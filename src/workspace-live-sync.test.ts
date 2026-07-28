import { describe, expect, it, vi } from "vitest";

import { writeWorkspaceEvent } from "../supabase/functions/_shared/workspaceEvents";

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
