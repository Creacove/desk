import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { writeWorkspaceEvent } from "../supabase/functions/_shared/workspaceEvents";
import {
  classifyWorkspaceEvent,
  createWorkspaceLiveSync,
  mergeWorkspaceInvalidations,
  type WorkspaceOperatingEvent,
} from "./services/workspaceLiveSync";
import { useWorkspaceLiveSync } from "./app/useWorkspaceLiveSync";

function insertDb(result: { data: { id: string } | null; error: unknown }) {
  const maybeSingle = vi.fn(async () => result);
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const upsert = vi.fn(() => ({ select }));
  return { db: { from: vi.fn(() => ({ insert, upsert })) }, insert, upsert };
}

const baseInput = {
  accountId: "account-a",
  artistWorkspaceId: "workspace-a",
  artistId: "artist-a",
  eventType: "manager_read_completed",
  summary: "Manager Read completed",
};

describe("writeWorkspaceEvent", () => {
  it("bounds visible summaries, refresh scopes, and provider payload fields", async () => {
    const { db, insert } = insertDb({ data: { id: "event-a" }, error: null });
    const id = await writeWorkspaceEvent(db, {
      ...baseInput,
      summary: `  ${"x".repeat(400)}\u0000  `,
      displayMode: "toast",
      refreshScope: ["desk", "music", "missions", "conversations", "activity", "brief", "profile", "setup", "ignored"],
      payload: { safe: "yes", providerBody: "secret", nested: { rawProviderBody: "secret", useful: true } },
    });

    expect(id).toBe("event-a");
    const row = insert.mock.calls[0][0];
    expect(row.summary.length).toBeLessThanOrEqual(280);
    expect(row.summary).not.toContain("\u0000");
    expect(row.refresh_scope).toHaveLength(8);
    expect(row.payload).toEqual({ safe: "yes", nested: { useful: true } });
  });

  it("uses a conflict-safe insert when a dedupe key is present", async () => {
    const { db, insert, upsert } = insertDb({ data: { id: "event-a" }, error: null });
    await writeWorkspaceEvent(db, { ...baseInput, dedupeKey: "manager-read:run-a" });

    expect(insert).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ dedupe_key: "manager-read:run-a" }), {
      onConflict: "artist_workspace_id,dedupe_key",
      ignoreDuplicates: true,
    });
  });

  it("leaves audit-only events without a display mode", async () => {
    const { db, insert } = insertDb({ data: { id: "event-a" }, error: null });
    await writeWorkspaceEvent(db, baseInput);
    expect(insert.mock.calls[0][0].display_mode).toBeNull();
  });
});

const event = (overrides: Partial<WorkspaceOperatingEvent> = {}): WorkspaceOperatingEvent => ({
  id: "event-1",
  artistWorkspaceId: "workspace-a",
  eventType: "manager_read_completed",
  createdAt: "2026-07-28T10:00:00.000Z",
  targetType: "music_item",
  targetId: "song-a",
  refreshScope: [],
  displayMode: "activity",
  summary: "Manager Read completed",
  ...overrides,
});

describe("workspace live sync", () => {
  afterEach(() => vi.useRealTimers());

  it("prefers explicit refresh scopes and merges duplicate invalidations", () => {
    expect(classifyWorkspaceEvent(event({ refreshScope: ["activity", "music-object", "conversation-list"] }))).toEqual([
      { scope: "activity" },
      { scope: "music-object", id: "song-a" },
      { scope: "conversation-list" },
    ]);
    expect(mergeWorkspaceInvalidations(
      [{ scope: "activity" }, { scope: "music-object", id: "song-a" }],
      [{ scope: "activity" }, { scope: "music-object", id: "song-b" }],
    )).toEqual([
      { scope: "activity" },
      { scope: "music-object", id: "song-a" },
      { scope: "music-object", id: "song-b" },
    ]);
  });

  it("uses one filtered channel and coalesces an event burst", async () => {
    vi.useFakeTimers();
    let insertHandler: ((payload: { new: Record<string, unknown> }) => void) | undefined;
    const unsubscribe = vi.fn();
    const channel = {
      on: vi.fn((_kind, filter, handler) => {
        expect(filter).toEqual(expect.objectContaining({
          event: "INSERT", schema: "public", table: "operating_events", filter: "artist_workspace_id=eq.workspace-a",
        }));
        insertHandler = handler;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
      unsubscribe,
    };
    const client = { channel: vi.fn(() => channel) };
    const onInvalidations = vi.fn();
    const onEvent = vi.fn();
    const sync = createWorkspaceLiveSync({
      client,
      userId: "user-a",
      workspaceId: "workspace-a",
      storage: memoryStorage(),
      onInvalidations,
      onEvent,
    });

    sync.start();
    sync.start();
    expect(client.channel).toHaveBeenCalledWith("workspace-events:workspace-a");
    expect(client.channel).toHaveBeenCalledTimes(1);
    insertHandler?.({ new: event() as unknown as Record<string, unknown> });
    insertHandler?.({ new: event() as unknown as Record<string, unknown> });
    insertHandler?.({ new: event({ id: "event-2", createdAt: "2026-07-28T10:00:01.000Z" }) as unknown as Record<string, unknown> });
    insertHandler?.({ new: event({ id: "event-0", createdAt: "2026-07-28T09:59:59.000Z" }) as unknown as Record<string, unknown> });
    insertHandler?.({ new: event({ id: "wrong-workspace", artistWorkspaceId: "workspace-b", createdAt: "2026-07-28T10:00:02.000Z" }) as unknown as Record<string, unknown> });
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onInvalidations).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(onInvalidations).toHaveBeenCalledTimes(1);
    expect(onInvalidations).toHaveBeenCalledWith(expect.arrayContaining([
      { scope: "activity" }, { scope: "music-object", id: "song-a" },
    ]));

    sync.stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    insertHandler?.({ new: event({ id: "event-3", createdAt: "2026-07-28T10:00:02.000Z" }) as unknown as Record<string, unknown> });
    await vi.advanceTimersByTimeAsync(250);
    expect(onInvalidations).toHaveBeenCalledTimes(1);
  });

  it("dedupes old events and bounds catch-up to three pages of fifty", async () => {
    const pages = [0, 1, 2].map((page) => Array.from({ length: 50 }, (_, index) => event({
      id: `event-${page}-${index}`,
      createdAt: `2026-07-28T10:${String(page).padStart(2, "0")}:${String(index).padStart(2, "0")}.000Z`,
    })));
    let page = 0;
    const limit = vi.fn(async () => ({ data: pages[page++] ?? [], error: null }));
    const builder: any = { select: () => builder, eq: () => builder, or: () => builder, order: () => builder, limit };
    const onReconcile = vi.fn(async () => undefined);
    const onInvalidations = vi.fn();
    const storage = memoryStorage();
    const sync = createWorkspaceLiveSync({
      client: { from: vi.fn(() => builder), channel: vi.fn() },
      userId: "user-a",
      workspaceId: "workspace-a",
      storage,
      onInvalidations,
      onReconcile,
    });

    await sync.catchUp();
    expect(limit).toHaveBeenCalledTimes(3);
    expect(limit).toHaveBeenCalledWith(50);
    expect(onReconcile).toHaveBeenCalledTimes(1);
    expect(onInvalidations).toHaveBeenCalled();
    expect(JSON.parse(storage.getItem("ordersounds.workspaceSyncCursor.v1:user-a:workspace-a")!)).toEqual({
      createdAt: pages[2][49].createdAt,
      id: pages[2][49].id,
    });
    expect(storage.getItem("ordersounds.activityCursor.v1:user-a:workspace-a")).toBeNull();
  });
});

describe("useWorkspaceLiveSync", () => {
  it("does not subscribe when the rollout gate is disabled", () => {
    const client = { channel: vi.fn() };
    renderHook(() => useWorkspaceLiveSync({
      enabled: false,
      client,
      userId: "user-a",
      workspaceId: "workspace-a",
      coordinator: { invalidate: vi.fn(), clearWorkspace: vi.fn() },
      onInvalidations: vi.fn(),
    }));
    expect(client.channel).not.toHaveBeenCalled();
  });

  it("subscribes once, catches up on channel health, and unsubscribes on unmount", async () => {
    const unsubscribe = vi.fn();
    const channel: any = {
      on: vi.fn(() => channel),
      subscribe: vi.fn((callback) => {
        callback("SUBSCRIBED");
        return channel;
      }),
      unsubscribe,
    };
    const limit = vi.fn(async () => ({ data: [], error: null }));
    const builder: any = { select: () => builder, eq: () => builder, or: () => builder, order: () => builder, limit };
    const clearWorkspace = vi.fn();
    const coordinator = { invalidate: vi.fn(), clearWorkspace };
    const client = { channel: vi.fn(() => channel), from: vi.fn(() => builder) };
    const rendered = renderHook(() => useWorkspaceLiveSync({
      enabled: true,
      client,
      userId: "user-a",
      workspaceId: "workspace-a",
      coordinator,
      onInvalidations: vi.fn(),
    }));

    await waitFor(() => expect(rendered.result.current.status).toBe("Up to date"));
    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledTimes(1);
    rendered.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(clearWorkspace).toHaveBeenCalledWith("workspace-a");
  });

  it("does not fetch while offline and catches up when connectivity returns", async () => {
    const originalOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const channel: any = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel), unsubscribe: vi.fn() };
    const limit = vi.fn(async () => ({ data: [], error: null }));
    const builder: any = { select: () => builder, eq: () => builder, or: () => builder, order: () => builder, limit };
    const coordinator = { invalidate: vi.fn(), clearWorkspace: vi.fn() };
    const rendered = renderHook(() => useWorkspaceLiveSync({
      enabled: true,
      client: { channel: vi.fn(() => channel), from: vi.fn(() => builder) },
      userId: "user-a",
      workspaceId: "workspace-a",
      coordinator,
      onInvalidations: vi.fn(),
    }));
    expect(rendered.result.current.status).toBe("Offline — updates resume when you're back");
    expect(limit).not.toHaveBeenCalled();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await act(async () => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(limit).toHaveBeenCalledTimes(1));
    rendered.unmount();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: originalOnline });
  });

  it("defers event-driven reads while hidden and flushes them when visible", async () => {
    vi.useFakeTimers();
    const originalVisibility = document.visibilityState;
    let handler: ((payload: { new: Record<string, unknown> }) => void) | undefined;
    const channel: any = {
      on: vi.fn((_kind, _filter, nextHandler) => { handler = nextHandler; return channel; }),
      subscribe: vi.fn(() => channel),
      unsubscribe: vi.fn(),
    };
    const onInvalidations = vi.fn();
    const coordinator = { invalidate: vi.fn(), clearWorkspace: vi.fn() };
    const rendered = renderHook(() => useWorkspaceLiveSync({
      enabled: true,
      client: { channel: vi.fn(() => channel), from: vi.fn() },
      userId: "user-a",
      workspaceId: "workspace-a",
      coordinator,
      onInvalidations,
    }));

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    handler?.({ new: event() as unknown as Record<string, unknown> });
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(onInvalidations).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(onInvalidations).toHaveBeenCalledTimes(1);
    rendered.unmount();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: originalVisibility });
  });
});

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}
