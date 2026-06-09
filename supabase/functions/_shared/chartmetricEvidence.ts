export type ChartmetricEvidenceContext = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  musicItemId?: string;
  musicProjectId?: string;
  subjectType?: "artist" | "music_project" | "music_item";
  subjectId?: string;
  sourceSnapshotId: string;
  providerId: string;
  subjectLabel: string;
  rawRef: string;
};

export type ChartmetricEvidenceDraft = {
  account_id: string;
  artist_workspace_id: string;
  artist_id: string;
  source_snapshot_id: string;
  provider_id: string;
  source: "Chartmetric";
  source_kind: "third_party_provider";
  evidence_type: string;
  subject_type: "artist" | "music_project" | "music_item";
  subject_id: string;
  subject_label: string;
  time_window_start?: string;
  time_window_end?: string;
  metric_name?: string;
  metric_value?: number;
  metric_unit?: string;
  lens: string;
  freshness: string;
  confidence: "medium" | "low" | "unknown";
  provenance: string;
  limitation: string;
  raw_ref: string;
};

const BASE_LIMITATION =
  "Chartmetric is a third-party provider; this evidence does not prove private Spotify analytics, royalties, campaign ROI, or conversion.";
const PLATFORM_METRIC_LIMITATION =
  "Chartmetric-reported platform metric. Treat as Chartmetric evidence for the named platform and time window, not as Spotify Web API or private account analytics.";
const ATTENTION_LIMITATION =
  "Public/social movement is an attention signal, not conversion proof without private analytics, smart-link, or campaign data.";
const MISSING_WINDOW_LIMITATION =
  "Chartmetric did not provide a complete time window for this evidence row; use as directional context only.";
const UNSUPPORTED_LIMITATION =
  "Chartmetric enrichment cannot be used here as private Spotify analytics, save-rate, source-of-stream, royalty revenue, campaign ROI, or conversion proof.";

const UNSUPPORTED_KEYS = [
  "spotify_saves",
  "spotify_listeners",
  "save_rate",
  "source_of_stream",
  "royalty",
  "revenue",
  "campaign_roi",
  "conversion",
];

export function normalizeChartmetricTrackEvidence(payload: unknown, context: ChartmetricEvidenceContext): ChartmetricEvidenceDraft[] {
  return normalizeChartmetricEvidence(payload, {
    ...context,
    subjectType: "music_item",
    subjectId: context.musicItemId ?? context.subjectId,
  });
}

export function normalizeChartmetricArtistEvidence(payload: unknown, context: ChartmetricEvidenceContext): ChartmetricEvidenceDraft[] {
  return normalizeChartmetricEvidence(payload, {
    ...context,
    subjectType: "artist",
    subjectId: context.subjectId ?? context.artistId,
  });
}

export function normalizeChartmetricProjectEvidence(payload: unknown, context: ChartmetricEvidenceContext): ChartmetricEvidenceDraft[] {
  return normalizeChartmetricEvidence(payload, {
    ...context,
    subjectType: "music_project",
    subjectId: context.subjectId ?? context.musicProjectId,
  });
}

function normalizeChartmetricEvidence(payload: unknown, context: ChartmetricEvidenceContext): ChartmetricEvidenceDraft[] {
  const source = readChartmetricSource(payload);
  const evidence: ChartmetricEvidenceDraft[] = [
    // Base metadata normalizers (always present)
    ...normalizeChartmetricTopLevelMetrics(source, context),
    ...normalizeArtistContext(source, context),
    ...normalizeArtistCmStatistics(source, context),
    ...normalizeProjectCmStatistics(source, context),
    ...normalizeTrackContext(source, context),
    ...normalizeTrackCmStatistics(source, context),
    ...normalizePlatformMetrics(source, context),
    ...normalizePlaylistMovement(source, context),
    ...normalizeChartAppearances(source, context),
    ...normalizeSocialMetrics(source, context),
    ...normalizeIdentifiers(source, context),
    // Supplemental normalizers (populated when enriched payload is present)
    ...normalizeSpotifyStreamHistory(source, context),
    ...normalizeSpotifyPopularityHistory(source, context),
    ...normalizeProjectTracklist(source, context),
    ...normalizeActivePlaylists(source, context),
    ...normalizeChartHistory(source, context),
    ...normalizeTikTokActivity(source, context),
    ...normalizeAppleMusicActivity(source, context),
  ];

  if (containsUnsupportedMetric(source)) {
    evidence.push(baseEvidence(context, {
      evidence_type: "source_limitation",
      metric_name: "unsupported_metric",
      lens: "source_boundary",
      confidence: "unknown",
      limitation: UNSUPPORTED_LIMITATION,
      raw_ref: context.rawRef,
    }));
  }

  return evidence;
}

// ---------------------------------------------------------------------------
// Base metadata normalizers
// ---------------------------------------------------------------------------

function normalizeTrackContext(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  if ((context.subjectType ?? "music_item") !== "music_item") return [];
  const evidence: ChartmetricEvidenceDraft[] = [];
  const observedAt = readString(isRecord(source.cm_statistics) ? source.cm_statistics.timestamp : undefined);
  const trackStage = readString(source.track_stage);
  const careerHealth = readString(source.career_health);

  if (trackStage) {
    evidence.push(baseEvidence(context, {
      evidence_type: "track_context",
      time_window_start: observedAt,
      time_window_end: observedAt,
      metric_name: "track_stage",
      metric_unit: "text",
      lens: "platform_performance",
      confidence: "medium",
      provenance: `Chartmetric classifies ${context.subjectLabel} as ${trackStage}.`,
      limitation: BASE_LIMITATION,
      raw_ref: `track_context:stage:${trackStage}`,
    }));
  }

  if (careerHealth) {
    evidence.push(baseEvidence(context, {
      evidence_type: "track_context",
      time_window_start: observedAt,
      time_window_end: observedAt,
      metric_name: "track_career_health",
      metric_unit: "text",
      lens: "platform_performance",
      confidence: "medium",
      provenance: `Chartmetric describes the current track health for ${context.subjectLabel} as ${careerHealth}.`,
      limitation: BASE_LIMITATION,
      raw_ref: `track_context:career_health:${careerHealth}`,
    }));
  }

  return evidence;
}

function normalizeTrackCmStatistics(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  if ((context.subjectType ?? "music_item") !== "music_item") return [];
  const stats = isRecord(source.cm_statistics) ? source.cm_statistics : {};
  const observedAt = readString(stats.timestamp);
  const metricMap: Array<{
    key: string;
    name: string;
    unit: string;
    lens: string;
    evidenceType?: string;
    confidence?: "medium" | "low";
    limitation?: string;
  }> = [
    { key: "score", name: "chartmetric_track_score", unit: "score", lens: "platform_performance" },
    { key: "sp_streams", name: "spotify_streams", unit: "streams", lens: "platform_performance" },
    { key: "sp_popularity", name: "spotify_popularity", unit: "score", lens: "platform_performance" },
    { key: "num_sp_playlists", name: "spotify_playlist_count", unit: "playlists", lens: "playlist" },
    { key: "num_sp_editorial_playlists", name: "spotify_editorial_playlist_count", unit: "playlists", lens: "playlist" },
    { key: "sp_playlist_total_reach", name: "spotify_playlist_total_reach", unit: "reach", lens: "playlist" },
    { key: "num_am_playlists", name: "apple_music_playlist_count", unit: "playlists", lens: "playlist" },
    { key: "num_am_editorial_playlists", name: "apple_music_editorial_playlist_count", unit: "playlists", lens: "playlist" },
    { key: "num_tt_videos", name: "tiktok_video_count", unit: "videos", lens: "social_attention", evidenceType: "public_social_metric", confidence: "low", limitation: ATTENTION_LIMITATION },
    { key: "tiktok_top_videos_views", name: "tiktok_top_video_views", unit: "views", lens: "social_attention", evidenceType: "public_social_metric", confidence: "low", limitation: ATTENTION_LIMITATION },
    { key: "youtube_views", name: "youtube_views", unit: "views", lens: "social_attention", evidenceType: "public_social_metric", confidence: "low", limitation: ATTENTION_LIMITATION },
    { key: "shazam_counts", name: "shazam_count", unit: "shazams", lens: "platform_performance" },
    { key: "airplay_streams", name: "airplay_spins", unit: "spins", lens: "radio" },
    { key: "pandora_lifetime_streams", name: "pandora_lifetime_streams", unit: "streams", lens: "platform_performance" },
    { key: "lastfm_listeners", name: "lastfm_listeners", unit: "listeners", lens: "platform_performance" },
    { key: "lastfm_plays", name: "lastfm_plays", unit: "plays", lens: "platform_performance" },
  ];

  return metricMap.flatMap((metric) => {
    const metricValue = readNumber(stats[metric.key]);
    if (metricValue === undefined) return [];
    return [baseEvidence(context, {
      evidence_type: metric.evidenceType ?? "platform_metric",
      time_window_start: observedAt,
      time_window_end: observedAt,
      metric_name: metric.name,
      metric_value: metricValue,
      metric_unit: metric.unit,
      lens: metric.lens,
      confidence: metric.confidence ?? "medium",
      provenance: `Chartmetric ${metric.name.replaceAll("_", " ")} for ${context.subjectLabel} as of ${observedAt ?? "the latest provider snapshot"}.`,
      limitation: metric.limitation ?? PLATFORM_METRIC_LIMITATION,
      raw_ref: `cm_statistics:${metric.key}`,
    })];
  });
}

function normalizeProjectCmStatistics(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  if (context.subjectType !== "music_project") return [];
  const stats = isRecord(source.cm_statistics) ? source.cm_statistics : {};
  const observedAt = readString(stats.timestamp);
  const metricMap = [
    { key: "sp_popularity", name: "spotify_popularity", unit: "score", lens: "platform_performance" },
    { key: "num_sp_playlists", name: "spotify_playlist_count", unit: "playlists", lens: "playlist" },
    { key: "num_sp_editorial_playlists", name: "spotify_editorial_playlist_count", unit: "playlists", lens: "playlist" },
    { key: "sp_playlist_total_reach", name: "spotify_playlist_total_reach", unit: "reach", lens: "playlist" },
    { key: "sp_editorial_playlist_total_reach", name: "spotify_editorial_playlist_total_reach", unit: "reach", lens: "playlist" },
  ];

  return metricMap.flatMap((metric) => {
    const metricValue = readNumber(stats[metric.key]);
    if (metricValue === undefined) return [];
    return [baseEvidence(context, {
      evidence_type: "platform_metric",
      time_window_start: observedAt,
      time_window_end: observedAt,
      metric_name: metric.name,
      metric_value: metricValue,
      metric_unit: metric.unit,
      lens: metric.lens,
      confidence: "medium",
      provenance: `Chartmetric ${metric.name.replaceAll("_", " ")} for ${context.subjectLabel}.`,
      limitation: observedAt
        ? PLATFORM_METRIC_LIMITATION
        : `${PLATFORM_METRIC_LIMITATION} ${MISSING_WINDOW_LIMITATION}`,
      raw_ref: `cm_statistics:${metric.key}`,
    })];
  });
}

function normalizeArtistContext(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  if ((context.subjectType ?? "music_item") !== "artist") return [];
  const evidence: ChartmetricEvidenceDraft[] = [];
  const careerStatus = isRecord(source.career_status) ? source.career_status : {};
  const stage = readString(careerStatus.stage);
  const trend = readString(careerStatus.trend);
  const stageScore = readNumber(careerStatus.stage_score);
  const trendScore = readNumber(careerStatus.trend_score);
  const currentCity = readString(source.current_city);
  const hometownCity = readString(source.hometown_city);
  const recordLabel = readString(source.record_label);
  const genres = readArtistGenres(source.genres);

  if (stage) {
    evidence.push(baseEvidence(context, {
      evidence_type: "artist_career_context",
      metric_name: "career_stage",
      metric_value: stageScore,
      metric_unit: "stage",
      lens: "artist_context",
      confidence: "medium",
      provenance: `Chartmetric career stage for ${context.subjectLabel}: ${stage}.`,
      limitation: BASE_LIMITATION,
      raw_ref: `career_status:stage:${stage}`,
    }));
  }
  if (trend) {
    evidence.push(baseEvidence(context, {
      evidence_type: "artist_career_context",
      metric_name: "career_trend",
      metric_value: trendScore,
      metric_unit: "trend",
      lens: "artist_context",
      confidence: "medium",
      provenance: `Chartmetric career trend for ${context.subjectLabel}: ${trend}.`,
      limitation: BASE_LIMITATION,
      raw_ref: `career_status:trend:${trend}`,
    }));
  }
  if (currentCity) {
    evidence.push(textContextEvidence(context, "artist_current_city", currentCity, "market", `artist_location:current:${currentCity}`));
  }
  if (hometownCity) {
    evidence.push(textContextEvidence(context, "artist_hometown_city", hometownCity, "market", `artist_location:hometown:${hometownCity}`));
  }
  if (recordLabel) {
    evidence.push(textContextEvidence(context, "artist_record_label", recordLabel, "artist_context", `artist_label:${recordLabel}`));
  }
  if (genres.primary) {
    evidence.push(textContextEvidence(context, "artist_primary_genre", genres.primary, "artist_context", `artist_genre:primary:${genres.primary}`));
  }
  for (const genre of genres.sub.slice(0, 6)) {
    evidence.push(textContextEvidence(context, "artist_subgenre", genre, "artist_context", `artist_genre:sub:${genre}`));
  }

  return evidence;
}

function normalizeArtistCmStatistics(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  if ((context.subjectType ?? "music_item") !== "artist") return [];
  const stats = isRecord(source.cm_statistics) ? source.cm_statistics : {};
  const evidence: ChartmetricEvidenceDraft[] = [];
  const countryRank = isRecord(stats.countryRank) ? stats.countryRank : {};
  const country = readString(countryRank.country);
  const rank = readNumber(countryRank.rank);

  if (country && rank !== undefined) {
    evidence.push(baseEvidence(context, {
      evidence_type: "market_rank",
      metric_name: `chartmetric_country_rank_${slugMetricPart(country)}`,
      metric_value: rank,
      metric_unit: "rank",
      lens: "market",
      confidence: "medium",
      provenance: `Chartmetric country rank for ${context.subjectLabel} in ${country}.`,
      limitation: `${BASE_LIMITATION} ${MISSING_WINDOW_LIMITATION}`,
      raw_ref: `country_rank:${country}`,
    }));
  }

  const metricMap: Array<{ key: string; name: string; unit: string; lens: string; evidenceType?: string; limitation?: string; confidence?: "medium" | "low" }> = [
    { key: "sp_followers", name: "spotify_followers", unit: "followers", lens: "platform_performance" },
    { key: "sp_monthly_listeners", name: "spotify_monthly_listeners", unit: "listeners", lens: "platform_performance" },
    { key: "sp_popularity", name: "spotify_popularity", unit: "score", lens: "platform_performance" },
    { key: "sp_playlist_count", name: "spotify_playlist_count", unit: "playlists", lens: "playlist" },
    { key: "sp_playlist_total_reach", name: "spotify_playlist_total_reach", unit: "reach", lens: "playlist" },
    { key: "sp_editorial_playlist_count", name: "spotify_editorial_playlist_count", unit: "playlists", lens: "playlist" },
    { key: "sp_editorial_playlist_total_reach", name: "spotify_editorial_playlist_total_reach", unit: "reach", lens: "playlist" },
    { key: "ins_followers", name: "instagram_followers", unit: "followers", lens: "social_attention", evidenceType: "public_social_metric", limitation: ATTENTION_LIMITATION, confidence: "low" },
    { key: "tiktok_followers", name: "tiktok_followers", unit: "followers", lens: "social_attention", evidenceType: "public_social_metric", limitation: ATTENTION_LIMITATION, confidence: "low" },
    { key: "tiktok_likes", name: "tiktok_likes", unit: "likes", lens: "social_attention", evidenceType: "public_social_metric", limitation: ATTENTION_LIMITATION, confidence: "low" },
    { key: "tiktok_track_posts", name: "tiktok_track_posts", unit: "posts", lens: "social_attention", evidenceType: "public_social_metric", limitation: ATTENTION_LIMITATION, confidence: "low" },
    { key: "tiktok_top_video_views", name: "tiktok_top_video_views", unit: "views", lens: "social_attention", evidenceType: "public_social_metric", limitation: ATTENTION_LIMITATION, confidence: "low" },
    { key: "youtube_monthly_video_views", name: "youtube_monthly_video_views", unit: "views", lens: "social_attention", evidenceType: "public_social_metric", limitation: ATTENTION_LIMITATION, confidence: "low" },
    { key: "youtube_daily_video_views", name: "youtube_daily_video_views", unit: "views", lens: "social_attention", evidenceType: "public_social_metric", limitation: ATTENTION_LIMITATION, confidence: "low" },
    { key: "youtube_subscribers", name: "youtube_subscribers", unit: "subscribers", lens: "social_attention", evidenceType: "public_social_metric", limitation: ATTENTION_LIMITATION, confidence: "low" },
    { key: "shazam_count", name: "shazam_count", unit: "shazams", lens: "platform_performance" },
    { key: "deezer_fans", name: "deezer_fans", unit: "fans", lens: "platform_performance" },
    { key: "pandora_lifetime_streams", name: "pandora_lifetime_streams", unit: "streams", lens: "platform_performance" },
    { key: "pandora_listeners_28_day", name: "pandora_listeners_28_day", unit: "listeners", lens: "platform_performance" },
    { key: "genius_pageviews", name: "genius_pageviews", unit: "views", lens: "social_attention", evidenceType: "public_social_metric", limitation: ATTENTION_LIMITATION, confidence: "low" },
    { key: "twitter_followers", name: "twitter_followers", unit: "followers", lens: "social_attention", evidenceType: "public_social_metric", limitation: ATTENTION_LIMITATION, confidence: "low" },
  ];

  for (const metric of metricMap) {
    const metricValue = readNumber(stats[metric.key]);
    if (metricValue === undefined) continue;
    evidence.push(baseEvidence(context, {
      evidence_type: metric.evidenceType ?? "platform_metric",
      metric_name: metric.name,
      metric_value: metricValue,
      metric_unit: metric.unit,
      lens: metric.lens,
      confidence: metric.confidence ?? "medium",
      provenance: `Chartmetric ${metric.name.replaceAll("_", " ")} for ${context.subjectLabel}.`,
      limitation: `${metric.limitation ?? PLATFORM_METRIC_LIMITATION} ${MISSING_WINDOW_LIMITATION}`,
      raw_ref: `cm_statistics:${metric.key}`,
    }));
  }

  const listenerCities = readArray(stats.sp_where_people_listen) ?? [];
  for (const row of listenerCities) {
    if (!isRecord(row)) continue;
    const city = readString(row.city) ?? readString(row.name);
    const listeners = readNumber(row.listeners) ?? readNumber(row.value);
    if (!city || listeners === undefined) continue;
    evidence.push(baseEvidence(context, {
      evidence_type: "market_metric",
      metric_name: `spotify_listener_city_${slugMetricPart(city)}`,
      metric_value: listeners,
      metric_unit: "listeners",
      lens: "market",
      confidence: "medium",
      provenance: `Chartmetric Spotify listener city signal for ${city}.`,
      limitation: `${PLATFORM_METRIC_LIMITATION} ${MISSING_WINDOW_LIMITATION}`,
      raw_ref: `cm_statistics:sp_where_people_listen:${city}`,
    }));
  }

  return evidence;
}

function textContextEvidence(context: ChartmetricEvidenceContext, metricName: string, value: string, lens: string, rawRef: string) {
  return baseEvidence(context, {
    evidence_type: "artist_context",
    metric_name: metricName,
    metric_unit: "text",
    lens,
    confidence: "medium",
    provenance: `Chartmetric returned ${value} for ${context.subjectLabel}.`,
    limitation: BASE_LIMITATION,
    raw_ref: rawRef,
  });
}

function readChartmetricSource(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) return {};
  return isRecord(payload.obj) ? payload.obj : payload;
}

function normalizeChartmetricTopLevelMetrics(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  return [
    { sourceKey: "cm_artist_rank", metricName: "chartmetric_artist_rank", metricUnit: "rank" },
    { sourceKey: "cm_artist_score", metricName: "chartmetric_artist_score", metricUnit: "score" },
    { sourceKey: "cm_track_rank", metricName: "chartmetric_track_rank", metricUnit: "rank" },
    { sourceKey: "cm_track_score", metricName: "chartmetric_track_score", metricUnit: "score" },
  ].flatMap((metric) => {
    const metricValue = readNumber(source[metric.sourceKey]);
    if (metricValue === undefined) return [];
    return [
      baseEvidence(context, {
        evidence_type: "platform_metric",
        metric_name: metric.metricName,
        metric_value: metricValue,
        metric_unit: metric.metricUnit,
        lens: "platform_performance",
        confidence: "medium",
        provenance: `Chartmetric ${metric.metricUnit} for ${context.subjectLabel}.`,
        limitation: `${PLATFORM_METRIC_LIMITATION} ${MISSING_WINDOW_LIMITATION}`,
        raw_ref: `chartmetric:${metric.sourceKey}`,
      }),
    ];
  });
}

function normalizePlatformMetrics(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  const stats = isRecord(source.platform_stats) ? source.platform_stats : isRecord(source.stats) ? source.stats : {};
  return Object.entries(stats).flatMap(([platform, value]) => {
    if (!isRecord(value)) return [];
    return supportedPlatformMetricNames(value).flatMap((metric) => {
      const metricValue = readNumber(value[metric]);
      if (metricValue === undefined) return [];
      const windowStart = readString(value.window_start) ?? readString(value.time_window_start) ?? readString(value.since);
      const windowEnd = readString(value.window_end) ?? readString(value.time_window_end) ?? readString(value.until) ?? windowStart;
      const limitation = windowStart || windowEnd ? PLATFORM_METRIC_LIMITATION : `${PLATFORM_METRIC_LIMITATION} ${MISSING_WINDOW_LIMITATION}`;

      return [
        baseEvidence(context, {
          evidence_type: "platform_metric",
          time_window_start: windowStart,
          time_window_end: windowEnd,
          metric_name: `${platform}_${metric}`,
          metric_value: metricValue,
          metric_unit: metric,
          lens: "platform_performance",
          confidence: "medium",
          provenance: `Chartmetric ${platform} ${metric} for ${context.subjectLabel}.`,
          limitation,
          raw_ref: `platform:${platform}:${metric}`,
        }),
      ];
    });
  });
}

function supportedPlatformMetricNames(value: Record<string, unknown>) {
  return ["streams", "views", "plays", "shazams", "popularity", "score", "rank", "followers", "video_creates"].filter((metric) => readNumber(value[metric]) !== undefined);
}

function normalizePlaylistMovement(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  const rows = readArray(source.playlist_movement) || readArray(source.playlists) || [];
  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const playlistName = readString(row.playlist_name) ?? readString(row.name) ?? "Unknown playlist";
    const observedAt = readString(row.observed_at) ?? readString(row.date) ?? readString(row.updated_at);
    const followers = readNumber(row.followers) ?? readNumber(row.reach) ?? readNumber(row.audience);
    const limitation = observedAt ? BASE_LIMITATION : `${BASE_LIMITATION} ${MISSING_WINDOW_LIMITATION}`;

    return [
      baseEvidence(context, {
        evidence_type: "playlist_movement",
        time_window_start: observedAt,
        time_window_end: observedAt,
        metric_name: followers === undefined ? "playlist_movement" : "playlist_followers",
        metric_value: followers,
        metric_unit: followers === undefined ? "event" : "followers",
        lens: "playlist",
        confidence: "medium",
        provenance: `Chartmetric playlist movement for ${playlistName}.`,
        limitation,
        raw_ref: `playlist:${playlistName}`,
      }),
    ];
  });
}

function normalizeChartAppearances(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  const rows = readArray(source.chart_appearances) || readArray(source.charts) || [];
  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const chartName = readString(row.chart_name) ?? readString(row.name) ?? readString(row.chart_type) ?? "Unknown chart";
    const observedAt = readString(row.observed_at) ?? readString(row.date) ?? readString(row.updated_at);
    const rank = readNumber(row.rank) ?? readNumber(row.position);
    const limitation = observedAt ? BASE_LIMITATION : `${BASE_LIMITATION} ${MISSING_WINDOW_LIMITATION}`;

    return [
      baseEvidence(context, {
        evidence_type: "chart_appearance",
        time_window_start: observedAt,
        time_window_end: observedAt,
        metric_name: rank === undefined ? "chart_appearance" : "chart_rank",
        metric_value: rank,
        metric_unit: rank === undefined ? "appearance" : "rank",
        lens: "chart",
        confidence: "medium",
        provenance: `Chartmetric chart appearance for ${chartName}.`,
        limitation,
        raw_ref: `chart:${chartName}`,
      }),
    ];
  });
}

function normalizeSocialMetrics(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  const social = isRecord(source.social_metrics) ? source.social_metrics : isRecord(source.social) ? source.social : {};
  return Object.entries(social).flatMap(([platform, value]) => {
    if (!isRecord(value)) return [];
    const metric = readString(value.metric) ?? "movement";
    const metricValue = readNumber(value.value) ?? readNumber(value.count);
    const windowStart = readString(value.window_start) ?? readString(value.time_window_start);
    const windowEnd = readString(value.window_end) ?? readString(value.time_window_end) ?? windowStart;
    const metricName = `${platform}_${metric}`;
    const limitation = windowStart || windowEnd ? ATTENTION_LIMITATION : `${ATTENTION_LIMITATION} ${MISSING_WINDOW_LIMITATION}`;

    return [
      baseEvidence(context, {
        evidence_type: "public_social_movement",
        time_window_start: windowStart,
        time_window_end: windowEnd,
        metric_name: metricName,
        metric_value: metricValue,
        metric_unit: "count",
        lens: "social_attention",
        confidence: "low",
        provenance: `Chartmetric public/social movement for ${platform}.`,
        limitation,
        raw_ref: `social:${platform}:${metric}`,
      }),
    ];
  });
}

function normalizeIdentifiers(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  const identifiers = isRecord(source.identifiers) ? source.identifiers : isRecord(source.external_ids) ? source.external_ids : {};
  const allowedIdentifierKeys = ["chartmetric_track_id", "spotify_track_id", "isrc", "youtube_video_id", "tiktok_sound_id"];
  return allowedIdentifierKeys.flatMap((key) => {
    const value = identifiers[key];
    if (value === undefined || value === null || value === "") return [];
    return [
      baseEvidence(context, {
        evidence_type: "cross_platform_track_identity",
        metric_name: key,
        metric_unit: "identifier",
        lens: "identity",
        confidence: "medium",
        provenance: `Chartmetric returned ${key} for ${context.subjectLabel}.`,
        limitation: BASE_LIMITATION,
        raw_ref: `${key}:${String(value)}`,
      }),
    ];
  });
}

// ---------------------------------------------------------------------------
// Supplemental normalizers (enriched payload, underscore-prefixed keys)
// ---------------------------------------------------------------------------

/**
 * Normalizes Chartmetric's per-track Spotify streaming time-series into:
 * - A peak-day evidence item (highest single-day stream count + date)
 * - Trailing 7-day and 28-day stream totals
 * - Trend direction (up / down / flat) comparing first vs. last 7 days
 *
 * Expects `source._spotify_stream_history` to be an array of `{ timestp, value }` rows.
 */
function normalizeSpotifyStreamHistory(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  const rows = readArray(source._spotify_stream_history);
  if (!rows || rows.length === 0) return [];

  const evidence: ChartmetricEvidenceDraft[] = [];
  const points = rows
    .filter(isRecord)
    .map((row) => ({
      date: readString(row.timestp) ?? readString(row.date) ?? readString(row.timestamp),
      value: readNumber(row.value) ?? readNumber(row.streams) ?? readNumber(row.count),
    }))
    .filter((p): p is { date: string; value: number } => Boolean(p.date && p.value !== undefined));

  if (points.length === 0) return [];

  // Sort chronologically
  points.sort((a, b) => a.date.localeCompare(b.date));

  const windowStart = points[0].date;
  const windowEnd = points[points.length - 1].date;

  // Peak day
  const peak = points.reduce((best, p) => (p.value > best.value ? p : best), points[0]);
  evidence.push(baseEvidence(context, {
    evidence_type: "spotify_stream_peak_day",
    time_window_start: peak.date,
    time_window_end: peak.date,
    metric_name: "spotify_peak_day_streams",
    metric_value: peak.value,
    metric_unit: "streams",
    lens: "platform_performance",
    confidence: "medium",
    provenance: `Chartmetric: highest single-day Spotify stream count for ${context.subjectLabel} was ${peak.value.toLocaleString()} on ${peak.date}.`,
    limitation: PLATFORM_METRIC_LIMITATION,
    raw_ref: `spotify_stream_history:peak:${peak.date}`,
  }));

  // Trailing 7-day total
  const last7 = points.slice(-7);
  const trailing7 = last7.reduce((sum, p) => sum + p.value, 0);
  evidence.push(baseEvidence(context, {
    evidence_type: "spotify_trailing_streams",
    time_window_start: last7[0]?.date ?? windowEnd,
    time_window_end: windowEnd,
    metric_name: "spotify_trailing_7d_streams",
    metric_value: trailing7,
    metric_unit: "streams",
    lens: "platform_performance",
    confidence: "medium",
    provenance: `Chartmetric: ${context.subjectLabel} had ${trailing7.toLocaleString()} Spotify streams in the trailing 7 days.`,
    limitation: PLATFORM_METRIC_LIMITATION,
    raw_ref: `spotify_stream_history:trailing_7d`,
  }));

  // Trailing 28-day total
  if (points.length >= 14) {
    const last28 = points.slice(-28);
    const trailing28 = last28.reduce((sum, p) => sum + p.value, 0);
    evidence.push(baseEvidence(context, {
      evidence_type: "spotify_trailing_streams",
      time_window_start: last28[0]?.date ?? windowStart,
      time_window_end: windowEnd,
      metric_name: "spotify_trailing_28d_streams",
      metric_value: trailing28,
      metric_unit: "streams",
      lens: "platform_performance",
      confidence: "medium",
      provenance: `Chartmetric: ${context.subjectLabel} had ${trailing28.toLocaleString()} Spotify streams in the trailing 28 days.`,
      limitation: PLATFORM_METRIC_LIMITATION,
      raw_ref: `spotify_stream_history:trailing_28d`,
    }));
  }

  // Trend direction: compare first vs. last 7-day block
  if (points.length >= 14) {
    const first7 = points.slice(0, 7);
    const firstAvg = first7.reduce((s, p) => s + p.value, 0) / first7.length;
    const lastAvg = last7.reduce((s, p) => s + p.value, 0) / last7.length;
    const ratio = firstAvg > 0 ? lastAvg / firstAvg : 1;
    const direction = ratio >= 1.05 ? "up" : ratio <= 0.95 ? "down" : "flat";
    const trendScore = Math.round((ratio - 1) * 100); // % change
    evidence.push(baseEvidence(context, {
      evidence_type: "spotify_stream_trend",
      time_window_start: windowStart,
      time_window_end: windowEnd,
      metric_name: `spotify_stream_trend_${direction}`,
      metric_value: trendScore,
      metric_unit: "percent_change",
      lens: "platform_performance",
      confidence: "medium",
      provenance: `Chartmetric: Spotify stream trajectory for ${context.subjectLabel} is ${direction} (${trendScore > 0 ? "+" : ""}${trendScore}% vs. opening 7 days of the window).`,
      limitation: PLATFORM_METRIC_LIMITATION,
      raw_ref: `spotify_stream_history:trend:${direction}`,
    }));
  }

  return evidence;
}

function normalizeSpotifyPopularityHistory(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  if (context.subjectType !== "music_project") return [];
  const rows = readArray(source._spotify_popularity_history);
  if (!rows?.length) return [];

  const points = rows
    .filter(isRecord)
    .map((row) => ({
      date: readString(row.timestp) ?? readString(row.date) ?? readString(row.timestamp),
      value: readNumber(row.value),
    }))
    .filter((point): point is { date: string; value: number } =>
      Boolean(point.date && point.value !== undefined)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) return [];

  const latest = points[points.length - 1];
  const first = points[0];
  return [
    baseEvidence(context, {
      evidence_type: "spotify_popularity_trend",
      time_window_start: first.date,
      time_window_end: latest.date,
      metric_name: "spotify_popularity_latest",
      metric_value: latest.value,
      metric_unit: "score",
      lens: "platform_performance",
      confidence: "medium",
      provenance: `Chartmetric latest Spotify popularity score for ${context.subjectLabel}.`,
      limitation: PLATFORM_METRIC_LIMITATION,
      raw_ref: `spotify_popularity_history:latest:${latest.date}`,
    }),
  ];
}

function normalizeProjectTracklist(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  if (context.subjectType !== "music_project") return [];
  const tracks = readArray(source._album_tracks);
  if (!tracks?.length) return [];

  return [
    baseEvidence(context, {
      evidence_type: "release_tracklist",
      metric_name: "chartmetric_album_track_count",
      metric_value: tracks.filter(isRecord).length,
      metric_unit: "tracks",
      lens: "release_context",
      confidence: "medium",
      provenance: `Chartmetric returned ${tracks.filter(isRecord).length} tracks for ${context.subjectLabel}.`,
      limitation: BASE_LIMITATION,
      raw_ref: "album_tracks:count",
    }),
  ];
}

/**
 * Normalizes Chartmetric's active playlist snapshot into individual evidence items,
 * one per playlist placement. Distinguishes editorial from algorithmic playlists.
 *
 * Expects `source._active_playlists` to be an array of playlist objects.
 */
function normalizeActivePlaylists(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  const rows = readArray(source._active_playlists);
  if (!rows || rows.length === 0) return [];

  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const playlistName = readString(row.name) ?? readString(row.playlist_name) ?? "Unknown playlist";
    const platform = readString(row.platform) ?? readString(row.store) ?? "spotify";
    const followers = readNumber(row.followers) ?? readNumber(row.num_followers) ?? readNumber(row.reach);
    const isEditorial = Boolean(row.editorial) || Boolean(row.is_editorial) || readString(row.type) === "editorial";
    const position = readNumber(row.position) ?? readNumber(row.rank);
    const observedAt = readString(row.added_at) ?? readString(row.last_seen) ?? readString(row.updated_at);
    const playlistType = isEditorial ? "editorial" : "algorithmic";

    return [
      baseEvidence(context, {
        evidence_type: "playlist_placement",
        time_window_start: observedAt,
        time_window_end: observedAt,
        metric_name: `${platform}_${playlistType}_playlist_reach`,
        metric_value: followers,
        metric_unit: "followers",
        lens: "playlist",
        confidence: "medium",
        provenance: `Chartmetric: ${context.subjectLabel} is on the ${isEditorial ? "editorial" : "algorithmic"} playlist "${playlistName}" (${platform}${followers !== undefined ? `, ${followers.toLocaleString()} followers` : ""}${position !== undefined ? `, position #${position}` : ""}).`,
        limitation: BASE_LIMITATION,
        raw_ref: `active_playlists:${platform}:${slugMetricPart(playlistName)}`,
      }),
    ];
  });
}

/**
 * Normalizes Chartmetric's Spotify chart history for the track into evidence items,
 * one per chart entry.
 *
 * Expects `source._chart_history` to be an array of chart position objects.
 */
function normalizeChartHistory(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  const rows = readArray(source._chart_history);
  if (!rows || rows.length === 0) return [];

  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const chartName = readString(row.chart_name) ?? readString(row.name) ?? "Unknown chart";
    const platform = readString(row.platform) ?? readString(row.store) ?? "spotify";
    const rank = readNumber(row.rank) ?? readNumber(row.position);
    const chartDate = readString(row.date) ?? readString(row.timestp) ?? readString(row.chart_date) ?? readString(row.added_at);
    const country = readString(row.country) ?? readString(row.region) ?? readString(row.code2) ?? "global";
    const limitation = chartDate ? BASE_LIMITATION : `${BASE_LIMITATION} ${MISSING_WINDOW_LIMITATION}`;

    return [
      baseEvidence(context, {
        evidence_type: "chart_position",
        time_window_start: chartDate,
        time_window_end: chartDate,
        metric_name: `${platform}_chart_rank_${slugMetricPart(country)}`,
        metric_value: rank,
        metric_unit: "rank",
        lens: "chart",
        confidence: "medium",
        provenance: `Chartmetric: ${context.subjectLabel} reached rank ${rank ?? "unknown"} on "${chartName}" (${platform}, ${country}${chartDate ? `, ${chartDate}` : ""}).`,
        limitation,
        raw_ref: `chart_history:${platform}:${slugMetricPart(chartName)}:${chartDate ?? "undated"}`,
      }),
    ];
  });
}

/**
 * Normalizes Chartmetric's TikTok per-track activity time-series.
 * Produces a total video-creates count over the fetch window plus daily peak.
 *
 * Expects `source._tiktok_activity` to be an array of `{ timestp, value }` rows.
 */
function normalizeTikTokActivity(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  const rows = readArray(source._tiktok_activity);
  if (!rows || rows.length === 0) return [];

  const evidence: ChartmetricEvidenceDraft[] = [];
  const points = rows
    .filter(isRecord)
    .map((row) => ({
      date: readString(row.timestp) ?? readString(row.date),
      value: readNumber(row.value) ?? readNumber(row.video_creates) ?? readNumber(row.count),
    }))
    .filter((p): p is { date: string; value: number } => Boolean(p.date && p.value !== undefined));

  if (points.length === 0) return [];

  points.sort((a, b) => a.date.localeCompare(b.date));
  const windowStart = points[0].date;
  const windowEnd = points[points.length - 1].date;
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const peak = points.reduce((best, p) => (p.value > best.value ? p : best), points[0]);

  evidence.push(baseEvidence(context, {
    evidence_type: "tiktok_video_creates",
    time_window_start: windowStart,
    time_window_end: windowEnd,
    metric_name: "tiktok_video_creates_total",
    metric_value: total,
    metric_unit: "video_creates",
    lens: "social_attention",
    confidence: "low",
    provenance: `Chartmetric: ${context.subjectLabel} generated ${total.toLocaleString()} TikTok video creates between ${windowStart} and ${windowEnd}.`,
    limitation: `${ATTENTION_LIMITATION}`,
    raw_ref: `tiktok_activity:total:${windowStart}:${windowEnd}`,
  }));

  evidence.push(baseEvidence(context, {
    evidence_type: "tiktok_video_creates",
    time_window_start: peak.date,
    time_window_end: peak.date,
    metric_name: "tiktok_peak_day_video_creates",
    metric_value: peak.value,
    metric_unit: "video_creates",
    lens: "social_attention",
    confidence: "low",
    provenance: `Chartmetric: highest single-day TikTok video creates for ${context.subjectLabel} was ${peak.value.toLocaleString()} on ${peak.date}.`,
    limitation: `${ATTENTION_LIMITATION}`,
    raw_ref: `tiktok_activity:peak:${peak.date}`,
  }));

  return evidence;
}

/**
 * Normalizes Chartmetric's Apple Music per-track play count time-series.
 * Produces a total play count over the fetch window.
 *
 * Expects `source._apple_activity` to be an array of `{ timestp, value }` rows.
 */
function normalizeAppleMusicActivity(source: Record<string, unknown>, context: ChartmetricEvidenceContext) {
  const rows = readArray(source._apple_activity);
  if (!rows || rows.length === 0) return [];

  const points = rows
    .filter(isRecord)
    .map((row) => ({
      date: readString(row.timestp) ?? readString(row.date),
      value: readNumber(row.value) ?? readNumber(row.plays) ?? readNumber(row.count),
    }))
    .filter((p): p is { date: string; value: number } => Boolean(p.date && p.value !== undefined));

  if (points.length === 0) return [];

  points.sort((a, b) => a.date.localeCompare(b.date));
  const windowStart = points[0].date;
  const windowEnd = points[points.length - 1].date;
  const total = points.reduce((sum, p) => sum + p.value, 0);

  return [
    baseEvidence(context, {
      evidence_type: "apple_music_plays",
      time_window_start: windowStart,
      time_window_end: windowEnd,
      metric_name: "apple_music_plays_total",
      metric_value: total,
      metric_unit: "plays",
      lens: "platform_performance",
      confidence: "medium",
      provenance: `Chartmetric: ${context.subjectLabel} had ${total.toLocaleString()} Apple Music plays between ${windowStart} and ${windowEnd}.`,
      limitation: PLATFORM_METRIC_LIMITATION,
      raw_ref: `apple_activity:total:${windowStart}:${windowEnd}`,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Base evidence builder
// ---------------------------------------------------------------------------

function baseEvidence(
  context: ChartmetricEvidenceContext,
  patch: Omit<Partial<ChartmetricEvidenceDraft>, "account_id" | "artist_workspace_id" | "artist_id"> & {
    evidence_type: string;
    lens: string;
    confidence: "medium" | "low" | "unknown";
    limitation: string;
    raw_ref: string;
  },
): ChartmetricEvidenceDraft {
  return {
    account_id: context.accountId,
    artist_workspace_id: context.artistWorkspaceId,
    artist_id: context.artistId,
    source_snapshot_id: context.sourceSnapshotId,
    provider_id: context.providerId,
    source: "Chartmetric",
    source_kind: "third_party_provider",
    subject_type: context.subjectType ?? "music_item",
    subject_id: context.subjectId ?? context.musicItemId ?? context.musicProjectId ?? context.artistId,
    subject_label: context.subjectLabel,
    freshness: patch.time_window_end ? "provider_window" : "window_missing",
    provenance: `Chartmetric raw snapshot ${context.sourceSnapshotId}.`,
    ...patch,
  };
}

// ---------------------------------------------------------------------------
// Unsupported metric guard
// ---------------------------------------------------------------------------

function containsUnsupportedMetric(source: Record<string, unknown>) {
  const keys = new Set<string>();
  collectKeys(source, keys);
  return UNSUPPORTED_KEYS.some((unsupportedKey) => keys.has(unsupportedKey));
}

function collectKeys(value: unknown, keys: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nestedValue] of Object.entries(value)) {
    keys.add(key.toLowerCase());
    collectKeys(nestedValue, keys);
  }
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

function readArray(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function readArtistGenres(value: unknown) {
  if (!isRecord(value)) return { primary: undefined as string | undefined, sub: [] as string[] };
  const primary = readString(value.primary);
  const subValue = value.sub ?? value.subgenres ?? value.secondary;
  const sub = Array.isArray(subValue) ? subValue.map(readString).filter((genre): genre is string => Boolean(genre)) : [];
  return { primary, sub };
}

function slugMetricPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
