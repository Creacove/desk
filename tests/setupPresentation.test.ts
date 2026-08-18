import { describe, expect, it } from "vitest";
import {
  buildMusicReadSummary,
  buildSetupPresentationSnapshot,
  mergeConsumedDiscoveryEvidence,
  mapOperatingEvent,
  readPhaseStartedAt,
  resolvePhaseStartedAt,
  resolvePresentationPhase,
} from "../src/services/setupPresentationProjection";

describe("setup presentation projection", () => {
  it("keeps workflow truth separate from presentation phases", () => {
    expect(resolvePresentationPhase("running", "catalog_bootstrap")).toBe("catalogue");
    expect(resolvePresentationPhase("running", "manager_discovery")).toBe("discovery");
    expect(resolvePresentationPhase("running", "setup_brief")).toBe("synthesis");
    expect(resolvePresentationPhase("completed", "music_reads")).toBe("ready");
  });

  it("exposes only the current phase start time for long-running UX", () => {
    expect(readPhaseStartedAt({
      catalog_bootstrap: { started_at: "2026-08-18T08:00:10.000Z" },
      manager_discovery: { started_at: "2026-08-18T08:01:30.000Z" },
    }, "manager_discovery")).toBe("2026-08-18T08:01:30.000Z");
  });

  it("derives discovery timing from the setup-scoped start event when stage_status has no started_at", () => {
    expect(resolvePhaseStartedAt(
      "discovery",
      { id: "setup-1", current_stage: "manager_discovery", stage_status: {} },
      [{ event_type: "manager_discovery_started", created_at: "2026-08-18T08:01:30.000Z" }],
      { id: "run-1", status: "running", started_at: "2026-08-18T08:01:35.000Z" },
    )).toBe("2026-08-18T08:01:30.000Z");
  });

  it("derives synthesis timing from the Manager run when setup stage timing is absent", () => {
    expect(resolvePhaseStartedAt(
      "synthesis",
      { id: "setup-1", current_stage: "setup_brief", stage_status: {} },
      [],
      null,
      { id: "brief-1", status: "running", started_at: "2026-08-18T08:02:00.000Z" },
    )).toBe("2026-08-18T08:02:00.000Z");
  });

  it("translates backend tool names into stable truthful product language", () => {
    expect(mapOperatingEvent({
      event_type: "manager_discovery_tool_started",
      payload: { tool: "chartmetric_track_enrich" },
      created_at: "2026-08-18T08:00:00.000Z",
    })).toEqual({
      kind: "focus_music",
      state: "working",
      label: "Reading your current music",
      occurredAt: "2026-08-18T08:00:00.000Z",
    });
  });

  it("does not leave a failed discovery tool looking permanently active", () => {
    expect(mapOperatingEvent({
      event_type: "manager_discovery_tool_failed",
      payload: { tool: "chartmetric_artist_enrich" },
    })).toEqual({
      kind: "audience",
      state: "complete",
      label: "Continuing with available audience signals",
      occurredAt: undefined,
    });
  });

  it("includes cached evidence only when the current discovery action actually consumed it", () => {
    const merged = mergeConsumedDiscoveryEvidence([], [{
      status: "applied",
      result_payload: {
        status: "cached",
        evidence: [{
          id: "evidence-old-action",
          metric_name: "spotify_monthly_listeners",
          metric_value: 765432,
          created_at: "2026-08-18T07:00:00.000Z",
        }],
      },
    }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.metric_value).toBe(765432);

    expect(mergeConsumedDiscoveryEvidence([], [{
      status: "failed",
      result_payload: { evidence: [{ metric_name: "spotify_monthly_listeners", metric_value: 999 }] },
    }])).toEqual([]);
  });

  it("reconstructs truthful catch-up state from persisted production rows", () => {
    const snapshot = buildSetupPresentationSnapshot({
      observedAt: "2026-08-18T08:02:00.000Z",
      setupRun: {
        id: "setup-1",
        status: "running",
        current_stage: "manager_discovery",
        started_at: "2026-08-18T08:00:00.000Z",
        updated_at: "2026-08-18T08:01:58.000Z",
        stage_status: {
          catalog_bootstrap: { status: "completed", started_at: "2026-08-18T08:00:10.000Z" },
          manager_discovery: { status: "running", started_at: "2026-08-18T08:01:30.000Z" },
        },
      },
      workspace: {
        artistName: "Example Artist",
        spotifyIdentity: { imageUrl: "https://i.scdn.co/example.jpg" },
        genres: ["Afrobeats", "R&B", "Pop"],
      },
      musicItems: [
        { id: "song-1", title: "Signal", metadata: { spotify: { cover_image_url: "https://i.scdn.co/song.jpg" } } },
        { id: "song-2", title: "Second", metadata: {} },
      ],
      musicProjects: [
        { id: "project-1", title: "Signal EP", metadata: { spotify: { images: [{ url: "https://i.scdn.co/ep.jpg" }] } } },
      ],
      operatingEvents: [
        {
          event_type: "spotify_catalog_bootstrap_completed",
          payload: { music_item_count: 14, music_project_count: 3 },
          created_at: "2026-08-18T08:00:40.000Z",
        },
        {
          event_type: "manager_discovery_tool_started",
          payload: { tool: "chartmetric_track_enrich" },
          created_at: "2026-08-18T08:01:50.000Z",
        },
      ],
      discoveryRun: {
        id: "discovery-1",
        status: "running",
        context_payload: {
          selectedMusicItemIds: ["song-1"],
          selectedMusicProjectId: "project-1",
        },
        steps_payload: [{ discovery: { marketsDiscovered: ["Lagos", "London", "Accra", "New York"] } }],
      },
      evidence: [
        { metric_name: "spotify_monthly_listeners", metric_value: 123456, metric_unit: "listeners", created_at: "2026-08-18T08:01:00.000Z" },
        {
          source: "public_web",
          source_kind: "public_web",
          subject_label: "Billboard",
          raw_ref: "https://www.billboard.com/music/example",
          created_at: "2026-08-18T08:01:10.000Z",
        },
      ],
      briefRun: null,
      managerOutput: null,
    });

    expect(snapshot.setup.phase).toBe("discovery");
    expect(snapshot.setup.phaseStartedAt).toBe("2026-08-18T08:01:30.000Z");
    expect(snapshot.artist).toEqual({
      name: "Example Artist",
      imageUrl: "https://i.scdn.co/example.jpg",
      genres: ["Afrobeats", "R&B"],
    });
    expect(snapshot.catalogue).toMatchObject({ state: "complete", trackCount: 14, releaseCount: 3 });
    expect(snapshot.activity?.label).toBe("Reading your current music");
    expect(snapshot.intelligence?.primaryMetric).toEqual({ label: "Monthly listeners", value: "123.5K" });
    expect(snapshot.intelligence?.markets).toEqual(["Lagos", "London", "Accra"]);
    expect(snapshot.intelligence?.publicSources).toEqual([{ name: "Billboard", domain: "billboard.com" }]);
    expect(snapshot.intelligence?.focusMusic?.title).toBe("Signal");
    expect(snapshot.manager).toEqual({ state: "waiting" });
  });

  it("treats catalogue counts as unknown until a persisted completion event provides exact counts", () => {
    const snapshot = buildSetupPresentationSnapshot({
      setupRun: {
        id: "setup-1",
        status: "running",
        current_stage: "catalog_bootstrap",
        stage_status: { catalog_bootstrap: { status: "running", started_at: "2026-08-18T08:00:00.000Z" } },
      },
      workspace: { artistName: "Artist" },
      musicItems: Array.from({ length: 40 }, (_, index) => ({ id: `song-${index}`, title: `Song ${index}`, metadata: {} })),
      musicProjects: Array.from({ length: 20 }, (_, index) => ({ id: `project-${index}`, title: `Project ${index}`, metadata: {} })),
      operatingEvents: [{ event_type: "spotify_catalog_bootstrap_started" }],
    });

    expect(snapshot.catalogue).toMatchObject({ state: "working" });
    expect(snapshot.catalogue?.trackCount).toBeUndefined();
    expect(snapshot.catalogue?.releaseCount).toBeUndefined();
  });

  it("can mark catalogue complete from durable setup state without inventing counts", () => {
    const snapshot = buildSetupPresentationSnapshot({
      setupRun: {
        id: "setup-1",
        status: "running",
        current_stage: "manager_discovery",
        stage_status: { catalog_bootstrap: { status: "completed" } },
      },
      workspace: { artistName: "Artist" },
      musicItems: [{ id: "song-1", title: "Song", metadata: {} }],
    });
    expect(snapshot.catalogue).toMatchObject({ state: "complete" });
    expect(snapshot.catalogue?.trackCount).toBeUndefined();
  });

  it("shows Manager synthesis as active even before the synthesis run row is visible", () => {
    const snapshot = buildSetupPresentationSnapshot({
      setupRun: { id: "setup-1", status: "running", current_stage: "setup_brief", stage_status: {} },
      workspace: { artistName: "Artist" },
    });

    expect(snapshot.setup.phase).toBe("synthesis");
    expect(snapshot.activity).toMatchObject({ kind: "manager", state: "working", label: "Your Manager is putting it together" });
    expect(snapshot.manager).toEqual({ state: "working" });
  });

  it("never invents optional facts when data is absent", () => {
    const snapshot = buildSetupPresentationSnapshot({
      observedAt: "2026-08-18T08:02:00.000Z",
      setupRun: { id: "setup-1", status: "running", current_stage: "catalog_bootstrap", stage_status: {} },
      workspace: { artistName: "Artist" },
    });

    expect(snapshot.setup.phase).toBe("catalogue");
    expect(snapshot.catalogue).toBeUndefined();
    expect(snapshot.intelligence).toBeUndefined();
    expect(snapshot.manager).toEqual({ state: "waiting" });
  });

  it("treats Music Reads as non-blocking aggregate information", () => {
    expect(buildMusicReadSummary({
      music_reads: {
        target_count: 3,
        targets: [
          { status: "completed" },
          { status: "running" },
          { status: "failed" },
        ],
      },
    })).toEqual({ target: 3, completed: 1, running: 1, failed: 1 });
  });

  it("only exposes a persisted Manager insight", () => {
    const snapshot = buildSetupPresentationSnapshot({
      setupRun: { id: "setup-1", status: "completed", current_stage: "music_reads", stage_status: {} },
      workspace: { artistName: "Artist" },
      briefRun: { id: "brief-1", status: "completed" },
      managerOutput: { render_json: { headlineRead: "Momentum is strongest where your latest single is converting attention into repeat discovery." } },
    });
    expect(snapshot.setup.phase).toBe("ready");
    expect(snapshot.manager).toEqual({
      state: "ready",
      insight: "Momentum is strongest where your latest single is converting attention into repeat discovery.",
    });
  });
});
