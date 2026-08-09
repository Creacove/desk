import { describe, expect, it } from "vitest";
import { executeManagerConversationTool } from "../supabase/functions/_shared/manager-conversation/toolExecutor";

type QueryState = { table: string; columns: string; filters: Array<[string, unknown]>; updates?: Record<string, unknown> };

class QueryDouble {
  state: QueryState;

  constructor(state: QueryState, private readonly rows: unknown[]) {
    this.state = state;
  }

  select(columns: string) { this.state.columns = columns; return this; }
  update(values: Record<string, unknown>) { this.state.updates = values; return this; }
  insert(values: Record<string, unknown>) { this.state.updates = values; return this; }
  eq(column: string, value: unknown) { this.state.filters.push([column, value]); return this; }
  order() { return this; }
  limit() { return this; }
  async maybeSingle() { return { data: this.rows[0] ?? null, error: null }; }
  then(resolve: (value: { data: unknown[]; error: null }) => unknown) { return Promise.resolve(resolve({ data: this.rows, error: null })); }
}

function dbWith(rows: unknown[]) {
  const states: QueryState[] = [];
  return {
    states,
    db: {
      from(table: string) {
        const state = { table, columns: "", filters: [] as Array<[string, unknown]> };
        states.push(state);
        return new QueryDouble(state, rows);
      },
    },
  };
}

const scope = { accountId: "account-1", artistWorkspaceId: "workspace-1", artistId: "artist-1" };

describe("Manager output tools", () => {
  it("lists Manager output metadata without embedding raw documents", async () => {
    const { db, states } = dbWith([{
      id: "output-1", output_type: "decision_package", subject_type: "music_item", subject_id: "song-1",
      summary: "Use a controlled proof loop.", render_json: { content: "private long document" }, created_at: "2026-08-02",
    }]);

    const result = await executeManagerConversationTool(db, scope, "query_manager_outputs", {});

    expect(states[0].columns).not.toContain("render_json");
    expect(result).toEqual(expect.objectContaining({ items: [expect.not.objectContaining({ render_json: expect.anything() })] }));
  });

  it("retrieves a bounded document section inside the current workspace scope", async () => {
    const { db, states } = dbWith([{
      id: "output-1", summary: "Short summary", render_json: { content: `Opening context\n\n${"x".repeat(9_000)}` },
    }]);

    const result = await executeManagerConversationTool(db, scope, "read_manager_output_section", {
      outputId: "output-1", query: "Opening", maxChars: 7000,
    }) as { status: string; content: string; truncated: boolean };

    expect(states[0].filters).toEqual(expect.arrayContaining([
      ["account_id", "account-1"], ["artist_workspace_id", "workspace-1"], ["artist_id", "artist-1"], ["id", "output-1"],
    ]));
    expect(result.status).toBe("found");
    expect(result.content.length).toBeLessThanOrEqual(7000);
    expect(result.truncated).toBe(true);
  });

  it("returns a neutral result when the scoped output is unavailable", async () => {
    const { db } = dbWith([]);

    await expect(executeManagerConversationTool(db, scope, "read_manager_output_section", { outputId: "other-workspace-output" }))
      .resolves.toEqual({ status: "not_found", outputId: "other-workspace-output" });
  });

  it("updates a focused song detail through the same metadata structure used by the Details surface", async () => {
    const { db, states } = dbWith([{ id: "song-1", metadata: { manual_details: { bpm: "98" } } }]);

    const result = await executeManagerConversationTool(db, {
      ...scope,
      musicSubject: { type: "music_item", id: "song-1" },
      conversationId: "conversation-1",
      runId: "run-1",
    }, "update_focused_music_metadata", {
      group: "Release metadata",
      label: "Tempo (BPM)",
      value: "102",
    }) as { status: string; subjectId: string; detail: { key: string; value: string } };

    expect(states.find((state) => state.table === "music_items")?.filters).toEqual(expect.arrayContaining([
      ["account_id", "account-1"], ["artist_workspace_id", "workspace-1"], ["artist_id", "artist-1"], ["id", "song-1"],
    ]));
    expect([...states].reverse().find((state) => state.table === "music_items" && state.updates)?.updates).toMatchObject({
      metadata: expect.objectContaining({
        manual_details: expect.objectContaining({ bpm: "98", tempo_bpm: "102" }),
        manual_detail_groups: expect.objectContaining({ tempo_bpm: "Release metadata" }),
      }),
    });
    expect([...states].reverse().find((state) => state.table === "music_items" && state.updates)?.columns).toBe("");
    expect(states.find((state) => state.table === "operating_events")?.updates).toMatchObject({
      event_type: "music_metadata_updated",
      target_id: "song-1",
      payload: expect.objectContaining({ source: "manager_conversation", conversationId: "conversation-1", runId: "run-1" }),
    });
    expect(result).toMatchObject({ status: "updated", subjectId: "song-1", detail: { key: "tempo_bpm", value: "102" } });
  });

  it("rejects a focused metadata write when no exact music subject is attached to the conversation", async () => {
    const { db } = dbWith([]);

    await expect(executeManagerConversationTool(db, scope, "update_focused_music_metadata", {
      group: "Release metadata",
      label: "Tempo (BPM)",
      value: "102",
    })).rejects.toThrow("focused music conversation");
  });

  it("updates the canonical song title when Manager confirms a title correction", async () => {
    const { db, states } = dbWith([{ id: "song-1", metadata: {} }]);

    await executeManagerConversationTool(db, {
      ...scope,
      musicSubject: { type: "music_item", id: "song-1" },
    }, "update_focused_music_metadata", {
      group: "Song identity",
      label: "Song title",
      value: "After Midnight",
    });

    expect([...states].reverse().find((state) => state.table === "music_items" && state.updates)?.updates).toMatchObject({
      title: "After Midnight",
      metadata: expect.objectContaining({ manual_details: expect.objectContaining({ song_title: "After Midnight" }) }),
    });
  });

  it("does not treat a released manual song as an unfinished pre-release checklist", async () => {
    const { db } = dbWith([{
      id: "song-released",
      title: "Already Out",
      lifecycle_stage: "released",
      released_at: "2026-07-18T00:00:00.000Z",
      metadata: {},
    }]);

    await expect(executeManagerConversationTool(db, {
      ...scope,
      musicSubject: { type: "music_item", id: "song-released" },
    }, "read_focused_release_readiness", {})).resolves.toMatchObject({
      mode: "post_release",
      blockers: [],
      nextFocus: expect.arrayContaining(["Monitor response and choose the next post-release move."]),
    });
  });

  it("queries only the identity columns that exist for the focused music record type", async () => {
    const { db, states } = dbWith([{
      id: "project-1",
      title: "The Night Project",
      project_type: "EP",
      lifecycle_stage: "production",
      metadata: {},
    }]);

    await executeManagerConversationTool(db, {
      ...scope,
      musicSubject: { type: "music_project", id: "project-1" },
    }, "read_focused_music_subject", {});

    const identityQuery = states.find((state) => state.table === "music_projects");
    expect(identityQuery?.columns).toContain("project_type");
    expect(identityQuery?.columns).not.toContain("item_type");
  });
});
