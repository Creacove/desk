import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSupabaseMusicLibraryLoader,
  createSupabaseBillingService,
  createSupabaseProductionRepositories,
  createSupabaseProfileSetupService,
  createSupabaseSpotifyArtistAdapter,
  createSupabaseWorkspaceLoader,
} from "./services/productionSupabase";
import { createFixtureRepositories, productionFixtureData } from "./services/fixtureRepositories";
import type { ProductionWorkspace } from "./types/productionApp";

afterEach(() => {
  vi.useRealTimers();
});

const workspace: ProductionWorkspace = {
  accountId: "account-1",
  artistWorkspaceId: "workspace-1",
  artistId: "artist-1",
  artistName: "Nova Vale",
  workspaceName: "Nova Vale Desk",
  status: "active",
  spotifyConnected: true,
  spotifyArtistId: "spotify-artist-1",
  spotifyArtistName: "Nova Vale",
  spotifyArtistUrl: "https://open.spotify.com/artist/spotify-artist-1",
  contextComplete: true,
  latestCatalogSyncStatus: "completed",
};

const productionSupabaseSource = readFileSync(join(process.cwd(), "src", "services", "productionSupabase.ts"), "utf8");

const musicManagerReadV2 = {
  position: "Jam is the current lead validation record.",
  managementRole: "Lead attention asset",
  body: "Jam has aligned public pressure across the current evidence. The listening, short-form, and market signals point to the same record.\n\nUse the next reporting window to test whether that attention can become repeatable audience behavior before widening spend.",
  metrics: [
    { label: "Spotify streams (7d)", value: "5.2M", evidenceId: "ev-1" },
    { label: "TikTok video creates", value: "19M", evidenceId: "ev-2" },
    { label: "Lagos rank", value: "#14", evidenceId: "ev-3" },
  ],
  evidenceIds: ["ev-1", "ev-2", "ev-3"],
} as const;

describe("production Supabase services", () => {
  it("loads an ephemeral Spotify catalog preview through the preview function", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = {
      functions: {
        invoke: async (name: string, options: { body: unknown }) => {
          calls.push({ name, body: options.body });
          return {
            data: {
              artist: { spotifyArtistId: "artist-1", name: "Nova Vale" },
              standaloneSingles: [],
            },
            error: null,
          };
        },
      },
    } as unknown as SupabaseClient;

    const preview = await createSupabaseSpotifyArtistAdapter(client).previewCatalog!({
      spotifyArtistId: "artist-1",
      name: "Nova Vale",
      spotifyUrl: "https://open.spotify.com/artist/artist-1",
      genres: [],
    });

    expect(preview.artist.name).toBe("Nova Vale");
    expect(calls).toEqual([{
      name: "spotify-catalog-preview",
      body: {
        selectedArtist: {
          spotifyArtistId: "artist-1",
          name: "Nova Vale",
          spotifyUrl: "https://open.spotify.com/artist/artist-1",
          genres: [],
        },
        market: "US",
      },
    }]);
  });

  it("starts the context-aware paid setup phase through the setup orchestrator", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = {
      functions: {
        invoke: async (name: string, options: { body: unknown }) => {
          calls.push({ name, body: options.body });
          return { data: { status: "completed", phase: "contextualize", setupMusicReadTargets: [] }, error: null };
        },
      },
    } as unknown as SupabaseClient;

    const result = await createSupabaseBillingService(client).runSetupPhase!({
      checkoutSessionId: "checkout-1",
      phase: "contextualize",
    });

    expect(result.status).toBe("completed");
    expect(calls).toEqual([{
      name: "paid-workspace-setup",
      body: { checkoutSessionId: "checkout-1", phase: "contextualize" },
    }]);
  });
  it("does not discard saved Today's Brief records for copy style terms", () => {
    expect(productionSupabaseSource).not.toContain("TODAY_BRIEF_BANNED_VISIBLE_TERMS");
    expect(productionSupabaseSource).not.toContain("todayBriefHasBannedVisibleTerms");
  });

  it("creates the first artist workspace through the onboarding RPC", async () => {
    const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push({ name, args });
        return {
          data: [
            {
              account_id: "account-1",
              artist_workspace_id: "workspace-1",
              artist_id: "artist-1",
              artist_name: "Sable Day",
              workspace_name: "Sable Day HQ",
              status: "setup",
              spotify_connected: false,
            },
          ],
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    const loader = createSupabaseWorkspaceLoader(client);
    const result = await loader.createInitialWorkspace?.(
      { id: "user-1", email: "artist@example.com" },
      { artistName: " Sable Day ", workspaceName: " Sable Day HQ " },
    );

    expect(rpcCalls).toEqual([
      {
        name: "create_initial_artist_workspace",
        args: {
          p_artist_display_name: "Sable Day",
          p_workspace_name: "Sable Day HQ",
        },
      },
    ]);
    expect(result).toEqual({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      artistName: "Sable Day",
      workspaceName: "Sable Day HQ",
      status: "setup",
      spotifyConnected: false,
      spotifyArtistId: undefined,
      spotifyArtistName: undefined,
      spotifyArtistUrl: undefined,
      spotifyImageUrl: undefined,
      contextComplete: false,
      latestCatalogSyncStatus: undefined,
    });
  });

  it("maps active workspace Spotify identity, context gate, and latest catalog sync status", async () => {
    const client = fakeSupabaseClient({
      account_memberships: [{ account_id: "account-1" }],
      artist_workspaces: [
        {
          id: "workspace-1",
          account_id: "account-1",
          artist_id: "artist-1",
          name: "Nova Vale Desk",
          status: "setup",
          artists: {
            display_name: "Nova Vale",
            canonical_spotify_artist_id: "spotify-artist-1",
            canonical_spotify_url: "https://open.spotify.com/artist/spotify-artist-1",
          },
          artist_profiles: [
            {
              display_name: "Nova Vale",
              stage: "Emerging artist",
              home_market: "Lagos",
              genres: ["afro-fusion"],
              artist_direction: "Build from catalog proof.",
              budget_context: "$3,000",
              spotify_identity: {
                name: "Nova Vale",
                image_url: "https://i.scdn.co/image/nova",
              },
            },
          ],
          source_sync_jobs: [{ status: "completed_with_limits" }],
        },
      ],
    });

    const result = await createSupabaseWorkspaceLoader(client).loadActiveWorkspace({ id: "user-1" });

    expect(result).toEqual({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      artistName: "Nova Vale",
      workspaceName: "Nova Vale Desk",
      status: "setup",
      spotifyConnected: true,
      spotifyArtistId: "spotify-artist-1",
      spotifyArtistName: "Nova Vale",
      spotifyArtistUrl: "https://open.spotify.com/artist/spotify-artist-1",
      spotifyImageUrl: "https://i.scdn.co/image/nova",
      contextComplete: true,
      latestCatalogSyncStatus: "completed_with_limits",
      entitlementActive: false,
      subscriptionStatus: "none",
      setupStatus: "not_started",
      setupStage: undefined,
      billingCheckoutSessionId: undefined,
      accessType: "none",
      accessStatus: "inactive",
      accessStartsAt: undefined,
      accessEndsAt: undefined,
      renewalAt: undefined,
    });
  });

  it("projects artist-level Chartmetric evidence into the artist profile intelligence read", async () => {
    const client = fakeSupabaseClient({
      artist_profiles: [
        {
          display_name: "Burna Boy",
          stage: "Superstar",
          home_market: "Lagos",
          genres: ["afrobeats"],
          artist_direction: "Manage global release decisions from verified evidence.",
          budget_context: "$50,000",
          spotify_identity: {
            name: "Burna Boy",
            image_url: "https://i.scdn.co/image/burna",
          },
          social_handles: {},
        },
      ],
      evidence_items: [
        {
          id: "ev-1",
          source: "Chartmetric",
          source_kind: "third_party_provider",
          evidence_type: "market_rank",
          subject_type: "artist",
          subject_id: "artist-1",
          subject_label: "Burna Boy",
          metric_name: "chartmetric_country_rank_nigeria",
          metric_value: 1,
          metric_unit: "rank",
          freshness: "window_missing",
          confidence: "medium",
          limitation: "Chartmetric is a third-party provider.",
        },
        {
          id: "ev-2",
          source: "Chartmetric",
          source_kind: "third_party_provider",
          evidence_type: "platform_metric",
          subject_type: "artist",
          subject_id: "artist-1",
          subject_label: "Burna Boy",
          metric_name: "spotify_monthly_listeners",
          metric_value: 33_095_448,
          metric_unit: "listeners",
          freshness: "window_missing",
          confidence: "medium",
          limitation: "Chartmetric-reported platform metric.",
        },
        {
          id: "ev-3",
          source: "Chartmetric",
          source_kind: "third_party_provider",
          evidence_type: "market_metric",
          subject_type: "artist",
          subject_id: "artist-1",
          subject_label: "Burna Boy",
          metric_name: "spotify_listener_city_lagos",
          metric_value: 1_344_811,
          metric_unit: "listeners",
          freshness: "window_missing",
          confidence: "medium",
          limitation: "Chartmetric-reported platform metric.",
        },
        {
          id: "ev-4",
          source: "Chartmetric",
          source_kind: "third_party_provider",
          evidence_type: "public_social_metric",
          subject_type: "artist",
          subject_id: "artist-1",
          subject_label: "Burna Boy",
          metric_name: "tiktok_track_posts",
          metric_value: 15_763_624,
          metric_unit: "posts",
          freshness: "window_missing",
          confidence: "low",
          limitation: "Attention signal, not conversion proof.",
        },
      ],
    });

    const profile = await createSupabaseProductionRepositories(client, workspace).artistProfile.loadProfile();

    expect(profile.artistIntelligence).toMatchObject({
      headline: "Chartmetric shows Burna Boy has strong verified artist context.",
      marketRead: "Country rank Nigeria: #1; Lagos: 1,344,811 listeners",
      platformRead: "Spotify monthly listeners: 33,095,448 listeners",
      socialRead: "TikTok track posts: 15,763,624 posts",
    });
    expect(profile.artistIntelligence?.limitations).toContain("Attention signal, not conversion proof.");
  });

  it("projects the latest completed setup Today's Brief from Manager synthesis runs", async () => {
    const client = fakeSupabaseClient({
      source_sync_jobs: [],
      operating_events: [],
      manager_synthesis_runs: [
        {
          id: "brief-run-1",
          status: "completed",
          classification: "setup_todays_brief_v1",
          confidence: "medium",
          completed_at: "2026-06-17T08:30:00.000Z",
          action_plan: [
            {
              headlineRead: "London is the clearest pressure point in Burna Boy's current read.",
              intelligenceSnapshot: [
                {
                  title: "Market Power",
                  insight: "Lagos proves home-market authority, but London is the larger city signal in this setup read.",
                  metrics: [
                    { label: "Nigeria rank", value: "#1", context: "artist rank", evidenceIds: ["ev-1"] },
                    { label: "Lagos", value: "1.34M", context: "listeners", evidenceIds: ["ev-2"] },
                  ],
                },
              ],
              snapshotSummary: "The market read has both home authority and major international pressure.",
              managerRead:
                "Burna Boy is not a basic validation problem. The useful read is that Nigeria gives the artist authority while the public audience picture points to international leverage. Today, I would choose the first management focus from the records that best connect those two realities.",
              sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
              confidence: "medium",
              generatedAt: "2026-06-17T08:30:00.000Z",
              managerSynthesisRunId: "brief-run-1",
              claimAudit: [
                {
                  claim: "top home-market position and major listener scale",
                  evidenceIds: ["ev-1", "ev-2"],
                  limitation: "Public audience proof, not private conversion proof.",
                },
              ],
            },
          ],
        },
      ],
    });

    const desk = await createSupabaseProductionRepositories(client, workspace).desk.loadDesk();

    expect(desk.todayBrief).toMatchObject({
      headlineRead: "London is the clearest pressure point in Burna Boy's current read.",
      managerRead: expect.stringContaining("not a basic validation problem"),
      snapshotSummary: "The market read has both home authority and major international pressure.",
      managerSynthesisRunId: "brief-run-1",
      state: "fresh",
    });
    expect(desk.todayBrief?.intelligenceSnapshot[0]).toMatchObject({
      title: "Market Power",
      metrics: expect.arrayContaining([expect.objectContaining({ label: "Nigeria rank", value: "#1" })]),
    });
    expect(JSON.stringify(desk.todayBrief)).not.toMatch(/Chartmetric|provider|API|normalized|database|evidence row|third-party/i);
  });

  it("prefers current packet-backed Manager outputs over legacy Manager synthesis action plans", async () => {
    const client = fakeSupabaseClient({
      source_sync_jobs: [],
      operating_events: [],
      manager_outputs: [
        {
          id: "manager-output-1",
          source_packet_id: "packet-1",
          created_from_run_id: "brief-run-2",
          output_type: "setup_first_manager_read",
          subject_type: "artist",
          subject_id: "artist-1",
          is_current: true,
          render_json: {
            headlineRead: "The durable Manager read should lead with the clearest city signal.",
            intelligenceSnapshot: [
              {
                title: "Strategic Signal",
                insight: "London is the strongest public pressure point, with private conversion still missing.",
                metrics: [{ label: "London", value: "1.34M", context: "listeners", evidenceIds: ["ev-city"] }],
              },
            ],
            snapshotSummary: "A city-led operating read is stronger than the old action plan.",
            managerRead:
              "The current useful move is to organize management around London pressure while the team asks for private conversion proof.",
            managerEvidenceReads: [
              {
                label: "Artist Score",
                value: "92",
                category: "kpi",
                read: "Artist Score is high, so treat it as broad strength rather than proof that London pressure converts.",
                evidenceIds: ["ev-score"],
                confidence: "Medium",
              },
            ],
            sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
            confidence: "medium",
            generatedAt: "2026-06-18T08:30:00.000Z",
          },
          created_at: "2026-06-18T08:30:00.000Z",
        },
      ],
      manager_synthesis_runs: [
        {
          id: "brief-run-legacy",
          status: "completed",
          classification: "setup_todays_brief_v1",
          completed_at: "2026-06-17T08:30:00.000Z",
          action_plan: [
            {
              headlineRead: "Legacy action plan should not win.",
              intelligenceSnapshot: [
                {
                  title: "Old Signal",
                  insight: "This is stale.",
                  metrics: [{ label: "Old", value: "1", evidenceIds: ["old"] }],
                },
              ],
              snapshotSummary: "Old summary.",
              managerRead: "Old manager read.",
              sourceLine: "Old source line.",
              confidence: "low",
            },
          ],
        },
      ],
    });

    const desk = await createSupabaseProductionRepositories(client, workspace).desk.loadDesk();

    expect(desk.todayBrief).toMatchObject({
      headlineRead: "The durable Manager read should lead with the clearest city signal.",
      snapshotSummary: "A city-led operating read is stronger than the old action plan.",
      managerSynthesisRunId: "brief-run-2",
      managerOutputId: "manager-output-1",
      managerIntelligencePacketId: "packet-1",
      state: "fresh",
    });
    expect(desk.todayBrief?.intelligenceSnapshot[0]?.metrics[0]).toMatchObject({ label: "London", evidenceIds: ["ev-city"] });
    expect(desk.todayBrief?.managerEvidenceReads?.[0]).toMatchObject({
      label: "Artist Score",
      read: expect.stringContaining("broad strength"),
      evidenceIds: ["ev-score"],
    });
  });

  it("does not expose internal Today's Brief style-policy failures in Desk movement", async () => {
    const client = fakeSupabaseClient({
      source_sync_jobs: [],
      operating_events: [
        {
          id: "event-1",
          event_type: "setup_todays_brief_failed",
          summary: "Today's Brief visible copy used banned setup/source term: campaign.",
          created_at: "2026-06-17T08:30:00.000Z",
        },
      ],
      manager_synthesis_runs: [],
    });

    const desk = await createSupabaseProductionRepositories(client, workspace).desk.loadDesk();

    expect(desk.movement[0].title).toBe("Today's Brief needs a fresh Manager read.");
    expect(desk.movement[0].title).not.toMatch(/banned|campaign|source term/i);
  });

  it("generates Today's Brief manually from saved normalized sources through the Supabase function", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const brief = {
      headlineRead: "Nova Vale's first management read has a clear market center.",
      intelligenceSnapshot: [
        {
          title: "Current Music In View",
          insight: "The imported music should be treated as current management focus, not a total discography claim.",
          metrics: [
            { label: "2.1M", value: "2.1456789M", context: "Monthly listeners", evidenceIds: ["listeners"] },
            { label: "Artist score", value: "97.8864321", context: "score", evidenceIds: ["score"] },
            { label: "Playlist reach", value: "2,451.873", context: "reach", evidenceIds: ["playlists"] },
          ],
        },
      ],
      snapshotSummary: "The first read is ready to choose a management focus.",
      managerRead: "The current music in view gives Nova Vale enough surface to choose the first management focus. Today, I would pick the record or story that best explains the strongest audience signal.",
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "limited",
      generatedAt: "2026-06-17T08:30:00.000Z",
      managerSynthesisRunId: "brief-run-2",
      claimAudit: [{ claim: "catalog starting point", evidenceIds: ["catalog"], limitation: "Catalog context only." }],
    };
    const client = createMutableSupabaseClient(
      {
        source_sync_jobs: [],
        operating_events: [],
        manager_synthesis_runs: [],
      },
      {
        invoke: async (name, options) => {
          calls.push({ name, body: options.body });
          return { data: { status: "completed", brief }, error: null };
        },
      },
    );

    const result = await createSupabaseProductionRepositories(client, workspace).desk.generateTodaysBrief();

    expect(calls).toEqual([
      {
        name: "generate-todays-brief",
        body: {
          accountId: "account-1",
          artistWorkspaceId: "workspace-1",
          artistId: "artist-1",
          trigger: "manual",
          generationMode: "operating",
          requestId: expect.any(String),
        },
      },
    ]);
    expect(result).toMatchObject({
      headlineRead: "Nova Vale's first management read has a clear market center.",
      state: "fresh",
      managerSynthesisRunId: "brief-run-2",
    });
    expect(result.intelligenceSnapshot[0]?.title).toBe("Current Music In View");
    expect(result.intelligenceSnapshot[0]?.metrics).toEqual([
      { label: "Monthly listeners", value: "2.1M", context: "Monthly listeners", evidenceIds: ["listeners"] },
      { label: "Artist score", value: "98", context: "score", evidenceIds: ["score"] },
      { label: "Playlist reach", value: "2,452", context: "reach", evidenceIds: ["playlists"] },
    ]);
  });

  it("passes setup-map generation mode through the Supabase function", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = createMutableSupabaseClient(
      {
        source_sync_jobs: [],
        operating_events: [],
        manager_synthesis_runs: [],
      },
      {
        invoke: async (name, options) => {
          calls.push({ name, body: options.body });
          return {
            data: {
              brief: {
                headlineRead: "Nova Vale is a city-led artist with a record-led operating map.",
                intelligenceSnapshot: [
                  {
                    title: "Artist Intelligence",
                    insight: "London and Jam define the first operating map.",
                    metrics: [{ label: "London", value: "1.2M", context: "listeners", evidenceIds: ["ev-1"] }],
                  },
                ],
                snapshotSummary: "The setup map is centered on the artist's actual audience shape.",
                managerRead: "Nova Vale's first map is not a generic checklist.",
                sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
                confidence: "medium",
              },
            },
            error: null,
          };
        },
      },
    );

    await createSupabaseProductionRepositories(client, workspace).desk.generateTodaysBrief("setup-map");

    expect(calls[0]).toEqual({
      name: "generate-todays-brief",
      body: {
        accountId: "account-1",
        artistWorkspaceId: "workspace-1",
        artistId: "artist-1",
        trigger: "setup",
        generationMode: "setup-map",
        requestId: expect.any(String),
      },
    });
  });

  it("marks generated Today's Brief responses as fallback when the function used packet fallback", async () => {
    const fallbackBrief = {
      headlineRead: "Nova Vale has a fallback packet read.",
      intelligenceSnapshot: [
        {
          title: "Artist Intelligence",
          insight: "The packet has evidence, but the live Manager read did not complete.",
          metrics: [{ label: "London", value: "1.2M", context: "listeners", evidenceIds: ["ev-1"] }],
        },
      ],
      snapshotSummary: "Fallback packet read.",
      managerRead: "This is only a fallback packet read.",
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
    };
    const client = createMutableSupabaseClient(
      {
        source_sync_jobs: [],
        operating_events: [],
        manager_synthesis_runs: [],
      },
      {
        invoke: async () => ({ data: { status: "completed_with_fallback", brief: fallbackBrief }, error: null }),
      },
    );

    const result = await createSupabaseProductionRepositories(client, workspace).desk.generateTodaysBrief("setup-map");

    expect(result.state).toBe("fallback");
    expect(result.brief.state).toBe("fallback");
  });

  it("saves setup context through the atomic profile setup RPC", async () => {
    const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push({ name, args });
        return {
          data: {
            account_id: "account-1",
            artist_workspace_id: "workspace-1",
            artist_id: "artist-1",
            artist_name: "Nova Vale",
            workspace_name: "Nova Vale Desk",
            status: "active",
            spotify_connected: true,
            spotify_artist_id: "spotify-artist-1",
            spotify_artist_name: "Nova Vale",
            spotify_artist_url: "https://open.spotify.com/artist/spotify-artist-1",
            context_complete: true,
            latest_catalog_sync_status: "completed",
          },
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    const betaWorkspace: ProductionWorkspace = {
      ...workspace,
      status: "setup",
      contextComplete: false,
      entitlementActive: true,
      subscriptionStatus: "none",
      accessType: "private_beta",
      accessStatus: "active",
      accessStartsAt: "2026-07-13T20:31:06.556Z",
      accessEndsAt: "2026-08-12T20:31:06.556Z",
      setupStatus: "running",
      setupStage: "manager_discovery",
      billingCheckoutSessionId: "checkout-beta-1",
    };

    const result = await createSupabaseProfileSetupService(client).saveSetupContext(betaWorkspace, {
      name: " Nova Vale ",
      spotify: "Nova Vale - Spotify public catalog",
      stage: "",
      market: "",
      genre: "",
      goal: " Build from catalog proof. ",
      release: "Spotify catalog import",
      budget: " $3,000 ",
      tiktok: " @novavale ",
      instagram: "",
      youtube: "",
      x: "",
    });

    expect(rpcCalls).toEqual([
      {
        name: "complete_artist_setup_context",
        args: {
          p_artist_workspace_id: "workspace-1",
          p_stage: "",
          p_home_market: "",
          p_genres: [],
          p_artist_direction: "Build from catalog proof.",
          p_current_goal: "Build from catalog proof.",
          p_budget_context: "$3,000",
          p_social_handles: {
            tiktok: "@novavale",
            instagram: "",
            youtube: "",
            x: "",
          },
        },
      },
    ]);
    expect(result.contextComplete).toBe(true);
    expect(result.status).toBe("active");
    expect(result.entitlementActive).toBe(true);
    expect(result.accessType).toBe("private_beta");
    expect(result.accessStatus).toBe("active");
    expect(result.accessStartsAt).toBe(betaWorkspace.accessStartsAt);
    expect(result.accessEndsAt).toBe(betaWorkspace.accessEndsAt);
    expect(result.billingCheckoutSessionId).toBe("checkout-beta-1");
  });

  it("saves an active workspace profile through the dedicated profile RPC without re-running setup", async () => {
    const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push({ name, args });
        return { data: null, error: null };
      },
    } as unknown as SupabaseClient;

    await createSupabaseProfileSetupService(client).updateArtistProfile!(workspace, {
      name: " Nova Vale ",
      spotify: "Nova Vale - Spotify public catalog",
      stage: " Independent ",
      market: " Lagos ",
      genre: "Afrobeats, Alté",
      goal: " Build a release plan from verified catalog evidence. ",
      release: "Not persisted here",
      budget: " $3,000 ",
      tiktok: " @novavale ",
      instagram: " @nova ",
      youtube: " ",
      x: " @novavale ",
    });

    expect(rpcCalls).toEqual([
      {
        name: "update_artist_profile",
        args: {
          p_artist_workspace_id: "workspace-1",
          p_display_name: "Nova Vale",
          p_stage: "Independent",
          p_home_market: "Lagos",
          p_genres: ["Afrobeats", "Alté"],
          p_artist_direction: "Build a release plan from verified catalog evidence.",
          p_budget_context: "$3,000",
          p_social_handles: {
            tiktok: "@novavale",
            instagram: "@nova",
            youtube: "",
            x: "@novavale",
          },
        },
      },
    ]);
  });

  it("maps Supabase Music rows into songs, projects, tracklists, and Spotify links", async () => {
    const client = fakeSupabaseClient({
      music_items: [
        {
          id: "song-1",
          title: "North Star",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          released_at: "2026-05-01T00:00:00.000Z",
          metadata: {
            spotify: {
              track_id: "song-1",
              uri: "spotify:track:song-1",
              url: "https://open.spotify.com/track/song-1",
              album_id: "project-1",
              album_name: "Midnight Signal",
              release_date: "2026-05-01",
              duration_ms: 184000,
              explicit: true,
              track_number: 1,
              disc_number: 1,
              isrc: "USNV12600001",
              upc: "123456789012",
              preview_url: null,
              popularity: 42,
              label: "Nova Vale Records",
              copyrights: [{ type: "P", text: "2026 Nova Vale Records" }],
              audio_features: { mode: 1 },
              artists: [
                { id: "artist-1", name: "Nova Vale" },
                { id: "artist-2", name: "Guest Star" },
              ],
            },
          },
        },
      ],
      music_projects: [
        {
          id: "project-1",
          title: "Midnight Signal",
          project_type: "album",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          released_at: "2026-05-02T00:00:00.000Z",
          metadata: {
            spotify: {
              album_id: "project-1",
              album_type: "album",
              release_date: "2026-05-02",
              total_tracks: 1,
              label: "Nova Vale Records",
              copyrights: [{ type: "P", text: "2026 Nova Vale Records" }],
              images: [{ url: "https://i.scdn.co/image/project-cover", width: 640, height: 640 }],
              external_urls: { spotify: "https://open.spotify.com/album/project-1" },
            },
          },
        },
      ],
      music_project_items: [
        {
          music_project_id: "project-1",
          music_item_id: "song-1",
          order_index: 1,
          display_title: "North Star",
        },
      ],
      music_assets: [
        {
          music_item_id: "song-1",
          music_project_id: null,
          asset_type: "cover_art",
          title: "Spotify cover artwork",
          status: "confirmed",
          metadata: { external_url: "https://i.scdn.co/image/song-cover" },
        },
      ],
      music_credits: [
        {
          music_item_id: "song-1",
          music_project_id: null,
          role: "Producer",
          name: "Mara Vale",
          status: "confirmed",
        },
      ],
      music_splits: [
        {
          music_item_id: "song-1",
          music_project_id: null,
          status: "draft",
          summary: "Draft publishing split exists.",
          contributors: [
            { name: "Nova Vale", role: "Artist / writer", publishing_share: "50%", master_share: "70%", approval: "Draft" },
          ],
        },
      ],
      music_identifiers: [
        {
          music_item_id: "song-1",
          music_project_id: null,
          identifier_type: "spotify_track_url",
          identifier_value: "https://open.spotify.com/track/song-1",
        },
        {
          music_item_id: null,
          music_project_id: "project-1",
          identifier_type: "spotify_album_url",
          identifier_value: "https://open.spotify.com/album/project-1",
        },
        {
          music_item_id: null,
          music_project_id: "project-1",
          identifier_type: "upc",
          identifier_value: "123456789012",
        },
      ],
      evidence_items: [
        {
          id: "evidence-1",
          source: "chartmetric",
          source_kind: "public_music_intelligence",
          evidence_type: "playlist_movement",
          subject_type: "music_item",
          subject_id: "song-1",
          subject_label: "North Star",
          metric_name: "spotify_playlist_reach",
          metric_value: 12500,
          metric_unit: "listeners",
          freshness: "Last 7 days",
          confidence: "medium",
          limitation: "Chartmetric public/social intelligence can report supported platform metrics, but does not prove private saves, source-of-stream, revenue, conversion, or campaign ROI.",
        },
        {
          id: "audio-analysis-bpm",
          source: "Audio analysis",
          source_kind: "uploaded_file",
          evidence_type: "audio_analysis",
          subject_type: "music_item",
          subject_id: "song-1",
          subject_label: "North Star master",
          metric_name: "tempo_bpm",
          metric_value: 102.5,
          metric_unit: "bpm",
          freshness: "Current upload",
          confidence: "medium",
          limitation: "Automated estimate. Verify before delivery or release.",
        },
        {
          id: "audio-analysis-key",
          source: "Audio analysis",
          source_kind: "uploaded_file",
          evidence_type: "audio_analysis",
          subject_type: "music_item",
          subject_id: "song-1",
          subject_label: "North Star master",
          metric_name: "musical_key",
          metric_value: null,
          metric_unit: "F# minor",
          freshness: "Current upload",
          confidence: "medium",
          limitation: "Automated estimate. Verify before delivery or release.",
        },
        {
          id: "evidence-project-1",
          source: "Chartmetric",
          source_kind: "third_party_provider",
          evidence_type: "spotify_trailing_streams",
          subject_type: "music_project",
          subject_id: "project-1",
          subject_label: "Midnight Signal",
          metric_name: "spotify_trailing_28d_streams",
          metric_value: 845000,
          metric_unit: "streams",
          freshness: "2026-05-04 to 2026-06-01",
          confidence: "medium",
          limitation: "Chartmetric-reported platform metric, not private Spotify analytics.",
        },
        {
          id: "evidence-project-2",
          source: "Chartmetric",
          source_kind: "third_party_provider",
          evidence_type: "playlist_placement",
          subject_type: "music_project",
          subject_id: "project-1",
          subject_label: "Midnight Signal",
          metric_name: "spotify_editorial_playlist_reach",
          metric_value: 1800000,
          metric_unit: "followers",
          freshness: "2026-06-01",
          confidence: "medium",
          limitation: "Playlist reach is exposure, not conversion proof.",
        },
      ],
    });

    const library = await createSupabaseMusicLibraryLoader(client).loadMusicLibrary(workspace);
    const musicViewModels = await createSupabaseProductionRepositories(client, workspace).music.loadMusic();

    expect(library.songs).toEqual([
      expect.objectContaining({
        id: "song-1",
        title: "North Star",
        spotifyUrl: "https://open.spotify.com/track/song-1",
        coverImageUrl: "https://i.scdn.co/image/project-cover",
        spotifyTrackId: "song-1",
        spotifyUri: "spotify:track:song-1",
        isrc: "USNV12600001",
        upc: "123456789012",
        albumName: "Midnight Signal",
        albumLabel: "Nova Vale Records",
        copyrights: ["2026 Nova Vale Records"],
        mode: "Major",
        explicit: true,
        trackNumber: 1,
        discNumber: 1,
        primaryArtist: "Nova Vale",
        featuredArtists: ["Guest Star"],
        credits: [{ role: "Producer", names: "Mara Vale", status: "Confirmed" }],
        assets: [expect.objectContaining({ label: "Spotify cover artwork", status: "Confirmed" })],
        splits: expect.objectContaining({ status: "Draft" }),
      }),
    ]);
    expect(musicViewModels.find((item) => item.id === "song-1")).toEqual(
      expect.objectContaining({
        managerReadStatus: "not_generated",
        blocker: "No active blocker",
        rightsState: "Released catalog rights attached outside this app",
        linkedTaskCount: 0,
        fileAssets: expect.arrayContaining([
          expect.objectContaining({ label: "Spotify track page", status: "Confirmed", action: "Open Spotify URL" }),
          expect.objectContaining({ label: "Spotify cover artwork", status: "Confirmed" }),
        ]),
        metadataFields: expect.arrayContaining([
          { label: "Tempo (BPM)", value: "102.5", status: "Draft" },
          { label: "Musical key", value: "F# minor", status: "Draft" },
        ]),
        sourceSummary: expect.objectContaining({
          headline: "North Star is a Released catalog song backed by Spotify public catalog and Chartmetric evidence.",
          badges: expect.arrayContaining(["Spotify", "Chartmetric"]),
          facts: expect.arrayContaining([
            { label: "Spotify track ID", value: "song-1", source: "Spotify", status: "Confirmed" },
            { label: "ISRC", value: "USNV12600001", source: "Spotify", status: "Confirmed" },
            { label: "Popularity", value: "42", source: "Spotify", status: "Confirmed" },
          ]),
          evidence: expect.arrayContaining([
            {
              label: "Spotify playlist reach",
              value: "12500 listeners",
              source: "Chartmetric",
              window: "Last 7 days",
              limitation: "Chartmetric public/social intelligence can report supported platform metrics, but does not prove private saves, source-of-stream, revenue, conversion, or campaign ROI.",
            },
          ]),
          limitations: expect.arrayContaining([
            "Spotify public catalog supports identity, catalog, and public metadata only.",
          ]),
        }),
      }),
    );
    expect(musicViewModels.find((item) => item.id === "song-1")?.fileAssets.some((asset) => asset.label === "User-uploaded master")).toBe(false);
    expect(library.projects).toEqual([
      expect.objectContaining({
        id: "project-1",
        title: "Midnight Signal",
        spotifyUrl: "https://open.spotify.com/album/project-1",
        coverImageUrl: "https://i.scdn.co/image/project-cover",
        spotifyAlbumId: "project-1",
        upc: "123456789012",
        tracks: [expect.objectContaining({ id: "song-1", title: "North Star", orderIndex: 1 })],
        evidence: expect.arrayContaining([
          expect.objectContaining({ id: "evidence-project-1", metricName: "spotify_trailing_28d_streams" }),
          expect.objectContaining({ id: "evidence-project-2", metricName: "spotify_editorial_playlist_reach" }),
        ]),
      }),
    ]);
    expect(musicViewModels.find((item) => item.id === "project-1")).toEqual(
      expect.objectContaining({
        managerReadStatus: "not_generated",
        sourceSummary: expect.objectContaining({
          badges: expect.arrayContaining(["Spotify", "Chartmetric"]),
          evidence: expect.arrayContaining([
            expect.objectContaining({ label: "Spotify trailing 28d streams", value: "845000 streams", source: "Chartmetric" }),
          ]),
        }),
      }),
    );
    expect(library.managerRuns).toEqual([]);
  });

  it.each([
    {
      name: "no read and no run",
      outputs: [],
      runs: [],
      status: "not_generated",
      hasRead: false,
    },
    {
      name: "legacy current output",
      outputs: [musicManagerOutputRow({ schema_version: "music-manager-read-v1", render_json: { managerRead: "Legacy copy" } })],
      runs: [],
      status: "stale",
      hasRead: true,
      readBody: "Legacy copy",
    },
    {
      name: "current read without resolved metrics",
      outputs: [musicManagerOutputRow({ render_json: { ...musicManagerReadV2, metrics: [] } })],
      runs: [],
      status: "fresh",
      hasRead: true,
    },
    {
      name: "active first read",
      outputs: [],
      runs: [musicManagerRunRow({ id: "run-active", status: "running", created_at: "2026-07-27T10:00:00.000Z" })],
      status: "running",
      runId: "run-active",
      hasRead: false,
    },
    {
      name: "active refresh",
      outputs: [musicManagerOutputRow()],
      runs: [musicManagerRunRow({ id: "run-refresh", status: "queued", created_at: "2026-07-27T10:00:00.000Z" })],
      status: "refreshing",
      runId: "run-refresh",
      hasRead: true,
    },
    {
      name: "failed first read",
      outputs: [],
      runs: [musicManagerRunRow({ id: "run-failed", status: "failed", error: "Provider unavailable", created_at: "2026-07-27T10:00:00.000Z" })],
      status: "failed",
      runId: "run-failed",
      error: "Provider unavailable",
      hasRead: false,
    },
    {
      name: "failed refresh newer than current output",
      outputs: [musicManagerOutputRow({ created_at: "2026-07-27T09:00:00.000Z" })],
      runs: [musicManagerRunRow({ id: "run-refresh-failed", status: "failed", error: "Refresh unavailable", created_at: "2026-07-27T10:00:00.000Z" })],
      status: "refresh_failed",
      runId: "run-refresh-failed",
      error: "Refresh unavailable",
      hasRead: true,
    },
    {
      name: "failed run older than current output",
      outputs: [musicManagerOutputRow({ created_at: "2026-07-27T10:00:00.000Z", created_from_run_id: "run-current" })],
      runs: [musicManagerRunRow({ id: "run-old-failure", status: "failed", error: "Old failure", created_at: "2026-07-27T09:00:00.000Z" })],
      status: "fresh",
      runId: "run-current",
      hasRead: true,
    },
  ])("recovers $name as durable Manager Read state", async ({ outputs, runs, status, runId, error, hasRead, readBody }) => {
    const tables = musicManagerReadTables({ manager_outputs: outputs, manager_synthesis_runs: runs });
    const [song] = await createSupabaseProductionRepositories(createMutableSupabaseClient(tables), workspace).music.loadMusic();

    expect(song).toMatchObject({
      id: "song-jam",
      managerReadStatus: status,
      ...(runId ? { managerReadRunId: runId } : {}),
      ...(error ? { managerReadError: error } : {}),
    });
    expect(Boolean(song?.managerRead)).toBe(hasRead);
    if (hasRead) {
      expect(song?.managerRead?.body).toBe(readBody ?? musicManagerReadV2.body);
      if (readBody) expect(song?.managerRead?.metrics).toEqual([]);
    }
  });

  it("hydrates the existing song mission and official conversation from artifact links", async () => {
    const tables = musicManagerReadTables({
      artifact_links: [
        {
          account_id: "account-1",
          artist_workspace_id: "workspace-1",
          artist_id: "artist-1",
          source_type: "mission",
          source_id: "mission-jam-release",
          target_type: "music_item",
          target_id: "song-jam",
          relationship: "references",
          created_at: "2026-07-27T09:00:00.000Z",
        },
        {
          account_id: "account-1",
          artist_workspace_id: "workspace-1",
          artist_id: "artist-1",
          source_type: "conversation",
          source_id: "conversation-jam-release",
          target_type: "music_item",
          target_id: "song-jam",
          relationship: "references",
          created_at: "2026-07-27T09:01:00.000Z",
        },
      ],
      conversations: [
        {
          id: "conversation-jam-release",
          account_id: "account-1",
          artist_workspace_id: "workspace-1",
          artist_id: "artist-1",
          topic: "Jam — song workspace",
          status: "active",
          summary: "Add the final mix before release planning.",
          last_update_at: "2026-07-27T09:01:00.000Z",
        },
      ],
    });

    const [song] = await createSupabaseProductionRepositories(createMutableSupabaseClient(tables), workspace).music.loadMusic();

    expect(song).toMatchObject({
      id: "song-jam",
      linkedMissionIds: ["mission-jam-release"],
      managerConversationId: "conversation-jam-release",
      managerConversation: {
        id: "conversation-jam-release",
        topic: "Jam — song workspace",
        summary: "Add the final mix before release planning.",
      },
    });
  });

  it("selects the newest subject run deterministically when database order is ambiguous", async () => {
    const tables = musicManagerReadTables({
      manager_synthesis_runs: [
        musicManagerRunRow({ id: "run-a", status: "failed", created_at: "2026-07-27T10:00:00.000Z" }),
        musicManagerRunRow({ id: "run-z", status: "running", created_at: "2026-07-27T10:00:00.000Z" }),
        musicManagerRunRow({ id: "run-foreign", artist_workspace_id: "workspace-other", status: "failed", created_at: "2026-07-27T11:00:00.000Z" }),
      ],
    });

    const [song] = await createSupabaseProductionRepositories(createMutableSupabaseClient(tables), workspace).music.loadMusic();

    expect(song).toMatchObject({ managerReadStatus: "running", managerReadRunId: "run-z" });
  });

  it.each([
    ["partial", { ...musicManagerReadV2, evidenceIds: undefined }],
    ["legacy", { headline: "Jam is moving", nextMove: "Spend now" }],
    ["unknown-key", { ...musicManagerReadV2, sourceLine: "Internal source" }],
    ["legacy-judgments", { ...musicManagerReadV2, decision: "Spend now" }],
    ["invalid-metric", { ...musicManagerReadV2, metrics: [{ label: "Streams", value: "5.2M", evidenceIds: ["ev-1"] }] }],
  ])("rejects %s payloads instead of filling v2 fields with fallback copy", async (_case, renderJson) => {
    const tables = musicManagerReadTables({
      manager_outputs: [musicManagerOutputRow({ render_json: renderJson })],
    });

    const [song] = await createSupabaseProductionRepositories(createMutableSupabaseClient(tables), workspace).music.loadMusic();

    expect(song).toMatchObject({ managerReadStatus: "not_generated" });
    expect(song?.managerRead).toBeUndefined();
  });

  it("starts one backend Manager Read job and reloads its persisted running state", async () => {
    const invoked: string[] = [];
    const tables = musicManagerReadTables();
    const client = createMutableSupabaseClient(tables, {
      invoke: async (name) => {
        invoked.push(name);
        tables.manager_synthesis_runs.push(musicManagerRunRow({ id: "run-1", status: "running" }));
        return { data: { status: "processing", runId: " run-1 " }, error: null };
      },
    });

    const result = await createSupabaseProductionRepositories(client, workspace).music.startManagerRead("song-jam", "music_item");

    expect(invoked).toEqual(["generate-music-summary"]);
    expect(result.managerReadRunId).toBe("run-1");
    expect(result.managerReadStatus).toBe("running");
  });

  it("returns a durable processing handle without polling when Today's Brief continues in the background", async () => {
    const client = createMutableSupabaseClient(
      { source_sync_jobs: [], operating_events: [], manager_synthesis_runs: [] },
      { invoke: async () => ({ data: { status: "processing", runId: "brief-run-processing" }, error: null }) },
    );

    const result = await createSupabaseProductionRepositories(client, workspace).desk.generateTodaysBrief();

    expect(result).toEqual({ status: "processing", runId: "brief-run-processing", setupMusicReadTargets: [] });
  });

  it("loads a bounded Music list without detail payloads or full Manager Read renders", async () => {
    const tables = musicManagerReadTables({
      manager_outputs: [musicManagerOutputRow()],
      manager_synthesis_runs: [musicManagerRunRow()],
    });
    const { client, calls } = createObservedSupabaseClient(tables);

    const result = await createSupabaseProductionRepositories(client, workspace).music.loadMusicList();

    expect(result).toEqual([expect.objectContaining({ id: "song-jam", kind: "song" })]);
    expect(calls.map((call) => call.table)).toEqual([
      "music_items",
      "music_projects",
      "music_project_items",
      "manager_outputs",
      "manager_synthesis_runs",
      "artifact_links",
    ]);
    expect(calls.some((call) => call.select.includes("render_json"))).toBe(false);
    expect(calls.some((call) => [
      "music_identifiers",
      "music_assets",
      "music_credits",
      "music_splits",
      "music_split_contributors",
      "evidence_items",
    ].includes(call.table))).toBe(false);
    for (const call of calls) {
      expect(call.filters).toEqual(expect.arrayContaining([
        ["account_id", "account-1"],
        ["artist_workspace_id", "workspace-1"],
        ["artist_id", "artist-1"],
      ]));
      expect(call.limit).toBeGreaterThan(0);
      expect(call.limit).toBeLessThan(200);
      expect(call.orders.length).toBeGreaterThan(0);
    }
  });

  it("hydrates the latest linked Manager conversation into the lightweight Music list", async () => {
    const tables = musicManagerReadTables({
      artifact_links: [{
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        source_type: "conversation",
        source_id: "conversation-list-song",
        target_type: "music_item",
        target_id: "song-jam",
        relationship: "references",
        created_at: "2026-08-07T12:00:00.000Z",
      }],
    });
    const { client, calls } = createObservedSupabaseClient(tables);

    const result = await createSupabaseProductionRepositories(client, workspace).music.loadMusicList();

    expect(result.find((subject) => subject.id === "song-jam")).toMatchObject({
      managerConversationId: "conversation-list-song",
    });
    expect(calls.find((call) => call.table === "artifact_links")?.inFilters).toContainEqual([
      "target_id",
      expect.arrayContaining(["song-jam"]),
    ]);
  });

  it("does not starve returned Music subjects behind global output or run history limits", async () => {
    const songs = Array.from({ length: 100 }, (_, index) => ({
      id: `song-${String(index).padStart(3, "0")}`,
      account_id: "account-1",
      artist_workspace_id: "workspace-1",
      artist_id: "artist-1",
      status: "active",
      title: `Song ${index}`,
      item_type: "released_track",
      lifecycle_stage: "released",
      source_kind: "spotify_public_catalog",
      source_limit: "Public catalog metadata only.",
      created_at: "2026-07-27T08:00:00.000Z",
      metadata: {},
    }));
    const projects = Array.from({ length: 50 }, (_, index) => ({
      id: `project-${String(index).padStart(3, "0")}`,
      account_id: "account-1",
      artist_workspace_id: "workspace-1",
      artist_id: "artist-1",
      status: "active",
      title: `Project ${index}`,
      project_type: "album",
      lifecycle_stage: "released",
      source_kind: "spotify_public_catalog",
      source_limit: "Public catalog metadata only.",
      created_at: "2026-07-27T08:00:00.000Z",
      metadata: {},
    }));
    const currentOutputs = [
      ...songs.map((song, index) => musicManagerOutputRow({
        id: `song-output-${index}`,
        subject_id: song.id,
        created_from_run_id: `song-run-${index}`,
      })),
      ...projects.map((project, index) => musicManagerOutputRow({
        id: `project-output-${index}`,
        subject_type: "music_project",
        subject_id: project.id,
        output_type: "project_manager_read",
        created_from_run_id: `project-run-${index}`,
      })),
    ];
    const historicalRuns = Array.from({ length: 101 }, (_, index) => musicManagerRunRow({
      id: `historical-run-${index}`,
      subject_id: songs[0].id,
      status: "completed",
      created_at: `2026-07-26T${String(index % 24).padStart(2, "0")}:00:00.000Z`,
    }));
    const activeTargetId = projects.at(-1)!.id;
    const tables = musicManagerReadTables({
      music_items: songs,
      music_projects: projects,
      manager_outputs: currentOutputs,
      manager_synthesis_runs: [
        ...historicalRuns,
        musicManagerRunRow({
          id: "active-target-run",
          subject_type: "music_project",
          subject_id: activeTargetId,
          status: "running",
          created_at: "2026-07-28T10:00:00.000Z",
        }),
      ],
    });
    const { client, calls } = createObservedSupabaseClient(tables);

    const result = await createSupabaseProductionRepositories(client, workspace).music.loadMusicList();

    expect(result).toHaveLength(150);
    expect(result.every((subject) => subject.managerReadStatus !== "not_generated" && subject.managerReadStatus !== "stale")).toBe(true);
    expect(result.find((subject) => subject.id === activeTargetId && subject.kind === "project")).toMatchObject({
      managerReadStatus: "refreshing",
      managerReadRunId: "active-target-run",
    });
    expect(calls.find((call) => call.table === "manager_outputs")?.limit).toBe(150);
    expect(calls.find((call) => call.table === "manager_synthesis_runs")?.inFilters).toContainEqual([
      "status",
      ["queued", "running"],
    ]);
  });

  it.each([
    ["music_item", "song-jam", "music_item_id"],
    ["music_project", "project-jam", "music_project_id"],
  ] as const)("loads only the owned %s detail for the exact subject", async (subjectType, subjectId, subjectColumn) => {
    const tables = musicManagerReadTables({
      music_projects: [{
        id: "project-jam",
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        status: "active",
        title: "Jam Project",
        project_type: "album",
        lifecycle_stage: "released",
        source_kind: "spotify_public_catalog",
        source_limit: "Public catalog metadata only.",
        created_at: "2026-07-27T08:00:00.000Z",
        metadata: {},
      }],
      music_identifiers: [
        {
          account_id: "account-1",
          artist_workspace_id: "workspace-1",
          artist_id: "artist-1",
          music_item_id: "song-jam",
          music_project_id: null,
          identifier_type: "isrc",
          identifier_value: "OWNED",
        },
        {
          account_id: "account-other",
          artist_workspace_id: "workspace-other",
          artist_id: "artist-other",
          music_item_id: "song-jam",
          music_project_id: null,
          identifier_type: "isrc",
          identifier_value: "FOREIGN",
        },
      ],
      manager_outputs: [musicManagerOutputRow()],
      manager_synthesis_runs: [musicManagerRunRow()],
    });
    const { client, calls } = createObservedSupabaseClient(tables);

    const result = await createSupabaseProductionRepositories(client, workspace).music.loadMusicObject(subjectId, subjectType);

    expect(result).toEqual(expect.objectContaining({ id: subjectId }));
    for (const call of calls) {
      expect(call.filters).toEqual(expect.arrayContaining([
        ["account_id", "account-1"],
        ["artist_workspace_id", "workspace-1"],
        ["artist_id", "artist-1"],
      ]));
    }
    for (const table of ["music_identifiers", "music_assets", "music_credits", "manager_outputs", "manager_synthesis_runs"]) {
      const call = calls.find((entry) => entry.table === table);
      expect(call?.filters).toContainEqual([subjectColumn === "music_item_id" && table.startsWith("music_")
        ? "music_item_id"
        : subjectColumn === "music_project_id" && table.startsWith("music_")
          ? "music_project_id"
          : "subject_id", subjectId]);
    }
    const identityTable = subjectType === "music_item" ? "music_items" : "music_projects";
    expect(calls.find((call) => call.table === identityTable)?.filters).toContainEqual(["id", subjectId]);
    expect(Boolean(result?.identifiers?.some((identifier) => identifier.value === "FOREIGN"))).toBe(false);
  });

  it("returns the latest scoped Manager conversation linked to an exact music subject", async () => {
    const tables = musicManagerReadTables({
      artifact_links: [
        {
          account_id: "account-1",
          artist_workspace_id: "workspace-1",
          artist_id: "artist-1",
          source_type: "conversation",
          source_id: "conversation-song-current",
          target_type: "music_item",
          target_id: "song-jam",
          relationship: "references",
          created_at: "2026-08-07T12:00:00.000Z",
        },
        {
          account_id: "account-other",
          artist_workspace_id: "workspace-other",
          artist_id: "artist-other",
          source_type: "conversation",
          source_id: "conversation-foreign",
          target_type: "music_item",
          target_id: "song-jam",
          relationship: "references",
          created_at: "2026-08-07T13:00:00.000Z",
        },
      ],
    });
    const { client, calls } = createObservedSupabaseClient(tables);

    const result = await createSupabaseProductionRepositories(client, workspace).music.loadMusicObject("song-jam", "music_item");

    expect(result).toMatchObject({ id: "song-jam", managerConversationId: "conversation-song-current" });
    const conversationLinkCall = calls.find((call) =>
      call.table === "artifact_links" && call.filters.some(([key, value]) => key === "target_id" && value === "song-jam"),
    );
    expect(conversationLinkCall).toMatchObject({
      filters: expect.arrayContaining([
        ["account_id", "account-1"],
        ["artist_workspace_id", "workspace-1"],
        ["artist_id", "artist-1"],
        ["target_type", "music_item"],
        ["target_id", "song-jam"],
        ["relationship", "references"],
      ]),
      inFilters: expect.arrayContaining([["source_type", ["conversation", "mission", "document"]]]),
    });
  });

  it("hydrates canonical song documents when refreshing one exact song", async () => {
    const tables = musicManagerReadTables({
      artifact_links: [{
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        source_type: "document",
        source_id: "document-lyrics",
        target_type: "music_item",
        target_id: "song-jam",
        relationship: "references",
        created_at: "2026-08-09T12:00:00.000Z",
      }],
      documents: [{
        id: "document-lyrics",
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        title: "Lyrics",
        document_type: "lyrics",
        origin: "user_uploaded",
        status: "accepted",
        current_version_id: "version-lyrics-1",
        metadata: {},
      }],
      document_versions: [{
        id: "version-lyrics-1",
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        document_id: "document-lyrics",
        version_number: 1,
        metadata: { body: "First line" },
      }],
    });
    const { client } = createObservedSupabaseClient(tables);

    const result = await createSupabaseProductionRepositories(client, workspace).music.loadMusicObject("song-jam", "music_item");

    expect(result?.materials).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "document-lyrics", kind: "document", materialType: "lyrics", body: "First line" }),
    ]));
  });

  it("loads one Manager Read run by the exact owner tuple and run id", async () => {
    const tables = musicManagerReadTables({
      manager_synthesis_runs: [
        musicManagerRunRow({ id: "run-owned", status: "running" }),
        musicManagerRunRow({ id: "run-owned", account_id: "account-other", status: "failed" }),
        musicManagerRunRow({ id: "run-other", status: "failed" }),
      ],
    });
    const { client, calls } = createObservedSupabaseClient(tables);

    const result = await createSupabaseProductionRepositories(client, workspace).music.loadManagerRun("run-owned");

    expect(result).toEqual({
      id: "run-owned",
      status: "running",
      subjectId: "song-jam",
      subjectType: "music_item",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      table: "manager_synthesis_runs",
      limit: 1,
      filters: expect.arrayContaining([
        ["account_id", "account-1"],
        ["artist_workspace_id", "workspace-1"],
        ["artist_id", "artist-1"],
        ["id", "run-owned"],
      ]),
    });
  });

  it("loads only the latest catalog status for the exact workspace owner scope", async () => {
    const { client, calls } = createObservedSupabaseClient({
      source_sync_jobs: [{
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        job_type: "spotify_catalog_bootstrap",
        status: "completed_with_limits",
        created_at: "2026-07-28T10:00:00.000Z",
      }],
    });

    const status = await createSupabaseWorkspaceLoader(client).loadCatalogSyncStatus?.(workspace);

    expect(status).toBe("completed_with_limits");
    expect(calls).toEqual([{
      table: "source_sync_jobs",
      select: "status",
      filters: [
        ["account_id", "account-1"],
        ["artist_workspace_id", "workspace-1"],
        ["artist_id", "artist-1"],
        ["job_type", "spotify_catalog_bootstrap"],
      ],
      inFilters: [],
      orders: [["created_at", false]],
      limit: 1,
    }]);
  });

  it("splits Desk, mission, and conversation list/detail reads into focused queries", async () => {
    const { client, calls } = createObservedSupabaseClient({
      source_sync_jobs: [{ status: "completed", completed_at: "2026-07-28T10:00:00.000Z", job_type: "spotify_catalog_bootstrap" }],
      operating_events: [{ id: "event-1", mission_id: "mission-1", event_type: "mission_updated", summary: "Mission updated", created_at: "2026-07-28T10:00:00.000Z" }],
      manager_outputs: [],
      manager_synthesis_runs: [],
      missions: [{ id: "mission-1", account_id: "account-1", artist_workspace_id: "workspace-1", artist_id: "artist-1", title: "Focused mission", objective: "Ship safely", status: "active", progress: 20 }],
      checkpoints: [],
      tasks: [{
        id: "task-1",
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        mission_id: "mission-1",
        primary_checkpoint_id: null,
        title: "Add the current working audio",
        status: "open",
        owner_role: "Artist / team",
        work_mode: "artist_action",
        purpose: "Give the song workspace a real audio reference.",
        approval_state: "not_required",
      }],
      task_steps: [],
      task_results: [],
      memory_entries: [],
      conversations: [{ id: "conversation-1", account_id: "account-1", artist_workspace_id: "workspace-1", artist_id: "artist-1", topic: "Focused conversation", status: "active", summary: "Summary", last_update_at: "2026-07-28T10:00:00.000Z", created_at: "2026-07-28T09:00:00.000Z" }],
      conversation_messages: [{ id: "message-1", account_id: "account-1", artist_workspace_id: "workspace-1", artist_id: "artist-1", conversation_id: "conversation-1", speaker: "manager", label: "Manager", body: "Detail", metadata: {}, created_at: "2026-07-28T10:00:00.000Z" }],
      artifact_links: [],
    });
    const repositories = createSupabaseProductionRepositories(client, workspace);

    await (repositories.desk as any).loadActivity();
    expect(calls.map((call) => call.table)).toEqual(["source_sync_jobs", "operating_events"]);
    expect(calls.find((call) => call.table === "operating_events")?.limit).toBe(20);

    calls.splice(0);
    await (repositories.desk as any).loadBrief();
    expect(calls.map((call) => call.table)).toEqual(["manager_outputs", "manager_synthesis_runs"]);

    calls.splice(0);
    const missionList = await (repositories.missions as any).loadMissionList();
    expect(calls.map((call) => call.table)).toEqual(["missions", "tasks"]);
    expect(calls.find((call) => call.table === "tasks")?.inFilters).toContainEqual(["mission_id", ["mission-1"]]);
    expect(missionList[0]).toMatchObject({
      nextTask: "Add the current working audio",
      tasks: [expect.objectContaining({ id: "task-1", title: "Add the current working audio" })],
    });

    calls.splice(0);
    await (repositories.missions as any).loadMission("mission-1");
    expect(calls.find((call) => call.table === "missions")?.filters).toContainEqual(["id", "mission-1"]);
    for (const table of ["checkpoints", "tasks", "operating_events", "memory_entries"]) {
      expect(calls.find((call) => call.table === table)?.filters).toContainEqual(["mission_id", "mission-1"]);
    }

    calls.splice(0);
    await (repositories.manager as any).loadConversationList();
    expect(calls.map((call) => call.table)).toEqual(["conversations", "artifact_links"]);
    expect(calls.find((call) => call.table === "artifact_links")?.filters).toEqual(expect.arrayContaining([
      ["source_type", "conversation"],
      ["relationship", "references"],
    ]));

    calls.splice(0);
    await (repositories.manager as any).loadConversation("conversation-1");
    expect(calls.find((call) => call.table === "conversations")?.filters).toContainEqual(["id", "conversation-1"]);
    expect(calls.find((call) => call.table === "conversation_messages")?.filters).toContainEqual(["conversation_id", "conversation-1"]);
  });

  it.each([
    "queued",
    "running",
    "completed",
    "completed_with_limits",
    "failed",
    "cancelled",
  ] as const)("accepts supported Manager Read run status %s", async (status) => {
    const tables = musicManagerReadTables({
      manager_synthesis_runs: [musicManagerRunRow({ id: `run-${status}`, status })],
    });

    const result = await createSupabaseProductionRepositories(
      createObservedSupabaseClient(tables).client,
      workspace,
    ).music.loadManagerRun(`run-${status}`);

    expect(result?.status).toBe(status);
  });

  it("rejects an unsupported Manager Read run status", async () => {
    const tables = musicManagerReadTables({
      manager_synthesis_runs: [musicManagerRunRow({ id: "run-unknown", status: "sleeping" })],
    });

    const result = await createSupabaseProductionRepositories(
      createObservedSupabaseClient(tables).client,
      workspace,
    ).music.loadManagerRun("run-unknown");

    expect(result).toBeNull();
  });

  it("starts Manager Read with one focused object reload and never invokes the broad library loader", async () => {
    const tables = musicManagerReadTables();
    const { client, calls } = createObservedSupabaseClient(tables, {
      invoke: async () => {
        tables.manager_synthesis_runs.push(musicManagerRunRow({ id: "run-focused", status: "running" }));
        return { data: { status: "processing", runId: "run-focused" }, error: null };
      },
    });

    const result = await createSupabaseProductionRepositories(client, workspace).music.startManagerRead("song-jam", "music_item");

    expect(result).toMatchObject({ id: "song-jam", managerReadRunId: "run-focused" });
    expect(calls.filter((call) => call.table === "music_items")).toHaveLength(1);
    expect(calls.some((call) => call.table === "music_projects")).toBe(false);
    expect(calls.every((call) => call.filters.some(([key, value]) =>
      (key === "id" || key === "subject_id" || key === "music_item_id") && value === "song-jam",
    ) || call.table === "music_project_items" || call.table === "music_split_contributors" || call.table === "artifact_links")).toBe(true);
  });

  it("rejects invalid backend Manager Read start responses", async () => {
    const client = createMutableSupabaseClient(musicManagerReadTables(), {
      invoke: async () => ({ data: { status: "completed", runId: null }, error: null }),
    });

    await expect(
      createSupabaseProductionRepositories(client, workspace).music.startManagerRead("song-jam", "music_item"),
    ).rejects.toThrow("Song Manager Read returned an invalid run response.");
  });

  it("rejects a whitespace-only Manager Read run id", async () => {
    const client = createMutableSupabaseClient(musicManagerReadTables(), {
      invoke: async () => ({ data: { status: "processing", runId: "   " }, error: null }),
    });

    await expect(
      createSupabaseProductionRepositories(client, workspace).music.startManagerRead("song-jam", "music_item"),
    ).rejects.toThrow("Song Manager Read returned an invalid run response.");
  });

  it.each([
    ["a different persisted run", musicManagerRunRow({ id: "run-other", status: "running" })],
    ["a non-active persisted run", musicManagerRunRow({ id: "run-1", status: "completed" })],
  ])("rejects reloads containing %s after starting a Manager Read", async (_case, persistedRun) => {
    const invoked: string[] = [];
    const tables = musicManagerReadTables();
    const client = createMutableSupabaseClient(tables, {
      invoke: async (name) => {
        invoked.push(name);
        tables.manager_synthesis_runs.push(persistedRun);
        return { data: { status: "processing", runId: "run-1" }, error: null };
      },
    });

    await expect(
      createSupabaseProductionRepositories(client, workspace).music.startManagerRead("song-jam", "music_item"),
    ).rejects.toThrow("Song Manager Read did not reload the active run that was started.");
    expect(invoked).toEqual(["generate-music-summary"]);
  });

  it("accepts the exact Manager Read run when it completes before the reload", async () => {
    const invoked: string[] = [];
    const tables = musicManagerReadTables();
    const client = createMutableSupabaseClient(tables, {
      invoke: async (name) => {
        invoked.push(name);
        tables.manager_synthesis_runs.push(musicManagerRunRow({ id: "run-1", status: "completed" }));
        tables.manager_outputs.push(musicManagerOutputRow({ created_from_run_id: "run-1" }));
        return { data: { status: "processing", runId: "run-1" }, error: null };
      },
    });

    const result = await createSupabaseProductionRepositories(client, workspace).music.startManagerRead("song-jam", "music_item");

    expect(result).toMatchObject({
      managerReadRunId: "run-1",
      managerReadStatus: "fresh",
      managerRead: musicManagerReadV2,
    });
    expect(invoked).toEqual(["generate-music-summary"]);
  });

  it.each([
    ["failed first read", [], "failed"],
    ["failed refresh", [musicManagerOutputRow({ created_from_run_id: "run-old", created_at: "2026-07-27T08:00:00.000Z" })], "refresh_failed"],
  ] as const)("accepts the exact Manager Read run after a fast %s", async (_case, outputs, expectedStatus) => {
    const invoked: string[] = [];
    const tables = musicManagerReadTables({ manager_outputs: [...outputs] });
    const client = createMutableSupabaseClient(tables, {
      invoke: async (name) => {
        invoked.push(name);
        tables.manager_synthesis_runs.push(musicManagerRunRow({
          id: "run-1",
          status: "failed",
          error: "Provider unavailable",
          created_at: "2026-07-27T10:00:00.000Z",
        }));
        return { data: { status: "processing", runId: "run-1" }, error: null };
      },
    });

    const result = await createSupabaseProductionRepositories(client, workspace).music.startManagerRead("song-jam", "music_item");

    expect(result).toMatchObject({
      managerReadRunId: "run-1",
      managerReadStatus: expectedStatus,
      managerReadError: "Provider unavailable",
    });
    expect(invoked).toEqual(["generate-music-summary"]);
  });

  it("returns running fixture state for a first read", async () => {
    const repositories = createFixtureRepositories();

    const result = await repositories.music.startManagerRead("song-after-hours", "music_item");

    expect(result).toMatchObject({
      id: "song-after-hours",
      managerReadStatus: "running",
      managerReadRunId: "fixture-music-read-music_item-song-after-hours",
    });
    expect(result.managerRead).toBeUndefined();
  });

  it("preserves the current fixture read while marking a refresh active", async () => {
    const repositories = createFixtureRepositories();
    const current = (await repositories.music.loadMusic()).find((item) => item.id === "song-night-bus");

    const result = await repositories.music.startManagerRead("song-night-bus", "music_item");

    expect(result).toMatchObject({
      id: "song-night-bus",
      managerReadStatus: "refreshing",
      managerReadRunId: "fixture-music-read-music_item-song-night-bus",
    });
    expect(result.managerRead).toEqual(current?.managerRead);
  });

  it("keeps a same-id fixture project unchanged when starting a song Manager Read", async () => {
    const song = productionFixtureData.music.find((item) => item.kind === "song");
    const project = productionFixtureData.music.find((item) => item.kind === "project");
    expect(song).toBeDefined();
    expect(project).toBeDefined();
    if (!song || !project) return;

    const originalProjectId = project.id;
    project.id = song.id;
    try {
      const repositories = createFixtureRepositories();
      const projectBefore = await repositories.music.loadMusicObject(song.id, "music_project");

      const updatedSong = await repositories.music.startManagerRead(song.id, "music_item");
      const projectAfter = await repositories.music.loadMusicObject(song.id, "music_project");

      expect(updatedSong).toMatchObject({
        id: song.id,
        kind: "song",
        managerReadRunId: `fixture-music-read-music_item-${song.id}`,
      });
      expect(projectAfter).toEqual(projectBefore);
      expect(projectAfter).toMatchObject({ id: song.id, kind: "project", title: project.title });
    } finally {
      project.id = originalProjectId;
    }
  });

  it("keeps manual unreleased split proof blocking while treating every released song as post-release work", async () => {
    const client = fakeSupabaseClient({
      music_items: [
        {
          id: "song-spotify-released",
          title: "Released From Spotify",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: { spotify: { track_id: "spotify-track-released", url: "https://open.spotify.com/track/spotify-track-released" } },
        },
        {
          id: "song-manual-ready",
          title: "Manual Ready Song",
          item_type: "song",
          lifecycle_stage: "ready",
          source_kind: "manual",
          source_limit: "User-created record.",
          metadata: {},
        },
        {
          id: "song-manual-released",
          title: "Manual Released Song",
          item_type: "song",
          lifecycle_stage: "released",
          released_at: "2026-07-18T00:00:00.000Z",
          source_kind: "manual",
          source_limit: "User-created record released through a distributor.",
          metadata: {},
        },
      ],
      music_projects: [
        {
          id: "project-spotify",
          title: "Released Project",
          project_type: "ep",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: { spotify: { album_id: "spotify-album-released" } },
        },
      ],
      music_project_items: [
        { music_project_id: "project-spotify", music_item_id: "song-spotify-released", order_index: 1, disc_number: 1, display_title: "Released From Spotify" },
      ],
      music_assets: [
        {
          id: "asset-master",
          music_item_id: "song-manual-ready",
          music_project_id: null,
          asset_type: "final_master",
          title: "Final master",
          status: "uploaded",
          uploaded_file_id: "file-master",
        },
        {
          id: "asset-press-release",
          music_item_id: "song-manual-ready",
          music_project_id: null,
          asset_type: "press_release",
          title: "Press release",
          status: "uploaded",
          uploaded_file_id: "file-press-release",
        },
        {
          id: "asset-split-sheet",
          music_item_id: "song-manual-ready",
          music_project_id: null,
          asset_type: "split_sheet",
          title: "Signed split sheet",
          status: "uploaded",
          uploaded_file_id: "file-split-sheet",
        },
      ],
      music_credits: [],
      music_splits: [
        {
          music_item_id: "song-spotify-released",
          status: "Missing",
          summary: "Missing split proof",
        },
        {
          music_item_id: "song-manual-ready",
          status: "Missing",
          summary: "Missing split proof",
        },
        {
          music_item_id: "song-manual-released",
          status: "Missing",
          summary: "Missing split proof",
        },
      ],
      music_identifiers: [],
      evidence_items: [],
    });

    const musicViewModels = await createSupabaseProductionRepositories(client, workspace).music.loadMusic();
    const spotifySong = musicViewModels.find((item) => item.id === "song-spotify-released");
    const manualSong = musicViewModels.find((item) => item.id === "song-manual-ready");
    const manualReleasedSong = musicViewModels.find((item) => item.id === "song-manual-released");
    const spotifyProject = musicViewModels.find((item) => item.id === "project-spotify");

    expect(spotifySong).toMatchObject({
      blocker: "No active blocker",
      rightsState: "Released catalog rights attached outside this app",
      managerReadStatus: "not_generated",
    });
    expect(spotifySong?.fileAssets?.some((asset) => asset.assetType === "split_sheet")).toBe(false);
    expect(spotifyProject).toMatchObject({ blocker: "No inherited blockers", managerReadStatus: "not_generated" });

    expect(manualSong).toMatchObject({
      blocker: "Missing split proof",
      rightsState: "Rights proof not connected",
      managerReadStatus: "not_generated",
    });
    expect(manualSong?.fileAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({ group: "Audio", label: "Final master", status: "Uploaded" }),
      expect.objectContaining({ group: "Documents", label: "Press release", status: "Uploaded" }),
    ]));
    expect(manualSong?.fileAssets?.some((asset) => asset.assetType === "split_sheet")).toBe(false);

    expect(manualReleasedSong).toMatchObject({
      status: "Released",
      blocker: "No active blocker",
      rightsState: "Rights were finalized before release",
      managerReadStatus: "not_generated",
    });
    expect(manualReleasedSong?.fileAssets?.some((asset) => asset.status === "Missing")).toBe(false);
  });

  it("searches the connected artist's Spotify catalogue through the edge function", async () => {
    const releases = [{ albumId: "album-1", name: "Night Bus", albumType: "album", alreadyImported: false }];
    let capturedBody: unknown;
    const client = createMutableSupabaseClient(
      {},
      {
        invoke: async (name: string, options: { body: unknown }) => {
          expect(name).toBe("spotify-catalog-search");
          capturedBody = options.body;
          return { data: { mode: "releases", releases }, error: null };
        },
      },
    );

    const result = await createSupabaseProductionRepositories(client, workspace).music.searchSpotifyCatalog({ kind: "project" });

    expect(result).toEqual({ mode: "releases", releases });
    expect(capturedBody).toMatchObject({ accountId: "account-1", artistWorkspaceId: "workspace-1", artistId: "artist-1", kind: "project" });
  });

  it("creates and explicitly delivers a Files-owned selected-asset share link through the server boundary", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = createMutableSupabaseClient({}, {
      invoke: async (name: string, options: { body: unknown }) => {
        calls.push({ name, body: options.body });
        if ((options.body as { action?: string }).action === "create") {
          return { data: { shareLink: { id: "share-1", label: "Jam package", preset: "delivery", url: "https://app.ordersounds.com/share?token=secret" } }, error: null };
        }
        return { data: { status: "sent", shareLinkId: "share-1", recipientEmail: "press@example.com" }, error: null };
      },
    });
    const music = createSupabaseProductionRepositories(client, workspace).music;

    const shareLink = await music.createShareLink({
      musicSubject: { type: "music_item", id: "song-jam" },
      assetIds: ["asset-master", "asset-cover"],
      preset: "delivery",
      recipientEmail: "press@example.com",
    });
    await music.sendShareLink({ shareLinkId: shareLink.id, url: shareLink.url, recipientEmail: "press@example.com" });

    expect(calls).toEqual([
      {
        name: "music-share-links",
        body: expect.objectContaining({
          action: "create",
          accountId: "account-1",
          artistWorkspaceId: "workspace-1",
          artistId: "artist-1",
          musicSubject: { type: "music_item", id: "song-jam" },
          assetIds: ["asset-master", "asset-cover"],
          preset: "delivery",
          recipientEmail: "press@example.com",
        }),
      },
      {
        name: "music-share-links",
        body: expect.objectContaining({ action: "send", shareLinkId: "share-1", recipientEmail: "press@example.com" }),
      },
    ]);
  });

  it("lists prior Files-owned share packages without returning their capability tokens", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = createMutableSupabaseClient({}, {
      invoke: async (name: string, options: { body: unknown }) => {
        calls.push({ name, body: options.body });
        return {
          data: {
            shareLinks: [{
              id: "share-older",
              label: "Jam press package",
              preset: "epk_press",
              state: "active",
              recipientEmail: "editor@example.com",
              assetCount: 3,
              accessCount: 5,
              createdAt: "2026-08-07T14:00:00.000Z",
            }],
          },
          error: null,
        };
      },
    });

    const links = await createSupabaseProductionRepositories(client, workspace).music.listShareLinks!({ type: "music_item", id: "song-jam" });

    expect(links).toEqual([expect.objectContaining({ id: "share-older", state: "active", assetCount: 3, accessCount: 5 })]);
    expect(calls).toEqual([{
      name: "music-share-links",
      body: expect.objectContaining({ action: "list", musicSubject: { type: "music_item", id: "song-jam" } }),
    }]);
    expect(JSON.stringify(links)).not.toContain("token");
  });

  it("imports a Spotify selection through the edge function", async () => {
    let capturedBody: unknown;
    const client = createMutableSupabaseClient(
      {},
      {
        invoke: async (name: string, options: { body: unknown }) => {
          expect(name).toBe("spotify-import-selection");
          capturedBody = options.body;
          return { data: { subjectType: "music_item", subjectId: "song-9", alreadyExisted: false }, error: null };
        },
      },
    );

    const result = await createSupabaseProductionRepositories(client, workspace).music.importSpotifySelection({ kind: "song", albumId: "album-1", trackId: "track-3" });

    expect(result).toMatchObject({ subjectType: "music_item", subjectId: "song-9", alreadyExisted: false });
    expect(capturedBody).toMatchObject({ kind: "song", albumId: "album-1", trackId: "track-3" });
  });

  it("builds real production repositories from Supabase rows without fixture content", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T08:00:00.000Z"));

    const client = fakeSupabaseClient({
      artist_profiles: [
        {
          display_name: "Nova Vale",
          spotify_identity: { name: "Nova Vale", url: "https://open.spotify.com/artist/spotify-artist-1" },
          genres: ["afro-fusion"],
          home_market: "Lagos",
          stage: "Emerging artist",
          current_goal: "Build from catalog proof.",
          artist_direction: "Build from catalog proof.",
          budget_context: "$3,000",
          social_handles: { tiktok: "@novavale" },
        },
      ],
      source_sync_jobs: [
        {
          status: "completed",
          completed_at: "2026-05-27T08:00:00.000Z",
          job_type: "spotify_catalog_bootstrap",
        },
      ],
      operating_events: [
        {
          id: "event-1",
          event_type: "spotify_catalog_bootstrap_completed",
          summary: "Imported Spotify public catalog records.",
          created_at: "2026-05-27T08:00:00.000Z",
        },
      ],
      agent_profiles: [
        {
          agent_key: "manager",
          name: "AI Manager",
          title: "Available now",
          status_default: "available",
          purpose: "Coordinates priorities and decisions.",
          tools: ["Decision reviews"],
          required_source_capabilities: [],
          optional_source_capabilities: [],
          manager_can_prepare: ["Create missions"],
        },
      ],
      music_items: [],
      music_projects: [],
      music_project_items: [],
      music_identifiers: [],
      conversations: [],
      missions: [],
      evidence_items: [],
    });

    const repositories = createSupabaseProductionRepositories(client, workspace);
    const [profile, desk, agents, music, conversations, missions, evidence] = await Promise.all([
      repositories.artistProfile.loadProfile(),
      repositories.desk.loadDesk(),
      repositories.staff.loadAgents(),
      repositories.music.loadMusic(),
      repositories.manager.loadConversations(),
      repositories.missions.loadMissions(),
      repositories.evidence.loadEvidence(),
    ]);

    expect(profile.name).toBe("Nova Vale");
    expect(desk.priority[0]?.value).toBe("Spotify catalog connected");
    expect(desk.attention).toEqual([]);
    expect(desk.movement[0]).toEqual({
      label: "Catalog",
      title: "Imported Spotify public catalog records.",
      time: "7d ago",
    });
    expect(agents[0]?.name).toBe("AI Manager");
    expect(music).toEqual([]);
    expect(conversations).toEqual([]);
    expect(missions).toEqual([]);
    expect(evidence).toEqual([]);
    expect(JSON.stringify({ profile, desk, agents })).not.toMatch(/Sable Day|Night Bus/);
  });

  it("creates manual songs and projects with durable audit events", async () => {
    const tables: Record<string, Array<Record<string, unknown>>> = {
      music_items: [],
      music_projects: [],
      operating_events: [],
    };
    const repositories = createSupabaseProductionRepositories(createMutableSupabaseClient(tables), workspace);

    const song = await repositories.music.createSong({
      title: "After Midnight",
      itemType: "song",
      lifecycleStage: "recording",
    });
    const project = await repositories.music.createProject({
      title: "After Midnight EP",
      projectType: "ep",
      lifecycleStage: "idea",
    });

    expect(song).toMatchObject({ title: "After Midnight", kind: "song" });
    expect(project).toMatchObject({ title: "After Midnight EP", kind: "project" });
    expect(tables.music_items[0]).toMatchObject({
      account_id: "account-1",
      artist_workspace_id: "workspace-1",
      artist_id: "artist-1",
      title: "After Midnight",
      item_type: "song",
      lifecycle_stage: "recording",
      source_kind: "manual",
      created_by_type: "user",
    });
    expect(tables.music_projects[0]).toMatchObject({
      title: "After Midnight EP",
      project_type: "ep",
      lifecycle_stage: "idea",
      source_kind: "manual",
    });
    expect(tables.operating_events).toEqual([
      expect.objectContaining({ event_type: "music_item_created", target_type: "music_item" }),
      expect.objectContaining({ event_type: "music_project_created", target_type: "music_project" }),
    ]);
  });

  it("routes Mission Genesis through the authenticated OpenAI function without client-side drafting", async () => {
    const tables: Record<string, Array<Record<string, unknown>>> = {};
    const invocations: Array<{ name: string; body: unknown }> = [];
    const expected = {
      outcome: "no_mission" as const,
      title: "Mission was not created",
      body: "The current artist packet does not support a durable objective yet.",
      reasons: ["No sufficiently valuable and grounded objective was found."],
      questions: [],
      evidenceNeeded: ["A current artist goal"],
    };
    const client = createMutableSupabaseClient(tables, {
      invoke: async (name, options) => {
        invocations.push({ name, body: options.body });
        return { data: expected, error: null };
      },
    });

    const result = await createSupabaseProductionRepositories(client, workspace).missionGenesis.runMissionGenesis();

    expect(invocations).toEqual([
      {
        name: "mission-genesis",
        body: {
          accountId: workspace.accountId,
          artistWorkspaceId: workspace.artistWorkspaceId,
          artistId: workspace.artistId,
          mode: "initial",
          requestKey: expect.any(String),
        },
      },
    ]);
    expect(result).toEqual(expected);
  });

  it("keeps multi-mission Mission Genesis activation ids from the function response", async () => {
    const expected = {
      outcome: "activate_mission" as const,
      title: "Missions activated",
      body: "The Manager activated two coordinated workstreams.",
      reasons: ["Both workstreams are grounded in the packet."],
      questions: [],
      evidenceNeeded: [],
      activatedMissionId: "mission-a",
      activatedMissionIds: ["mission-a", "mission-b"],
      candidateMissionIds: ["mission-c"],
    };
    const client = createMutableSupabaseClient({}, {
      invoke: async () => ({ data: expected, error: null }),
    });

    const result = await createSupabaseProductionRepositories(client, workspace).missionGenesis.runMissionGenesis();

    expect(result).toEqual(expected);
  });

  it("treats split Mission Genesis missionIds as activated ids when the function omits activatedMissionIds", async () => {
    const tables: Record<string, Array<Record<string, unknown>>> = {
      missions: [
        {
          id: "mission-position",
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          title: "Define Blaqbonez's 90-day career position",
          status: "active",
          summary: "Resolve the artist position before scaling the feature moment.",
          current_recommendation: "Choose the career thesis that Blaqbonez should own this quarter.",
          progress: 0,
          review_point: "Career position quality",
        },
        {
          id: "mission-feature",
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          title: "Turn the Asake feature into Blaqbonez-owned leverage",
          status: "active",
          summary: "Use the feature without letting the collaborator own the whole narrative.",
          current_recommendation: "Scale only if attention transfers back to Blaqbonez.",
          progress: 0,
          review_point: "Feature leverage quality",
        },
      ],
      mission_plan_versions: [
        { id: "plan-position", mission_id: "mission-position", version: 1, status: "active" },
        { id: "plan-feature", mission_id: "mission-feature", version: 1, status: "active" },
      ],
      checkpoints: [
        {
          id: "checkpoint-position",
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          mission_id: "mission-position",
          mission_plan_version_id: "plan-position",
          title: "Career position quality",
          question: "Can the team choose Blaqbonez's owned position before campaign scale?",
          status: "waiting",
          recommendation: "Decide the position before spend.",
        },
        {
          id: "checkpoint-feature",
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          mission_id: "mission-feature",
          mission_plan_version_id: "plan-feature",
          title: "Feature leverage quality",
          question: "If the song grows but Blaqbonez's profile does not, should the feature plan stop or reframe?",
          status: "waiting",
          recommendation: "Watch profile lift before scaling.",
        },
      ],
      tasks: [
        {
          id: "task-position",
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          mission_id: "mission-position",
          mission_plan_version_id: "plan-position",
          primary_checkpoint_id: "checkpoint-position",
          title: "Choose the 90-day Blaqbonez position",
          status: "proposed",
          owner_role: "Artist / team",
          purpose: "Make the career thesis explicit before the team scales activity.",
        },
        {
          id: "task-feature",
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          mission_id: "mission-feature",
          mission_plan_version_id: "plan-feature",
          primary_checkpoint_id: "checkpoint-feature",
          title: "Measure whether the feature lifts Blaqbonez",
          status: "proposed",
          owner_role: "Marketing",
          purpose: "Separate song-level lift from Blaqbonez-owned career leverage.",
        },
      ],
    };
    const client = createMutableSupabaseClient(tables, {
      invoke: async () => ({
        data: {
          outcome: "activate_mission",
          title: "Missions activated",
          body: "The Manager split career position and feature leverage into separate missions.",
          reasons: ["The objectives should not live in one mission."],
          questions: [],
          evidenceNeeded: [],
          missionIds: ["mission-position", "mission-feature"],
        },
        error: null,
      }),
    });
    const repositories = createSupabaseProductionRepositories(client, workspace);

    const result = await repositories.missionGenesis.runMissionGenesis();
    const missions = await repositories.missions.loadMissions();

    expect(result).toMatchObject({
      outcome: "activate_mission",
      activatedMissionId: "mission-position",
      activatedMissionIds: ["mission-position", "mission-feature"],
    });
    expect(missions.map((mission) => mission.title)).toEqual([
      "Define Blaqbonez's 90-day career position",
      "Turn the Asake feature into Blaqbonez-owned leverage",
    ]);
    expect(missions[0].tasks[0]).toMatchObject({ title: "Choose the 90-day Blaqbonez position" });
    expect(missions[1].checkpoints[0]).toMatchObject({ title: "Feature leverage quality" });
  });

  it("resolves a background Mission Genesis run without the old fixed polling loop", async () => {
    expect(productionSupabaseSource).not.toContain("MISSION_GENESIS_POLL_INTERVAL_MS");
    expect(productionSupabaseSource).not.toContain("MISSION_GENESIS_POLL_ATTEMPTS");
    expect(productionSupabaseSource).toContain("createActiveRunFallback");
    expect(productionSupabaseSource).toContain("postgres_changes");
    const tables: Record<string, Array<Record<string, unknown>>> = {
      manager_synthesis_runs: [
        {
          id: "mission-run-1",
          artist_workspace_id: workspace.artistWorkspaceId,
          status: "completed",
        },
      ],
      manager_run_actions: [
        {
          id: "action-1",
          manager_synthesis_run_id: "mission-run-1",
          order_index: 1,
          payload: {
            outcome: "activate_mission",
            decisionSummary: "The Manager activated a focused London proof loop.",
            reasons: ["London is the strongest current signal."],
            evidenceNeeded: [],
            questions: [],
          },
          result_payload: {
            outcome: "activate_mission",
            missionId: "mission-1",
            missionIds: ["mission-1"],
            activatedMissionIds: ["mission-1"],
            candidateMissionIds: [],
            questions: [],
          },
        },
      ],
    };
    const invocations: Array<{ name: string; body: unknown }> = [];
    const client = createMutableSupabaseClient(tables, {
      invoke: async (name, options) => {
        invocations.push({ name, body: options.body });
        return { data: { status: "processing", runId: "mission-run-1" }, error: null };
      },
    });

    const result = await createSupabaseProductionRepositories(client, workspace).missionGenesis.runMissionGenesis();

    expect(invocations).toHaveLength(1);
    expect(result).toEqual({
      outcome: "activate_mission",
      title: "Mission activated",
      body: "The Manager activated a focused London proof loop.",
      reasons: ["London is the strongest current signal."],
      questions: [],
      evidenceNeeded: [],
      missionIds: ["mission-1"],
      activatedMissionId: "mission-1",
      activatedMissionIds: ["mission-1"],
    });
  });

  it("recovers a background Mission Genesis result when the run status is stale but the mission graph exists", async () => {
    vi.useFakeTimers();

    const tables: Record<string, Array<Record<string, unknown>>> = {
      manager_synthesis_runs: [
        {
          id: "mission-run-stale-status",
          artist_workspace_id: workspace.artistWorkspaceId,
          status: "running",
        },
      ],
      manager_run_actions: [
        {
          id: "action-stale-status",
          manager_synthesis_run_id: "mission-run-stale-status",
          order_index: 1,
          payload: {
            outcome: "activate_mission",
            decisionSummary: "The Manager activated Blaqbonez-owned feature leverage.",
            reasons: ["The collaboration can grow the song without clarifying Blaqbonez's position."],
            evidenceNeeded: [],
            questions: [],
          },
          result_payload: {
            outcome: "activate_mission",
            missionId: "mission-feature-leverage",
            missionIds: ["mission-feature-leverage"],
            activatedMissionIds: ["mission-feature-leverage"],
            candidateMissionIds: ["mission-identity-position"],
            questions: [],
          },
        },
      ],
      missions: [
        {
          id: "mission-feature-leverage",
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          title: "Turn the Asake feature into Blaqbonez-owned leverage",
          status: "active",
          summary: "Use the feature moment to strengthen Blaqbonez's own public position.",
          current_recommendation: "Only scale activity that transfers attention back to Blaqbonez.",
          progress: 0,
          review_point: "Feature leverage quality",
        },
        {
          id: "mission-identity-position",
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          title: "Define Blaqbonez's 90-day career position",
          status: "candidate",
          summary: "Hidden until selected.",
          current_recommendation: "Resolve the artist identity gap.",
        },
      ],
      mission_plan_versions: [
        { id: "plan-feature-leverage", mission_id: "mission-feature-leverage", version: 1, status: "active" },
      ],
      checkpoints: [
        {
          id: "checkpoint-feature-leverage",
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          mission_id: "mission-feature-leverage",
          mission_plan_version_id: "plan-feature-leverage",
          title: "Feature leverage quality",
          question: "If the song grows but Blaqbonez's profile does not, should spend stop and the story reframe around artist identity?",
          status: "waiting",
          recommendation: "Protect Blaqbonez-owned leverage before scaling the collaboration.",
        },
      ],
      tasks: [
        {
          id: "task-feature-leverage",
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          mission_id: "mission-feature-leverage",
          mission_plan_version_id: "plan-feature-leverage",
          primary_checkpoint_id: "checkpoint-feature-leverage",
          title: "Map the feature attention back to Blaqbonez",
          status: "proposed",
          owner_role: "Artist / team",
          purpose: "Separate song-level momentum from Blaqbonez-owned audience and narrative gains.",
        },
      ],
    };
    const client = createMutableSupabaseClient(tables, {
      invoke: async () => ({ data: { status: "processing", runId: "mission-run-stale-status" }, error: null }),
    });
    const repositories = createSupabaseProductionRepositories(client, workspace);

    const resultPromise = repositories.missionGenesis.runMissionGenesis();
    await vi.advanceTimersByTimeAsync(1500 * 240);
    const result = await resultPromise;
    const missions = await repositories.missions.loadMissions();

    expect(result).toMatchObject({
      outcome: "activate_mission",
      activatedMissionId: "mission-feature-leverage",
      activatedMissionIds: ["mission-feature-leverage"],
    });
    expect(missions).toHaveLength(1);
    expect(missions[0]).toMatchObject({
      id: "mission-feature-leverage",
      title: "Turn the Asake feature into Blaqbonez-owned leverage",
      tasks: [
        expect.objectContaining({
          id: "task-feature-leverage",
          title: "Map the feature attention back to Blaqbonez",
          checkpointId: "checkpoint-feature-leverage",
        }),
      ],
      checkpoints: [
        expect.objectContaining({
          id: "checkpoint-feature-leverage",
          question: expect.stringContaining("Blaqbonez's profile does not"),
        }),
      ],
    });
  });

  it("loads Manager conversation messages and created work from persisted message metadata", async () => {
    const client = fakeSupabaseClient({
      conversations: [
        {
          id: "conversation-1",
          topic: "Budget validation",
          status: "active",
          summary: "Manager created a validation thread.",
          last_update_at: "2026-06-26T08:00:00.000Z",
          created_at: "2026-06-26T07:55:00.000Z",
        },
      ],
      conversation_messages: [
        {
          id: "message-1",
          conversation_id: "conversation-1",
          speaker: "artist",
          label: "You",
          body: "We have $5,000. What should we do this month?",
          metadata: {},
          created_at: "2026-06-26T07:56:00.000Z",
        },
        {
          id: "message-2",
          conversation_id: "conversation-1",
          speaker: "manager",
          label: "Manager",
          body: "Run a capped proof loop before scaling spend.",
          metadata: {
            contextRequestId: "context-budget-1",
            contextQuestions: [{
              key: "budget_boundary",
              question: "What budget should the Manager protect?",
              reason: "Spend changes the task plan.",
              answerKind: "money_range",
              options: [],
            }],
            createdWork: [
              {
                type: "task",
                title: "Define capped spend proof loop",
                body: "Create the test before committing the full budget.",
                id: "task-1",
                parentMissionId: "mission-1",
                status: "created",
              },
            ],
          },
          created_at: "2026-06-26T07:57:00.000Z",
        },
        {
          id: "message-3",
          conversation_id: "conversation-1",
          speaker: "artist",
          label: "You",
          body: "Context answers for Manager mission decision.",
          metadata: {
            contextRequestId: "context-budget-1",
            contextAnswers: [{ questionKey: "budget_boundary", answer: "$5,000" }],
          },
          created_at: "2026-06-26T07:58:00.000Z",
        },
      ],
      artifact_links: [
        {
          artist_workspace_id: "workspace-1",
          source_type: "conversation",
          source_id: "conversation-1",
          target_type: "task",
          target_id: "task-1",
          relationship: "references",
        },
        {
          artist_workspace_id: "workspace-1",
          source_type: "conversation",
          source_id: "conversation-1",
          target_type: "music_item",
          target_id: "song-debbie",
          relationship: "references",
        },
      ],
      music_items: [
        {
          id: "song-debbie",
          title: "Debbie",
          lifecycle_stage: "mastering",
          status: "active",
        },
      ],
    });

    const conversations = await createSupabaseProductionRepositories(client, workspace).manager.loadConversations();

    expect(conversations).toEqual([
      expect.objectContaining({
        id: "conversation-1",
        taskContextId: "task-1",
        musicSubject: { type: "music_item", id: "song-debbie", title: "Debbie", lifecycleStage: "mastering" },
        topic: "Budget validation",
        lastUpdate: "2026-06-26T08:00:00.000Z",
        messages: [
          expect.objectContaining({ id: "message-1", speaker: "artist", body: "We have $5,000. What should we do this month?" }),
          expect.objectContaining({
            id: "message-2",
            speaker: "manager",
            body: "Run a capped proof loop before scaling spend.",
            createdWork: [
              expect.objectContaining({
                type: "task",
                title: "Define capped spend proof loop",
                id: "task-1",
                parentMissionId: "mission-1",
                status: "created",
              }),
            ],
          }),
          expect.objectContaining({
            id: "message-3",
            speaker: "artist",
            contextRequestId: "context-budget-1",
            contextAnswers: [{ questionKey: "budget_boundary", answer: "$5,000" }],
          }),
        ],
        createdWork: [
          expect.objectContaining({
            type: "task",
            title: "Define capped spend proof loop",
            id: "task-1",
            parentMissionId: "mission-1",
            status: "created",
          }),
        ],
      }),
    ]);
  });

  it("sends Manager chat messages through the authenticated conversation router function", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const expected = {
      id: "conversation-2",
      topic: "Release plan",
      status: "Manager responded",
      summary: "Manager answered the release plan question.",
      prompt: "Should we move the release date?",
      lastUpdate: "Just now",
      messages: [
        { id: "message-user", speaker: "artist", label: "You", body: "Should we move the release date?" },
        { id: "message-manager", speaker: "manager", label: "Manager", body: "Do not move it until rights proof is clear." },
      ],
      createdWork: [],
    };
    const client = createMutableSupabaseClient({}, {
      invoke: async (name, options) => {
        calls.push({ name, body: options.body });
        return { data: expected, error: null };
      },
    });

    const result = await createSupabaseProductionRepositories(client, workspace).manager.sendMessage({
      conversationId: "conversation-existing",
      body: "Should we move the release date?",
      musicSubject: { type: "music_item", id: "music-item-1" },
    });

    expect(calls).toEqual([
      {
        name: "manager-conversation",
        body: {
          accountId: workspace.accountId,
          artistWorkspaceId: workspace.artistWorkspaceId,
          artistId: workspace.artistId,
          conversationId: "conversation-existing",
          body: "Should we move the release date?",
          musicSubject: { type: "music_item", id: "music-item-1" },
        },
      },
    ]);
    expect(result).toEqual(expected);
  });

  it("streams Manager chat messages through the native fetch stream function", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.test");
    const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"assistant.delta","conversationId":"conversation-existing","delta":"Streaming reply."}\n\n'));
        controller.close();
      },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url, init) => {
      fetchCalls.push({ url: String(url), init: init as RequestInit });
      return new Response(stream, { status: 200 });
    }) as unknown as typeof fetch;

    const client = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: "token-1" } }, error: null }),
      },
    } as unknown as SupabaseClient;
    const events: string[] = [];

    try {
      await createSupabaseProductionRepositories(client, workspace).manager.sendMessageStream?.(
        {
          conversationId: "conversation-existing",
          body: "Should we move the release date?",
          musicSubject: { type: "music_item", id: "music-item-1" },
        },
        {
          onEvent: (event) => {
            if (event.type === "assistant.delta") events.push(event.delta);
          },
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
      vi.unstubAllEnvs();
    }

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe("https://supabase.test/functions/v1/manager-conversation-stream");
    expect(fetchCalls[0].init.headers).toEqual({
      Authorization: "Bearer token-1",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(fetchCalls[0].init.body))).toEqual({
      accountId: workspace.accountId,
      artistWorkspaceId: workspace.artistWorkspaceId,
      artistId: workspace.artistId,
      conversationId: "conversation-existing",
      body: "Should we move the release date?",
      musicSubject: { type: "music_item", id: "music-item-1" },
    });
    expect(events).toEqual(["Streaming reply."]);
  });

  it("sends the complete context answer batch back through OpenAI", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = createMutableSupabaseClient({}, {
      invoke: async (name, options) => {
        calls.push({ name, body: options.body });
        return {
          data: {
            outcome: "no_mission",
            title: "Mission was not created",
            body: "The answers do not support new coordinated work.",
            reasons: ["The current priority is already covered."],
            questions: [],
            evidenceNeeded: [],
          },
          error: null,
        };
      },
    });
    const answers = [
      { questionKey: "mission_genesis_candidate_goal", answer: "Build London retention" },
      { questionKey: "mission_genesis_candidate_budget", answer: "$5,000" },
    ];

    await createSupabaseProductionRepositories(client, workspace).missionGenesis.answerMissionGenesisContext({
      candidateMissionId: "candidate-1",
      answers,
    });

    expect(calls).toEqual([{ name: "mission-genesis", body: {
      accountId: workspace.accountId,
      artistWorkspaceId: workspace.artistWorkspaceId,
      artistId: workspace.artistId,
      mode: "continuation",
      candidateMissionId: "candidate-1",
      answers,
    } }]);
  });

  it("loads every active mission instead of only the first page", async () => {
    const client = fakeSupabaseClient({
      missions: Array.from({ length: 25 }, (_, index) => ({
        id: `mission-${String(index + 1).padStart(2, "0")}`,
        title: `Visible mission ${index + 1}`,
        status: "active",
        summary: `Mission ${index + 1} should remain visible.`,
        current_recommendation: "Keep created mission work visible.",
        progress: index,
        review_point: "Visibility",
        created_at: `2026-06-${String(28 - index).padStart(2, "0")}T00:00:00.000Z`,
      })),
      checkpoints: [],
      tasks: [],
      task_steps: [],
      task_results: [],
    });

    const missions = await createSupabaseProductionRepositories(client, workspace).missions.loadMissions();

    expect(missions).toHaveLength(25);
    expect(missions.map((mission) => mission.title)).toContain("Visible mission 25");
  });

  it("renders a persisted met checkpoint as Met", async () => {
    const client = fakeSupabaseClient({
      missions: [{
        id: "mission-met",
        title: "Validate the market signal",
        status: "active",
        summary: "The team has completed the required validation.",
        current_recommendation: "Use the validated signal in the next mission decision.",
        progress: 100,
      }],
      checkpoints: [{
        id: "checkpoint-met",
        mission_id: "mission-met",
        title: "Market signal quality",
        question: "Was the signal sufficient to support the mission?",
        status: "met",
      }],
      tasks: [],
      task_steps: [],
      task_results: [],
      operating_events: [],
      memory_entries: [],
    });

    const [mission] = await createSupabaseProductionRepositories(client, workspace).missions.loadMissions();

    expect(mission.checkpoints).toEqual([
      expect.objectContaining({ id: "checkpoint-met", status: "Met" }),
    ]);
  });

  it("keeps checkpoint creation rationale separate from the live Manager read", async () => {
    const client = fakeSupabaseClient({
      missions: [{
        id: "mission-checkpoint-projection",
        title: "Validate the market signal",
        status: "active",
        summary: "Validate the evidence before scaling.",
        current_recommendation: "Use the current evidence in the next decision.",
        progress: 50,
      }],
      checkpoints: [{
        id: "checkpoint-projection",
        mission_id: "mission-checkpoint-projection",
        title: "Market signal quality",
        question: "Does the signal justify more work?",
        status: "waiting",
        reason_for_checkpoint: "The initial audience signal warranted a bounded validation step.",
        recommendation: "Manager read: pause scaling until the source-backed read is complete.",
      }],
      tasks: [],
      task_steps: [],
      task_results: [],
      operating_events: [],
      memory_entries: [],
    });

    const [mission] = await createSupabaseProductionRepositories(client, workspace).missions.loadMissions();
    const checkpoint = mission.checkpoints?.[0];

    expect(checkpoint).toMatchObject({
      rationale: "The initial audience signal warranted a bounded validation step.",
      managerRead: "Manager read: pause scaling until the source-backed read is complete.",
    });
    expect(checkpoint).not.toHaveProperty("resultSummary");
  });

  it("projects every Manager task and classifies participation without hiding collaborative work", async () => {
    const baseTables = {
      missions: [{
        id: "mission-legacy-manager-work",
        title: "Validate artist-owned leverage",
        status: "active",
        summary: "Separate song attention from durable artist attachment.",
        current_recommendation: "Keep validation narrow until artist attachment improves.",
        progress: 30,
      }],
      checkpoints: [{
        id: "checkpoint-legacy-manager-work",
        mission_id: "mission-legacy-manager-work",
        title: "Artist attachment",
        question: "Is discovery becoming artist-owned leverage?",
        status: "waiting",
        recommendation: "Public discovery is strong, but artist attachment is not proven yet.",
      }],
      task_steps: [],
      task_results: [],
      operating_events: [],
      memory_entries: [],
    };
    const client = fakeSupabaseClient({
      ...baseTables,
      tasks: [
        {
          id: "task-manager-analysis",
          mission_id: "mission-legacy-manager-work",
          primary_checkpoint_id: "checkpoint-legacy-manager-work",
          title: "Review discovery and attachment evidence",
          owner_role: "Manager",
          work_mode: "manager_work",
          completion_mode: "evidence",
          status: "proposed",
          approval_state: "not_required",
        },
        {
          id: "task-team-action",
          mission_id: "mission-legacy-manager-work",
          primary_checkpoint_id: "checkpoint-legacy-manager-work",
          title: "Approve the campaign angle",
          owner_role: "Manager / Marketing",
          work_mode: "collaborative",
          status: "proposed",
          approval_state: "not_required",
        },
      ],
    });

    const [mission] = await createSupabaseProductionRepositories(client, workspace).missions.loadMissions();

    expect(mission.tasks?.map((task) => task.id)).toEqual(["task-manager-analysis", "task-team-action"]);
    expect(mission.tasks?.map((task) => [task.id, task.workMode])).toEqual([
      ["task-manager-analysis", "manager_work"],
      ["task-team-action", "collaborative"],
    ]);
    expect(mission.nextTask).toBe("Approve the campaign angle");
    expect(mission.checkpoints?.[0]).toMatchObject({
      status: "Waiting on tasks",
      requiredTaskIds: ["task-team-action"],
      managerRead: "Public discovery is strong, but artist attachment is not proven yet.",
    });

    const managerOnlyClient = fakeSupabaseClient({
      ...baseTables,
      tasks: [{
        id: "task-manager-analysis",
        mission_id: "mission-legacy-manager-work",
        primary_checkpoint_id: "checkpoint-legacy-manager-work",
        title: "Review discovery and attachment evidence",
        owner_role: " Manager ",
        work_mode: "manager_work",
        completion_mode: "evidence",
        status: "proposed",
        approval_state: "not_required",
      }],
    });
    const [managerOnlyMission] = await createSupabaseProductionRepositories(managerOnlyClient, workspace).missions.loadMissions();

    expect(managerOnlyMission.tasks).toEqual([
      expect.objectContaining({ id: "task-manager-analysis", workMode: "manager_work" }),
    ]);
    expect(managerOnlyMission.checkpoints?.[0]).toMatchObject({
      status: "Watching signal",
      requiredTaskIds: [],
      nextAction: "Nothing needed from you. The Manager is watching the checkpoint signals.",
    });
  });

  it("infers legacy Manager drafts as collaborative and preserves their completed history", async () => {
    const client = fakeSupabaseClient({
      missions: [{
        id: "mission-legacy-draft",
        title: "Define the artist position",
        status: "active",
        summary: "Build the position with the Manager.",
        current_recommendation: "Use the approved position.",
        progress: 35,
      }],
      checkpoints: [{
        id: "checkpoint-legacy-draft",
        mission_id: "mission-legacy-draft",
        title: "Career thesis guides choices",
        question: "Is the thesis specific enough?",
        status: "ready_for_manager_check",
        recommendation: "The thesis is ready for the next decision.",
      }],
      tasks: [{
        id: "task-legacy-draft",
        mission_id: "mission-legacy-draft",
        primary_checkpoint_id: "checkpoint-legacy-draft",
        title: "Draft the 90-day career thesis",
        owner_role: "Manager",
        completion_mode: "manager_draft",
        status: "completed",
        user_responsibility: "Approve, correct, or reject the proposed direction.",
        approval_state: "not_required",
      }],
      task_steps: [{ task_id: "task-legacy-draft", body: "Review the proposed thesis.", order_index: 1 }],
      task_results: [{
        task_id: "task-legacy-draft",
        status: "completed",
        summary: "The artist approved the thesis.",
      }],
      operating_events: [],
      memory_entries: [],
    });

    const [mission] = await createSupabaseProductionRepositories(client, workspace).missions.loadMissions();

    expect(mission.tasks).toEqual([
      expect.objectContaining({
        id: "task-legacy-draft",
        workMode: "collaborative",
        steps: ["Review the proposed thesis."],
        result: expect.objectContaining({ status: "completed", summary: "The artist approved the thesis." }),
      }),
    ]);
    expect(mission.checkpoints?.[0].requiredTaskIds).toEqual(["task-legacy-draft"]);
  });

  it("keeps candidate missions out of the active mission list and renders generated tasks/checkpoints", async () => {
    const client = fakeSupabaseClient({
      missions: [
        {
          id: "mission-active",
          title: "Validate London market signal",
          status: "active",
          summary: "Market signal deserves focused operating attention.",
          current_recommendation: "Verify signal quality before spend.",
          progress: 20,
          review_point: "Market signal quality",
        },
        {
          id: "mission-candidate",
          title: "Candidate mission",
          status: "candidate",
          summary: "Hidden candidate.",
          current_recommendation: "Answer questions first.",
        },
      ],
      mission_plan_versions: [
        { id: "plan-1", mission_id: "mission-active", version: 1, status: "active" },
      ],
      checkpoints: [
        {
          id: "checkpoint-1",
          mission_id: "mission-active",
          mission_plan_version_id: "plan-1",
          title: "Market signal quality",
          question: "Is this market signal real enough to deserve focused operating attention?",
          status: "waiting",
          recommendation: "Verify the signal.",
        },
      ],
      tasks: [
        {
          id: "task-1",
          mission_id: "mission-active",
          mission_plan_version_id: "plan-1",
          primary_checkpoint_id: "checkpoint-1",
          title: "Verify geography signal quality",
          status: "proposed",
          owner_role: "Artist / team",
          purpose: "Confirm whether the market signal is source-backed.",
        },
      ],
    });

    const missions = await createSupabaseProductionRepositories(client, workspace).missions.loadMissions();

    expect(missions).toHaveLength(1);
    expect(missions[0]).toMatchObject({
      id: "mission-active",
      title: "Validate London market signal",
      progress: 20,
      review: "Market signal quality",
      checkpoints: [expect.objectContaining({ id: "checkpoint-1", question: expect.stringContaining("real enough") })],
      tasks: [expect.objectContaining({ id: "task-1", title: "Verify geography signal quality", checkpointId: "checkpoint-1" })],
    });
  });

  it("reviews completed mission tasks through the Manager review Edge Function", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const tables: Record<string, Array<Record<string, unknown>>> = {
      missions: [
        {
          id: "mission-active",
          title: "Validate London market signal",
          account_id: "account-1",
          artist_workspace_id: "workspace-1",
          artist_id: "artist-1",
          status: "active",
          progress: 0,
          review_point: "Market signal quality",
          summary: "Market signal deserves focused operating attention.",
          current_recommendation: "Complete source-backed validation tasks.",
        },
      ],
      checkpoints: [
        {
          id: "checkpoint-1",
          account_id: "account-1",
          artist_workspace_id: "workspace-1",
          artist_id: "artist-1",
          mission_id: "mission-active",
          title: "Market signal quality",
          question: "Is this market signal real enough to deserve focused operating attention?",
          status: "waiting",
          recommendation: "Verify the signal.",
        },
      ],
      tasks: [
        {
          id: "task-1",
          account_id: "account-1",
          artist_workspace_id: "workspace-1",
          artist_id: "artist-1",
          mission_id: "mission-active",
          primary_checkpoint_id: "checkpoint-1",
          title: "Verify geography signal quality",
          status: "approved",
          owner_role: "Artist / team",
          purpose: "Confirm whether the market signal is source-backed.",
        },
      ],
      task_state_events: [],
      task_results: [],
      memory_entries: [],
      operating_events: [],
    };
    const client = createMutableSupabaseClient(tables, {
      invoke: async (name, options) => {
        calls.push({ name, body: options.body });
        if (name !== "manager-review-task-result") {
          return { data: null, error: new Error(`Unexpected function: ${name}`) };
        }

        tables.tasks[0].status = "completed";
        tables.checkpoints[0].status = "ready_for_manager_check";
        tables.checkpoints[0].recommendation = "Manager reviewed the task result and recommends continuing the London validation path.";
        tables.missions[0].progress = 100;
        tables.missions[0].review_point = "Market signal quality";
        tables.missions[0].current_recommendation = "Continue the mission after Manager review.";
        tables.task_results.push({
          id: "task-result-1",
          task_id: "task-1",
          mission_id: "mission-active",
          checkpoint_id: "checkpoint-1",
          status: "completed",
          user_note: "London listener concentration is real across Spotify city data and repeated short-form saves.",
          manager_interpretation: "Manager reviewed the completed task against the checkpoint decision rule.",
          mission_effect: "Checkpoint is ready for the next mission decision.",
          recommended_follow_up: "Continue with the next validation task.",
        });
        tables.memory_entries.push({
          id: "memory-1",
          mission_id: "mission-active",
          task_id: "task-1",
          kind: "task_result_review",
          source_type: "manager_review_task_result",
        });
        tables.operating_events.push({
          id: "event-1",
          event_type: "task_completed",
          target_type: "task",
          target_id: "task-1",
        });

        return {
          data: {
            mission: {
              id: "mission-active",
              title: "Validate London market signal",
              status: "active",
              progress: 100,
              review_point: "Market signal quality",
              summary: "Market signal deserves focused operating attention.",
              current_recommendation: "Continue the mission after Manager review.",
              pattern_name: "city_live_market_validation",
            },
          },
          error: null,
        };
      },
    });

    const mission = await createSupabaseProductionRepositories(client, workspace).missions.completeTask("task-1", {
      status: "completed",
      note: "London listener concentration is real across Spotify city data and repeated short-form saves.",
    });

    expect(calls).toEqual([{
      name: "manager-review-task-result",
      body: {
        accountId: workspace.accountId,
        artistWorkspaceId: workspace.artistWorkspaceId,
        artistId: workspace.artistId,
        taskId: "task-1",
        status: "completed",
        note: "London listener concentration is real across Spotify city data and repeated short-form saves.",
        documentIds: [],
      },
    }]);
    expect(tables.task_results[0]).toMatchObject({
      task_id: "task-1",
      mission_id: "mission-active",
      status: "completed",
      user_note: expect.stringContaining("London listener concentration"),
      manager_interpretation: expect.stringContaining("Manager reviewed"),
    });
    expect(tables.checkpoints[0]).toMatchObject({
      status: "ready_for_manager_check",
      recommendation: expect.stringContaining("Manager reviewed"),
    });
    expect(tables.missions[0]).toMatchObject({
      progress: 100,
      review_point: "Market signal quality",
      current_recommendation: expect.stringContaining("Continue the mission"),
    });
    expect(tables.memory_entries[0]).toMatchObject({
      mission_id: "mission-active",
      task_id: "task-1",
      kind: "task_result_review",
      source_type: "manager_review_task_result",
    });
    expect(tables.operating_events[0]).toMatchObject({
      event_type: "task_completed",
      target_type: "task",
      target_id: "task-1",
    });
    expect(mission.progress).toBe(100);
    expect(mission.tasks?.[0]).toMatchObject({ id: "task-1", result: { status: "completed" } });
    expect(mission.checkpoints?.[0]).toMatchObject({ id: "checkpoint-1", status: "Ready for AI review" });
  });

  it("uploads task deliverables as linked workspace documents", async () => {
    const uploadedFiles: Array<{ bucket: string; path: string; token: string; fileName: string; options: Record<string, unknown> }> = [];
    const functionCalls: Array<{ name: string; body: Record<string, unknown> }> = [];
    const tables: Record<string, Array<Record<string, unknown>>> = {};
    const client = createMutableSupabaseClient(tables, {
      invoke: async (name, options) => {
        functionCalls.push({ name, body: options.body as Record<string, unknown> });
        if ((options.body as Record<string, unknown>).action === "prepare") {
          return {
            data: {
              uploadId: "upload-task-1",
              bucket: "workspace-documents",
              path: "account-1/workspace-1/task-1/upload-task-1-thesis.pdf",
              token: "signed-token",
            },
            error: null,
          };
        }
        return {
          data: {
            id: "document-task-1",
            documentId: "document-task-1",
            title: "90-day thesis",
            status: "uploaded",
            fileName: "thesis.pdf",
            validationSummary: "Uploaded and ready for content-aware Manager review.",
          },
          error: null,
        };
      },
      storage: {
        from(bucket) {
          return {
            async uploadToSignedUrl(path, token, file, options) {
              uploadedFiles.push({ bucket, path, token, fileName: file.name, options });
              return { data: { path }, error: null };
            },
          };
        },
      },
    });

    const deliverable = await createSupabaseProductionRepositories(client, workspace).missions.uploadTaskDeliverable?.("task-1", {
      title: "90-day thesis",
      file: new File(["positioning thesis"], "thesis.pdf", { type: "application/pdf" }),
    });

    expect(uploadedFiles).toEqual([expect.objectContaining({
      bucket: "workspace-documents",
      fileName: "thesis.pdf",
      token: "signed-token",
    })]);
    expect(functionCalls).toEqual([
      expect.objectContaining({
        name: "task-document-upload",
        body: expect.objectContaining({ action: "prepare", taskId: "task-1", fileName: "thesis.pdf" }),
      }),
      expect.objectContaining({
        name: "task-document-upload",
        body: expect.objectContaining({ action: "finalize", taskId: "task-1", uploadId: "upload-task-1" }),
      }),
    ]);
    expect(tables).toEqual({});
    expect(deliverable).toMatchObject({
      title: "90-day thesis",
      status: "uploaded",
      documentId: "document-task-1",
      fileName: "thesis.pdf",
    });
  });

  it("updates music details and uploads assets through an intent/finalize flow", async () => {
    const uploadedFiles: Array<{ bucket: string; path: string; fileName: string; options: Record<string, unknown> }> = [];
    const tables: Record<string, Array<Record<string, unknown>>> = {
      music_items: [{ id: "song-1", account_id: "account-1", artist_workspace_id: "workspace-1", artist_id: "artist-1", metadata: {} }],
      music_assets: [],
      music_credits: [],
      music_identifiers: [],
      uploaded_files: [],
      operating_events: [],
      artifact_links: [{
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        source_type: "mission",
        source_id: "mission-release-1",
        target_type: "music_item",
        target_id: "song-1",
        relationship: "references",
      }],
    };
    const client = createMutableSupabaseClient(tables, {
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, file: File, options: Record<string, unknown>) => {
            uploadedFiles.push({ bucket, path, fileName: file.name, options });
            return { data: { path }, error: null };
          },
        }),
      },
    });
    const repositories = createSupabaseProductionRepositories(client, workspace);

    await repositories.music.updateLifecycleStage("song-1", "ready");
    await repositories.music.saveDetail("song-1", { group: "Lyrics", label: "Lyrics", value: "The first line" });
    await repositories.music.saveDetail("song-1", { group: "Song identity", label: "Song title", value: "After Midnight" });
    await repositories.music.saveCredit("song-1", { role: "Producer", name: "Mara Vale" });
    await repositories.music.saveIdentifier("song-1", { identifierType: "isrc", identifierValue: "USNV12600099" });
    const uploaded = await repositories.music.uploadAsset("song-1", {
      assetType: "final_master",
      title: "Final master",
      file: new File(["audio"], "After Midnight.wav", { type: "audio/wav" }),
    });

    expect(uploaded).toMatchObject({ label: "Final master", status: "Uploaded" });
    expect(uploadedFiles).toEqual([
      expect.objectContaining({
        bucket: "music-uploads",
        fileName: "After Midnight.wav",
        path: expect.stringMatching(/^account-1\/workspace-1\/song-1\/final_master\/\d+-after-midnight\.wav$/),
        options: expect.objectContaining({ upsert: false, contentType: "audio/wav" }),
      }),
    ]);
    expect(tables.music_items[0]).toMatchObject({
      lifecycle_stage: "ready",
      title: "After Midnight",
      metadata: expect.objectContaining({ manual_details: expect.objectContaining({ lyrics: "The first line" }) }),
    });
    expect(tables.music_credits[0]).toMatchObject({
      role: "Producer",
      name: "Mara Vale",
      status: "draft",
    });
    expect(tables.music_identifiers[0]).toMatchObject({
      identifier_type: "isrc",
      identifier_value: "USNV12600099",
    });
    expect(tables.uploaded_files[0]).toMatchObject({
      file_name: "After Midnight.wav",
      file_type: "audio/wav",
      classification: "final_master",
      status: "uploaded",
      storage_bucket: "music-uploads",
      storage_ref: uploadedFiles[0]?.path,
    });
    expect(tables.music_assets[0]).toMatchObject({
      music_item_id: "song-1",
      asset_type: "final_master",
      status: "uploaded",
      uploaded_file_id: tables.uploaded_files[0]?.id,
    });
    expect(tables.operating_events.map((event) => event.event_type)).toEqual([
      "music_lifecycle_updated",
      "music_metadata_updated",
      "music_metadata_updated",
      "music_credit_updated",
      "music_identifier_added",
      "music_asset_upload_intent_created",
      "music_asset_uploaded",
    ]);
    expect(tables.operating_events.filter((event) => String(event.event_type).startsWith("music_asset_")))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ event_type: "music_asset_upload_intent_created", mission_id: "mission-release-1" }),
        expect.objectContaining({ event_type: "music_asset_uploaded", mission_id: "mission-release-1" }),
      ]));
  });

  it("creates a short-lived signed URL for an asset owned by the requested song", async () => {
    const signedUrlCalls: Array<{ bucket: string; path: string; expiresIn: number }> = [];
    const client = createMutableSupabaseClient({
      music_assets: [{
        id: "asset-1",
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        music_item_id: "song-1",
        uploaded_file_id: "file-1",
      }],
      uploaded_files: [{
        id: "file-1",
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        storage_bucket: "music-uploads",
        storage_ref: "account-1/workspace-1/song-1/final_master/master.wav",
      }],
    }, {
      storage: {
        from: (bucket: string) => ({
          upload: async () => ({ data: null, error: null }),
          createSignedUrl: async (path: string, expiresIn: number) => {
            signedUrlCalls.push({ bucket, path, expiresIn });
            return { data: { signedUrl: "https://signed.example/master.wav" }, error: null };
          },
        }),
      },
    });
    const music = createSupabaseProductionRepositories(client, workspace).music as unknown as {
      getAssetAccessUrl(musicItemId: string, assetId: string): Promise<string>;
    };

    const url = await music.getAssetAccessUrl("song-1", "asset-1");

    expect(url).toBe("https://signed.example/master.wav");
    expect(signedUrlCalls).toEqual([{
      bucket: "music-uploads",
      path: "account-1/workspace-1/song-1/final_master/master.wav",
      expiresIn: 300,
    }]);
  });

  it("does not create playback access for an asset attached to another song", async () => {
    const client = createMutableSupabaseClient({
      music_assets: [{
        id: "asset-1",
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        music_item_id: "song-2",
        uploaded_file_id: "file-1",
      }],
      uploaded_files: [],
    });
    const music = createSupabaseProductionRepositories(client, workspace).music;

    await expect(music.getAssetAccessUrl?.("song-1", "asset-1"))
      .rejects.toThrow("This file is not available to play yet.");
  });

  it("creates, removes, and sends scoped split confirmations only when totals are balanced", async () => {
    const functionCalls: Array<{ name: string; body: unknown }> = [];
    const tables: Record<string, Array<Record<string, unknown>>> = {
      music_items: [{ id: "song-1", account_id: "account-1", artist_workspace_id: "workspace-1", artist_id: "artist-1", title: "North Star" }],
      music_splits: [],
      music_split_contributors: [],
      music_split_confirmations: [],
      operating_events: [],
    };
    const repositories = createSupabaseProductionRepositories(
      createMutableSupabaseClient(tables, {
        invoke: async (name, options) => {
          functionCalls.push({ name, body: options.body });
          const split = tables.music_splits[0];
          if (split) {
            split.status = "pending_confirmation";
            split.summary = "Split confirmation links sent. Waiting for collaborators to confirm their shares.";
          }
          for (const contributor of tables.music_split_contributors) contributor.approval_status = "pending";
          tables.operating_events.push({ event_type: "music_split_confirmation_sent" });
          return { data: { status: "sent", sent: 2 }, error: null };
        },
      }),
      workspace,
    );

    await repositories.music.saveSplitContributor("song-1", {
      name: "Nova Vale",
      role: "Artist / writer",
      email: "nova@example.com",
      publishingShare: 50,
      masterShare: 70,
    });
    await repositories.music.saveSplitContributor("song-1", {
      name: "Mara Vale",
      role: "Producer / writer",
      email: "mara@example.com",
      publishingShare: 40,
      masterShare: 30,
    });

    await expect(repositories.music.sendSplitConfirmationLinks("song-1")).rejects.toThrow("Publishing and master split totals must both equal 100%.");

    await repositories.music.removeSplitContributor("song-1", tables.music_split_contributors[1]?.id as string);
    await repositories.music.saveSplitContributor("song-1", {
      name: "Mara Vale",
      role: "Producer / writer",
      email: "mara@example.com",
      publishingShare: 50,
      masterShare: 30,
    });
    await repositories.music.sendSplitConfirmationLinks("song-1");

    expect(tables.music_splits[0]).toMatchObject({
      music_item_id: "song-1",
      status: "pending_confirmation",
      publishing_total: 100,
      master_total: 100,
    });
    expect(tables.music_split_contributors).toEqual([
      expect.objectContaining({ name: "Nova Vale", email: "nova@example.com", publishing_share: 50, master_share: 70, approval_status: "pending" }),
      expect.objectContaining({ name: "Mara Vale", email: "mara@example.com", publishing_share: 50, master_share: 30, approval_status: "pending" }),
    ]);
    expect(functionCalls).toEqual([
      {
        name: "send-split-confirmations",
        body: {
          accountId: "account-1",
          artistWorkspaceId: "workspace-1",
          artistId: "artist-1",
          musicItemId: "song-1",
          appOrigin: window.location.origin,
        },
      },
    ]);
    expect(tables.operating_events.map((event) => event.event_type)).toEqual([
      "music_split_created",
      "music_split_contributor_saved",
      "music_split_contributor_saved",
      "music_split_contributor_removed",
      "music_split_contributor_saved",
      "music_split_confirmation_sent",
    ]);
  });

  it("loads and submits external split confirmations through token-scoped functions", async () => {
    const functionCalls: Array<{ name: string; body: unknown }> = [];
    const repositories = createSupabaseProductionRepositories(
      createMutableSupabaseClient(
        {},
        {
          invoke: async (name, options) => {
            functionCalls.push({ name, body: options.body });
            if (name === "load-split-confirmation") {
              return {
                data: {
                  songTitle: "North Star",
                  contributorName: "Mara Vale",
                  contributorRole: "Producer / writer",
                  publishingShare: 50,
                  masterShare: 30,
                  status: "sent",
                  contributors: [
                    { name: "Nova Vale", role: "Artist / writer", publishingShare: 50, masterShare: 70, approval: "pending" },
                    { name: "Mara Vale", role: "Producer / writer", publishingShare: 50, masterShare: 30, approval: "pending" },
                  ],
                },
                error: null,
              };
            }

            return { data: { status: "partially_confirmed" }, error: null };
          },
        },
      ),
      workspace,
    );

    await expect(repositories.music.loadSplitConfirmation("")).rejects.toThrow("Split confirmation token is required.");
    const confirmation = await repositories.music.loadSplitConfirmation("raw-token");
    await repositories.music.submitSplitConfirmation("raw-token", { decision: "confirmed", confirmationText: "I confirm these split details." });

    expect(confirmation).toMatchObject({
      songTitle: "North Star",
      contributorName: "Mara Vale",
      publishingShare: "50%",
      masterShare: "30%",
    });
    expect(functionCalls).toEqual([
      { name: "load-split-confirmation", body: { token: "raw-token" } },
      {
        name: "confirm-split",
        body: {
          token: "raw-token",
          decision: "confirmed",
          confirmationText: "I confirm these split details.",
        },
      },
    ]);
  });

  it("marks upload intents failed and surfaces Supabase Storage/RLS errors", async () => {
    const tables: Record<string, Array<Record<string, unknown>>> = {
      music_items: [{ id: "song-1", account_id: "account-1", artist_workspace_id: "workspace-1", artist_id: "artist-1", metadata: {} }],
      music_assets: [],
      uploaded_files: [],
      operating_events: [],
    };
    const client = createMutableSupabaseClient(tables, {
      storage: {
        from: () => ({
          upload: async () => ({
            data: null,
            error: { message: "new row violates row-level security policy" },
          }),
        }),
      },
    });
    const repositories = createSupabaseProductionRepositories(client, workspace);

    await expect(
      repositories.music.uploadAsset("song-1", {
        assetType: "split_sheet",
        title: "Split sheet document",
        file: new File(["split"], "split.pdf", { type: "application/pdf" }),
      }),
    ).rejects.toThrow("new row violates row-level security policy");

    expect(tables.uploaded_files[0]).toMatchObject({
      status: "failed",
      error: "new row violates row-level security policy",
    });
    expect(tables.music_assets).toEqual([]);
    expect(tables.operating_events.map((event) => event.event_type)).toEqual([
      "music_asset_upload_intent_created",
      "music_asset_upload_failed",
    ]);
  });

  it("searches Spotify artists and connects identity through a non-blocking Supabase function", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = {
      functions: {
        invoke: async (name: string, options: { body: unknown }) => {
          calls.push({ name, body: options.body });

          if (name === "spotify-artist-search") {
            return {
              data: {
                artists: [
                  {
                    spotifyArtistId: "spotify-artist-1",
                    name: "Sable Day",
                    spotifyUrl: "https://open.spotify.com/artist/spotify-artist-1",
                    spotifyUri: "spotify:artist:spotify-artist-1",
                    followers: 25000,
                    genres: ["alt-pop"],
                    imageUrl: "https://i.scdn.co/image/artist",
                  },
                ],
              },
              error: null,
            };
          }

          return {
            data: {
              account_id: "account-1",
              artist_workspace_id: "workspace-1",
              artist_id: "artist-1",
              artist_name: "Sable Day",
              workspace_name: "Nova Vale Desk",
              status: "setup",
              spotify_connected: true,
              spotify_artist_id: "spotify-artist-1",
              spotify_artist_name: "Sable Day",
              spotify_artist_url: "https://open.spotify.com/artist/spotify-artist-1",
              spotify_image_url: "https://i.scdn.co/image/artist",
              context_complete: false,
              latest_catalog_sync_status: "running",
            },
            error: null,
          };
        },
      },
    } as unknown as SupabaseClient;

    const adapter = createSupabaseSpotifyArtistAdapter(client);
    const [candidate] = await adapter.searchArtists("Sable Day");
    const result = await adapter.connectArtist(workspace, candidate);

    expect(calls).toEqual([
      {
        name: "spotify-artist-search",
        body: { query: "Sable Day" },
      },
      {
        name: "connect-spotify-artist",
        body: {
          accountId: "account-1",
          artistWorkspaceId: "workspace-1",
          artistId: "artist-1",
          selectedArtist: candidate,
          market: "US",
        },
      },
    ]);
    expect(result).toMatchObject({
      spotifyConnected: true,
      spotifyArtistId: "spotify-artist-1",
      latestCatalogSyncStatus: "running",
      contextComplete: false,
    });
  });

  it("falls back to authenticated client writes when the hosted connect function fails", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const tables: Record<string, Array<Record<string, unknown>>> = {
      source_providers: [{ id: "provider-spotify", provider_key: "spotify" }],
      artist_profiles: [{ id: "profile-1", account_id: "account-1", artist_workspace_id: "workspace-1", artist_id: "artist-1" }],
      source_connections: [],
      source_sync_jobs: [],
      artists: [{ id: "artist-1", account_id: "account-1", display_name: "Nova Vale" }],
    };
    const client = createMutableSupabaseClient(tables, {
      invoke: async (name: string, options: { body: unknown }) => {
        calls.push({ name, body: options.body });

        if (name === "connect-spotify-artist") {
          return {
            data: null,
            error: {
              message: "Edge Function returned a non-2xx status code",
              context: {
                clone: () => ({
                  json: async () => ({ error: "connect function crashed after artist identity was selected" }),
                }),
              },
            },
          };
        }

        return {
          data: { status: "completed", sourceSyncJobId: "sync-job-1" },
          error: null,
        };
      },
    });

    const candidate = {
      spotifyArtistId: "spotify-artist-1",
      name: "Sable Day",
      spotifyUrl: "https://open.spotify.com/artist/spotify-artist-1",
      spotifyUri: "spotify:artist:spotify-artist-1",
      followers: 25000,
      genres: ["alt-pop"],
      imageUrl: "https://i.scdn.co/image/artist",
    };

    const result = await createSupabaseSpotifyArtistAdapter(client).connectArtist(workspace, candidate);

    expect(result).toMatchObject({
      spotifyConnected: true,
      spotifyArtistId: "spotify-artist-1",
      spotifyArtistName: "Sable Day",
      latestCatalogSyncStatus: "running",
    });
    expect(tables.artists[0]).toMatchObject({
      display_name: "Sable Day",
      canonical_spotify_artist_id: "spotify-artist-1",
      canonical_spotify_url: "https://open.spotify.com/artist/spotify-artist-1",
    });
    expect(tables.artist_profiles[0].spotify_identity).toMatchObject({
      id: "spotify-artist-1",
      name: "Sable Day",
      url: "https://open.spotify.com/artist/spotify-artist-1",
      image_url: "https://i.scdn.co/image/artist",
    });
    expect(tables.source_connections[0]).toMatchObject({
      provider_id: "provider-spotify",
      handle_or_external_ref: "spotify-artist-1",
      status: "connected",
    });
    expect(tables.source_sync_jobs[0]).toMatchObject({
      job_type: "spotify_catalog_bootstrap",
      trigger_type: "setup",
      status: "running",
      source_connection_id: "source_connection-1",
    });
    expect(calls.map((call) => call.name)).toEqual(["connect-spotify-artist", "spotify-catalog-bootstrap"]);
    expect(calls[1]?.body).toMatchObject({
      sourceConnectionId: "source_connection-1",
      sourceSyncJobId: "source_sync_job-1",
    });
  });

  it("surfaces Spotify bootstrap error bodies returned by Supabase functions", async () => {
    const client = {
      functions: {
        invoke: async () => ({
          data: null,
          error: {
            message: "Edge Function returned a non-2xx status code",
            context: {
              clone: () => ({
                json: async () => ({ error: "Missing required environment variable: SPOTIFY_CLIENT_SECRET" }),
              }),
            },
          },
        }),
      },
    } as unknown as SupabaseClient;

    const adapter = createSupabaseSpotifyArtistAdapter(client);

    await expect(
      adapter.bootstrapCatalog(workspace, {
        spotifyArtistId: "spotify-artist-1",
        name: "Sable Day",
        spotifyUrl: "https://open.spotify.com/artist/spotify-artist-1",
        spotifyUri: "spotify:artist:spotify-artist-1",
        genres: [],
      }),
    ).rejects.toThrow("Missing required environment variable: SPOTIFY_CLIENT_SECRET");
  });
});

function musicManagerReadTables(
  overrides: Partial<Record<string, Array<Record<string, unknown>>>> = {},
): Record<string, Array<Record<string, unknown>>> {
  return {
    music_items: [
      {
        id: "song-jam",
        account_id: "account-1",
        artist_workspace_id: "workspace-1",
        artist_id: "artist-1",
        status: "active",
        title: "Jam",
        item_type: "released_track",
        lifecycle_stage: "released",
        source_kind: "spotify_public_catalog",
        source_limit: "Public catalog metadata only.",
        created_at: "2026-07-27T08:00:00.000Z",
        metadata: { spotify: { track_id: "spotify-track-jam" } },
      },
    ],
    music_projects: [],
    music_project_items: [],
    music_identifiers: [],
    music_assets: [],
    music_credits: [],
    music_splits: [],
    evidence_items: [],
    manager_outputs: [],
    manager_synthesis_runs: [],
    ...overrides,
  };
}

function musicManagerOutputRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "output-jam",
    account_id: "account-1",
    artist_workspace_id: "workspace-1",
    artist_id: "artist-1",
    source_packet_id: "packet-1",
    created_from_run_id: "run-output",
    output_type: "song_manager_read",
    subject_type: "music_item",
    subject_id: "song-jam",
    is_current: true,
    schema_version: "music-manager-read-v2",
    render_json: musicManagerReadV2,
    created_at: "2026-07-27T09:00:00.000Z",
    ...overrides,
  };
}

function musicManagerRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-jam",
    account_id: "account-1",
    artist_workspace_id: "workspace-1",
    artist_id: "artist-1",
    classification: "music_manager_read_v2",
    subject_type: "music_item",
    subject_id: "song-jam",
    status: "completed",
    error: null,
    created_at: "2026-07-27T09:00:00.000Z",
    completed_at: "2026-07-27T09:01:00.000Z",
    ...overrides,
  };
}

function fakeSupabaseClient(tableData: Record<string, unknown[]>) {
  return {
    from(table: string) {
      return queryResult(tableData[table] ?? []);
    },
  } as unknown as SupabaseClient;
}

function queryResult(data: unknown[]) {
  const result = {
    select: () => result,
    eq: () => result,
    in: () => result,
    limit: () => result,
    order: () => result,
    maybeSingle: () => Promise.resolve({ data: data[0] ?? null, error: null }),
    single: () => Promise.resolve({ data: data[0], error: null }),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  return result;
}

function createMutableSupabaseClient(
  tableData: Record<string, Array<Record<string, unknown>>>,
  extras: {
    invoke?: (name: string, options: { body: unknown }) => Promise<{ data: unknown; error: unknown }>;
    storage?: {
      from(bucket: string): {
        upload(path: string, file: File, options: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
        createSignedUrl?(path: string, expiresIn: number): Promise<{ data: { signedUrl?: string } | null; error: unknown }>;
      };
    };
  } = {},
) {
  return {
    functions: extras.invoke ? { invoke: extras.invoke } : undefined,
    storage: extras.storage,
    from(table: string) {
      return mutableQuery(table, tableData);
    },
  } as unknown as SupabaseClient;
}

type ObservedQueryCall = {
  table: string;
  select: string;
  filters: Array<[string, unknown]>;
  inFilters: Array<[string, unknown[]]>;
  orders: Array<[string, boolean | undefined]>;
  limit?: number;
};

function createObservedSupabaseClient(
  tableData: Record<string, Array<Record<string, unknown>>>,
  extras: {
    invoke?: (name: string, options: { body: unknown }) => Promise<{ data: unknown; error: unknown }>;
  } = {},
) {
  const calls: ObservedQueryCall[] = [];
  const client = {
    functions: extras.invoke ? { invoke: extras.invoke } : undefined,
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const inFilters: Array<[string, unknown[]]> = [];
      const orders: Array<[string, boolean | undefined]> = [];
      let selectedColumns = "";
      let limitCount: number | undefined;

      const execute = async () => {
        calls.push({
          table,
          select: selectedColumns,
          filters: [...filters],
          inFilters: [...inFilters],
          orders: [...orders],
          limit: limitCount,
        });
        const rows = (tableData[table] ?? []).filter((row) =>
          filters.every(([key, value]) => row[key] === value) &&
          inFilters.every(([key, values]) => values.includes(row[key])),
        );
        return { data: typeof limitCount === "number" ? rows.slice(0, limitCount) : rows, error: null };
      };

      const query = {
        select(columns: string) {
          selectedColumns = columns;
          return query;
        },
        eq(key: string, value: unknown) {
          filters.push([key, value]);
          return query;
        },
        in(key: string, values: unknown[]) {
          inFilters.push([key, values]);
          return query;
        },
        order(key: string, options?: { ascending?: boolean }) {
          orders.push([key, options?.ascending]);
          return query;
        },
        limit(count: number) {
          limitCount = count;
          return query;
        },
        maybeSingle: () => execute().then(({ data, error }) => ({ data: data[0] ?? null, error })),
        single: () => execute().then(({ data, error }) => ({ data: data[0], error })),
        then: (
          resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
          reject: (reason: unknown) => unknown,
        ) => execute().then(resolve, reject),
      };
      return query;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

function mutableQuery(table: string, tableData: Record<string, Array<Record<string, unknown>>>) {
  const filters: Array<{ key: string; value: unknown }> = [];
  const inFilters: Array<{ key: string; values: unknown[] }> = [];
  let mode: "select" | "insert" | "update" | "delete" = "select";
  let payload: Record<string, unknown> | null = null;
  let limitCount: number | undefined;

  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      filters.push({ key, value });
      return query;
    },
    in: (key: string, values: unknown[]) => {
      inFilters.push({ key, values });
      return query;
    },
    limit: (count: number) => {
      limitCount = count;
      return query;
    },
    order: () => query,
    insert: (nextPayload: Record<string, unknown>) => {
      mode = "insert";
      payload = nextPayload;
      return query;
    },
    update: (nextPayload: Record<string, unknown>) => {
      mode = "update";
      payload = nextPayload;
      return query;
    },
    delete: () => {
      mode = "delete";
      return query;
    },
    maybeSingle: () => execute().then(({ data, error }) => ({ data: Array.isArray(data) ? data[0] ?? null : data, error })),
    single: () => execute().then(({ data, error }) => ({ data: Array.isArray(data) ? data[0] : data, error })),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject),
  };

  function matchingRows() {
    const rows = tableData[table] ?? [];
    const matched = rows.filter((row) =>
      filters.every((filter) => row[filter.key] === filter.value) &&
      inFilters.every((filter) => filter.values.includes(row[filter.key])),
    );
    return typeof limitCount === "number" ? matched.slice(0, limitCount) : matched;
  }

  async function execute() {
    tableData[table] = tableData[table] ?? [];

    if (mode === "insert") {
      const row = {
        id: `${table.slice(0, -1)}-${tableData[table].length + 1}`,
        ...payload,
      };
      tableData[table].push(row);
      return { data: [row], error: null };
    }

    if (mode === "update") {
      const rows = matchingRows();
      rows.forEach((row) => Object.assign(row, payload));
      return { data: rows, error: null };
    }

    if (mode === "delete") {
      const rows = matchingRows();
      tableData[table] = tableData[table].filter((row) => !rows.includes(row));
      return { data: rows, error: null };
    }

    return { data: matchingRows(), error: null };
  }

  return query;
}

