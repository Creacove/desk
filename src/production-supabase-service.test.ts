import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSupabaseMusicLibraryLoader,
  createSupabaseProductionRepositories,
  createSupabaseProfileSetupService,
  createSupabaseSpotifyArtistAdapter,
  createSupabaseWorkspaceLoader,
} from "./services/productionSupabase";
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

describe("production Supabase services", () => {
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
            { label: "Recent focus", value: "Latest project + 5 songs", context: "working catalog", evidenceIds: ["catalog"] },
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
        },
      },
    ]);
    expect(result).toMatchObject({
      headlineRead: "Nova Vale's first management read has a clear market center.",
      state: "fresh",
      managerSynthesisRunId: "brief-run-2",
    });
    expect(result.intelligenceSnapshot[0]?.title).toBe("Current Music In View");
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
      },
    });
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

    const result = await createSupabaseProfileSetupService(client).saveSetupContext(workspace, {
      name: " Nova Vale ",
      spotify: "Nova Vale - Spotify public catalog",
      stage: " Emerging artist ",
      market: " Lagos ",
      genre: " Afro-fusion ",
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
          p_stage: "Emerging artist",
          p_home_market: "Lagos",
          p_genres: ["Afro-fusion"],
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
        situationLine: "Released song · 1 current result available",
        managerRead: expect.stringContaining("The Manager's Read for North Star is being prepared from the saved packet."),
        watchNext: "Watch this room for the generated Manager Read for North Star.",
        managerReadState: "loading",
        nextMove: "Wait for North Star's generated Manager Read, or regenerate it if the read does not appear shortly.",
        blocker: "No active blocker",
        rightsState: "Released catalog rights attached outside this app",
        linkedTaskCount: 0,
        fileAssets: expect.arrayContaining([
          expect.objectContaining({ label: "Spotify track page", status: "Confirmed", action: "Open Spotify URL" }),
          expect.objectContaining({ label: "Cover artwork", status: "Confirmed" }),
          expect.objectContaining({ label: "User-uploaded master", status: "Missing" }),
        ]),
        sourceSummary: expect.objectContaining({
          headline: "North Star is a Released catalog song backed by Spotify public catalog and Chartmetric evidence.",
          badges: expect.arrayContaining(["Spotify", "Chartmetric"]),
          facts: expect.arrayContaining([
            { label: "Spotify track ID", value: "song-1", source: "Spotify", status: "Confirmed" },
            { label: "ISRC", value: "USNV12600001", source: "Spotify", status: "Confirmed" },
            { label: "Popularity", value: "42", source: "Spotify", status: "Confirmed" },
          ]),
          evidence: [
            {
              label: "Spotify playlist reach",
              value: "12500 listeners",
              source: "Chartmetric",
              window: "Last 7 days",
              limitation: "Chartmetric public/social intelligence can report supported platform metrics, but does not prove private saves, source-of-stream, revenue, conversion, or campaign ROI.",
            },
          ],
          limitations: expect.arrayContaining([
            "Spotify public catalog supports identity, catalog, and public metadata only.",
            "Private analytics are still missing: streams, saves, listeners, source-of-stream, revenue, conversion, and campaign ROI are not proven by these sources.",
          ]),
        }),
      }),
    );
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
        managerRead: expect.stringContaining("The Manager's Read for Midnight Signal is being prepared from the saved packet."),
        managerReadState: "loading",
        snapshotSummary: expect.stringContaining("Spotify streams"),
        sourceSummary: expect.objectContaining({
          badges: expect.arrayContaining(["Spotify", "Chartmetric"]),
          evidence: expect.arrayContaining([
            expect.objectContaining({ label: "Spotify trailing 28d streams", value: "845000 streams", source: "Chartmetric" }),
          ]),
        }),
      }),
    );
    const projectView = musicViewModels.find((item) => item.id === "project-1");
    expect(projectView?.nextMove).toBe("Wait for Midnight Signal's generated Manager Read, or regenerate it if the read does not appear shortly.");
    expect(projectView?.intelligenceSnapshot?.[0]?.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Recent streams", value: "845K" }),
      expect.objectContaining({ label: "Playlist reach", value: "1.8M" }),
    ]));
    expect(projectView?.managerRead).not.toMatch(/private saves|repeat listeners|source-of-stream|campaign ROI|rights clearance/i);
  });

  it("prefers generated Manager reads from Music metadata without exposing provider mechanics in the main read", async () => {
    const client = fakeSupabaseClient({
      music_items: [
        {
          id: "song-generated",
          title: "Late Nights",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: {
            spotify: { track_id: "spotify-track-generated", popularity: 55 },
            manager_read: {
              situationLine: "Released song · Listening is growing · Split proof is missing",
              managerRead: "Late Nights is the record with the cleanest early music-platform surface: 42,000 reported streams on its best day, 14 active playlists, and one editorial placement give the team a real song-level read. I would use Late Nights as the first record to inspect and decide whether the playlist base or the peak listening day should shape the next team action.",
              nextMove: "Use Late Nights as the first record to inspect and compare playlist support against the peak listening day.",
              watchNext: "Check whether listening stays up after playlist activity slows.",
              generationState: "fresh",
            },
          },
        },
      ],
      music_projects: [
        {
          id: "project-generated",
          title: "After Hours",
          project_type: "album",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: {
            spotify: { album_id: "spotify-album-generated", total_tracks: 12 },
            manager_read: {
              managerRead: "I found After Hours behaving like a project with one clear job: identify the two records still pulling attention and stop treating all 12 tracks the same. The next read should rank the tracklist, not describe the album.",
              nextMove: "Rank the tracklist by outside attention, then choose the two songs worth management time this week.",
            },
          },
        },
      ],
      music_project_items: [],
      music_assets: [],
      music_credits: [],
      music_splits: [],
      music_identifiers: [],
      evidence_items: [],
    });

    const musicViewModels = await createSupabaseProductionRepositories(client, workspace).music.loadMusic();

    expect(musicViewModels.find((item) => item.id === "song-generated")).toMatchObject({
      situationLine: "Released song · Listening is growing · Split proof is missing",
      managerRead: expect.stringContaining("Late Nights is the record with the cleanest early music-platform surface"),
      nextMove: "Use Late Nights as the first record to inspect and compare playlist support against the peak listening day.",
      watchNext: "Check whether listening stays up after playlist activity slows.",
      managerReadState: "fresh",
    });
    expect(musicViewModels.find((item) => item.id === "song-generated")?.managerRead).not.toContain("Chartmetric");
    expect(musicViewModels.find((item) => item.id === "project-generated")).toMatchObject({
      managerRead: expect.stringContaining("I found After Hours behaving like a project"),
      nextMove: "Rank the tracklist by outside attention, then choose the two songs worth management time this week.",
    });
  });

  it("prefers current song and project Manager outputs over legacy Music metadata reads", async () => {
    const client = fakeSupabaseClient({
      music_items: [
        {
          id: "song-output",
          title: "Signal Run",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: {
            spotify: { track_id: "spotify-track-output", popularity: 45 },
            manager_read: {
              managerRead: "Legacy song metadata should not win.",
              nextMove: "Use the old metadata move.",
              generationState: "limited",
            },
          },
        },
      ],
      music_projects: [
        {
          id: "project-output",
          title: "Signal Pack",
          project_type: "ep",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: {
            spotify: { album_id: "spotify-album-output", total_tracks: 4 },
            manager_read: {
              managerRead: "Legacy project metadata should not win.",
              nextMove: "Use the old project move.",
            },
          },
        },
      ],
      manager_outputs: [
        {
          id: "song-output-read",
          output_type: "song_manager_read",
          subject_type: "music_item",
          subject_id: "song-output",
          is_current: true,
          render_json: {
            situationLine: "Released song - playlist support and city pressure are visible",
            managerRead:
              "Signal Run is the record with the clearest working read: playlist support and city pressure are pointing to the same song. I would make Signal Run the first music-room focus and inspect whether the playlist base or the city signal should shape the next team action.",
            nextMove: "Use Signal Run as the first music-room focus, then compare playlist support against the city signal.",
            watchNext: "Watch whether playlist support keeps matching the city signal.",
            generationState: "fresh",
          },
          created_at: "2026-06-18T08:30:00.000Z",
        },
        {
          id: "project-output-read",
          output_type: "project_manager_read",
          subject_type: "music_project",
          subject_id: "project-output",
          is_current: true,
          render_json: {
            managerRead:
              "Signal Pack reads like a project that needs a focus-track decision before a broad release push. The next read should rank the four songs by outside attention and choose the one that deserves management time first.",
            nextMove: "Rank the four songs by outside attention, then choose the first focus track.",
            generationState: "fresh",
          },
          created_at: "2026-06-18T08:30:00.000Z",
        },
      ],
      music_project_items: [],
      music_assets: [],
      music_credits: [],
      music_splits: [],
      music_identifiers: [],
      evidence_items: [],
    });

    const musicViewModels = await createSupabaseProductionRepositories(client, workspace).music.loadMusic();

    expect(musicViewModels.find((item) => item.id === "song-output")).toMatchObject({
      managerRead: expect.stringContaining("Signal Run is the record with the clearest working read"),
      nextMove: "Use Signal Run as the first music-room focus, then compare playlist support against the city signal.",
      managerReadState: "fresh",
    });
    expect(musicViewModels.find((item) => item.id === "song-output")?.managerRead).not.toContain("Legacy song metadata");
    expect(musicViewModels.find((item) => item.id === "project-output")).toMatchObject({
      managerRead: expect.stringContaining("Signal Pack reads like a project"),
      nextMove: "Rank the four songs by outside attention, then choose the first focus track.",
      managerReadState: "fresh",
    });
    expect(musicViewModels.find((item) => item.id === "project-output")?.managerRead).not.toContain("Legacy project metadata");
  });

  it("rejects bloated generated Manager reads that sound like source dumps or fake commands", async () => {
    const client = fakeSupabaseClient({
      music_items: [
        {
          id: "song-bad-generated",
          title: "6 Million",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: {
            spotify: {
              track_id: "1WVM8SKzLoAHOVBtijHdjt",
              popularity: 47,
              upc: "054391223517",
              release_date: "2025-12-05",
              artists: [{ name: "PEEKABOO" }, { name: "Skrillex" }, { name: "Flowdan" }],
            },
            manager_read: {
              managerRead:
                'I found that the track "6 Million" is a released single (UPC 054391223517) on 2025-12-05 credited to PEEKABOO, Skrillex, Flowdan and Fireboy DML, released under Major Recordings / Warner Records Inc. The public catalog gives us the exact Spotify asset and the cover image, duration, copyright owner, exclusive license, and territory/scene lanes.',
              nextMove:
                "Within 48 hours I will demand from the label/aggregator full DSP analytics for first 7 / 28 / 90 days, playlist placement report, ISRC and master ownership statement, composition splits/publishing contacts, and then brief two remix commissions while preparing a press and radio list.",
            },
          },
        },
      ],
      music_projects: [],
      music_project_items: [],
      music_assets: [],
      music_credits: [],
      music_splits: [],
      music_identifiers: [],
      evidence_items: [],
    });

    const musicViewModels = await createSupabaseProductionRepositories(client, workspace).music.loadMusic();
    const song = musicViewModels.find((item) => item.id === "song-bad-generated");

    expect(song?.managerRead).toContain("The Manager's Read for 6 Million is being prepared from the saved packet.");
    expect(song?.managerReadState).toBe("loading");
    expect(song?.managerRead).not.toContain("released under Major Recordings");
    expect(song?.managerRead).not.toContain("The public catalog gives us");
    expect(song?.managerRead).not.toContain("territory/scene lanes");
    expect(song?.managerRead).not.toMatch(/source-of-stream|private saves|repeat listeners|campaign ROI/i);
    expect(song?.nextMove).toBe("Wait for 6 Million's generated Manager Read, or regenerate it if the read does not appear shortly.");
    expect(song?.nextMove).not.toContain("Within 48 hours I will demand");
  });

  it("keeps data-rich generated Manager reads instead of falling back on arbitrary short-copy limits", async () => {
    const client = fakeSupabaseClient({
      music_items: [
        {
          id: "song-useful-generated",
          title: "Colorado",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: {
            spotify: { track_id: "spotify-track-colorado" },
            manager_read: {
              situationLine: "Released song - 154.2M recent streams and 408.4K TikTok videos",
              managerRead:
                "Colorado is the record with the clearest public pressure in this workspace: 154.2M Spotify streams in the latest 28-day window, 4.2M playlist reach, 408.4K TikTok videos, and 230.5K Shazams all point to the same song. I would use Colorado as the first record to organize around and start with the platform behavior already visible: streaming scale plus short-form discovery.",
              nextMove: "Use Colorado as the first record to organize around, starting with streaming scale plus short-form discovery.",
              watchNext: "Watch whether streaming scale and TikTok creation keep pointing to the same record.",
              generationState: "limited",
            },
          },
        },
      ],
      music_projects: [],
      music_project_items: [],
      music_assets: [],
      music_credits: [],
      music_splits: [],
      music_identifiers: [],
      evidence_items: [],
    });

    const musicViewModels = await createSupabaseProductionRepositories(client, workspace).music.loadMusic();
    const song = musicViewModels.find((item) => item.id === "song-useful-generated");

    expect(song?.managerReadState).toBe("limited");
    expect(song?.managerRead).toContain("154.2M Spotify streams");
    expect(song?.managerRead).not.toContain("Basic read");
    expect(song?.managerRead).not.toMatch(/third-party|source-of-stream|private saves|repeat listeners|conversion/i);
  });

  it("keeps full-length OpenAI Manager reads that match the current prompt contract", async () => {
    const openAiManagerRead = [
      "Down Below is the record I would put in front of the team first because the useful facts are not scattered: the latest seven-day stream count, playlist count, and playlist reach all point back to one song. The public read is not saying this is already a campaign answer; it is saying the record has enough present behavior to deserve a focused inspection before the catalog gets split into too many small priorities.",
      "The important difference is that Down Below is showing both listening scale and playlist support, so the next decision should not be a generic push. I would compare whether the current lift is coming from playlist surfaces or from listeners choosing the song directly, then decide which lane gets the first team action.",
      "Today, I would make Down Below the lead record for the music room, inspect the playlist support against the latest stream window, and use that read to choose one practical next move instead of asking the team to work every song at once, with the artist seeing the actual management judgment instead of a recycled placeholder.",
    ].join("\n\n");
    const openAiProjectRead = [
      "IMMORTAL reads like a project that needs a focus-track decision before it needs a broad release speech. Six mapped songs give the release enough shape to judge, but the useful management question is which record is carrying the project today and which tracks are only supporting the world around it. I would not treat the EP as one equal block when the saved facts can help choose the first song to inspect.",
      "The project-level numbers give the release a real base: playlist reach and playlist count show that there is already public surface around the body of work. That matters because the team can decide whether to organize the next move around the strongest track, the playlist lane, or the release story instead of asking every song to do the same job.",
      "Today, I would keep IMMORTAL as the release frame, inspect the mapped tracklist for the song with the clearest present behavior, and use that focus-track read to decide the next team action before spending attention on the whole project.",
    ].join("\n\n");

    const client = fakeSupabaseClient({
      music_items: [
        {
          id: "song-openai-long-read",
          title: "Down Below",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: {
            spotify: { track_id: "spotify-track-down-below" },
            manager_read: {
              situationLine: "Released song - streaming scale and playlist support are both visible",
              managerRead: openAiManagerRead,
              nextMove: "Make Down Below the lead record, then compare playlist support against the latest stream window.",
              watchNext: "Watch whether playlist support keeps matching the latest stream window.",
              generationState: "fresh",
            },
          },
        },
      ],
      music_projects: [
        {
          id: "project-openai-long-read",
          title: "IMMORTAL",
          project_type: "ep",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: {
            spotify: { album_id: "spotify-project-immortal", total_tracks: 6 },
            manager_read: {
              situationLine: "Released EP - six mapped songs with playlist support in view",
              managerRead: openAiProjectRead,
              nextMove: "Keep IMMORTAL as the release frame, then choose the focus track from the mapped tracklist.",
              watchNext: "Watch which mapped song keeps carrying the project read.",
              generationState: "fresh",
            },
          },
        },
      ],
      music_project_items: [],
      music_assets: [],
      music_credits: [],
      music_splits: [],
      music_identifiers: [],
      evidence_items: [],
    });

    const musicViewModels = await createSupabaseProductionRepositories(client, workspace).music.loadMusic();
    const song = musicViewModels.find((item) => item.id === "song-openai-long-read");
    const project = musicViewModels.find((item) => item.id === "project-openai-long-read");

    expect(openAiManagerRead.split(/\s+/).filter(Boolean).length).toBeGreaterThan(170);
    expect(openAiProjectRead.split(/\s+/).filter(Boolean).length).toBeGreaterThan(170);
    expect(song?.managerReadState).toBe("fresh");
    expect(song?.managerRead).toBe(openAiManagerRead);
    expect(song?.managerRead).not.toContain("Down Below is live, but the first management read is simple");
    expect(project?.managerReadState).toBe("fresh");
    expect(project?.managerRead).toBe(openAiProjectRead);
    expect(project?.managerRead).not.toContain("IMMORTAL has 0 mapped songs");
  });

  it("does not expose vendor/source-limit language from stored generated song intelligence", async () => {
    const client = fakeSupabaseClient({
      music_items: [
        {
          id: "song-dirty-snapshot",
          title: "Jam",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: {
            spotify: { track_id: "spotify-track-jam" },
            manager_read: {
              situationLine: "Released song - 19M top TikTok views",
              managerRead:
                "Jam is the record with the clearest public pressure right now: 19M views on the top TikTok clip and 8.1M YouTube views point to the same song. Today, I would make Jam the first record to inspect and decide whether short-form discovery or video demand should lead the next team action.",
              nextMove: "Make Jam the first record to inspect and compare short-form discovery against video demand.",
              watchNext: "Watch whether TikTok and YouTube keep pointing to the same record.",
              generationState: "fresh",
              confidence: "medium",
              snapshotSummary: "Chartmetric third-party APIs say Jam has public movement.",
              intelligenceSnapshot: [
                {
                  title: "Record Intelligence",
                  insight: "Provider data shows Jam moving.",
                  metrics: [
                    {
                      label: "Missing proof",
                      value: "Territory streaming and private documents are still missing",
                      context: "Spotify for Artists export",
                      evidenceIds: ["bad-gap"],
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
      music_projects: [],
      music_project_items: [],
      music_assets: [],
      music_credits: [],
      music_splits: [],
      music_identifiers: [],
      evidence_items: [
        {
          id: "evidence-tiktok",
          music_item_id: "song-dirty-snapshot",
          source: "Chartmetric",
          source_kind: "chartmetric",
          evidence_type: "public_social_metric",
          subject_type: "music_item",
          subject_id: "song-dirty-snapshot",
          metric_name: "tiktok_top_video_views",
          metric_value: 19000000,
          metric_unit: "views",
          freshness: "provider_window",
          confidence: "medium",
        },
      ],
    });

    const musicViewModels = await createSupabaseProductionRepositories(client, workspace).music.loadMusic();
    const song = musicViewModels.find((item) => item.id === "song-dirty-snapshot");
    const visibleSnapshotText = JSON.stringify({
      situationLine: song?.situationLine,
      managerRead: song?.managerRead,
      snapshotSummary: song?.snapshotSummary,
      intelligenceSnapshot: song?.intelligenceSnapshot,
    });

    expect(song?.managerReadState).toBe("fresh");
    expect(song?.managerRead).toContain("Jam is the record with the clearest public pressure");
    expect(song?.snapshotSummary).toContain("top TikTok clip");
    expect(song?.intelligenceSnapshot?.[0]?.metrics?.[0]?.label).toBe("Top TikTok clip");
    expect(visibleSnapshotText).not.toMatch(/Chartmetric|third-party|API|provider|Missing proof|Spotify for Artists|source limits|private documents/i);
  });

  it("builds a ranked fallback Manager read from high-value evidence instead of raw metric names", async () => {
    const client = fakeSupabaseClient({
      music_items: [
        {
          id: "song-ranked-fallback",
          title: "Colorado",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: { spotify: { track_id: "spotify-track-colorado" } },
        },
      ],
      music_projects: [],
      music_project_items: [],
      music_assets: [],
      music_credits: [],
      music_splits: [
        {
          music_item_id: "song-ranked-fallback",
          status: "Missing",
          summary: "Missing split proof",
        },
      ],
      music_identifiers: [],
      evidence_items: [
        {
          id: "evidence-raw-low",
          music_item_id: "song-ranked-fallback",
          source: "Chartmetric",
          source_kind: "chartmetric",
          evidence_type: "public_social_metric",
          subject_type: "music_item",
          subject_id: "song-ranked-fallback",
          metric_name: "tiktok_peak_day_video_creates",
          metric_value: 342000,
          metric_unit: "video_creates",
          freshness: "provider_window",
          confidence: "low",
        },
        {
          id: "evidence-streams",
          music_item_id: "song-ranked-fallback",
          source: "Chartmetric",
          source_kind: "chartmetric",
          evidence_type: "spotify_trailing_streams",
          subject_type: "music_item",
          subject_id: "song-ranked-fallback",
          metric_name: "spotify_trailing_28d_streams",
          metric_value: 154185578,
          metric_unit: "streams",
          freshness: "provider_window",
          confidence: "medium",
        },
        {
          id: "evidence-reach",
          music_item_id: "song-ranked-fallback",
          source: "Chartmetric",
          source_kind: "chartmetric",
          evidence_type: "platform_metric",
          subject_type: "music_item",
          subject_id: "song-ranked-fallback",
          metric_name: "spotify_playlist_total_reach",
          metric_value: 4222033,
          metric_unit: "reach",
          freshness: "provider_window",
          confidence: "medium",
        },
        {
          id: "evidence-tiktok",
          music_item_id: "song-ranked-fallback",
          source: "Chartmetric",
          source_kind: "chartmetric",
          evidence_type: "public_social_metric",
          subject_type: "music_item",
          subject_id: "song-ranked-fallback",
          metric_name: "tiktok_video_count",
          metric_value: 408400,
          metric_unit: "videos",
          freshness: "provider_window",
          confidence: "low",
        },
      ],
    });

    const musicViewModels = await createSupabaseProductionRepositories(client, workspace).music.loadMusic();
    const song = musicViewModels.find((item) => item.id === "song-ranked-fallback");

    expect(song?.managerReadState).toBe("loading");
    expect(song?.managerRead).toContain("The Manager's Read for Colorado is being prepared from the saved packet.");
    expect(song?.managerRead).not.toMatch(/private saves|repeat listeners|source-of-stream|campaign ROI|still missing/i);
    expect(song?.managerRead).not.toContain("video_creates");
    expect(song?.managerRead).not.toContain("provider_window");
    expect(song?.nextMove).toBe("Wait for Colorado's generated Manager Read, or regenerate it if the read does not appear shortly.");
    expect(song?.blocker).toBe("No active blocker");
    expect(song?.situationLine).not.toMatch(/split proof/i);
    expect(song?.rightsState).not.toMatch(/split proof/i);
    expect(song?.fileAssets?.some((asset) => asset.group === "Splits" && asset.status === "Missing")).toBe(false);
  });

  it("keeps manual unreleased split proof blocking while ignoring split proof for released Spotify catalog imports", async () => {
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
      music_assets: [],
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
      ],
      music_identifiers: [],
      evidence_items: [],
    });

    const musicViewModels = await createSupabaseProductionRepositories(client, workspace).music.loadMusic();
    const spotifySong = musicViewModels.find((item) => item.id === "song-spotify-released");
    const manualSong = musicViewModels.find((item) => item.id === "song-manual-ready");
    const spotifyProject = musicViewModels.find((item) => item.id === "project-spotify");

    expect(spotifySong).toMatchObject({
      blocker: "No active blocker",
      rightsState: "Released catalog rights attached outside this app",
    });
    expect(spotifySong?.situationLine).not.toMatch(/split proof/i);
    expect(spotifySong?.nextMove).not.toMatch(/split proof|rights proof/i);
    expect(spotifySong?.fileAssets?.some((asset) => asset.group === "Splits" && asset.status === "Missing")).toBe(false);
    expect(spotifyProject?.blocker).toBe("No inherited blockers");
    expect(spotifyProject?.nextMove).not.toMatch(/clear rights|split proof/i);

    expect(manualSong).toMatchObject({
      blocker: "Missing split proof",
      rightsState: "Rights proof not connected",
    });
    expect(manualSong?.situationLine).toMatch(/Missing split proof/i);
    expect(manualSong?.fileAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({ group: "Splits", label: "Split sheet document", status: "Missing", canUpload: true }),
    ]));
  });

  it("builds a project fallback Manager read from available EP metrics instead of source gaps", async () => {
    const client = fakeSupabaseClient({
      music_items: [
        {
          id: "song-alaye",
          title: "Alaye",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: { spotify: { track_id: "spotify-track-alaye" } },
        },
        {
          id: "song-state-of-mind",
          title: "STATE OF MIND",
          item_type: "released_track",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: { spotify: { track_id: "spotify-track-state" } },
        },
      ],
      music_projects: [
        {
          id: "project-real",
          title: "REAL, Vol. 1",
          project_type: "ep",
          lifecycle_stage: "released",
          source_kind: "spotify_public_catalog",
          source_limit: "Spotify public catalog supports identity, catalog, and public metadata only.",
          metadata: { spotify: { album_id: "spotify-album-real", total_tracks: 2 } },
        },
      ],
      music_project_items: [
        { music_project_id: "project-real", music_item_id: "song-alaye", order_index: 1, disc_number: 1, display_title: "Alaye" },
        { music_project_id: "project-real", music_item_id: "song-state-of-mind", order_index: 2, disc_number: 1, display_title: "STATE OF MIND" },
      ],
      music_assets: [],
      music_credits: [],
      music_splits: [],
      music_identifiers: [],
      evidence_items: [
        {
          id: "project-playlist-count",
          music_project_id: "project-real",
          source: "Chartmetric",
          source_kind: "chartmetric",
          evidence_type: "platform_metric",
          subject_type: "music_project",
          subject_id: "project-real",
          metric_name: "spotify_playlist_count",
          metric_value: 5700,
          metric_unit: "playlists",
          freshness: "current",
          confidence: "medium",
        },
        {
          id: "project-editorial-count",
          music_project_id: "project-real",
          source: "Chartmetric",
          source_kind: "chartmetric",
          evidence_type: "platform_metric",
          subject_type: "music_project",
          subject_id: "project-real",
          metric_name: "spotify_editorial_playlist_count",
          metric_value: 24,
          metric_unit: "playlists",
          freshness: "current",
          confidence: "medium",
        },
        {
          id: "project-reach",
          music_project_id: "project-real",
          source: "Chartmetric",
          source_kind: "chartmetric",
          evidence_type: "platform_metric",
          subject_type: "music_project",
          subject_id: "project-real",
          metric_name: "spotify_playlist_total_reach",
          metric_value: 16200000,
          metric_unit: "reach",
          freshness: "current",
          confidence: "medium",
        },
      ],
    });

    const project = (await createSupabaseProductionRepositories(client, workspace).music.loadMusic()).find((item) => item.id === "project-real");
    const visibleText = JSON.stringify({
      situationLine: project?.situationLine,
      snapshotSummary: project?.snapshotSummary,
      managerRead: project?.managerRead,
      intelligenceSnapshot: project?.intelligenceSnapshot,
      nextMove: project?.nextMove,
    });

    expect(project?.managerReadState).toBe("loading");
    expect(project?.managerRead).toContain("The Manager's Read for REAL, Vol. 1 is being prepared from the saved packet.");
    expect(project?.snapshotSummary).toContain("playlist reach");
    expect(project?.intelligenceSnapshot?.[0]?.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Playlist count", value: "5.7K" }),
      expect.objectContaining({ label: "Editorial support", value: "24" }),
      expect.objectContaining({ label: "Playlist reach", value: "16.2M" }),
    ]));
    expect(visibleText).not.toMatch(/private analytics|private saves|listeners or saves|source-of-stream|campaign ROI|source limit|source gaps|still missing/i);
  });

  it("uses project-specific copy when project brief generation fails", async () => {
    const client = createMutableSupabaseClient(
      {
        music_items: [],
        music_projects: [],
        music_project_items: [],
        music_identifiers: [],
        music_assets: [],
        music_credits: [],
        music_splits: [],
        evidence_items: [],
      },
      {
        invoke: async () => ({
          data: null,
          error: {
            context: {
              clone: () => ({
                json: async () => ({}),
              }),
            },
          },
        }),
      },
    );

    await expect(
      createSupabaseProductionRepositories(client, workspace).music.generateMusicSummary("project-error", "music_project"),
    ).rejects.toThrow("Project brief generation failed.");
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
    expect(desk.attention[0]?.title).toBe("Private analytics missing");
    expect(desk.attention[0]?.body).toBe("Upload saves, source-of-stream, revenue, or conversion proof.");
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
          owner_role: "Manager",
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
          owner_role: "Manager",
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

  it("polls a background Mission Genesis run until the persisted action result is ready", async () => {
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
          owner_role: "Manager",
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
      ],
    });

    const conversations = await createSupabaseProductionRepositories(client, workspace).manager.loadConversations();

    expect(conversations).toEqual([
      expect.objectContaining({
        id: "conversation-1",
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
          owner_role: "Manager",
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

  it("records completed mission tasks as checkpoint evidence and refreshes mission state", async () => {
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
          owner_role: "Manager",
          purpose: "Confirm whether the market signal is source-backed.",
        },
      ],
      task_state_events: [],
      task_results: [],
      memory_entries: [],
      operating_events: [],
    };
    const client = createMutableSupabaseClient(tables);

    const mission = await createSupabaseProductionRepositories(client, workspace).missions.completeTask("task-1", {
      status: "completed",
      note: "London listener concentration is real across Spotify city data and repeated short-form saves.",
    });

    expect(tables.tasks[0]).toMatchObject({
      id: "task-1",
      status: "completed",
    });
    expect(tables.task_state_events[0]).toMatchObject({
      task_id: "task-1",
      mission_id: "mission-active",
      checkpoint_id: "checkpoint-1",
      from_status: "approved",
      to_status: "completed",
    });
    expect(tables.task_results[0]).toMatchObject({
      task_id: "task-1",
      mission_id: "mission-active",
      status: "completed",
      user_note: expect.stringContaining("London listener concentration"),
      manager_interpretation: expect.stringContaining("Task completed"),
    });
    expect(tables.checkpoints[0]).toMatchObject({
      status: "ready_for_manager_check",
      recommendation: expect.stringContaining("ready for Manager review"),
    });
    expect(tables.missions[0]).toMatchObject({
      progress: 100,
      review_point: "Market signal quality",
      current_recommendation: expect.stringContaining("ready for Manager review"),
    });
    expect(tables.memory_entries[0]).toMatchObject({
      mission_id: "mission-active",
      task_id: "task-1",
      kind: "task_result",
      source_type: "task_result",
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

  it("updates music details and uploads assets through an intent/finalize flow", async () => {
    const uploadedFiles: Array<{ bucket: string; path: string; fileName: string; options: Record<string, unknown> }> = [];
    const tables: Record<string, Array<Record<string, unknown>>> = {
      music_items: [{ id: "song-1", account_id: "account-1", artist_workspace_id: "workspace-1", artist_id: "artist-1", metadata: {} }],
      music_assets: [],
      music_credits: [],
      music_identifiers: [],
      uploaded_files: [],
      operating_events: [],
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
    expect(tables.music_items[0]).toMatchObject({ lifecycle_stage: "ready" });
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
      "music_credit_updated",
      "music_identifier_added",
      "music_asset_upload_intent_created",
      "music_asset_uploaded",
    ]);
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
          return { data: { sent: 2 }, error: null };
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

