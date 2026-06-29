import type { ChartmetricKpiInput, Direction, EvidenceConfidence } from "../types";

type InterpretedStage = "Emerging" | "Developing" | "Mid-Level" | "Mainstream" | "Superstar" | "Legendary" | "Unknown";

const normalizeStage = (stage?: string | null): InterpretedStage => {
  const value = (stage ?? "").toLowerCase();
  if (value.includes("legend")) return "Legendary";
  if (value.includes("super")) return "Superstar";
  if (value.includes("main")) return "Mainstream";
  if (value.includes("mid")) return "Mid-Level";
  if (value.includes("develop")) return "Developing";
  if (value.includes("emerg") || value.includes("seed")) return "Emerging";
  return "Unknown";
};

const direction = (value?: { direction?: Direction } | null): Direction => value?.direction ?? "unknown";

const confidenceFromPresence = (...values: unknown[]): EvidenceConfidence => {
  const present = values.filter((value) => value !== undefined && value !== null).length;
  if (present >= values.length) return "High";
  if (present > 0) return "Medium";
  return "Low";
};

const scoreRead = (value: number | null | undefined, scoreDirection: Direction) => {
  if (value === null || value === undefined) {
    return "Artist Score is unavailable, so stage and momentum should lean on available platform, fan, and market evidence.";
  }
  if (value >= 80) return `Artist Score is high and ${scoreDirection}; read it as broad artist strength, not proof of current conversion by itself.`;
  if (value >= 50) return `Artist Score is mid-range and ${scoreDirection}; the artist needs signal agreement before scaling spend or positioning.`;
  return `Artist Score is still developing and ${scoreDirection}; prioritize identity, conversion, and proof before broad expansion.`;
};

const compareRanks = (fanBaseRank?: number | null, engagementRank?: number | null) => {
  if (!fanBaseRank || !engagementRank) {
    return {
      relationship: "unknown" as const,
      read: "Fanbase and engagement ranks are incomplete, so confidence should lean on available conversion and fan signals.",
    };
  }

  const ratio = fanBaseRank / engagementRank;
  if (ratio >= 2) {
    return {
      relationship: "engagement_stronger" as const,
      read: "Current engagement is much stronger than durable fanbase. Treat the moment as heat that needs conversion into followers, saves, and repeat listening.",
    };
  }
  if (ratio <= 0.5) {
    return {
      relationship: "fanbase_stronger" as const,
      read: "Durable fanbase is stronger than current engagement. The artist may have passive scale or a cooling current cycle.",
    };
  }
  return {
    relationship: "both_strong" as const,
    read: "Fanbase and engagement are broadly aligned, which supports higher conviction if other signals agree.",
  };
};

const cityRole = (score?: number | null, listenerCount?: number | null) => {
  if (score === null || score === undefined) return "unknown" as const;
  if (score >= 90 && (listenerCount ?? 0) >= 10_000) return "power_market" as const;
  if (score >= 75) return "emerging_pocket" as const;
  if (score >= 50) return "passive_scale" as const;
  return "avoid_for_now" as const;
};

const brandFit = (score?: number | null, artistWorldFit?: string | null) => {
  if (score === null || score === undefined) return "unknown" as const;
  if (score >= 80 && artistWorldFit === "strong") return "strong_fit" as const;
  if (score >= 70) return "investigate" as const;
  if (artistWorldFit === "weak") return "positioning_risk" as const;
  return "unknown" as const;
};

export const interpretChartmetricKpis = (input: ChartmetricKpiInput) => {
  const interpretedStage = normalizeStage(input.careerStage);
  const fanbaseVsEngagement = compareRanks(input.fanBaseRank, input.engagementRank);
  const artistScoreDirection = direction(input.artistScore);
  const artistRankDirection = direction(input.artistRank);

  return {
    artistScore: {
      value: input.artistScore?.value ?? null,
      direction: artistScoreDirection,
      read: scoreRead(input.artistScore?.value, artistScoreDirection),
      managementMeaning: "Use Artist Score as broad strength context, not a standalone decision trigger.",
      confidence: confidenceFromPresence(input.artistScore?.value),
    },
    artistRank: {
      value: input.artistRank?.value ?? null,
      direction: artistRankDirection,
      read:
        input.artistRank?.value === null || input.artistRank?.value === undefined
          ? "Artist Rank is unavailable, so competitive context is incomplete."
          : `Artist Rank is ${input.artistRank.value} and ${artistRankDirection}; interpret rank movement relative to peer movement, not in isolation.`,
      relativeContext: "Rank is relative and can move because peers change, even when the artist improves.",
    },
    careerStage: {
      sourceStage: input.careerStage ?? null,
      interpretedStage,
      stageReason:
        interpretedStage === "Unknown"
          ? "No reliable career-stage field was available."
          : `${interpretedStage} strategy should match the artist's settled level, while momentum controls urgency.`,
    },
    momentum: {
      direction: input.momentum ?? "unknown",
      read: `Momentum is ${input.momentum ?? "unknown"}; do not confuse this with long-term career stage.`,
    },
    fanbaseVsEngagement: fanbaseVsEngagement,
    socialEngagementRead:
      input.socialEngagementScore && input.socialEngagementScore >= 75
        ? "Social engagement is strong for the current read; protect authenticity and route attention into owned fan behavior."
        : "Social engagement does not independently prove fan attachment.",
    networkStrengthRead:
      input.networkStrengthScore && input.networkStrengthScore >= 70
        ? "Network strength suggests tastemaker or industry leverage; use it carefully instead of over-commercializing early."
        : "Network strength is not yet a major leverage signal.",
    cityAffinityReads: (input.cityAffinity ?? []).map((city) => {
      const role = cityRole(city.score, city.listenerCount);
      return {
        city: city.city,
        score: city.score ?? null,
        role,
        read:
          role === "power_market"
            ? `${city.city} combines affinity and audience scale; treat it as a first activation market.`
            : `${city.city} is worth watching as a ${role.replace(/_/g, " ")} signal.`,
      };
    }),
    brandAffinityReads: (input.brandAffinity ?? []).map((brand) => {
      const fit = brandFit(brand.score, brand.artistWorldFit);
      return {
        brandOrCategory: brand.brandOrCategory,
        score: brand.score ?? null,
        fit,
        read:
          fit === "strong_fit"
            ? `${brand.brandOrCategory} has affinity and artist-world fit; it can inform positioning, not automatic outreach.`
            : `${brand.brandOrCategory} needs identity and career-stage review before any recommendation.`,
      };
    }),
    moodGenreRead:
      [...(input.moodTags ?? []), ...(input.genreTags ?? [])].length > 0
        ? "Mood and genre tags should shape artist-world, playlist, sync, and positioning reads."
        : "Mood and genre tags are unavailable, so world-building confidence is lower.",
    trackScoreReads: (input.trackScores ?? []).map((track) => ({
      musicItemId: track.musicItemId ?? null,
      trackName: track.trackName,
      chartmetricTrackScore: track.chartmetricTrackScore ?? null,
      spotifyPopularity: track.spotifyPopularity ?? null,
      read: `${track.trackName} has track-level playlist/exposure context; judge durability by retention and conversion, not score alone.`,
      risk: "Track score can reflect playlist exposure without owned fandom.",
      watchMetric: "playlist retention, saves, follows, Shazams, and repeat listening",
    })),
  };
};
