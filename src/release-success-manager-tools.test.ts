import { describe, expect, it } from "vitest";
import { managerConversationTools } from "../supabase/functions/_shared/manager-conversation/agentLoop";
import { executeManagerConversationTool } from "../supabase/functions/_shared/manager-conversation/toolExecutor";

type QueryCall = {
  table: string;
  columns: string;
  filters: Array<[string, unknown]>;
};

class ReleaseQuery {
  constructor(
    private readonly rows: unknown[],
    readonly call: QueryCall,
  ) {}

  select(columns: string) {
    this.call.columns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.call.filters.push([column, value]);
    return this;
  }

  in(column: string, value: unknown[]) {
    this.call.filters.push([column, value]);
    return this;
  }

  order() { return this; }
  limit() { return this; }

  async maybeSingle() {
    return { data: this.rows[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected);
  }
}

function releaseDb(rows: Record<string, unknown[]>, rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = []) {
  const calls: QueryCall[] = [];
  return {
    calls,
    rpcCalls,
    db: {
      from(table: string) {
        const call: QueryCall = { table, columns: "", filters: [] };
        calls.push(call);
        return new ReleaseQuery(rows[table] ?? [], call);
      },
      async rpc(name: string, args: Record<string, unknown>) {
        rpcCalls.push({ name, args });
        return {
          data: {
            id: "request-1",
            releasePlanId: "plan-1",
            musicItemId: "song-1",
            fromDate: "2026-08-26",
            proposedDate: "2026-09-09",
            status: "pending",
            expectedPlanRevision: 2,
            previewHash: "hash-1",
            preview: args.p_preview,
            expiresAt: "2026-08-12T23:59:00.000Z",
          },
          error: null,
        };
      },
    },
  };
}

const scope = { accountId: "account-1", artistWorkspaceId: "workspace-1", artistId: "artist-1" };
const subject = { type: "music_item" as const, id: "song-1" };

const releaseRows = {
  music_items: [{
    id: "song-1",
    title: "After Midnight",
    item_type: "song",
    lifecycle_stage: "ready",
    planned_release_date: "2026-08-26",
    released_at: null,
    rights_state: "declared",
    metadata: {
      manual_details: { genre: "Afrobeats", mood: "late-night" },
      release_success: {
        campaign: { spotifyEditorialEnabled: true, independentPlaylistsEnabled: true, pressEnabled: true, contentEnabled: true },
        clearances: { state: "confirmed", source: "artist_declaration" },
      },
      distributor: { state: "pending", source: "artist_workspace" },
    },
  }],
  music_release_plans: [{
    id: "plan-1",
    music_item_id: "song-1",
    mission_id: "mission-1",
    status: "approved",
    approved_release_date: "2026-08-26",
    revision: 2,
  }],
  missions: [{ id: "mission-1", title: "Release Success Mission", status: "active", pattern_name: "release_planning" }],
  tasks: [{
    id: "task-1",
    mission_id: "mission-1",
    title: "Distributor delivery",
    status: "active",
    deadline: "2026-08-14T00:00:00.000Z",
    schedule_key: "distributor_delivery",
  }],
  release_task_schedule_bindings: [{
    task_id: "task-1",
    offset_days: -12,
    active: true,
    applied_plan_revision: 2,
  }],
  music_assets: [
    { id: "asset-master", asset_type: "final_master", title: "Final master", status: "uploaded" },
    { id: "asset-art", asset_type: "cover_art", title: "Cover art", status: "confirmed" },
  ],
  music_credits: [{ id: "credit-1", role: "Producer", name: "Ada", status: "confirmed" }],
  music_splits: [{ id: "split-1", status: "cleared", summary: "All collaborators confirmed" }],
  music_identifiers: [{ id: "identifier-1", identifier_type: "isrc", identifier_value: "NG-AAA-26-00001", confidence: "high" }],
  artifact_links: [
    { source_type: "document", target_type: "music_item", target_id: "song-1", relationship: "references", source_id: "document-1" },
    { source_type: "document", target_type: "music_item", target_id: "song-1", relationship: "references", source_id: "document-2" },
    { source_type: "release_opportunity", target_type: "music_item", target_id: "song-1", relationship: "references", source_id: "playlist-1" },
    { source_type: "release_opportunity", target_type: "music_item", target_id: "song-1", relationship: "references", source_id: "press-1" },
  ],
  manager_outputs: [],
};

describe("release success Manager tools", () => {
  it("exposes strict focused read and proposal tools without exposing approval", () => {
    const names = managerConversationTools
      .filter((tool) => tool.type === "function")
      .map((tool) => tool.name);
    expect(names).toContain("read_focused_release_success");
    expect(names).toContain("propose_focused_release_date_change");
    expect(names).not.toContain("approve_focused_release_date_change");

    const readTool = managerConversationTools.find((tool) => tool.type === "function" && tool.name === "read_focused_release_success");
    expect(readTool).toMatchObject({
      type: "function",
      strict: true,
      parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
    });

    const proposalTool = managerConversationTools.find((tool) => tool.type === "function" && tool.name === "propose_focused_release_date_change");
    expect(proposalTool).toMatchObject({
      type: "function",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["proposedDate", "reason"],
      },
    });
    expect(JSON.stringify(proposalTool)).not.toContain("accountId");
    expect(JSON.stringify(proposalTool)).not.toContain("workspaceId");
  });

  it("returns one scoped normalized release packet with dates, mission schedule, evidence, and opportunity counts", async () => {
    const { db, calls } = releaseDb(releaseRows);

    const result = await executeManagerConversationTool(db, { ...scope, musicSubject: subject }, "read_focused_release_success", {}) as any;

    expect(result).toMatchObject({
      status: "found",
      packet: {
        musicItem: { id: "song-1", title: "After Midnight", itemType: "song" },
        providerReleaseDate: "2026-08-26",
        approvedReleaseDate: "2026-08-26",
        releasePlanId: "plan-1",
        releasePlanRevision: 2,
        mission: { id: "mission-1", title: "Release Success Mission" },
        activeTasks: [expect.objectContaining({ id: "task-1", scheduleKey: "distributor_delivery" })],
        scheduleBindings: [expect.objectContaining({ taskId: "task-1", offsetDays: -12 })],
        assets: { finalMaster: expect.objectContaining({ state: "uploaded" }), artwork: expect.objectContaining({ state: "confirmed" }) },
        assetsRead: expect.arrayContaining([expect.objectContaining({ assetType: "final_master" })]),
        credits: expect.objectContaining({ state: "confirmed" }),
        creditsRead: expect.arrayContaining([expect.objectContaining({ role: "Producer" })]),
        splits: expect.objectContaining({ state: "confirmed" }),
        splitsRead: expect.arrayContaining([expect.objectContaining({ status: "cleared" })]),
        identifiers: expect.objectContaining({ state: "confirmed" }),
        identifiersRead: expect.arrayContaining([expect.objectContaining({ type: "isrc" })]),
        clearances: expect.objectContaining({ state: "confirmed" }),
        distributor: expect.objectContaining({ state: "pending" }),
        canonicalDocuments: { count: 2 },
        opportunityCounts: { playlist: 1, press: 1 },
        assessment: expect.objectContaining({ musicItemId: "song-1", foundation: expect.any(Object) }),
      },
    });
    expect(result.packet).not.toHaveProperty("workspace");
    expect(result.packet).not.toHaveProperty("unrelatedWorkspace");
    expect(calls.every((call) => call.filters.some(([key]) => key === "account_id"))).toBe(true);
    expect(calls.map((call) => call.table)).not.toContain("music_projects");
  });

  it("creates a preview proposal only for the attached unreleased song and never applies it", async () => {
    const { db, rpcCalls } = releaseDb(releaseRows);

    const result = await executeManagerConversationTool(db, { ...scope, musicSubject: subject }, "propose_focused_release_date_change", {
      proposedDate: "2026-09-09",
      reason: "The press package and playlist outreach need a clean runway.",
    }) as any;

    expect(result).toMatchObject({ status: "proposed", request: { id: "request-1", preview: expect.any(Object) } });
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("propose_release_date_change");
    expect(rpcCalls[0].name).not.toBe("approve_release_date_change");
    expect(rpcCalls[0].args).toMatchObject({ p_music_item_id: "song-1", p_proposed_date: "2026-09-09" });
  });

  it("rejects release tools without an attached subject and does not treat rough mixes as final masters", async () => {
    const { db } = releaseDb({
      ...releaseRows,
      music_assets: [{ id: "asset-rough", asset_type: "rough_mix", title: "Rough mix", status: "uploaded" }],
    });

    await expect(executeManagerConversationTool(db, scope, "read_focused_release_success", {}))
      .rejects.toThrow("focused music conversation");
    const result = await executeManagerConversationTool(db, { ...scope, musicSubject: subject }, "read_focused_release_success", {}) as any;
    expect(result.packet.assessment.foundation.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "final_master", state: "unknown" }),
    ]));
  });
});
