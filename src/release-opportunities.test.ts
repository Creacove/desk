import { describe, expect, it } from "vitest";
import {
  classifyOpportunitySafety,
  dedupeOpportunityCandidates,
  normalizeOpportunityBrief,
  normalizePublicEmail,
  normalizePublicUrl,
} from "../supabase/functions/_shared/release-success/opportunities";
import type {
  ReleaseOpportunityCandidate,
  ReleaseOpportunitySongContext,
} from "../supabase/functions/_shared/release-success/types";

const song: ReleaseOpportunitySongContext = {
  musicItemId: "song-1",
  title: "After Midnight",
  genres: ["alt-r&b"],
  moods: ["late-night", "introspective"],
  markets: ["Lagos", "London"],
  comparableArtists: ["Tems"],
  artistStage: "upcoming",
};

function candidate(overrides: Partial<ReleaseOpportunityCandidate> = {}): ReleaseOpportunityCandidate {
  return {
    opportunityType: "playlist",
    platform: "Independent playlist",
    targetName: "Night Drive Selects",
    sourceUrl: "https://example.com/playlists/night-drive-selects/",
    targetUrl: "https://example.com/playlists/night-drive-selects",
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
    ...overrides,
  };
}

describe("release opportunity normalization", () => {
  it("normalizes HTTPS URLs and collapses case/trailing-slash duplicates", () => {
    expect(normalizePublicUrl(" HTTPS://Example.COM/Playlists/Night-Drive/?utm_source=test#contact ")).toBe("https://example.com/Playlists/Night-Drive");
    expect(normalizePublicUrl("http://example.com/playlist")).toBeNull();
    expect(normalizePublicUrl("not a URL")).toBeNull();

    const deduped = dedupeOpportunityCandidates([
      candidate({ sourceUrl: "https://EXAMPLE.com/playlists/night-drive-selects/" }),
      candidate({ sourceUrl: "https://example.com/playlists/night-drive-selects" }),
    ]);
    expect(deduped).toHaveLength(1);
  });

  it("rejects source-less candidates and removes inferred or malformed emails", () => {
    expect(normalizeOpportunityBrief(candidate({ sourceUrl: "" }), song)).toBeNull();
    expect(normalizePublicEmail("not-an-email")).toBeNull();
    expect(normalizeOpportunityBrief(candidate({
      publicContact: { kind: "email", value: "editor@example.com", sourceUrl: "https://example.com/contact" },
    }), song)?.publicContact).toBeUndefined();
    expect(normalizeOpportunityBrief(candidate({
      publicContact: { kind: "email", value: "not-an-email", sourceUrl: "https://example.com/contact", verifiedAt: "2026-08-12" },
    }), song)?.publicContact).toBeUndefined();
  });

  it("keeps a verified public submission route actionable", () => {
    const brief = normalizeOpportunityBrief(candidate(), song);
    expect(brief).toMatchObject({
      targetName: "Night Drive Selects",
      safetyState: "clear",
      status: "shortlisted",
      publicContact: {
        kind: "submission_form",
        value: "https://example.com/submit",
        sourceUrl: "https://example.com/contact",
        verifiedAt: "2026-08-12T10:00:00.000Z",
      },
    });
  });

  it("keeps a strong match as watch when no verified route exists", () => {
    const brief = normalizeOpportunityBrief(candidate({ publicContact: undefined }), song);
    expect(brief).toMatchObject({ safetyState: "caution", status: "watch", targetName: "Night Drive Selects" });
  });

  it("excludes guaranteed paid placement claims", () => {
    const paid = candidate({
      paidPlacementClaim: true,
      fit: {
        songCriteria: ["alt-r&b"],
        targetCriteria: ["accepts guaranteed paid placement"],
        explanation: "The song fits alt-r&b, but the target guarantees placement for payment.",
      },
    });
    expect(classifyOpportunitySafety(paid)).toBe("excluded");
    expect(normalizeOpportunityBrief(paid, song)).toMatchObject({ safetyState: "excluded", status: "skipped" });
  });

  it("retains source observation and contact verification dates", () => {
    const brief = normalizeOpportunityBrief(candidate({
      sourceEvidence: [
        { source: "Outlet page", ref: "https://example.com/outlet", observedAt: "2026-08-01T00:00:00.000Z" },
        { source: "Byline page", ref: "https://example.com/byline", observedAt: "2026-08-02T00:00:00.000Z" },
      ],
    }), song);
    expect(brief?.sourceEvidence).toEqual([
      { source: "Outlet page", ref: "https://example.com/outlet", observedAt: "2026-08-01T00:00:00.000Z" },
      { source: "Byline page", ref: "https://example.com/byline", observedAt: "2026-08-02T00:00:00.000Z" },
    ]);
    expect(brief?.publicContact?.verifiedAt).toBe("2026-08-12T10:00:00.000Z");
  });

  it("keeps press byline and outlet evidence separate", () => {
    const brief = normalizeOpportunityBrief(candidate({
      opportunityType: "press",
      platform: "Editorial outlet",
      targetName: "Night Culture Journal",
      sourceEvidence: [
        { source: "Outlet evidence", ref: "https://example.com/about", observedAt: "2026-08-01T00:00:00.000Z" },
        { source: "Byline evidence", ref: "https://example.com/byline/jordan", observedAt: "2026-08-02T00:00:00.000Z" },
      ],
      fit: {
        songCriteria: ["introspective alt-r&b story"],
        targetCriteria: ["the outlet publishes Lagos music features"],
        explanation: "After Midnight has an introspective alt-r&b story, and this outlet publishes Lagos music features.",
      },
    }), song);
    expect(brief?.sourceEvidence).toHaveLength(2);
    expect(brief?.sourceEvidence.map((item) => item.source)).toEqual(["Outlet evidence", "Byline evidence"]);
  });

  it("requires both song-specific and target-specific fit reasons", () => {
    expect(normalizeOpportunityBrief(candidate({ fit: {
      songCriteria: [],
      targetCriteria: ["target criterion"],
      explanation: "Only a target claim.",
    } }), song)).toBeNull();
    expect(normalizeOpportunityBrief(candidate({ fit: {
      songCriteria: ["song criterion"],
      targetCriteria: [],
      explanation: "Only a song claim.",
    } }), song)).toBeNull();
  });

  it("returns an empty shortlist when no candidate is a strong evidence-backed match", () => {
    const shortlist = [
      candidate({ publicContact: undefined, fit: { songCriteria: [], targetCriteria: [], explanation: "Generic blog list." } }),
      candidate({ sourceUrl: "https://example.com/paid", paidPlacementClaim: true }),
    ].map((item) => normalizeOpportunityBrief(item, song)).filter((item): item is NonNullable<typeof item> => Boolean(item && item.status === "shortlisted"));
    expect(shortlist).toEqual([]);
  });
});
