import { describe, expect, it, vi } from "vitest";
import { executeManagerConversationTool } from "../supabase/functions/_shared/manager-conversation/toolExecutor";

const { captureAppError } = vi.hoisted(() => ({ captureAppError: vi.fn() }));
vi.mock("../supabase/functions/_shared/appError", () => ({ captureAppError }));
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

function minimalOpportunityDb(options: { failOn?: "from" | "upsert" } = {}) {
  const rows = (table: string) => table === "music_items"
    ? [{ id: "song-1", title: "After Midnight", item_type: "song", metadata: { manual_details: { genre: "alt-r&b", mood: "late-night" } }, planned_release_date: "2026-08-26", released_at: null, lifecycle_stage: "ready" }]
    : [];
  const chain = (table: string) => {
    const query: any = {
      select() { return query; },
      eq() { return query; },
      in() { return query; },
      order() { return query; },
      limit() { return query; },
      insert() { return query; },
      upsert() {
        if (options.failOn === "upsert") throw new Error("opportunity persistence unavailable");
        return query;
      },
      update() { return query; },
      async maybeSingle() { return { data: rows(table)[0] ?? null, error: null }; },
      async single() { return { data: rows(table)[0] ?? { id: "created-1" }, error: null }; },
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        return Promise.resolve({ data: rows(table), error: null }).then(resolve);
      },
    };
    return query;
  };
  return {
    from(table: string) {
      if (options.failOn === "from") throw new Error("opportunity search unavailable");
      return chain(table);
    },
  };
}

const managerScope = { accountId: "account-1", artistWorkspaceId: "workspace-1", artistId: "artist-1", musicSubject: { type: "music_item" as const, id: "song-1" } };

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

  it("logs unexpected search, contact verification, and persistence failures with the required stages", async () => {
    captureAppError.mockReset();
    captureAppError.mockResolvedValue("error-event-1");

    await expect(executeManagerConversationTool(
      minimalOpportunityDb({ failOn: "from" }),
      managerScope,
      "query_focused_release_opportunities",
      { opportunityType: "playlist" },
    )).resolves.toMatchObject({ status: "failed", retryable: true });
    expect(captureAppError).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      refs: expect.objectContaining({ stage: "opportunity_search" }),
    }));

    captureAppError.mockReset();
    captureAppError.mockResolvedValue("error-event-2");
    await expect(executeManagerConversationTool(
      minimalOpportunityDb(),
      managerScope,
      "save_focused_release_opportunities",
      { opportunityType: "playlist", candidates: [{ ...candidate(), fit: null }] },
    )).resolves.toMatchObject({ status: "failed", retryable: true });
    expect(captureAppError).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      refs: expect.objectContaining({ stage: "contact_verification" }),
    }));

    captureAppError.mockReset();
    captureAppError.mockResolvedValue("error-event-3");
    await expect(executeManagerConversationTool(
      minimalOpportunityDb({ failOn: "upsert" }),
      managerScope,
      "save_focused_release_opportunities",
      { opportunityType: "playlist", candidates: [candidate()] },
    )).resolves.toMatchObject({ status: "failed", retryable: true });
    expect(captureAppError).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      refs: expect.objectContaining({ stage: "opportunity_persistence" }),
    }));
  });
});
