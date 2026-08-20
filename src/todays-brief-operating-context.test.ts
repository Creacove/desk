import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTodaysBriefModelPacket } from "../supabase/functions/_shared/manager-intelligence/brief/briefPacketProjection";
import {
  loadTodaysBriefOperatingContext,
  maybeRefreshChartmetricArtistForTodaysBrief,
  TODAYS_BRIEF_CONTEXT_TEXT_LIMIT,
} from "../supabase/functions/_shared/todaysBriefOperatingContext";

type QueryRecord = {
  table: string;
  filters: Array<[string, unknown]>;
  limit?: number;
};

function createFakeDb(rowsByTable: Record<string, unknown[]>, queries: QueryRecord[]) {
  return {
    from(table: string) {
      const state: QueryRecord = { table, filters: [] };
      const rows = rowsByTable[table] ?? [];
      const recordQuery = () => queries.push({ ...state, filters: [...state.filters] });
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          state.filters.push([column, value]);
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          state.filters.push([column, values]);
          return builder;
        },
        order: () => builder,
        limit: (value: number) => {
          state.limit = value;
          return builder;
        },
        maybeSingle: async () => {
          recordQuery();
          return { data: rows[0] ?? null, error: null };
        },
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          recordQuery();
          const data = typeof state.limit === "number" ? rows.slice(0, state.limit) : rows;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

const input = {
  accountId: "account-1",
  artistWorkspaceId: "workspace-1",
  artistId: "artist-1",
};

describe("Today's Brief operating context", () => {
  it("keeps current workspace context bounded and scoped before model projection", async () => {
    const longText = "x".repeat(TODAYS_BRIEF_CONTEXT_TEXT_LIMIT * 3);
    const queries: QueryRecord[] = [];
    const context = await loadTodaysBriefOperatingContext(
      createFakeDb(
        {
          missions: [{ id: "mission-1", title: "Release", status: "active", summary: longText, created_at: "2026-08-20T10:00:00Z" }],
          tasks: [{ id: "task-1", mission_id: "mission-1", title: "Approve master", status: "blocked", dependency: longText, created_at: "2026-08-20T09:00:00Z" }],
          conversations: [{ id: "conversation-1", topic: "Release decision", status: "open", summary: longText, created_at: "2026-08-20T08:00:00Z" }],
          conversation_messages: [{ id: "message-1", conversation_id: "conversation-1", body: longText, speaker: "artist", created_at: "2026-08-20T08:30:00Z" }],
          memory_entries: [{ id: "memory-1", content: longText, scope: "artist", kind: "preference", created_at: "2026-08-20T07:00:00Z" }],
          agent_reports: [{ id: "report-1", summary: longText, finding: longText, created_at: "2026-08-20T06:00:00Z" }],
          operating_events: [{ id: "event-1", event_type: "song_updated", summary: longText, payload: { detail: longText }, created_at: "2026-08-20T05:00:00Z" }],
          manager_outputs: [{ id: "read-1", output_type: "song_manager_read", summary: longText, render_json: { managerRead: longText }, created_at: "2026-08-20T04:00:00Z" }],
          music_items: [{ id: "song-1", title: "Current Song", status: "active", metadata: { detail: longText }, created_at: "2026-08-20T03:00:00Z" }],
          music_projects: [{ id: "project-1", title: "Current Project", status: "active", metadata: { detail: longText }, created_at: "2026-08-20T02:00:00Z" }],
          music_splits: [{ id: "split-1", music_item_id: "song-1", status: "missing", summary: longText, created_at: "2026-08-20T01:00:00Z" }],
          music_split_contributors: [{ id: "contributor-1", music_split_id: "split-1", name: "Writer", role: "writer", created_at: "2026-08-20T00:00:00Z" }],
        },
        queries,
      ),
      input,
    );

    expect(context.activeMissions[0].summary.length).toBeLessThanOrEqual(TODAYS_BRIEF_CONTEXT_TEXT_LIMIT);
    expect(context.priorityTasks[0].dependency.length).toBeLessThanOrEqual(TODAYS_BRIEF_CONTEXT_TEXT_LIMIT);
    expect(context.recentConversations[0].recentMessages[0].body.length).toBeLessThanOrEqual(TODAYS_BRIEF_CONTEXT_TEXT_LIMIT);
    expect((context.meaningfulEvents[0].payload as Record<string, string>).detail.length).toBeLessThanOrEqual(TODAYS_BRIEF_CONTEXT_TEXT_LIMIT);
    expect((context.currentMusic.songs[0].metadata as Record<string, string>).detail.length).toBeLessThanOrEqual(TODAYS_BRIEF_CONTEXT_TEXT_LIMIT);

    for (const query of queries) {
      expect(query.filters).toEqual(expect.arrayContaining([
        ["account_id", input.accountId],
        ["artist_workspace_id", input.artistWorkspaceId],
        ["artist_id", input.artistId],
      ]));
    }
  });

  it("reuses a cached Chartmetric identity after 24 hours and preserves last-known-good evidence on failure", async () => {
    const queries: QueryRecord[] = [];
    const db = createFakeDb(
      {
        source_sync_jobs: [{
          id: "job-1",
          completed_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
          source_connection_id: "connection-1",
        }],
        source_connections: [{ metadata: { chartmetric_artist_id: "cm-123" } }],
      },
      queries,
    );
    const originalFetch = globalThis.fetch;
    const requests: Array<{ body: Record<string, unknown>; headers: Headers }> = [];

    try {
      globalThis.fetch = (async (_input, init) => {
        requests.push({
          body: JSON.parse(String(init?.body)),
          headers: new Headers(init?.headers),
        });
        return new Response("{}", { status: 200 });
      }) as typeof fetch;

      await expect(maybeRefreshChartmetricArtistForTodaysBrief({
        db,
        input,
        authHeader: "Bearer artist-token",
        supabaseUrl: "https://desk.example",
      })).resolves.toMatchObject({ attempted: true, refreshed: true, reason: "refreshed" });

      expect(requests[0].body).toMatchObject({
        ...input,
        sourceConnectionId: "connection-1",
        chartmetricArtistId: "cm-123",
        skipTodaysBriefHandoff: true,
      });
      expect(requests[0].headers.get("authorization")).toBe("Bearer artist-token");

      globalThis.fetch = (async () => new Response("upstream unavailable", { status: 503 })) as typeof fetch;
      await expect(maybeRefreshChartmetricArtistForTodaysBrief({
        db,
        input,
        authHeader: "Bearer artist-token",
        supabaseUrl: "https://desk.example",
      })).resolves.toMatchObject({ attempted: true, refreshed: false, reason: "failed" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("bounds persisted operating context again at the model-packet boundary", () => {
    const longText = "x".repeat(TODAYS_BRIEF_CONTEXT_TEXT_LIMIT * 3);
    const modelPacket = buildTodaysBriefModelPacket({
      profile: { artistName: "Mavo", genres: [], socialHandles: {} },
      workingCatalog: {
        scopeLabel: "working catalog in view",
        projectCount: 0,
        songCount: 0,
        latestProjectTitles: [],
        focusSongTitles: [],
        note: "Current music in view.",
      },
      intelligenceSnapshotInputs: [],
      derivedInsights: [],
      sourceLimits: [],
      generatedFor: "manual",
    }, {
      internal_only_json: {
        operating_context: {
          version: "todays_brief_operating_context_v1",
          activeMissions: [{ id: "mission-1", summary: longText }],
          currentMusic: { songs: [{ id: "song-1", metadata: { detail: longText } }], projects: [] },
        },
      },
    });

    const context = modelPacket.operatingContext as {
      activeMissions: Array<{ summary: string }>;
      currentMusic: { songs: Array<{ metadata: { detail: string } }> };
    };
    expect(context.activeMissions[0].summary.length).toBeLessThanOrEqual(TODAYS_BRIEF_CONTEXT_TEXT_LIMIT);
    expect(context.currentMusic.songs[0].metadata.detail.length).toBeLessThanOrEqual(TODAYS_BRIEF_CONTEXT_TEXT_LIMIT);
  });

  it("scopes Chartmetric identity persistence to the authenticated source connection", () => {
    const source = readFileSync(
      join(process.cwd(), "supabase", "functions", "chartmetric-artist-enrichment", "index.ts"),
      "utf8",
    );
    const start = source.indexOf("async function persistResolvedChartmetricArtistId");
    const end = source.indexOf("async function loadArtistProfile", start);
    const persistence = source.slice(start, end);

    expect(source).toContain("const sourceConnection = sourceConnectionId && !queuedJob.sourceConnectionId");
    expect(persistence).toContain("input.accountId");
    expect(persistence).toContain("input.artistWorkspaceId");
    expect(persistence).toContain("input.artistId");
    expect(persistence).toContain('.eq("id", sourceConnectionId)');
    expect(persistence).toContain('.select("id")');
    expect(persistence).toContain("source connection was not found in the current artist scope");
  });
});
