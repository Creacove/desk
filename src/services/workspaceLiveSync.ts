export type WorkspaceOperatingEvent = {
  id: string;
  artistWorkspaceId: string;
  eventType: string;
  createdAt: string;
  targetType?: string | null;
  targetId?: string | null;
  refreshScope?: string[] | null;
  displayMode?: "activity" | "toast" | "action" | null;
  summary: string;
};

export type WorkspaceInvalidation =
  | { scope: "workspace" }
  | { scope: "desk-brief" }
  | { scope: "activity" }
  | { scope: "music-list" }
  | { scope: "music-object"; id: string }
  | { scope: "mission-list" }
  | { scope: "mission"; id: string }
  | { scope: "conversation-list" }
  | { scope: "conversation"; id: string };

export type WorkspaceEventCursor = { createdAt: string; id: string };
type Cursor = WorkspaceEventCursor;

type WorkspaceLiveSyncOptions = {
  client: any;
  userId: string;
  workspaceId: string;
  storage?: Pick<Storage, "getItem" | "setItem">;
  onInvalidations: (invalidations: WorkspaceInvalidation[]) => void;
  onEvent?: (event: WorkspaceOperatingEvent) => void;
  onReconcile?: () => void | Promise<void>;
  onStatus?: (status: string) => void;
  coalesceMs?: number;
};

const EVENT_COLUMNS = "id,artist_workspace_id,event_type,created_at,target_type,target_id,refresh_scope,display_mode,summary";
const PAGE_SIZE = 50;
const MAX_PAGES = 3;

export function classifyWorkspaceEvent(event: WorkspaceOperatingEvent): WorkspaceInvalidation[] {
  const explicitScopes = (event.refreshScope ?? []).flatMap((scope) => invalidationsForScope(scope, event));
  if (explicitScopes.length) return mergeWorkspaceInvalidations([], explicitScopes);

  const eventType = event.eventType.toLowerCase();
  const legacy: WorkspaceInvalidation[] = [{ scope: "activity" }];
  if (/setup|workspace/.test(eventType)) legacy.push({ scope: "workspace" });
  if (/brief/.test(eventType)) legacy.push({ scope: "desk-brief" });
  if (/music|catalog|track|song|project|manager_read/.test(eventType)) {
    legacy.push(event.targetId && /music|track|song|project/.test(event.targetType ?? "")
      ? { scope: "music-object", id: event.targetId }
      : { scope: "music-list" });
  }
  if (/mission|task|checkpoint/.test(eventType)) {
    legacy.push({ scope: "mission-list" });
    if (event.targetId && event.targetType === "mission") legacy.push({ scope: "mission", id: event.targetId });
  }
  if (/conversation|message/.test(eventType)) {
    legacy.push({ scope: "conversation-list" });
    if (event.targetId && event.targetType === "conversation") legacy.push({ scope: "conversation", id: event.targetId });
  }
  return mergeWorkspaceInvalidations([], legacy);
}

export function mergeWorkspaceInvalidations(
  current: WorkspaceInvalidation[],
  next: WorkspaceInvalidation[],
): WorkspaceInvalidation[] {
  const merged = [...current];
  const keys = new Set(current.map(invalidationKey));
  for (const invalidation of next) {
    const key = invalidationKey(invalidation);
    if (!keys.has(key)) {
      keys.add(key);
      merged.push(invalidation);
    }
  }
  return merged;
}

export function createWorkspaceLiveSync(options: WorkspaceLiveSyncOptions) {
  const storage = options.storage ?? window.localStorage;
  const cursorKey = `ordersounds.activityCursor.v1:${options.userId}:${options.workspaceId}`;
  const coalesceMs = options.coalesceMs ?? 250;
  let cursor = readCursor(storage, cursorKey);
  let channel: any;
  let active = false;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingInvalidations: WorkspaceInvalidation[] = [];

  function accept(raw: Record<string, unknown>, defer = true) {
    const nextEvent = eventFromRow(raw);
    if (!active && defer) return;
    if (nextEvent.artistWorkspaceId !== options.workspaceId || !isAfterCursor(nextEvent, cursor)) return;
    cursor = { createdAt: nextEvent.createdAt, id: nextEvent.id };
    options.onEvent?.(nextEvent);
    pendingInvalidations = mergeWorkspaceInvalidations(pendingInvalidations, classifyWorkspaceEvent(nextEvent));
    if (defer) scheduleFlush();
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, coalesceMs);
  }

  function flush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = undefined;
    if (!pendingInvalidations.length) return;
    const next = pendingInvalidations;
    pendingInvalidations = [];
    options.onInvalidations(next);
  }

  async function catchUp() {
    let pagesRead = 0;
    let shouldReconcile = false;
    for (; pagesRead < MAX_PAGES; pagesRead += 1) {
      let query = options.client
        .from("operating_events")
        .select(EVENT_COLUMNS)
        .eq("artist_workspace_id", options.workspaceId);
      if (cursor) {
        query = query.or(`created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`);
      }
      const { data, error } = await query
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];
      for (const row of rows) accept(row, false);
      if (rows.length < PAGE_SIZE) break;
      if (pagesRead === MAX_PAGES - 1) shouldReconcile = true;
    }
    flush();
    if (shouldReconcile) {
      if (cursor) storage.setItem(cursorKey, JSON.stringify(cursor));
      await options.onReconcile?.();
    }
  }

  return {
    start() {
      if (active) return;
      active = true;
      channel = options.client
        .channel(`workspace-events:${options.workspaceId}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "operating_events",
          filter: `artist_workspace_id=eq.${options.workspaceId}`,
        }, (payload: { new: Record<string, unknown> }) => accept(payload.new))
        .subscribe((status: string) => options.onStatus?.(status));
    },
    stop() {
      if (!active) return;
      active = false;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = undefined;
      pendingInvalidations = [];
      if (channel) {
        if (options.client.removeChannel) void options.client.removeChannel(channel);
        else void channel.unsubscribe?.();
      }
      channel = undefined;
    },
    catchUp,
    flush,
  };
}

export async function loadWorkspaceActivityPage(
  client: any,
  workspaceId: string,
  before?: Cursor,
): Promise<WorkspaceOperatingEvent[]> {
  let query = client
    .from("operating_events")
    .select(EVENT_COLUMNS)
    .eq("artist_workspace_id", workspaceId)
    .not("display_mode", "is", null);
  if (before) {
    query = query.or(`created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`);
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(eventFromRow);
}

function invalidationsForScope(scopeValue: string, event: WorkspaceOperatingEvent): WorkspaceInvalidation[] {
  const scope = scopeValue.trim().toLowerCase();
  const [kind, embeddedId] = scope.split(":", 2);
  const id = embeddedId || event.targetId || "";
  switch (kind) {
    case "workspace": case "setup": return [{ scope: "workspace" }];
    case "desk": case "desk-brief": case "brief": return [{ scope: "desk-brief" }];
    case "activity": return [{ scope: "activity" }];
    case "music": case "catalog": case "music-list": return [{ scope: "music-list" }];
    case "music-object": return id ? [{ scope: "music-object", id }] : [{ scope: "music-list" }];
    case "missions": case "mission-list": return [{ scope: "mission-list" }];
    case "mission": return id ? [{ scope: "mission", id }] : [{ scope: "mission-list" }];
    case "conversations": case "conversation-list": return [{ scope: "conversation-list" }];
    case "conversation": return id ? [{ scope: "conversation", id }] : [{ scope: "conversation-list" }];
    default: return [];
  }
}

function invalidationKey(invalidation: WorkspaceInvalidation) {
  return "id" in invalidation ? `${invalidation.scope}:${invalidation.id}` : invalidation.scope;
}

function eventFromRow(row: Record<string, unknown>): WorkspaceOperatingEvent {
  return {
    id: String(row.id ?? ""),
    artistWorkspaceId: String(row.artist_workspace_id ?? row.artistWorkspaceId ?? ""),
    eventType: String(row.event_type ?? row.eventType ?? "workspace_activity"),
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    targetType: nullableString(row.target_type ?? row.targetType),
    targetId: nullableString(row.target_id ?? row.targetId),
    refreshScope: Array.isArray(row.refresh_scope ?? row.refreshScope)
      ? ((row.refresh_scope ?? row.refreshScope) as unknown[]).map(String)
      : [],
    displayMode: (row.display_mode ?? row.displayMode ?? null) as WorkspaceOperatingEvent["displayMode"],
    summary: String(row.summary ?? "Workspace activity updated."),
  };
}

function nullableString(value: unknown) {
  return value == null || value === "" ? null : String(value);
}

function readCursor(storage: Pick<Storage, "getItem">, key: string): Cursor | null {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "null");
    return parsed && typeof parsed.createdAt === "string" && typeof parsed.id === "string"
      ? { createdAt: parsed.createdAt, id: parsed.id }
      : null;
  } catch {
    return null;
  }
}

function isAfterCursor(event: WorkspaceOperatingEvent, cursor: Cursor | null) {
  if (!event.id || !event.createdAt) return false;
  if (!cursor) return true;
  return event.createdAt > cursor.createdAt || (event.createdAt === cursor.createdAt && event.id > cursor.id);
}
