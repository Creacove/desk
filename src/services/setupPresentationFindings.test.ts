import { describe, expect, it } from "vitest";
import {
  compareSetupPresentationFindingRevision,
  normalizeSetupPresentationFinding,
  parseSetupPresentationFeed,
  sortSetupPresentationFindings,
} from "./setupPresentationFindings";

const runId = "setup-run-7";

const baseFeed = {
  version: 2,
  observedAt: "2026-08-23T10:00:00.000Z",
  setup: {
    runId,
    artistWorkspaceId: "workspace-7",
    status: "running",
    phase: "discovery",
    startedAt: "2026-08-23T09:59:00.000Z",
    phaseStartedAt: "2026-08-23T09:59:30.000Z",
    updatedAt: "2026-08-23T10:00:00.000Z",
  },
  artist: {
    name: "Victor Ny",
    imageUrl: "https://images.example.com/victor.jpg",
    genres: ["Afrobeats", "Alternative"],
  },
  findings: [],
  projection: {
    bounded: true,
    maxFindings: 32,
    omittedMalformed: 0,
  },
} as const;

function finding(overrides: Record<string, unknown> = {}) {
  return {
    id: "evidence-1",
    dedupeKey: "audience:spotify-monthly-listeners",
    revision: "1",
    persistedAt: "2026-08-23T10:00:01.000Z",
    phase: "discovery",
    kind: "audience",
    destination: "audience",
    metricName: "spotify_monthly_listeners",
    metricValue: 7_500_000,
    metricUnit: "listeners",
    detail: "A real persisted audience signal.",
    artwork: {
      url: "https://images.example.com/victor.jpg",
      alt: "Victor Ny",
    },
    ...overrides,
  };
}

describe("setup presentation v2 finding projection", () => {
  it("normalizes an approved metric into a bounded display-safe finding", () => {
    const feed = parseSetupPresentationFeed({
      ...baseFeed,
      findings: [finding()],
    }, runId);

    expect(feed.findings).toEqual([expect.objectContaining({
      id: "evidence-1",
      dedupeKey: "audience:spotify-monthly-listeners",
      revision: "1",
      platform: "spotify",
      title: "Monthly listeners",
      value: "7.5M",
      detail: "A real persisted audience signal.",
      artwork: {
        url: "https://images.example.com/victor.jpg",
        alt: "Victor Ny",
      },
    })]);
    expect(feed.findings[0]).not.toHaveProperty("metricName");
    expect(feed.findings[0]).not.toHaveProperty("metricValue");
    expect(feed.projection).toMatchObject({ bounded: true, maxFindings: 32 });
  });

  it("maps approved platform metrics without exposing provider metadata", () => {
    const feed = parseSetupPresentationFeed({
      ...baseFeed,
      findings: [
        finding({
          id: "evidence-tiktok",
          dedupeKey: "audience:tiktok-top-video-views",
          metricName: "tiktok_top_videos_views",
          metricValue: 1_200_000,
          metricUnit: "views",
          source: "internal-provider",
          sourceKind: "provider-evidence",
          providerId: "provider-42",
          toolName: "internal-tool",
          actionName: "internal-action",
          rawRef: "raw://private",
          provenance: "private provenance",
        }),
      ],
    }, runId);

    expect(feed.findings[0]).toMatchObject({
      platform: "tiktok",
      title: "Top video views",
      value: "1.2M",
    });
    expect(JSON.stringify(feed)).not.toContain("internal-provider");
    expect(JSON.stringify(feed)).not.toContain("private provenance");
    expect(feed.findings[0]).not.toHaveProperty("source");
    expect(feed.findings[0]).not.toHaveProperty("providerId");
    expect(feed.findings[0]).not.toHaveProperty("rawRef");
  });

  it("omits unknown metrics and malformed siblings without losing valid findings", () => {
    const feed = parseSetupPresentationFeed({
      ...baseFeed,
      findings: [
        finding({ id: "valid-1" }),
        finding({ id: "unknown", metricName: "invented_metric", title: "Should not appear" }),
        finding({ id: "bad-art", artwork: { url: "http://not-https.example.com/a.jpg", alt: "Bad" } }),
        finding({ id: "bad-control", detail: "unsafe\u0000detail" }),
        finding({
          id: "valid-2",
          dedupeKey: "market:listener-city-lagos",
          metricName: "spotify_listener_city_lagos",
          metricValue: 250_000,
          metricUnit: "listeners",
          kind: "market",
          destination: "markets",
          detail: "Listeners in Lagos",
        }),
      ],
    }, runId);

    expect(feed.findings.map((item) => item.id)).toEqual(["bad-art", "valid-1", "valid-2"]);
    expect(feed.findings.find((item) => item.id === "bad-art")).not.toHaveProperty("artwork");
    expect(feed.projection.omittedMalformed).toBe(2);
  });

  it("enforces the declared value kind for approved metrics", () => {
    expect(normalizeSetupPresentationFinding(finding({
      metricName: "spotify_followers",
      metricValue: "many followers",
    }))).toBeNull();
    expect(normalizeSetupPresentationFinding(finding({
      metricName: "career_stage",
      kind: "momentum",
      destination: "momentum",
      metricValue: 3,
    }))).toBeNull();
    expect(normalizeSetupPresentationFinding(finding({
      metricName: "career_stage",
      kind: "momentum",
      destination: "momentum",
      metricValue: "Emerging",
    }))).toMatchObject({
      title: "Career stage",
      value: "Emerging",
    });
  });

  it("requires an approved metric for quantitative findings but allows safe narrative findings", () => {
    const { metricName: _metricName, metricValue: _metricValue, metricUnit: _metricUnit, ...arbitraryAudience } = finding({
      kind: "audience",
      destination: "audience",
      title: "Audience narrative",
      value: "A narrative without a metric name",
    });
    expect(normalizeSetupPresentationFinding(arbitraryAudience)).toBeNull();

    expect(normalizeSetupPresentationFinding({
      id: "narrative-1",
      dedupeKey: "context:artist-profile",
      revision: "1",
      persistedAt: "2026-08-23T10:00:03.000Z",
      phase: "synthesis",
      kind: "public_context",
      destination: "manager_read",
      title: "A public artist profile was found",
      detail: "example.com",
    })).toMatchObject({
      kind: "public_context",
      title: "A public artist profile was found",
    });
  });

  it("rejects arbitrary caller-supplied value text for numeric metrics", () => {
    expect(normalizeSetupPresentationFinding(finding({
      metricName: "spotify_followers",
      metricValue: 42,
      value: "A large and growing audience",
    }))).toBeNull();
    expect(normalizeSetupPresentationFinding(finding({
      metricName: "spotify_followers",
      value: "42 followers",
    }))).toBeNull();
  });

  it("rejects invalid or null phase, kind, and destination fields instead of inferring them", () => {
    for (const field of ["phase", "kind", "destination"] as const) {
      expect(normalizeSetupPresentationFinding(finding({ [field]: null }))).toBeNull();
      expect(normalizeSetupPresentationFinding(finding({ [field]: "not-valid" }))).toBeNull();
    }
  });

  it("rejects forbidden provider and tool text from every public string field", () => {
    const feed = parseSetupPresentationFeed({
      ...baseFeed,
      artist: {
        name: "Chartmetric Artist",
        imageUrl: "https://images.example.com/artist.jpg",
        genres: ["web_search"],
      },
      findings: [
        finding({ id: "Chartmetric-id" }),
        finding({ id: "forbidden-dedupe", dedupeKey: "manager_discovery_tool:metric" }),
        finding({ id: "forbidden-revision", revision: "save_public_evidence" }),
        finding({ id: "forbidden-detail", detail: "write_strategic_memory" }),
        finding({
          id: "forbidden-art-alt",
          artwork: { url: "https://images.example.com/artist.jpg", alt: "web_search" },
        }),
        finding({
          id: "forbidden-host",
          kind: "public_context",
          destination: "manager_read",
          metricName: "public_context_artist_identity",
          title: "A public profile",
          publicContextUrl: "https://chartmetric.example.com/profile",
        }),
      ],
    }, runId);

    const serialized = JSON.stringify(feed).toLowerCase();
    expect(feed.artist).toBeUndefined();
    expect(feed.findings.map((item) => item.id)).toEqual(["forbidden-art-alt"]);
    expect(feed.findings[0]).not.toHaveProperty("artwork");
    expect(serialized).not.toContain("chartmetric");
    expect(serialized).not.toContain("manager_discovery_tool");
    expect(serialized).not.toContain("save_public_evidence");
    expect(serialized).not.toContain("write_strategic_memory");
    expect(serialized).not.toContain("web_search");
  });

  it("skips findings whose optional scope metadata does not match the feed", () => {
    const feed = parseSetupPresentationFeed({
      ...baseFeed,
      findings: [
        finding({ id: "valid-scoped", setupRunId: runId, artistWorkspaceId: "workspace-7" }),
        finding({ id: "wrong-run", setupRunId: "another-run", artistWorkspaceId: "workspace-7" }),
        finding({ id: "wrong-workspace", setup_run_id: runId, artist_workspace_id: "another-workspace" }),
        finding({ id: "valid-run-only", setup_run_id: runId }),
      ],
    }, runId);

    expect(feed.findings.map((item) => item.id)).toEqual(["valid-run-only", "valid-scoped"]);
    expect(JSON.stringify(feed.findings)).not.toContain("setupRunId");
    expect(JSON.stringify(feed.findings)).not.toContain("artistWorkspaceId");
  });

  it("omits broken optional artist and finding artwork without discarding valid data", () => {
    const feed = parseSetupPresentationFeed({
      ...baseFeed,
      artist: {
        name: "Victor Ny",
        imageUrl: "http://not-https.example.com/victor.jpg",
        genres: ["Afrobeats"],
      },
      findings: [finding({
        id: "broken-artwork",
        artwork: { url: "javascript:alert(1)", alt: "Broken artwork" },
      })],
    }, runId);

    expect(feed.artist).toEqual({ name: "Victor Ny", genres: ["Afrobeats"] });
    expect(feed.findings).toEqual([expect.objectContaining({ id: "broken-artwork" })]);
    expect(feed.findings[0]).not.toHaveProperty("artwork");
  });

  it("rejects malformed envelope authority and wrong setup-run scope", () => {
    expect(() => parseSetupPresentationFeed({ ...baseFeed, version: 1 }, runId)).toThrow(/unsupported version/i);
    expect(() => parseSetupPresentationFeed({
      ...baseFeed,
      setup: { ...baseFeed.setup, runId: "another-run" },
    }, runId)).toThrow(/run id/i);
    expect(() => parseSetupPresentationFeed({
      ...baseFeed,
      setup: { ...baseFeed.setup, updatedAt: "not-a-date" },
    }, runId)).toThrow(/updatedAt/i);
    expect(() => parseSetupPresentationFeed({
      ...baseFeed,
      setup: { ...baseFeed.setup, started_at: "not-a-date" },
    }, runId)).toThrow(/startedAt/i);
    expect(() => parseSetupPresentationFeed({
      ...baseFeed,
      setup: { ...baseFeed.setup, phaseStartedAt: "2026-08-23T10:00:00.000Z", phase_started_at: "not-a-date" },
    }, runId)).toThrow(/phaseStartedAt/i);
    expect(() => parseSetupPresentationFeed({ ...baseFeed, findings: {} }, runId)).toThrow(/findings/i);
    expect(() => parseSetupPresentationFeed({
      ...baseFeed,
      projection: { bounded: false, maxFindings: 32, omittedMalformed: 0 },
    }, runId)).toThrow(/projection/i);
  });

  it("sanitizes public-context URLs to hostnames and never uses them for platform metrics", () => {
    const normalized = normalizeSetupPresentationFinding({
      id: "context-1",
      dedupeKey: "context:profile",
      revision: "1",
      persistedAt: "2026-08-23T10:00:02.000Z",
      phase: "discovery",
      kind: "public_context",
      destination: "manager_read",
      metricName: "public_context_artist_identity",
      title: "A public profile was found",
      publicContextUrl: "https://www.example.com/articles/victor?utm_source=private",
    });

    expect(normalized).toEqual(expect.objectContaining({
      kind: "public_context",
      detail: "example.com",
    }));
    expect(JSON.stringify(normalized)).not.toContain("/articles");
    expect(JSON.stringify(normalized)).not.toContain("utm_source");
    expect(normalizeSetupPresentationFinding({
      id: "context-2",
      dedupeKey: "context:bad",
      revision: "1",
      persistedAt: "2026-08-23T10:00:02.000Z",
      phase: "discovery",
      kind: "audience",
      destination: "audience",
      metricName: "spotify_followers",
      metricValue: 20,
      publicContextUrl: "https://private.example.com/should-not-be-platform-data",
    })).toMatchObject({ platform: "spotify" });
    expect(normalizeSetupPresentationFinding({
      id: "context-3",
      dedupeKey: "context:unsafe",
      revision: "1",
      persistedAt: "2026-08-23T10:00:02.000Z",
      phase: "discovery",
      kind: "public_context",
      destination: "manager_read",
      metricName: "public_context_artist_identity",
      title: "Private context",
      publicContextUrl: "http://not-secure.example.com/profile",
    })).toBeNull();
  });

  it("sorts the initial batch deterministically by time, phase, kind, and id", () => {
    const candidates = [
      normalizeSetupPresentationFinding(finding({ id: "z", persistedAt: "2026-08-23T10:00:02.000Z" })),
      normalizeSetupPresentationFinding(finding({ id: "catalogue", persistedAt: "2026-08-23T10:00:01.000Z", phase: "discovery", kind: "playlist", destination: "audience", metricName: "spotify_playlist_count", metricValue: 3, metricUnit: "playlists" })),
      normalizeSetupPresentationFinding(finding({ id: "audience-b", persistedAt: "2026-08-23T10:00:00.000Z" })),
      normalizeSetupPresentationFinding(finding({ id: "audience-a", persistedAt: "2026-08-23T10:00:00.000Z" })),
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    expect(sortSetupPresentationFindings(candidates).map((item) => item.id)).toEqual([
      "audience-a",
      "audience-b",
      "catalogue",
      "z",
    ]);
  });

  it("compares numeric and timestamp revisions without using browser time", () => {
    expect(compareSetupPresentationFindingRevision("2", "10")).toBeLessThan(0);
    expect(compareSetupPresentationFindingRevision("2026-08-23T10:00:00.000Z", "2026-08-23T10:00:01.000Z")).toBeLessThan(0);
    expect(compareSetupPresentationFindingRevision("same", "same")).toBe(0);
    expect(compareSetupPresentationFindingRevision("z", "a")).toBeGreaterThan(0);
  });

  it("counts conflicting stable IDs while preserving the first valid content", () => {
    const first = finding({
      id: "conflicting-id",
      dedupeKey: "audience:first-semantic-fact",
      metricName: "spotify_followers",
      metricValue: 42,
    });
    const conflict = finding({
      id: "conflicting-id",
      dedupeKey: "audience:second-semantic-fact",
      metricName: "spotify_followers",
      metricValue: 999,
    });
    const feed = parseSetupPresentationFeed({
      ...baseFeed,
      findings: [first, conflict],
    }, runId);

    expect(feed.findings).toHaveLength(1);
    expect(feed.findings[0]).toMatchObject({
      id: "conflicting-id",
      dedupeKey: "audience:first-semantic-fact",
      value: "42",
    });
    expect(feed.projection.omittedMalformed).toBe(1);
  });
});
