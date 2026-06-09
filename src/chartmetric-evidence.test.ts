import { describe, expect, it } from "vitest";
import {
  normalizeChartmetricArtistEvidence,
  normalizeChartmetricProjectEvidence,
  normalizeChartmetricTrackEvidence,
} from "../supabase/functions/_shared/chartmetricEvidence";

const baseContext = {
  accountId: "account-1",
  artistWorkspaceId: "workspace-1",
  artistId: "artist-1",
  musicItemId: "song-1",
  sourceSnapshotId: "snapshot-1",
  providerId: "provider-chartmetric",
  subjectLabel: "Night Bus",
  rawRef: "spotify_track_id:track-1",
};

describe("Chartmetric evidence normalization", () => {
  it("normalizes documented artist endpoint rank and score fields into provider evidence", () => {
    const evidence = normalizeChartmetricArtistEvidence(
      {
        obj: {
          id: 206557,
          name: "Chartmetric Smoke Artist",
          cm_artist_rank: 12,
          cm_artist_score: 98.4,
        },
      },
      {
        ...baseContext,
        musicItemId: undefined,
        subjectLabel: "Chartmetric Smoke Artist",
        rawRef: "206557",
      },
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "platform_metric",
        subject_type: "artist",
        subject_id: "artist-1",
        subject_label: "Chartmetric Smoke Artist",
        metric_name: "chartmetric_artist_rank",
        metric_value: 12,
        metric_unit: "rank",
        lens: "platform_performance",
        confidence: "medium",
        limitation: expect.stringContaining("Chartmetric-reported"),
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        metric_name: "chartmetric_artist_score",
        metric_value: 98.4,
        metric_unit: "score",
      }),
    );
  });

  it("normalizes artist cm_statistics into manager-usable platform, market, and social evidence", () => {
    const evidence = normalizeChartmetricArtistEvidence(
      {
        obj: {
          name: "Burna Boy",
          current_city: "Lagos",
          hometown_city: "Lagos",
          record_label: "WMG",
          career_status: { stage: "superstar", trend: "steady", stage_score: 14, trend_score: 13 },
          genres: { primary: "afrobeats", sub: ["afropop", "afropiano"] },
          cm_statistics: {
            countryRank: { rank: 1, country: "Nigeria", percentile: 1 },
            sp_followers: 16_486_083,
            sp_monthly_listeners: 33_095_448,
            sp_popularity: 80,
            sp_playlist_count: 979_389,
            sp_playlist_total_reach: 296_879_337,
            sp_editorial_playlist_count: 423,
            sp_editorial_playlist_total_reach: 136_158_471,
            sp_where_people_listen: [
              { city: "Lagos", listeners: 1_344_811 },
              { city: "London", listeners: 880_997 },
            ],
            ins_followers: 17_991_952,
            tiktok_followers: 7_400_000,
            tiktok_likes: 73_800_000,
            tiktok_track_posts: 15_763_624,
            youtube_monthly_video_views: 107_417_718,
            youtube_subscribers: 6_000_000,
            shazam_count: 103_862_003,
            deezer_fans: 1_048_012,
            pandora_lifetime_streams: 253_112_922,
          },
        },
      },
      {
        ...baseContext,
        musicItemId: undefined,
        subjectLabel: "Burna Boy",
        rawRef: "212614",
      },
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "artist_career_context",
        subject_type: "artist",
        metric_name: "career_stage",
        metric_unit: "stage",
        lens: "artist_context",
        raw_ref: "career_status:stage:superstar",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "market_rank",
        metric_name: "chartmetric_country_rank_nigeria",
        metric_value: 1,
        metric_unit: "rank",
        lens: "market",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "platform_metric",
        metric_name: "spotify_monthly_listeners",
        metric_value: 33_095_448,
        metric_unit: "listeners",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "market_metric",
        metric_name: "spotify_listener_city_lagos",
        metric_value: 1_344_811,
        metric_unit: "listeners",
        lens: "market",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "public_social_metric",
        metric_name: "tiktok_track_posts",
        metric_value: 15_763_624,
        metric_unit: "posts",
        lens: "social_attention",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "platform_metric",
        metric_name: "pandora_lifetime_streams",
        metric_value: 253_112_922,
        metric_unit: "streams",
      }),
    );
  });

  it("normalizes playlist movement with provider time window and limitation", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        playlist_movement: [
          {
            playlist_name: "Alt R&B Current",
            event: "added",
            platform: "spotify",
            followers: 120_000,
            observed_at: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "playlist_movement",
        source: "Chartmetric",
        source_kind: "third_party_provider",
        subject_type: "music_item",
        subject_id: "song-1",
        subject_label: "Night Bus",
        metric_name: "playlist_followers",
        metric_value: 120_000,
        metric_unit: "followers",
        lens: "playlist",
        confidence: "medium",
        time_window_start: "2026-06-01T00:00:00.000Z",
        time_window_end: "2026-06-01T00:00:00.000Z",
        limitation: expect.stringContaining("third-party"),
      }),
    );
  });

  it("normalizes chart appearances and adds a missing-window limitation when dates are absent", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        chart_appearances: [
          {
            chart_name: "TikTok Songs Nigeria",
            platform: "tiktok",
            rank: 24,
          },
        ],
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "chart_appearance",
        metric_name: "chart_rank",
        metric_value: 24,
        metric_unit: "rank",
        lens: "chart",
        confidence: "medium",
        limitation: expect.stringContaining("did not provide"),
      }),
    );
  });

  it("normalizes public social movement without treating attention as conversion", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        social_metrics: {
          tiktok: {
            metric: "video_creates",
            value: 430,
            window_start: "2026-05-25T00:00:00.000Z",
            window_end: "2026-06-01T00:00:00.000Z",
          },
        },
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "public_social_movement",
        metric_name: "tiktok_video_creates",
        metric_value: 430,
        metric_unit: "count",
        lens: "social_attention",
        confidence: "low",
        limitation: expect.stringContaining("not conversion proof"),
      }),
    );
  });

  it("normalizes cross-platform track identity without metric values", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        identifiers: {
          chartmetric_track_id: 123456,
          spotify_track_id: "track-1",
          isrc: "US-ABC-26-00001",
        },
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "cross_platform_track_identity",
        metric_name: "chartmetric_track_id",
        metric_unit: "identifier",
        lens: "identity",
        confidence: "medium",
        raw_ref: "chartmetric_track_id:123456",
      }),
    );
  });

  it("stores Chartmetric-provided stream counts as Chartmetric evidence", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        platform_stats: {
          spotify: {
            streams: 982_341,
            window_start: "2026-05-01",
            window_end: "2026-06-01",
          },
        },
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "platform_metric",
        source: "Chartmetric",
        metric_name: "spotify_streams",
        metric_value: 982_341,
        metric_unit: "streams",
        lens: "platform_performance",
        confidence: "medium",
        time_window_start: "2026-05-01",
        time_window_end: "2026-06-01",
        limitation: expect.stringContaining("Chartmetric-reported"),
      }),
    );
    expect(evidence).not.toContainEqual(expect.objectContaining({ metric_name: "unsupported_metric" }));
  });

  it("normalizes documented track cm_statistics into management intelligence", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        id: 165260603,
        name: "Colorado",
        track_stage: "mid-level",
        career_health: "growth",
        cm_statistics: {
          timestamp: "2026-06-06T14:09:09Z",
          score: 97.06,
          sp_streams: 8_203_174,
          sp_popularity: 71,
          num_sp_playlists: 629,
          num_sp_editorial_playlists: 8,
          sp_playlist_total_reach: 4_222_033,
          num_tt_videos: 342_000,
          tiktok_top_videos_views: 130_333_908,
          youtube_views: 5_428_881,
          shazam_counts: 227_779,
        },
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "platform_metric",
        metric_name: "spotify_streams",
        metric_value: 8_203_174,
        metric_unit: "streams",
        time_window_end: "2026-06-06T14:09:09Z",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        metric_name: "spotify_playlist_count",
        metric_value: 629,
        metric_unit: "playlists",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        metric_name: "spotify_editorial_playlist_count",
        metric_value: 8,
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        metric_name: "tiktok_video_count",
        metric_value: 342_000,
        confidence: "low",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "track_context",
        metric_name: "track_career_health",
        raw_ref: "track_context:career_health:growth",
      }),
    );
  });

  it("normalizes album statistics and popularity history without calling them streams", () => {
    const evidence = normalizeChartmetricProjectEvidence(
      {
        name: "Colorado",
        cm_statistics: {
          sp_popularity: 71,
          num_sp_playlists: 629,
          num_sp_editorial_playlists: 8,
          sp_playlist_total_reach: 4_222_033,
          sp_editorial_playlist_total_reach: 1_200_000,
        },
        _spotify_popularity_history: [
          { timestp: "2026-06-01", value: 70 },
          { timestp: "2026-06-02", value: 71 },
        ],
        _album_tracks: [
          { name: "Colorado", cm_track: 165260603 },
        ],
      },
      {
        ...baseContext,
        musicItemId: undefined,
        musicProjectId: "project-1",
        subjectLabel: "Colorado",
        rawRef: "815685",
      },
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        subject_type: "music_project",
        subject_id: "project-1",
        metric_name: "spotify_popularity",
        metric_value: 71,
        metric_unit: "score",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        metric_name: "spotify_playlist_total_reach",
        metric_value: 4_222_033,
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "spotify_popularity_trend",
        metric_name: "spotify_popularity_latest",
        metric_value: 71,
        time_window_end: "2026-06-02",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "release_tracklist",
        metric_name: "chartmetric_album_track_count",
        metric_value: 1,
      }),
    );
    expect(evidence).not.toContainEqual(
      expect.objectContaining({ metric_name: expect.stringContaining("stream") }),
    );
  });

  it("drops unsupported private analytics and records an explicit limitation", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        spotify_saves: 12_000,
        source_of_stream: "algorithmic",
        campaign_roi: 3.2,
      },
      baseContext,
    );

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      evidence_type: "source_limitation",
      metric_name: "unsupported_metric",
      confidence: "unknown",
      limitation: expect.stringContaining("private Spotify analytics"),
    });
    expect(JSON.stringify(evidence)).not.toContain("12000");
    expect(JSON.stringify(evidence)).not.toContain("algorithmic");
    expect(JSON.stringify(evidence)).not.toContain("3.2");
  });

  it("normalizes Spotify stream history from supplemental data into peak day, trailing totals, and trajectory trend", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        _spotify_stream_history: [
          { timestp: "2026-05-01", value: 1000 },
          { timestp: "2026-05-02", value: 1100 },
          { timestp: "2026-05-03", value: 1200 },
          { timestp: "2026-05-04", value: 1300 },
          { timestp: "2026-05-05", value: 1400 },
          { timestp: "2026-05-06", value: 1500 },
          { timestp: "2026-05-07", value: 1600 },
          { timestp: "2026-05-08", value: 1700 },
          { timestp: "2026-05-09", value: 1800 },
          { timestp: "2026-05-10", value: 1900 },
          { timestp: "2026-05-11", value: 2000 },
          { timestp: "2026-05-12", value: 2100 },
          { timestp: "2026-05-13", value: 2200 },
          { timestp: "2026-05-14", value: 2300 },
        ],
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "spotify_stream_peak_day",
        metric_name: "spotify_peak_day_streams",
        metric_value: 2300,
        time_window_start: "2026-05-14",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "spotify_trailing_streams",
        metric_name: "spotify_trailing_7d_streams",
        metric_value: 14000,
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "spotify_trailing_streams",
        metric_name: "spotify_trailing_28d_streams",
        metric_value: 23100,
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "spotify_stream_trend",
        metric_name: "spotify_stream_trend_up",
        metric_value: 54, // % change
      }),
    );
  });

  it("normalizes active playlist snapshot from supplemental data, distinguishing editorial and algorithmic reach", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        _active_playlists: [
          { name: "RapCaviar", platform: "spotify", followers: 14000000, editorial: true, position: 3, added_at: "2026-06-01" },
          { name: "Discover Weekly", platform: "spotify", followers: 50000, editorial: false, position: 12, added_at: "2026-06-02" },
        ],
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "playlist_placement",
        metric_name: "spotify_editorial_playlist_reach",
        metric_value: 14000000,
        time_window_start: "2026-06-01",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "playlist_placement",
        metric_name: "spotify_algorithmic_playlist_reach",
        metric_value: 50000,
        time_window_start: "2026-06-02",
      }),
    );
  });

  it("normalizes chart history from supplemental data into chart positions", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        _chart_history: [
          { chart_name: "Daily Viral Songs Nigeria", platform: "spotify", rank: 5, date: "2026-06-03", country: "Nigeria" },
        ],
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "chart_position",
        metric_name: "spotify_chart_rank_nigeria",
        metric_value: 5,
        time_window_start: "2026-06-03",
      }),
    );
  });

  it("normalizes TikTok activity from supplemental data into video creates total and daily peak", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        _tiktok_activity: [
          { timestp: "2026-05-10", value: 150 },
          { timestp: "2026-05-11", value: 200 },
        ],
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "tiktok_video_creates",
        metric_name: "tiktok_video_creates_total",
        metric_value: 350,
        time_window_start: "2026-05-10",
        time_window_end: "2026-05-11",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "tiktok_video_creates",
        metric_name: "tiktok_peak_day_video_creates",
        metric_value: 200,
        time_window_start: "2026-05-11",
      }),
    );
  });

  it("normalizes Apple Music activity from supplemental data into Apple Music plays total", () => {
    const evidence = normalizeChartmetricTrackEvidence(
      {
        _apple_activity: [
          { timestp: "2026-05-10", value: 500 },
          { timestp: "2026-05-11", value: 600 },
        ],
      },
      baseContext,
    );

    expect(evidence).toContainEqual(
      expect.objectContaining({
        evidence_type: "apple_music_plays",
        metric_name: "apple_music_plays_total",
        metric_value: 1100,
        time_window_start: "2026-05-10",
        time_window_end: "2026-05-11",
      }),
    );
  });
});
