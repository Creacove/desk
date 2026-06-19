import { describe, expect, it } from "vitest";
import { classifyArtistStage } from "./services/missionGenesis/artistStage";
import { runMissionGenesis } from "./services/missionGenesis";
import { draftMissionPlan } from "./services/missionGenesis/missionPlanDraft";
import { detectMissionPressures } from "./services/missionGenesis/pressureDetection";
import { applyMissionWorthinessGates } from "./services/missionGenesis/worthinessGates";
import type { ArtistOperatingPacket, MissionPressure } from "./services/missionGenesis/types";

function basePacket(overrides: Partial<ArtistOperatingPacket> = {}): ArtistOperatingPacket {
  return {
    artist: {
      id: "artist-1",
      name: "Test Artist",
      stage: "developing",
      stageReason: "Some released music and early public signals exist.",
      goals: ["Build repeatable audience proof"],
      genreContext: ["Alt-pop"],
      marketContext: ["Lagos"],
      positioning: ["Left-field but accessible"],
      constraints: [],
      doNotDo: [],
    },
    budget: {
      posture: "unknown",
      source: "unknown",
      confidence: "unknown",
    },
    team: {
      capacity: "solo",
      availableRoles: ["artist"],
      constraints: ["No dedicated campaign team confirmed"],
    },
    music: {
      songs: [],
      projects: [],
    },
    audience: {
      momentumSignals: [],
      geographySignals: [],
      platformSignals: [],
      sourceLimitations: [],
    },
    business: {
      rightsRisks: [],
      metadataRisks: [],
      distributionRisks: [],
      revenueSignals: [],
    },
    memory: {
      durableContext: [],
      priorDecisions: [],
      rejectedMoves: [],
      activeConstraints: [],
    },
    existingMissions: [],
    recentAgentInputs: [],
    sourceConfidence: {
      strong: [],
      weak: [],
      missing: [],
      stale: [],
    },
    ...overrides,
  };
}

describe("Mission Genesis", () => {
  it("classifies a foundation artist when source and catalog context are weak", () => {
    const result = classifyArtistStage(basePacket({
      artist: {
        ...basePacket().artist,
        goals: [],
      },
      sourceConfidence: {
        strong: [],
        weak: [],
        missing: ["streaming analytics", "artist goal", "team capacity"],
        stale: [],
      },
    }));

    expect(result.stage).toBe("foundation");
    expect(result.reasons.join(" ")).toContain("missing");
  });

  it("requires compact context instead of activating a valuable but under-specified pressure", () => {
    const pressure: MissionPressure = {
      pressureKey: "market-expansion-london",
      category: "market_expansion",
      title: "Validate whether London deserves focused operating attention",
      whyNow: "Audience geography shows London movement, but intent and budget are unclear.",
      artistStageFit: "Market validation fits a developing artist if the team can run a scoped test.",
      supportingSignals: ["London appears in audience geography"],
      missingContext: ["90-day goal", "budget range", "team capacity"],
      missingEvidence: [],
      risksIfIgnored: ["The team may spend against a weak or misaligned market read."],
      likelyPatterns: ["Market Expansion", "Audience Development"],
      estimatedTimeline: {
        minDays: 30,
        maxDays: 90,
        reason: "Market validation needs enough time to test signal quality and review response.",
      },
      confidence: "medium",
    };

    const result = applyMissionWorthinessGates(basePacket(), pressure);

    expect(result.outcome).toBe("candidate_needs_context");
    expect(result.questionsNeeded.length).toBeGreaterThan(0);
    expect(result.activate).toBe(false);
  });
});

describe("Mission pressure detection", () => {
  it("detects a source completeness pressure before inventing strategic missions for weak packets", () => {
    const pressures = detectMissionPressures(basePacket({
      sourceConfidence: {
        strong: [],
        weak: [],
        missing: ["streaming analytics", "budget posture", "team capacity", "artist goal"],
        stale: [],
      },
    }));

    expect(pressures[0].category).toBe("data_source_completeness");
    expect(pressures[0].title).toContain("source");
  });

  it("detects market expansion when geography signal exists but requires context", () => {
    const pressures = detectMissionPressures(basePacket({
      audience: {
        momentumSignals: ["Monthly listeners increased"],
        geographySignals: ["London audience is rising"],
        platformSignals: [],
        sourceLimitations: [],
      },
    }));

    expect(pressures.some((pressure) => pressure.category === "market_expansion")).toBe(true);
  });
});

describe("Mission plan drafting", () => {
  it("turns a market expansion pressure into checkpoint questions and tasks without release assumptions", () => {
    const pressure: MissionPressure = {
      pressureKey: "market-expansion-london",
      category: "market_expansion",
      title: "Validate whether London deserves focused operating attention",
      whyNow: "London geography signal appears in the audience packet.",
      artistStageFit: "Market validation fits this developing artist if scoped to proof.",
      supportingSignals: ["London audience is rising"],
      missingContext: [],
      missingEvidence: ["smart-link geography"],
      risksIfIgnored: ["The team may miss a market opening."],
      likelyPatterns: ["Market Expansion", "Audience Development"],
      estimatedTimeline: {
        minDays: 45,
        maxDays: 120,
        reason: "Market validation needs enough time to test signal quality.",
      },
      confidence: "medium",
    };

    const draft = draftMissionPlan(basePacket(), pressure);

    expect(draft.mission.title).toContain("London");
    expect(draft.checkpoints[0].question).toContain("real enough");
    expect(draft.tasks.some((task) => task.title.toLowerCase().includes("geography"))).toBe(true);
    expect(draft.tasks.every((task) => task.primaryCheckpointKey)).toBe(true);
  });

  it("turns an audience development pressure into real audience checkpoints instead of a generic Manager-read placeholder", () => {
    const pressure: MissionPressure = {
      pressureKey: "audience-development-repeat-behavior",
      category: "audience_development",
      title: "Test whether current attention is becoming repeatable audience behavior",
      whyNow: "Momentum exists, but the Manager must determine whether it is durable enough to shape operating work.",
      artistStageFit: "Audience development fits artists with early or growing public signal.",
      supportingSignals: ["Monthly listeners increased", "Playlist adds are rising"],
      missingContext: [],
      missingEvidence: [],
      risksIfIgnored: ["The team may mistake attention for fandom or fail to capture real demand."],
      likelyPatterns: ["Audience Development", "Creator / Content Validation"],
      estimatedTimeline: {
        minDays: 14,
        maxDays: 45,
        reason: "Audience validation needs a short testing window plus reviewable signal.",
      },
      confidence: "medium",
    };

    const draft = draftMissionPlan(basePacket(), pressure);

    expect(draft.mission.patternName).toBe("Audience Development + Creator / Content Validation");
    expect(draft.checkpoints.map((checkpoint) => checkpoint.key)).toEqual([
      "attention_quality",
      "capture_path",
      "repeat_behavior_review",
    ]);
    expect(draft.tasks.map((task) => task.title)).toEqual([
      "Verify attention quality",
      "Define the audience capture path",
      "Set the repeat-behavior review rule",
    ]);
    expect(draft.checkpoints.map((checkpoint) => checkpoint.title)).not.toContain("Objective quality");
    expect(draft.tasks.map((task) => task.title)).not.toContain("Prepare first Manager read");
  });

  it("refuses unsupported mission categories instead of activating generic fallback work", () => {
    const pressure: MissionPressure = {
      pressureKey: "unsupported-team-pressure",
      category: "team_operations",
      title: "Clarify recurring team ownership",
      whyNow: "Ownership is unclear.",
      artistStageFit: "Team operations may fit this artist.",
      supportingSignals: ["No one owns weekly review."],
      missingContext: [],
      missingEvidence: [],
      risksIfIgnored: ["Work may stall."],
      likelyPatterns: ["Team Operations"],
      estimatedTimeline: {
        minDays: 7,
        maxDays: 14,
        reason: "Team process can be clarified quickly.",
      },
      confidence: "medium",
    };

    expect(() => draftMissionPlan(basePacket(), pressure)).toThrow("Mission Genesis cannot activate team_operations yet");
  });
});

describe("Mission Genesis orchestration", () => {
  it("returns a candidate with questions when the best pressure needs context", () => {
    const result = runMissionGenesis(basePacket({
      audience: {
        momentumSignals: ["Monthly listeners increased"],
        geographySignals: ["London audience is rising"],
        platformSignals: [],
        sourceLimitations: [],
      },
      budget: {
        posture: "unknown",
        source: "unknown",
        confidence: "unknown",
      },
      team: {
        capacity: "unknown",
        availableRoles: [],
        constraints: [],
      },
    }));

    expect(result.outcome).toBe("candidate_needs_context");
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.candidate?.title).toContain("market");
  });
});
