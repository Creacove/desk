import type {
  SetupPresentationArtwork,
  SetupPresentationFeed,
  SetupPresentationFinding,
  SetupPresentationFindingDestination,
  SetupPresentationFindingKind,
  SetupPresentationFindingPhase,
  SetupPresentationPlatform,
} from "../types/setupPresentation";

export const SETUP_PRESENTATION_FEED_VERSION = 2 as const;
export const SETUP_PRESENTATION_MAX_FINDINGS = 32 as const;

const MAX_INPUT_FINDINGS = 128;
const MAX_IDENTIFIER_LENGTH = 160;
const MAX_TITLE_LENGTH = 96;
const MAX_VALUE_LENGTH = 96;
const MAX_DETAIL_LENGTH = 180;
const MAX_ALT_LENGTH = 120;
const MAX_ARTIST_NAME_LENGTH = 120;
const MAX_GENRE_LENGTH = 48;
const MAX_URL_LENGTH = 2_048;
const MAX_TIMESTAMP_LENGTH = 64;

const FINDING_PHASE_RANK: Record<SetupPresentationFindingPhase, number> = {
  catalogue: 0,
  discovery: 1,
  synthesis: 2,
};

const FINDING_KIND_RANK: Record<SetupPresentationFindingKind, number> = {
  identity: 0,
  catalogue: 1,
  music: 2,
  audience: 3,
  playlist: 4,
  market: 5,
  momentum: 6,
  public_context: 7,
  manager_read: 8,
};

const SETUP_STATUSES = new Set<SetupPresentationFeed["setup"]["status"]>([
  "queued",
  "running",
  "completed",
  "failed",
]);

const SETUP_PHASES = new Set<SetupPresentationFeed["setup"]["phase"]>([
  "catalogue",
  "discovery",
  "synthesis",
  "ready",
]);

const FINDING_PHASES = new Set<SetupPresentationFindingPhase>([
  "catalogue",
  "discovery",
  "synthesis",
]);

const FINDING_KINDS = new Set<SetupPresentationFindingKind>([
  "identity",
  "catalogue",
  "audience",
  "playlist",
  "market",
  "momentum",
  "music",
  "public_context",
  "manager_read",
]);

const FINDING_DESTINATIONS = new Set<SetupPresentationFindingDestination>([
  "catalogue",
  "audience",
  "markets",
  "momentum",
  "manager_read",
]);

const NARRATIVE_FINDING_KINDS = new Set<SetupPresentationFindingKind>([
  "identity",
  "catalogue",
  "music",
  "public_context",
  "manager_read",
]);

const NARRATIVE_DESTINATIONS: Partial<Record<SetupPresentationFindingKind, SetupPresentationFindingDestination>> = {
  identity: "catalogue",
  catalogue: "catalogue",
  music: "catalogue",
  public_context: "manager_read",
  manager_read: "manager_read",
};

const PLATFORM_ALIASES: Record<string, SetupPresentationPlatform> = {
  spotify: "spotify",
  spotify_for_artists: "spotify",
  apple_music: "apple_music",
  "apple music": "apple_music",
  applemusic: "apple_music",
  tiktok: "tiktok",
  tik_tok: "tiktok",
  instagram: "instagram",
  instagram_music: "instagram",
  youtube: "youtube",
  youtube_music: "youtube",
  shazam: "shazam",
  deezer: "deezer",
};

type MetricDefinition = {
  title: string;
  platform?: SetupPresentationPlatform;
  kind: SetupPresentationFindingKind;
  destination: SetupPresentationFindingDestination;
  valueKind: "number" | "text";
  requiresValue?: boolean;
};

const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  spotify_monthly_listeners: metric("Monthly listeners", "spotify", "audience", "audience"),
  spotify_followers: metric("Followers", "spotify", "audience", "audience"),
  spotify_playlist_total_reach: metric("Playlist reach", "spotify", "playlist", "audience"),
  spotify_playlist_reach: metric("Playlist reach", "spotify", "playlist", "audience"),
  spotify_playlist_count: metric("Playlist count", "spotify", "playlist", "audience"),
  spotify_editorial_playlist_count: metric("Editorial playlist count", "spotify", "playlist", "audience"),
  spotify_editorial_playlist_total_reach: metric("Editorial playlist reach", "spotify", "playlist", "audience"),
  spotify_editorial_playlist_reach: metric("Editorial playlist reach", "spotify", "playlist", "audience"),

  instagram_followers: metric("Followers", "instagram", "audience", "audience"),
  tiktok_followers: metric("Followers", "tiktok", "audience", "audience"),
  tiktok_likes: metric("Likes", "tiktok", "audience", "audience"),
  tiktok_track_posts: metric("Track posts", "tiktok", "audience", "audience"),
  tiktok_video_count: metric("Video count", "tiktok", "audience", "audience"),
  tiktok_video_creates: metric("Video creates", "tiktok", "audience", "audience"),
  tiktok_video_creates_total: metric("Video creates", "tiktok", "audience", "audience"),
  tiktok_peak_day_video_creates: metric("Peak-day video creates", "tiktok", "audience", "audience"),
  tiktok_top_video_views: metric("Top video views", "tiktok", "audience", "audience"),
  tiktok_top_videos_views: metric("Top video views", "tiktok", "audience", "audience"),
  youtube_subscribers: metric("Subscribers", "youtube", "audience", "audience"),
  youtube_views: metric("Video views", "youtube", "audience", "audience"),
  youtube_monthly_video_views: metric("Monthly video views", "youtube", "audience", "audience"),
  youtube_daily_video_views: metric("Daily video views", "youtube", "audience", "audience"),

  apple_music_playlist_count: metric("Playlist count", "apple_music", "playlist", "audience"),
  apple_music_editorial_playlist_count: metric("Editorial playlist count", "apple_music", "playlist", "audience"),
  apple_music_editorial_playlist_reach: metric("Editorial playlist reach", "apple_music", "playlist", "audience"),
  apple_music_plays: metric("Plays", "apple_music", "audience", "audience"),
  apple_music_plays_total: metric("Plays", "apple_music", "audience", "audience"),
  shazam_count: metric("Shazams", "shazam", "audience", "audience"),
  shazam_counts: metric("Shazams", "shazam", "audience", "audience"),
  deezer_fans: metric("Fans", "deezer", "audience", "audience"),

  spotify_streams: metric("Streams", "spotify", "momentum", "momentum"),
  spotify_trailing_7d_streams: metric("Streams over 7 days", "spotify", "momentum", "momentum"),
  spotify_trailing_28d_streams: metric("Streams over 28 days", "spotify", "momentum", "momentum"),
  spotify_stream_trend: metric("Stream trend", "spotify", "momentum", "momentum", "text"),
  spotify_popularity: metric("Popularity score", "spotify", "momentum", "momentum"),
  spotify_popularity_latest: metric("Popularity score", "spotify", "momentum", "momentum"),
  track_stage: metric("Track stage", undefined, "momentum", "momentum", "text"),
  track_career_health: metric("Track momentum", undefined, "momentum", "momentum", "text"),
  playlist_movement: metric("Playlist movement", "spotify", "playlist", "audience", "text"),
  playlist_followers: metric("Playlist followers", "spotify", "playlist", "audience"),
  playlist_placement: metric("Playlist placement", "spotify", "playlist", "audience", "text"),

  career_stage: metric("Career stage", undefined, "momentum", "momentum", "text"),
  career_trend: metric("Career trend", undefined, "momentum", "momentum", "text"),
  artist_current_city: metric("Current listener market", undefined, "market", "markets", "text"),
  listener_market: metric("Listener market", "spotify", "market", "markets", "text"),

  artist_identity: metric("Artist identity", "spotify", "identity", "catalogue", "text"),
  spotify_identity: metric("Artist identity", "spotify", "identity", "catalogue", "text"),
  track_count: metric("Tracks", "spotify", "catalogue", "catalogue"),
  catalogue_track_count: metric("Tracks", "spotify", "catalogue", "catalogue"),
  spotify_catalogue_track_count: metric("Tracks", "spotify", "catalogue", "catalogue"),
  release_count: metric("Releases", "spotify", "catalogue", "catalogue"),
  catalogue_release_count: metric("Releases", "spotify", "catalogue", "catalogue"),
  spotify_catalogue_release_count: metric("Releases", "spotify", "catalogue", "catalogue"),
  focus_track: metric("Focus track", "spotify", "music", "catalogue", "text"),
  focus_project: metric("Focus project", "spotify", "music", "catalogue", "text"),

  public_context: metric("Public context", undefined, "public_context", "manager_read", "text", false),
  public_context_artist_identity: metric("Public artist context", undefined, "public_context", "manager_read", "text", false),
  public_career_context: metric("Career context", undefined, "public_context", "manager_read", "text", false),
  public_context_live_dates: metric("Live context", undefined, "public_context", "manager_read", "text", false),
  press_interview_artist_positioning: metric("Artist positioning", undefined, "public_context", "manager_read", "text", false),
  manager_read: metric("Manager read", undefined, "manager_read", "manager_read", "text", false),
  setup_first_manager_read: metric("Manager read", undefined, "manager_read", "manager_read", "text", false),
};

export function parseSetupPresentationFeed(value: unknown, expectedRunId: string): SetupPresentationFeed {
  const root = requireRecord(value, "Setup presentation feed must be an object.");
  if (root.version !== SETUP_PRESENTATION_FEED_VERSION) {
    throw new Error("Setup presentation feed returned an unsupported version.");
  }

  const observedAt = requireTimestamp(root.observedAt, "observedAt");
  const setup = normalizeSetupEnvelope(root.setup, expectedRunId);
  const artist = normalizeArtist(root.artist);
  const rawFindings = requireArray(root.findings, "findings");
  const projection = normalizeProjection(root.projection);

  let omittedMalformed = projection.omittedMalformed;
  const candidates = rawFindings.slice(0, MAX_INPUT_FINDINGS);
  omittedMalformed += Math.max(0, rawFindings.length - candidates.length);

  const normalized: SetupPresentationFinding[] = [];
  for (const candidate of candidates) {
    const finding = normalizeSetupPresentationFinding(candidate, {
      runId: setup.runId,
      artistWorkspaceId: setup.artistWorkspaceId,
    });
    if (!finding) {
      omittedMalformed += 1;
      continue;
    }
    normalized.push(finding);
  }

  const deduped = dedupeInitialFindings(normalized);
  omittedMalformed += deduped.conflictingCount;

  return {
    version: SETUP_PRESENTATION_FEED_VERSION,
    observedAt,
    setup,
    ...(artist ? { artist } : {}),
    findings: sortSetupPresentationFindings(deduped.findings).slice(0, SETUP_PRESENTATION_MAX_FINDINGS),
    projection: {
      bounded: true,
      maxFindings: SETUP_PRESENTATION_MAX_FINDINGS,
      omittedMalformed,
    },
  };
}

export const assertSetupPresentationFeed = parseSetupPresentationFeed;
export const normalizeSetupPresentationFeed = parseSetupPresentationFeed;

export type SetupPresentationFindingScope = Pick<SetupPresentationFeed["setup"], "runId" | "artistWorkspaceId">;

export function normalizeSetupPresentationFinding(
  value: unknown,
  scope?: SetupPresentationFindingScope,
): SetupPresentationFinding | null {
  if (!isRecord(value)) return null;

  const id = readIdentifier(value.id);
  const dedupeKey = readIdentifier(value.dedupeKey ?? value.dedupe_key);
  const revision = readIdentifier(value.revision);
  const persistedAt = readTimestamp(value.persistedAt ?? value.persisted_at);
  const metricName = readMetricName(value);
  if (!id || !dedupeKey || !revision || !persistedAt || !matchesFindingScope(value, scope) || (hasField(value, "metricName", "metric_name") && !metricName)) {
    return null;
  }

  const metric = metricName ? resolveMetric(metricName) : undefined;
  if (metricName && !metric) return null;

  const hasPhase = hasField(value, "phase");
  const explicitPhase = readEnum(value.phase, FINDING_PHASES);
  if (hasPhase && !explicitPhase) return null;

  const hasKind = hasField(value, "kind");
  const explicitKind = readEnum(value.kind, FINDING_KINDS);
  if (hasKind && !explicitKind) return null;
  const kind = explicitKind ?? metric?.kind;
  if (!kind || (metric && explicitKind && explicitKind !== metric.kind)) return null;
  if (!metric && !NARRATIVE_FINDING_KINDS.has(kind)) return null;

  const hasDestination = hasField(value, "destination");
  const explicitDestination = readEnum(value.destination, FINDING_DESTINATIONS);
  if (hasDestination && !explicitDestination) return null;
  const destination = explicitDestination ?? metric?.destination ?? NARRATIVE_DESTINATIONS[kind];
  if (!destination || (metric && explicitDestination && explicitDestination !== metric.destination)) return null;
  if (!metric && destination !== NARRATIVE_DESTINATIONS[kind]) return null;

  const phase = explicitPhase ?? (metric ? inferPhase(metric.kind) : inferPhase(kind));
  if (metric && explicitPhase && explicitPhase !== inferPhase(metric.kind)) return null;

  const explicitPlatform = normalizePlatform(value.platform);
  if (hasField(value, "platform") && value.platform !== undefined && value.platform !== null && !explicitPlatform) return null;
  if (metric?.platform && explicitPlatform && metric.platform !== explicitPlatform) return null;
  const platform = explicitPlatform ?? metric?.platform;

  const rawTitle = readOptionalDisplayString(value.title, MAX_TITLE_LENGTH);
  if (rawTitle === null) return null;
  const title = metric && kind !== "public_context" ? metric.title : rawTitle ?? metric?.title;
  if (!title || hasForbiddenDisplayText(title)) return null;

  const rawDetail = readOptionalDisplayString(value.detail, MAX_DETAIL_LENGTH);
  if (rawDetail === null) return null;
  let detail = rawDetail ?? undefined;

  const rawValue = readOptionalDisplayString(value.value, MAX_VALUE_LENGTH);
  if (rawValue === null) return null;
  let displayValue = rawValue ?? undefined;
  const metricValue = readMetricValue(value);
  if (metricValue === INVALID_VALUE) return null;
  if (metricValue !== undefined && metricValue !== null) {
    if (!metric || typeof metricValue !== (metric.valueKind === "number" ? "number" : "string")) return null;
    displayValue = formatMetricValue(metricValue, readMetricUnit(value));
  }
  if (!metric && metricValue !== undefined && metricValue !== null) return null;
  if (metric?.valueKind === "number") {
    if (typeof metricValue !== "number") return null;
    if (rawValue !== undefined) return null;
  }
  if (metric?.requiresValue !== false && metricName && displayValue === undefined) return null;
  if (detail && hasForbiddenDisplayText(detail)) return null;
  if (displayValue && hasForbiddenDisplayText(displayValue)) return null;

  if (kind === "public_context" && hasField(value, "publicContextUrl", "public_context_url", "publicUrl", "public_url")) {
    const publicUrl = value.publicContextUrl ?? value.public_context_url ?? value.publicUrl ?? value.public_url;
    const hostname = sanitizePublicContextHostname(publicUrl);
    if (!hostname) return null;
    detail = detail ? `${detail} · ${hostname}`.slice(0, MAX_DETAIL_LENGTH) : hostname;
  }

  const artwork = normalizeArtwork(value.artwork);

  return {
    id,
    dedupeKey,
    revision,
    persistedAt,
    phase,
    kind,
    destination,
    ...(platform ? { platform } : {}),
    title,
    ...(displayValue !== undefined ? { value: displayValue } : {}),
    ...(detail !== undefined ? { detail } : {}),
    ...(artwork ? { artwork } : {}),
  };
}

export function assertSetupPresentationFinding(value: unknown): SetupPresentationFinding {
  const finding = normalizeSetupPresentationFinding(value);
  if (!finding) throw new Error("Setup presentation finding is malformed.");
  return finding;
}

export function sortSetupPresentationFindings(findings: SetupPresentationFinding[]): SetupPresentationFinding[] {
  return [...findings].sort(compareSetupPresentationFindings);
}

export function compareSetupPresentationFindings(
  left: SetupPresentationFinding,
  right: SetupPresentationFinding,
): number {
  const persistedOrder = compareTimestamp(left.persistedAt, right.persistedAt);
  if (persistedOrder !== 0) return persistedOrder;

  const phaseOrder = FINDING_PHASE_RANK[left.phase] - FINDING_PHASE_RANK[right.phase];
  if (phaseOrder !== 0) return phaseOrder;

  const kindOrder = FINDING_KIND_RANK[left.kind] - FINDING_KIND_RANK[right.kind];
  if (kindOrder !== 0) return kindOrder;

  return compareStrings(left.id, right.id);
}

export function compareSetupPresentationFindingRevision(left: string, right: string): number {
  if (left === right) return 0;

  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    const leftNumber = BigInt(left);
    const rightNumber = BigInt(right);
    return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0;
  }

  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime < rightTime ? -1 : 1;
  }

  return compareStrings(left, right);
}

export function isNewerSetupPresentationFindingRevision(next: string, current: string): boolean {
  return compareSetupPresentationFindingRevision(next, current) > 0;
}

function normalizeSetupEnvelope(value: unknown, expectedRunId: string): SetupPresentationFeed["setup"] {
  const setup = requireRecord(value, "Setup presentation feed returned no setup state.");
  const runId = readIdentifier(setup.runId ?? setup.run_id);
  const artistWorkspaceId = readIdentifier(setup.artistWorkspaceId ?? setup.artist_workspace_id);
  const status = readEnum(setup.status, SETUP_STATUSES);
  const phase = readEnum(setup.phase, SETUP_PHASES);
  const startedAt = readOptionalTimestampAliases(setup, ["startedAt", "started_at"], "startedAt");
  const phaseStartedAt = readOptionalTimestampAliases(setup, ["phaseStartedAt", "phase_started_at"], "phaseStartedAt");
  const updatedAt = readRequiredTimestampAliases(setup, ["updatedAt", "updated_at"], "updatedAt");

  if (!isSafeIdentifier(expectedRunId) || !runId || runId !== expectedRunId) {
    throw new Error("Setup presentation feed returned an invalid setup run ID.");
  }
  if (!artistWorkspaceId) throw new Error("Setup presentation feed returned an invalid workspace ID.");
  if (!status) throw new Error("Setup presentation feed returned an invalid setup status.");
  if (!phase) throw new Error("Setup presentation feed returned an invalid setup phase.");

  return {
    runId,
    artistWorkspaceId,
    status,
    phase,
    ...(startedAt ? { startedAt } : {}),
    ...(phaseStartedAt ? { phaseStartedAt } : {}),
    updatedAt,
  };
}

function normalizeArtist(value: unknown): SetupPresentationFeed["artist"] {
  if (value === undefined || value === null) return undefined;
  const artist = requireRecord(value, "Setup presentation feed returned an invalid artist.");
  const name = readSafeString(artist.name, MAX_ARTIST_NAME_LENGTH);
  if (!name) {
    if (hasForbiddenDisplayText(artist.name)) return undefined;
    throw new Error("Setup presentation feed returned an invalid artist name.");
  }
  if (!Array.isArray(artist.genres)) throw new Error("Setup presentation feed returned invalid artist genres.");

  const genres = artist.genres.slice(0, 2).map((genre) => readSafeString(genre, MAX_GENRE_LENGTH));
  if (genres.some((genre) => !genre)) {
    if (artist.genres.some((genre) => hasForbiddenDisplayText(genre))) return undefined;
    throw new Error("Setup presentation feed returned invalid artist genres.");
  }

  let imageUrl: string | undefined;
  if (artist.imageUrl !== undefined && artist.imageUrl !== null) {
    imageUrl = normalizeHttpsUrl(artist.imageUrl);
  }

  return {
    name,
    ...(imageUrl ? { imageUrl } : {}),
    genres: genres.filter((genre): genre is string => Boolean(genre)),
  };
}

function normalizeProjection(value: unknown): SetupPresentationFeed["projection"] {
  const projection = requireRecord(value, "Setup presentation feed returned an invalid projection.");
  if (projection.bounded !== true || projection.maxFindings !== SETUP_PRESENTATION_MAX_FINDINGS) {
    throw new Error("Setup presentation feed returned an invalid projection bound.");
  }
  if (!Number.isInteger(projection.omittedMalformed) || Number(projection.omittedMalformed) < 0) {
    throw new Error("Setup presentation feed returned an invalid malformed count.");
  }

  return {
    bounded: true,
    maxFindings: SETUP_PRESENTATION_MAX_FINDINGS,
    omittedMalformed: Number(projection.omittedMalformed),
  };
}

function normalizeArtwork(value: unknown): SetupPresentationArtwork | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) return undefined;
  const url = normalizeHttpsUrl(value.url);
  const alt = readSafeString(value.alt, MAX_ALT_LENGTH);
  if (!url || !alt) return undefined;
  return { url, alt };
}

function resolveMetric(metricName: string): MetricDefinition | undefined {
  const normalized = normalizeMetricName(metricName);
  const direct = METRIC_DEFINITIONS[normalized];
  if (direct) return direct;

  const cityMatch = /^(?:spotify_)?listener_city_([a-z0-9][a-z0-9_-]*)$/.exec(normalized);
  if (cityMatch) {
    const city = titleCaseSlug(cityMatch[1]);
    if (!city) return undefined;
    return metric(`Listeners in ${city}`, "spotify", "market", "markets");
  }

  const affinityMatch = /^city_affinity_([a-z0-9][a-z0-9_-]*)$/.exec(normalized);
  if (affinityMatch) {
    const city = titleCaseSlug(affinityMatch[1]);
    if (!city) return undefined;
    return metric(`Listener affinity: ${city}`, "spotify", "market", "markets", "text");
  }

  return undefined;
}

function metric(
  title: string,
  platform: SetupPresentationPlatform | undefined,
  kind: SetupPresentationFindingKind,
  destination: SetupPresentationFindingDestination,
  valueKind: "number" | "text" = "number",
  requiresValue = true,
): MetricDefinition {
  return { title, platform, kind, destination, valueKind, requiresValue };
}

function inferPhase(kind: SetupPresentationFindingKind): SetupPresentationFindingPhase {
  if (kind === "identity" || kind === "catalogue" || kind === "music") return "catalogue";
  if (kind === "manager_read") return "synthesis";
  return "discovery";
}

function readMetricName(value: Record<string, unknown>): string | undefined {
  const raw = value.metricName ?? value.metric_name;
  if (raw === undefined || raw === null) return undefined;
  const string = readSafeString(raw, MAX_IDENTIFIER_LENGTH);
  return string ? normalizeMetricName(string) : undefined;
}

function normalizeMetricName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizePlatform(value: unknown): SetupPresentationPlatform | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = readSafeString(value, MAX_IDENTIFIER_LENGTH);
  if (!raw) return undefined;
  return PLATFORM_ALIASES[raw.toLowerCase().replace(/\s+/g, "_")] ?? PLATFORM_ALIASES[raw.toLowerCase()];
}

const INVALID_VALUE = Symbol("invalid metric value");

function readMetricValue(value: Record<string, unknown>): number | string | null | undefined | typeof INVALID_VALUE {
  const raw = value.metricValue ?? value.metric_value;
  if (raw === undefined || raw === null) return raw;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : INVALID_VALUE;
  if (typeof raw === "string") return readSafeString(raw, MAX_VALUE_LENGTH) ?? INVALID_VALUE;
  return INVALID_VALUE;
}

function readMetricUnit(value: Record<string, unknown>): string | undefined {
  const raw = value.metricUnit ?? value.metric_unit;
  return typeof raw === "string" ? raw.trim().toLowerCase() : undefined;
}

function formatMetricValue(value: number | string, unit?: string): string {
  if (typeof value === "string") return value;
  if (unit === "rank") return `#${Math.round(value)}`;

  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${trimDecimal(value / 1_000_000_000)}B`;
  if (absolute >= 1_000_000) return `${trimDecimal(value / 1_000_000)}M`;
  if (absolute >= 1_000) return `${trimDecimal(value / 1_000)}K`;
  return Number.isInteger(value) ? String(value) : trimDecimal(value);
}

function trimDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function sanitizePublicContextHostname(value: unknown): string | undefined {
  const raw = readSafeString(value, MAX_URL_LENGTH);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname) return undefined;
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function normalizeHttpsUrl(value: unknown): string | undefined {
  const raw = readSafeString(value, MAX_URL_LENGTH);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

function readIdentifier(value: unknown): string | undefined {
  const string = readSafeString(value, MAX_IDENTIFIER_LENGTH);
  if (!string || !isSafeIdentifier(string)) return undefined;
  return string;
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !hasForbiddenDisplayText(value);
}

function readTimestamp(value: unknown): string | undefined {
  const string = readSafeString(value, MAX_TIMESTAMP_LENGTH);
  if (!string) return undefined;
  const parsed = Date.parse(string);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function requireTimestamp(value: unknown, field: string): string {
  const timestamp = readTimestamp(value);
  if (!timestamp) throw new Error(`Setup presentation feed returned an invalid ${field}.`);
  return timestamp;
}

function readOptionalTimestampAliases(
  value: Record<string, unknown>,
  keys: string[],
  label: string,
): string | undefined {
  const timestamps: string[] = [];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const raw = value[key];
    if (raw === null || raw === undefined) continue;
    const timestamp = readTimestamp(raw);
    if (!timestamp) throw new Error(`Setup presentation feed returned an invalid ${label}.`);
    timestamps.push(timestamp);
  }
  return timestamps[0];
}

function readRequiredTimestampAliases(
  value: Record<string, unknown>,
  keys: string[],
  label: string,
): string {
  const timestamp = readOptionalTimestampAliases(value, keys, label);
  if (!timestamp) throw new Error(`Setup presentation feed returned an invalid ${label}.`);
  return timestamp;
}

function readOptionalDisplayString(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  return readSafeString(value, maxLength) ?? null;
}

function readSafeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maxLength) return undefined;
  if (hasForbiddenDisplayText(normalized)) return undefined;
  return normalized;
}

function hasForbiddenDisplayText(value: unknown): boolean {
  return typeof value === "string" && /(chartmetric|manager_discovery_tool|save_public_evidence|write_strategic_memory|web_search)/i.test(value);
}

function titleCaseSlug(value: string): string | undefined {
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized || !/^[A-Za-z0-9 ]+$/.test(normalized)) return undefined;
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase()).slice(0, MAX_TITLE_LENGTH);
}

function compareTimestamp(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (leftTime !== rightTime) return leftTime < rightTime ? -1 : 1;
  return compareStrings(left, right);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function dedupeInitialFindings(findings: SetupPresentationFinding[]): {
  findings: SetupPresentationFinding[];
  conflictingCount: number;
} {
  const byId = new Map<string, number>();
  const result: SetupPresentationFinding[] = [];
  let conflictingCount = 0;

  for (const finding of findings) {
    const existingIndex = byId.get(finding.id);
    if (existingIndex === undefined) {
      byId.set(finding.id, result.length);
      result.push(finding);
      continue;
    }

    const existing = result[existingIndex];
    if (existing.dedupeKey !== finding.dedupeKey) {
      conflictingCount += 1;
      continue;
    }
    if (isNewerSetupPresentationFindingRevision(finding.revision, existing.revision)) {
      result[existingIndex] = finding;
    }
  }

  return { findings: result, conflictingCount };
}

function hasField(value: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function matchesFindingScope(value: Record<string, unknown>, scope?: SetupPresentationFindingScope): boolean {
  const scopedFields: Array<{ keys: string[]; expected: string | undefined }> = [
    { keys: ["setupRunId", "setup_run_id"], expected: scope?.runId },
    { keys: ["artistWorkspaceId", "artist_workspace_id"], expected: scope?.artistWorkspaceId },
  ];

  for (const field of scopedFields) {
    if (!hasField(value, ...field.keys)) continue;
    if (!scope || !field.expected) return false;

    const supplied = field.keys
      .filter((key) => Object.prototype.hasOwnProperty.call(value, key))
      .map((key) => readIdentifier(value[key]));
    if (supplied.some((candidate) => !candidate) || new Set(supplied).size !== 1 || supplied[0] !== field.expected) {
      return false;
    }
  }

  return true;
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(message);
  return value;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Setup presentation feed returned invalid ${field}.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readEnum<T extends string>(value: unknown, values: Set<T>): T | undefined {
  return typeof value === "string" && values.has(value as T) ? value as T : undefined;
}
