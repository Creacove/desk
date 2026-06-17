import type { SupabaseClient } from "@supabase/supabase-js";
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

describe("production Supabase services", () => {
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
              headlineRead: "I'm seeing Burna Boy as a global artist with a clear home-market advantage.",
              artistSnapshot: "Your catalog and public audience picture already show a large international base.",
              signals: [
                {
                  claim: "Your strongest current proof is a top home-market position and major listener scale.",
                  whyItMatters: "That gives the team a real audience base to organize around instead of guessing.",
                  evidenceIds: ["ev-1", "ev-2"],
                },
              ],
              managerRead:
                "I'm seeing a serious artist profile, not an empty setup. Your audience picture is already broad enough that the next decision should be about focus, not basic validation.",
              teamRead: "The team should treat the artist profile, imported catalog, and public audience picture as the starting operating context.",
              todayDirective: "Pick the current release or catalog lane that deserves management attention today.",
              missingProof: ["Private saves and source-of-stream are still missing."],
              sourceLine: "Based on your saved artist profile, imported catalog, public audience signals, and current source limits.",
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
      headlineRead: "I'm seeing Burna Boy as a global artist with a clear home-market advantage.",
      managerRead: expect.stringContaining("I'm seeing a serious artist profile"),
      todayDirective: "Pick the current release or catalog lane that deserves management attention today.",
      managerSynthesisRunId: "brief-run-1",
      state: "fresh",
    });
    expect(JSON.stringify(desk.todayBrief)).not.toMatch(/Chartmetric|provider|API|normalized|database|evidence row|third-party/i);
  });

  it("generates Today's Brief manually from saved normalized sources through the Supabase function", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const brief = {
      headlineRead: "I'm seeing Nova Vale as a developing artist with enough public proof for a first read.",
      artistSnapshot: "Your setup gives the Manager a usable picture of stage, direction, catalog, and audience.",
      signals: [
        {
          claim: "The catalog gives us a starting point for management decisions.",
          whyItMatters: "It lets the team discuss actual work instead of an empty profile.",
          evidenceIds: ["catalog"],
        },
      ],
      managerRead: "The catalog tells me there is enough saved context to begin managing the artist, but not enough private proof to make spend claims.",
      teamRead: "The team should use this as an operating read, not a final campaign verdict.",
      todayDirective: "Choose the first music focus and connect stronger private proof before approving spend.",
      missingProof: ["Private saves, source-of-stream, revenue, and conversion are still missing."],
      sourceLine: "Based on your saved artist profile, imported catalog, public audience signals, and current source limits.",
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
        },
      },
    ]);
    expect(result).toMatchObject({
      headlineRead: "I'm seeing Nova Vale as a developing artist with enough public proof for a first read.",
      state: "fresh",
      managerSynthesisRunId: "brief-run-2",
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
        situationLine: "Released song · 1 current result available · Draft split proof",
        managerRead: "I found 12,500 listeners from Spotify playlist reach over Last 7 days. That shows where the song is appearing, but not whether people are saving it, returning to it, or becoming fans. I would clear the draft split proof and check listener behaviour before spending on a campaign.",
        watchNext: "Check whether people keep listening after playlist support changes.",
        managerReadState: "fallback",
        nextMove: "Add rights or split proof before treating this released catalog track as operationally clear.",
        blocker: "Draft split proof",
        rightsState: "Draft split proof",
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
        managerRead: "I found Midnight Signal as a released album with 1 track and a confirmed UPC 123456789012. The project-level read has two useful details: 845,000 streams from Spotify trailing 28d streams over 2026-05-04 to 2026-06-01; 1,800,000 followers from Spotify editorial playlist reach over 2026-06-01. North Star is the track to inspect first because it is the only track currently mapped into the project. I would not push the whole project as one campaign until we know which songs are earning saves, repeat listening, source-of-stream, and rights clearance.",
        sourceSummary: expect.objectContaining({
          badges: expect.arrayContaining(["Spotify", "Chartmetric"]),
          evidence: expect.arrayContaining([
            expect.objectContaining({ label: "Spotify trailing 28d streams", value: "845000 streams", source: "Chartmetric" }),
          ]),
        }),
      }),
    );
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
              managerRead: "I found Late Nights getting real surface area: 42,000 reported streams on its best day, 14 active playlists, and one editorial placement. I would test the hook this week, but I would not spend hard until saves and source-of-stream prove people are choosing it.",
              nextMove: "Pull Spotify for Artists saves/source data and test one hook-led content angle.",
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
      managerRead: expect.stringContaining("I found Late Nights getting real surface area"),
      nextMove: "Pull Spotify for Artists saves/source data and test one hook-led content angle.",
      watchNext: "Check whether listening stays up after playlist activity slows.",
      managerReadState: "fresh",
    });
    expect(musicViewModels.find((item) => item.id === "song-generated")?.managerRead).not.toContain("Chartmetric");
    expect(musicViewModels.find((item) => item.id === "project-generated")).toMatchObject({
      managerRead: expect.stringContaining("I found After Hours behaving like a project"),
      nextMove: "Rank the tracklist by outside attention, then choose the two songs worth management time this week.",
    });
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

    expect(song?.managerRead).toContain("I can confirm the song is live");
    expect(song?.managerRead).toContain("check listener behaviour");
    expect(song?.managerRead).not.toContain("released under Major Recordings");
    expect(song?.managerRead).not.toContain("The public catalog gives us");
    expect(song?.managerRead).not.toContain("territory/scene lanes");
    expect(song?.nextMove).toBe("Add rights or split proof before treating this released catalog track as operationally clear.");
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
              situationLine: "Released song - third-party intelligence shows serious attention - split proof is missing",
              managerRead:
                "I found Colorado has enough outside attention to work: 154.2M Spotify streams in the latest 28-day window, 4.2M playlist reach, 408.4K TikTok videos, and 230.5K Shazams. That is not a metadata story; it is a live attention story across streaming, playlists, and short-form discovery. I would clear the split proof, then use DSP countries, saves, and source-of-stream to decide where to spend and which content angle to push.",
              nextMove: "Clear split proof, then choose one market and content lane after DSP country and save data confirms where attention is converting.",
              watchNext: "Check DSP countries, saves, and source-of-stream to separate attention from real fan demand.",
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

    expect(song?.managerReadState).toBe("fallback");
    expect(song?.managerRead).toContain("154.2M Spotify streams in the latest 28-day window");
    expect(song?.managerRead).toContain("4.2M Spotify playlist reach");
    expect(song?.managerRead).toContain("408.4K TikTok videos");
    expect(song?.managerRead).not.toContain("video_creates");
    expect(song?.managerRead).not.toContain("provider_window");
    expect(song?.nextMove).toContain("Clear split proof");
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
  let mode: "select" | "insert" | "update" | "delete" = "select";
  let payload: Record<string, unknown> | null = null;
  let limitCount: number | undefined;

  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      filters.push({ key, value });
      return query;
    },
    limit: (count: number) => {
      limitCount = count;
      return query;
    },
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
    const matched = rows.filter((row) => filters.every((filter) => row[filter.key] === filter.value));
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
