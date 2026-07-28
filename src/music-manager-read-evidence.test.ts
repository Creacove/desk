import { describe, expect, it } from "vitest";
import {
  projectMusicManagerReadEvidence,
  resolveSelectedManagerReadMetrics,
} from "../supabase/functions/_shared/musicManagerReadEvidence";

function evidence(
  id: string,
  metricName: string,
  metricValue: number | null,
  metricUnit: string,
  freshness: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    source: "Chartmetric",
    source_kind: "provider_api",
    evidence_type: "metric",
    subject_type: "music_item",
    subject_id: "song-jam",
    subject_label: "Jam",
    metric_name: metricName,
    metric_value: metricValue,
    metric_unit: metricUnit,
    freshness,
    confidence: "high",
    provenance: "provider response / internal route",
    limitation: "Provider window is partial but usable.",
    raw_ref: "private/provider/ref",
    created_at: "2026-07-28T08:00:00.000Z",
    ...overrides,
  };
}

describe("music Manager Read evidence projection", () => {
  it("creates exact product metrics for representative normalized Chartmetric rows", () => {
    const result = projectMusicManagerReadEvidence([
      evidence("streams", "spotify_trailing_7d_streams", 1_234_567, "streams", "trailing 7d"),
      evidence("rank", "chartmetric_country_rank_nigeria", 14, "rank", "current"),
      evidence("trend", "spotify_stream_trend_growing", 24.5, "percent_change", "trailing 28d"),
      evidence("tiktok", "tiktok_video_creates_total", 18_400, "video_creates", "lifetime"),
      evidence("shazam", "shazam_count", 7_080, "shazams", "current"),
    ]);

    expect(result.metricCandidates).toEqual([
      expect.objectContaining({ id: "streams", label: "Spotify streams (7d)", value: "1.23M" }),
      expect.objectContaining({ id: "rank", label: "Nigeria rank", value: "#14" }),
      expect.objectContaining({ id: "trend", label: "Spotify stream trend (28d)", value: "+24.5%" }),
      expect.objectContaining({ id: "tiktok", label: "TikTok video creates", value: "18.4K" }),
      expect.objectContaining({ id: "shazam", label: "Shazams", value: "7.08K" }),
    ]);
  });

  it("keeps safe reasoning semantics while excluding provider and database machinery", () => {
    const result = projectMusicManagerReadEvidence([
      evidence("streams", "spotify_trailing_7d_streams", 1_234_567, "streams", "trailing 7d"),
    ]);

    expect(result.reasoningEvidence).toEqual([
      {
        id: "streams",
        evidenceType: "metric",
        subjectType: "music_item",
        subjectId: "song-jam",
        subjectLabel: "Jam",
        metricName: "spotify_trailing_7d_streams",
        metricValue: 1_234_567,
        metricUnit: "streams",
        freshness: "trailing 7d",
        confidence: "high",
        limitationState: "limited",
        observedAt: "2026-07-28T08:00:00.000Z",
      },
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Chartmetric");
    expect(serialized).not.toContain("provider_api");
    expect(serialized).not.toContain("provider response");
    expect(serialized).not.toContain("private/provider/ref");
    expect(serialized).not.toContain("provenance");
    expect(serialized).not.toContain("raw_ref");
  });

  it("normalizes limitation state without forwarding raw diagnostic text", () => {
    const result = projectMusicManagerReadEvidence([
      evidence("unresolved", "spotify_streams", 20, "streams", "current", { limitation: "Exact provider identity unresolved." }),
      evidence("stale", "shazam_count", 30, "shazams", "stale", { limitation: "Snapshot is stale." }),
      evidence("clean", "spotify_popularity_latest", 80, "score", "current", { limitation: null }),
    ]);
    expect(result.reasoningEvidence.map((item) => item.limitationState)).toEqual([
      "identity_unresolved",
      "stale",
      undefined,
    ]);
  });

  it("excludes identifiers, text states, nulls, and non-finite values from visible candidates", () => {
    const result = projectMusicManagerReadEvidence([
      evidence("identifier", "chartmetric_track_id", 123, "identifier", "current"),
      evidence("stage", "career_stage", 2, "stage", "current"),
      evidence("text", "track_stage", null, "text", "current"),
      evidence("nan", "spotify_streams", Number.NaN, "streams", "current"),
      evidence("valid", "spotify_monthly_listeners", 33_095_448, "listeners", "current"),
    ]);
    expect(result.metricCandidates.map((candidate) => candidate.id)).toEqual(["valid"]);
    expect(result.metricCandidates[0]).toMatchObject({ label: "Spotify monthly listeners", value: "33.1M" });
  });

  it("resolves selected metrics in model order and refuses unknown or duplicate IDs", () => {
    const { metricCandidates } = projectMusicManagerReadEvidence([
      evidence("streams", "spotify_trailing_7d_streams", 1_234_567, "streams", "trailing 7d"),
      evidence("rank", "chartmetric_country_rank_nigeria", 14, "rank", "current"),
    ]);

    expect(resolveSelectedManagerReadMetrics(["rank", "streams"], metricCandidates)).toEqual([
      { label: "Nigeria rank", value: "#14", evidenceId: "rank" },
      { label: "Spotify streams (7d)", value: "1.23M", evidenceId: "streams" },
    ]);
    expect(() => resolveSelectedManagerReadMetrics(["missing"], metricCandidates)).toThrow(/unsupported metric evidence ID "missing"/);
    expect(() => resolveSelectedManagerReadMetrics(["rank", "rank"], metricCandidates)).toThrow(/duplicate metric evidence ID "rank"/);
  });
});
