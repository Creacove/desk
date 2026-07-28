import type { MusicManagerReadMetric } from "./openaiMusicManagerRead.ts";

export type MusicManagerMetricCandidate = {
  id: string;
  label: string;
  value: string;
  subjectId: string;
  subjectLabel: string;
  timeframe?: string;
};

export type MusicManagerReasoningEvidence = {
  id: string;
  evidenceType?: string;
  subjectType?: string;
  subjectId?: string;
  subjectLabel?: string;
  metricName?: string;
  metricValue?: number;
  metricUnit?: string;
  freshness?: string;
  confidence?: string;
  limitationState?: "identity_unresolved" | "stale" | "limited";
  observedAt?: string;
};

const NON_DISPLAY_UNITS = new Set([
  "appearance",
  "event",
  "identifier",
  "stage",
  "text",
  "trend",
]);

export function projectMusicManagerReadEvidence(rows: Array<Record<string, unknown>>): {
  reasoningEvidence: MusicManagerReasoningEvidence[];
  metricCandidates: MusicManagerMetricCandidate[];
} {
  const reasoningEvidence: MusicManagerReasoningEvidence[] = [];
  const metricCandidates: MusicManagerMetricCandidate[] = [];

  for (const row of rows) {
    const id = readString(row.id);
    if (!id) continue;
    const metricName = readString(row.metric_name);
    const metricUnit = readString(row.metric_unit)?.toLowerCase();
    const metricValue = readFiniteNumber(row.metric_value);
    const freshness = normalizeFreshness(readString(row.freshness));
    const limitationState = normalizeLimitationState(readString(row.limitation), freshness);
    const subjectId = readString(row.subject_id);
    const subjectLabel = readString(row.subject_label);

    reasoningEvidence.push({
      id,
      evidenceType: readString(row.evidence_type),
      subjectType: readString(row.subject_type),
      subjectId,
      subjectLabel,
      metricName,
      metricValue,
      metricUnit,
      freshness,
      confidence: normalizeConfidence(readString(row.confidence)),
      limitationState,
      observedAt: normalizeIsoTimestamp(readString(row.observed_at)) ?? normalizeIsoTimestamp(readString(row.created_at)),
    });

    if (!metricName || metricValue === undefined || !metricUnit || NON_DISPLAY_UNITS.has(metricUnit)) continue;
    const label = formatMetricLabel(metricName, freshness);
    const value = formatMetricValue(metricValue, metricUnit);
    if (!label || !value) continue;
    metricCandidates.push({
      id,
      label,
      value,
      subjectId: subjectId ?? "",
      subjectLabel: subjectLabel ?? "",
      ...(freshness ? { timeframe: freshness } : {}),
    });
  }

  return { reasoningEvidence, metricCandidates };
}

export function resolveSelectedManagerReadMetrics(
  selectedIds: string[],
  candidates: MusicManagerMetricCandidate[],
): MusicManagerReadMetric[] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const seen = new Set<string>();
  return selectedIds.map((evidenceId) => {
    if (seen.has(evidenceId)) {
      throw new Error(`Music Manager Read selected duplicate metric evidence ID "${evidenceId}".`);
    }
    seen.add(evidenceId);
    const candidate = byId.get(evidenceId);
    if (!candidate) {
      throw new Error(`Music Manager Read selected unsupported metric evidence ID "${evidenceId}".`);
    }
    return { label: candidate.label, value: candidate.value, evidenceId };
  });
}

function formatMetricLabel(metricName: string, freshness?: string): string {
  const trailingStreams = metricName.match(/^spotify_trailing_(\d+)d_streams$/);
  if (trailingStreams) return `Spotify streams (${trailingStreams[1]}d)`;

  const countryRank = metricName.match(/^(?:chartmetric_)?country_rank_(.+)$/);
  if (countryRank) return `${titleWords(countryRank[1])} rank`;

  if (/^spotify_stream_trend_/.test(metricName)) {
    return `Spotify stream trend${timeframeSuffix(freshness)}`;
  }

  const exactLabels: Record<string, string> = {
    apple_music_plays_total: "Apple Music plays",
    chart_rank: "Chart rank",
    chartmetric_album_track_count: "Project tracks",
    playlist_followers: "Playlist followers",
    shazam_count: "Shazams",
    spotify_monthly_listeners: "Spotify monthly listeners",
    spotify_peak_day_streams: "Spotify peak-day streams",
    spotify_playlist_reach: "Spotify playlist reach",
    spotify_popularity_latest: "Spotify popularity",
    tiktok_track_posts: "TikTok posts",
    tiktok_video_creates: "TikTok video creates",
    tiktok_video_creates_total: "TikTok video creates",
  };
  if (exactLabels[metricName]) return exactLabels[metricName];

  const chartRank = metricName.match(/^([a-z0-9]+)_chart_rank_(.+)$/);
  if (chartRank) return `${platformName(chartRank[1])} ${titleWords(chartRank[2])} rank`;

  return titleWords(metricName
    .replace(/^chartmetric_/, "")
    .replace(/^spotify_/, "Spotify ")
    .replace(/^tiktok_/, "TikTok ")
    .replace(/^youtube_/, "YouTube ")
    .replace(/^apple_music_/, "Apple Music "));
}

function formatMetricValue(value: number, unit: string): string | undefined {
  if (unit === "rank") return `#${formatPlainNumber(value)}`;
  if (unit === "percent" || unit === "percentage" || unit === "percent_change") {
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatPlainNumber(value)}%`;
  }
  if (!Number.isFinite(value)) return undefined;
  if (Math.abs(value) < 1_000) return formatPlainNumber(value);
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPlainNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function normalizeFreshness(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (/^(current|fresh|stale|lifetime)$/.test(normalized)) return normalized;
  const trailing = normalized.match(/^trailing\s+(\d+)d$/);
  if (trailing) return `trailing ${trailing[1]}d`;
  if (/^\d{4}-\d{2}-\d{2}(?:t[\d:.+-]+z?)?$/i.test(normalized)) return normalized;
  return undefined;
}

function normalizeLimitationState(
  limitation?: string,
  freshness?: string,
): MusicManagerReasoningEvidence["limitationState"] {
  const normalized = limitation?.toLowerCase() ?? "";
  if (/unresolved|identity.*missing|not matched/.test(normalized)) return "identity_unresolved";
  if (freshness === "stale" || /\bstale\b|out[- ]of[- ]date/.test(normalized)) return "stale";
  if (/partial|limited|missing|window|incomplete|unavailable/.test(normalized)) return "limited";
  return undefined;
}

function normalizeConfidence(value?: string): string | undefined {
  const normalized = value?.toLowerCase();
  return normalized === "low" || normalized === "medium" || normalized === "high" ? normalized : undefined;
}

function normalizeIsoTimestamp(value?: string): string | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function timeframeSuffix(freshness?: string): string {
  const match = freshness?.match(/trailing (\d+)d/);
  return match ? ` (${match[1]}d)` : "";
}

function platformName(value: string): string {
  const names: Record<string, string> = {
    apple: "Apple Music",
    spotify: "Spotify",
    tiktok: "TikTok",
    youtube: "YouTube",
  };
  return names[value] ?? titleWords(value);
}

function titleWords(value: string): string {
  const clean = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const titled = clean.split(" ").map((word, index) => {
    if (/^(Spotify|TikTok|YouTube|Apple|Music)$/.test(word)) return word;
    if (index > 0) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
  return titled.replace(/^Apple music\b/, "Apple Music");
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
