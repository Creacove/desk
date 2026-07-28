export type ResourceKey =
  | "workspace"
  | "desk-brief"
  | "activity"
  | "music-list"
  | `music-object:${string}`
  | "mission-list"
  | `mission:${string}`
  | "conversation-list"
  | `conversation:${string}`;

type Entry = {
  workspaceGeneration: number;
  resourceGeneration: number;
  hasValue: boolean;
  value?: unknown;
  loadedAt?: number;
  loader?: () => Promise<unknown>;
  inFlight?: Promise<unknown>;
  followUp?: Promise<unknown>;
};

export function createResourceRequestCoordinator() {
  const entries = new Map<string, Entry>();
  const workspaceGenerations = new Map<string, number>();

  function workspaceGeneration(workspaceId: string) {
    return workspaceGenerations.get(workspaceId) ?? 0;
  }

  function entryId(workspaceId: string, key: ResourceKey) {
    return `${workspaceId}\u0000${key}`;
  }

  function isCurrent(workspaceId: string, id: string, entry: Entry) {
    return entries.get(id) === entry && workspaceGeneration(workspaceId) === entry.workspaceGeneration;
  }

  function run<T>(workspaceId: string, id: string, entry: Entry, loader: () => Promise<T>): Promise<T> {
    const requestGeneration = entry.resourceGeneration;
    entry.loader = loader as () => Promise<unknown>;
    let request: Promise<T>;
    try {
      request = Promise.resolve(loader());
    } catch (error) {
      request = Promise.reject(error);
    }
    entry.inFlight = request;

    void request.then((value) => {
      if (isCurrent(workspaceId, id, entry) && entry.resourceGeneration === requestGeneration) {
        entry.value = value;
        entry.hasValue = true;
        entry.loadedAt = Date.now();
      }
    }).finally(() => {
      if (entry.inFlight === request) entry.inFlight = undefined;
    }).catch(() => undefined);

    return request;
  }

  function scheduleFollowUp<T>(workspaceId: string, id: string, entry: Entry): Promise<T> {
    if (entry.followUp) return entry.followUp as Promise<T>;
    const activeRequest = entry.inFlight ?? Promise.resolve();
    let followUp!: Promise<T>;
    followUp = activeRequest
      .catch(() => undefined)
      .then(() => {
        if (!isCurrent(workspaceId, id, entry)) {
          throw new Error("Workspace resource request was invalidated.");
        }
        if (entry.followUp === followUp) entry.followUp = undefined;
        return run(workspaceId, id, entry, entry.loader as () => Promise<T>);
      });
    entry.followUp = followUp;
    void followUp.catch(() => undefined);
    return followUp;
  }

  return {
    load<T>(workspaceId: string, key: ResourceKey, loader: () => Promise<T>): Promise<T> {
      const id = entryId(workspaceId, key);
      let entry = entries.get(id);
      if (!entry || entry.workspaceGeneration !== workspaceGeneration(workspaceId)) {
        entry = {
          workspaceGeneration: workspaceGeneration(workspaceId),
          resourceGeneration: 0,
          hasValue: false,
        };
        entries.set(id, entry);
      }

      entry.loader = loader as () => Promise<unknown>;
      if (entry.followUp) return entry.followUp as Promise<T>;
      if (entry.inFlight) return entry.inFlight as Promise<T>;
      if (entry.hasValue) return Promise.resolve(entry.value as T);
      return run(workspaceId, id, entry, loader);
    },

    invalidate(workspaceId: string, key: ResourceKey) {
      const id = entryId(workspaceId, key);
      const entry = entries.get(id);
      if (!entry) return;
      entry.resourceGeneration += 1;
      entry.hasValue = false;
      entry.value = undefined;
      entry.loadedAt = undefined;
      if (entry.inFlight && entry.loader) scheduleFollowUp(workspaceId, id, entry);
    },

    clearWorkspace(workspaceId: string) {
      workspaceGenerations.set(workspaceId, workspaceGeneration(workspaceId) + 1);
      const prefix = `${workspaceId}\u0000`;
      for (const id of entries.keys()) {
        if (id.startsWith(prefix)) entries.delete(id);
      }
    },
  };
}
