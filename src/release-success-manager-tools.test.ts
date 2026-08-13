import { describe, expect, it, vi } from "vitest";
import { managerConversationTools, selectManagerConversationToolsForTurn } from "../supabase/functions/_shared/manager-conversation/agentLoop";
import { buildManagerConversationInstructions } from "../supabase/functions/_shared/openaiManagerConversation";
import { executeManagerConversationTool } from "../supabase/functions/_shared/manager-conversation/toolExecutor";
import { verifyOpportunityPublicContact } from "../supabase/functions/_shared/release-success/opportunities";

type QueryCall = {
  table: string;
  columns: string;
  filters: Array<[string, unknown]>;
};

type WriteCall = {
  table: string;
  mode: "insert" | "upsert" | "update";
  rows?: unknown[];
  values?: Record<string, unknown>;
  options?: Record<string, unknown>;
};

class ReleaseQuery {
  constructor(
    private readonly rows: unknown[],
    readonly call: QueryCall,
    private readonly writes: WriteCall[],
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

  insert(value: Record<string, unknown> | Record<string, unknown>[]) {
    this.writes.push({ table: this.call.table, mode: "insert", rows: Array.isArray(value) ? value : [value] });
    return this;
  }

  upsert(value: Record<string, unknown> | Record<string, unknown>[], options?: Record<string, unknown>) {
    this.writes.push({ table: this.call.table, mode: "upsert", rows: Array.isArray(value) ? value : [value], options });
    return this;
  }

  update(values: Record<string, unknown>) {
    this.writes.push({ table: this.call.table, mode: "update", values });
    return this;
  }

  order() { return this; }
  limit() { return this; }

  async single() {
    const write = [...this.writes].reverse().find((item) => item.table === this.call.table);
    const first = write?.rows?.[0] && typeof write.rows[0] === "object" ? write.rows[0] as Record<string, unknown> : {};
    return { data: { id: first.id ?? `${this.call.table}-created`, ...first }, error: null };
  }

  async maybeSingle() {
    const write = [...this.writes].reverse().find((item) => item.table === this.call.table);
    const first = write?.rows?.[0] && typeof write.rows[0] === "object" ? write.rows[0] as Record<string, unknown> : null;
    return { data: this.rows[0] ?? (first ? { id: first.id ?? `${this.call.table}-created`, ...first } : write ? { id: `${this.call.table}-created` } : null), error: null };
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
  const writes: WriteCall[] = [];
  return {
    calls,
    rpcCalls,
    writes,
    db: {
      from(table: string) {
        const call: QueryCall = { table, columns: "", filters: [] };
        calls.push(call);
        return new ReleaseQuery(rows[table] ?? [], call, writes);
      },
      async rpc(name: string, args: Record<string, unknown>) {
        rpcCalls.push({ name, args });
        if (name === "persist_focused_song_document_v1") {
          return {
            data: {
              documentId: "document-created",
              versionId: "version-created",
              musicItemId: "song-1",
              missionId: "mission-1",
              documentType: args.p_document_type,
              title: args.p_title,
              status: "draft",
              created: true,
            },
            error: null,
          };
        }
        return {
          data: {
            requestId: "request-1",
            idempotencyKey: args.p_idempotency_key,
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

const opportunityCandidate = {
  opportunityType: "playlist",
  platform: "Independent playlist",
  targetName: "Night Drive Selects",
  sourceUrl: "https://example.com/playlists/night-drive-selects/",
  targetUrl: "https://example.com/playlists/night-drive-selects",
  publicOrganization: "Example Music Curation",
  publicContact: {
    kind: "submission_form",
    value: "https://example.com/submit",
    sourceUrl: "https://example.com/contact",
    verifiedAt: "2026-08-12T10:00:00.000Z",
  },
  fit: {
    songCriteria: ["alt-r&b and late-night mood"],
    targetCriteria: ["the playlist documents late-night independent R&B"],
    explanation: "After Midnight matches the alt-r&b late-night mood, and this target documents a compatible independent R&B lane.",
    recency: "Updated this month",
    market: "Lagos",
  },
  sourceEvidence: [
    { source: "Playlist page", ref: "https://example.com/playlists/night-drive-selects", observedAt: "2026-08-12T09:00:00.000Z" },
  ],
  confidence: "high",
  limitations: ["No placement guarantee."],
  requirements: ["Use the public submission form."],
  paidPlacementClaim: false,
};

const verifiedContactFetch = vi.fn(async () => ({
  ok: true,
  headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "text/html" : null },
  text: async () => '<a href="https://example.com/submit">Submit music</a>',
}) as Response);

describe("release success Manager tools", () => {
  it("does not expose release writes unless the turn targets an attached unreleased song", () => {
    const unrelated = selectManagerConversationToolsForTurn({ body: "Help me understand my audience", hasAttachedUnreleasedSong: true });
    const released = selectManagerConversationToolsForTurn({ body: "Plan this release", hasAttachedUnreleasedSong: false });
    for (const tools of [unrelated, released]) {
      const names = tools.filter((tool) => tool.type === "function").map((tool) => tool.name);
      expect(names).not.toContain("propose_focused_release_date_change");
      expect(names).not.toContain("save_focused_release_opportunities");
      expect(names).not.toContain("create_focused_song_document");
    }
  });

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

  it("exposes strict playlist and press research tools with web search but no approval or sending authority", () => {
    const names = managerConversationTools
      .filter((tool) => tool.type === "function")
      .map((tool) => tool.name);
    expect(managerConversationTools).toContainEqual({ type: "web_search" });
    expect(names).toEqual(expect.arrayContaining([
      "query_focused_release_opportunities",
      "save_focused_release_opportunities",
      "record_focused_release_opportunity_outcome",
      "create_focused_song_document",
    ]));
    expect(names).not.toContain("approve_focused_release_date_change");
    expect(names.some((name) => /send|email|submit/i.test(name))).toBe(false);

    for (const name of [
      "query_focused_release_opportunities",
      "save_focused_release_opportunities",
      "record_focused_release_opportunity_outcome",
      "create_focused_song_document",
    ]) {
      expect(managerConversationTools.find((tool) => tool.type === "function" && tool.name === name)).toMatchObject({
        type: "function",
        strict: true,
        parameters: { type: "object", additionalProperties: false },
      });
    }

    const instructions = buildManagerConversationInstructions();
    expect(instructions).toContain("Spotify editorial route");
    expect(instructions).toContain("independent playlist outreach");
    expect(instructions).toContain("public source and contact provenance");
    expect(instructions).toContain("never send, submit, or claim placement");
  });

  it("queries only the attached song and returns evidence-backed playlist or press research context", async () => {
    const { db, calls } = releaseDb({
      ...releaseRows,
      evidence_items: [{
        id: "evidence-1",
        music_item_id: "song-1",
        subject_type: "music_item",
        subject_id: "song-1",
        source: "artist_details",
        source_kind: "artist_declared",
        evidence_type: "song_context",
        subject_label: "After Midnight",
        provenance: "artist workspace",
        confidence: "medium",
        limitation: null,
        raw_ref: null,
        created_at: "2026-08-12T09:00:00.000Z",
      }],
      release_opportunities: [{
        id: "opportunity-1",
        music_item_id: "song-1",
        opportunity_type: "playlist",
        target_name: "Existing Selects",
        source_url: "https://example.com/existing",
        safety_state: "clear",
        status: "shortlisted",
        fit_json: { explanation: "Existing song-specific fit." },
        source_evidence_json: [{ source: "Existing page", ref: "https://example.com/existing" }],
        public_contact_value: "https://example.com/submit",
      }],
    });

    const result = await executeManagerConversationTool(
      db,
      { ...scope, musicSubject: subject, fetchImpl: verifiedContactFetch as typeof fetch },
      "query_focused_release_opportunities",
      { opportunityType: "playlist" },
    ) as any;

    expect(result).toMatchObject({
      status: "ready_for_research",
      song: {
        musicItemId: "song-1",
        title: "After Midnight",
        genres: ["Afrobeats"],
        moods: ["late-night"],
      },
      evidence: [expect.objectContaining({ id: "evidence-1", subjectId: "song-1" })],
      existingOpportunities: [expect.objectContaining({ id: "opportunity-1", opportunityType: "playlist" })],
      searchPlan: expect.objectContaining({ publicSourcesOnly: true, webSearchRequired: true }),
    });
    expect(calls.every((call) => call.filters.some(([key, value]) => key === "account_id" && value === "account-1"))).toBe(true);
    expect(calls.every((call) => call.filters.some(([key, value]) => key === "artist_workspace_id" && value === "workspace-1"))).toBe(true);
    expect(calls.some((call) => call.filters.some(([key, value]) => key === "music_item_id" && value === "song-1"))).toBe(true);
  });

  it("saves an evidence-backed shortlist idempotently, excludes unsafe placement, and keeps a handoff instead of sending", async () => {
    expect(await verifyOpportunityPublicContact(opportunityCandidate as any, verifiedContactFetch as typeof fetch))
      .toMatchObject({ publicContact: expect.objectContaining({ value: "https://example.com/submit" }) });
    verifiedContactFetch.mockClear();
    const { db, writes } = releaseDb({ ...releaseRows, release_opportunities: [] }) as any;
    const result = await executeManagerConversationTool(
      db,
      { ...scope, musicSubject: subject, fetchImpl: verifiedContactFetch as typeof fetch },
      "save_focused_release_opportunities",
      {
        opportunityType: "playlist",
        candidates: [
          opportunityCandidate,
          {
            ...opportunityCandidate,
            targetName: "Guaranteed Streams",
            sourceUrl: "https://example.com/guaranteed",
            fit: {
              ...opportunityCandidate.fit,
              targetCriteria: ["guaranteed paid placement"],
              explanation: "This target guarantees placement for payment.",
            },
            paidPlacementClaim: true,
          },
        ],
      },
    ) as any;

    expect(verifiedContactFetch).toHaveBeenCalledWith("https://example.com/contact", expect.objectContaining({ method: "GET" }));

    expect(result).toMatchObject({
      status: "saved",
      saved: [expect.objectContaining({ targetName: "Night Drive Selects", status: "shortlisted", safetyState: "clear" })],
      excluded: [expect.objectContaining({ targetName: "Guaranteed Streams", safetyState: "excluded" })],
    });
    expect(writes.filter((write: any) => write.table === "release_opportunities")).toHaveLength(1);
    expect(writes.find((write: any) => write.table === "release_opportunities")).toMatchObject({
      options: { onConflict: "music_item_id,opportunity_type,dedupe_key" },
    });

    const retry = await executeManagerConversationTool(
      db,
      { ...scope, musicSubject: subject, fetchImpl: verifiedContactFetch as typeof fetch },
      "save_focused_release_opportunities",
      { opportunityType: "playlist", candidates: [opportunityCandidate] },
    ) as any;
    expect(retry.saved).toHaveLength(1);
    expect(writes.filter((write: any) => write.table === "release_opportunities")).toHaveLength(2);
    expect(new Set((writes[0].rows as any[]).map((row) => row.dedupe_key)).size).toBe(1);
  });

  it("requires public provenance for independent targets and records manual outcomes without an email tool", async () => {
    const { db, writes } = releaseDb({ ...releaseRows, release_opportunities: [{ id: "opportunity-1", music_item_id: "song-1", opportunity_type: "press" }] }) as any;
    await expect(executeManagerConversationTool(
      db,
      { ...scope, musicSubject: subject },
      "save_focused_release_opportunities",
      {
        opportunityType: "press",
        candidates: [{
          ...opportunityCandidate,
          opportunityType: "press",
          targetName: "Invented Outlet",
          sourceUrl: "",
          publicContact: { kind: "email", value: "editor@example.com", sourceUrl: "", verifiedAt: "2026-08-12T10:00:00.000Z" },
        }],
      },
    )).rejects.toThrow(/source|provenance|contact/i);

    const result = await executeManagerConversationTool(
      db,
      { ...scope, musicSubject: subject },
      "record_focused_release_opportunity_outcome",
      { opportunityId: "opportunity-1", status: "submitted_manually", manualOutcome: "Submission link prepared for the artist." },
    ) as any;
    expect(result).toMatchObject({ status: "recorded", opportunityId: "opportunity-1", outcome: "submitted_manually" });
    expect(writes.some((write: any) => write.table === "release_opportunities" && write.mode === "update")).toBe(true);
  });

  it("creates a song document through the canonical draft pathway", async () => {
    const { db, writes, rpcCalls } = releaseDb({
      ...releaseRows,
      artifact_links: [],
      documents: [],
      document_versions: [],
      release_opportunities: [{ id: "opportunity-1", music_item_id: "song-1", opportunity_type: "press" }],
    }) as any;
    const result = await executeManagerConversationTool(
      db,
      { ...scope, musicSubject: subject, runId: "run-1" },
      "create_focused_song_document",
      { documentType: "press_pitch", title: "After Midnight press pitch", body: "A concise song-specific press pitch draft.", opportunityId: "opportunity-1" },
    ) as any;
    expect(result).toMatchObject({ status: "drafted", documentType: "press_pitch", musicItemId: "song-1", opportunityId: "opportunity-1" });
    expect(rpcCalls).toContainEqual(expect.objectContaining({ name: "persist_focused_song_document_v1" }));
    expect(writes).toContainEqual(expect.objectContaining({
      table: "release_opportunities",
      mode: "update",
      values: expect.objectContaining({ pitch_document_id: expect.any(String) }),
    }));
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

    expect(result).toMatchObject({
      status: "proposed",
      request: {
        requestId: "request-1",
        idempotencyKey: rpcCalls[0].args.p_idempotency_key,
        preview: expect.any(Object),
      },
    });
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
