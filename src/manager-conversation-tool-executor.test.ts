import { describe, expect, it } from "vitest";
import { executeManagerConversationTool } from "../supabase/functions/_shared/manager-conversation/toolExecutor";

type QueryState = { table: string; columns: string; filters: Array<[string, unknown]> };

class QueryDouble {
  state: QueryState;

  constructor(state: QueryState, private readonly rows: unknown[]) {
    this.state = state;
  }

  select(columns: string) { this.state.columns = columns; return this; }
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
});
