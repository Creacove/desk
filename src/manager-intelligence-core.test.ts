import { describe, expect, it } from "vitest";
import { interpretChartmetricKpis } from "../supabase/functions/_shared/manager-intelligence/profile/kpiInterpreter";
import { validateManagerIntelligencePacket } from "../supabase/functions/_shared/manager-intelligence/packet/packetSchema";
import { routePlaybooks, summarizePlaybookInfluenceForPublicOutput } from "../supabase/functions/_shared/manager-intelligence/playbooks/playbookRouter";
import { classifyEvidenceSignal } from "../supabase/functions/_shared/manager-intelligence/signals/signalClassifier";

describe("Manager Intelligence signal classification", () => {
  it("classifies raw evidence into management signal types before interpretation", () => {
    expect(
      classifyEvidenceSignal({
        evidence_type: "public_social_metric",
        metric_name: "tiktok_track_posts",
        lens: "social_attention",
        metric_value: 1_500_000,
      }),
    ).toMatchObject({ signalType: "attention", evidenceStrength: "High" });

    expect(
      classifyEvidenceSignal({
        evidence_type: "platform_metric",
        metric_name: "shazam_count",
        metric_value: 20_000,
      }),
    ).toMatchObject({ signalType: "discovery", evidenceStrength: "High" });

    expect(
      classifyEvidenceSignal({
        evidence_type: "playlist_movement",
        metric_name: "spotify_playlist_total_reach",
        metric_value: 5_000_000,
      }),
    ).toMatchObject({ signalType: "playlist", evidenceStrength: "High" });

    expect(
      classifyEvidenceSignal({
        evidence_type: "market_metric",
        metric_name: "city_affinity_lagos",
        lens: "market",
        metric_value: 92,
      }),
    ).toMatchObject({ signalType: "market", evidenceStrength: "High" });
  });
});

describe("Manager Intelligence KPI interpretation", () => {
  it("turns Chartmetric-style KPIs into management reads instead of raw numbers", () => {
    const read = interpretChartmetricKpis({
      artistScore: { value: 42, direction: "up" },
      artistRank: { value: 12_000, direction: "down" },
      careerStage: "Developing",
      momentum: "rising",
      fanBaseRank: 80_000,
      engagementRank: 8_000,
      socialEngagementScore: 86,
      networkStrengthScore: 72,
      cityAffinity: [
        { city: "Lagos", score: 94, listenerCount: 30_000 },
        { city: "London", score: 82, listenerCount: 5_000 },
      ],
      brandAffinity: [{ brandOrCategory: "streetwear", score: 88, artistWorldFit: "strong" }],
      moodTags: ["confident", "nightlife"],
      genreTags: ["afrobeats", "alt-pop"],
      trackScores: [
        {
          musicItemId: "song-1",
          trackName: "Call Me",
          chartmetricTrackScore: 78,
          spotifyPopularity: 68,
        },
      ],
    });

    expect(read.careerStage.interpretedStage).toBe("Developing");
    expect(read.fanbaseVsEngagement.relationship).toBe("engagement_stronger");
    expect(read.fanbaseVsEngagement.read).toMatch(/attention|engagement|fanbase|convert/i);
    expect(read.cityAffinityReads[0]).toMatchObject({ city: "Lagos", role: "power_market" });
    expect(read.cityAffinityReads[1]).toMatchObject({ city: "London", role: "emerging_pocket" });
    expect(read.brandAffinityReads[0]).toMatchObject({ fit: "strong_fit" });
    expect(read.trackScoreReads[0].read).toMatch(/playlist|exposure|durability|track/i);
  });
});

describe("Manager Intelligence playbook routing", () => {
  it("keeps playbooks internal while exposing only public management influence", () => {
    const routing = routePlaybooks({
      careerStage: "Developing",
      signalTypes: ["attention", "discovery", "playlist", "market"],
      strongestSignal: "TikTok attention is ahead of owned fanbase",
      biggestRisk: "Playlist reach may not convert",
      marketShape: "Lagos power market with diaspora lift",
      catalogShape: "Song-first spike",
      hasRightsOrDealRisk: true,
    });

    expect(routing.appliedPlaybooks).toEqual(
      expect.arrayContaining(["no_engine", "social_contagion", "playlist_discovery", "ar_breakout", "cultural_expansion", "artist_as_business"]),
    );

    const publicSummary = summarizePlaybookInfluenceForPublicOutput(routing);
    expect(publicSummary).toMatch(/avoid|convert|protect|focus|risk/i);
    expect(publicSummary).not.toMatch(/playbook|social_contagion|playlist_discovery|no_engine|artist_as_business/i);
  });
});

describe("Manager Intelligence packet validation", () => {
  it("rejects packets without evidence-backed recommendations, avoid judgment, confidence, and hidden internal-only routing", () => {
    const result = validateManagerIntelligencePacket({
      executive_read_json: {
        priority: "Convert TikTok attention into owned listeners",
        manager_read: "The moment is attention-led, not fanbase-led yet.",
        confidence_level: "Medium",
        confidence_reason: "Attention and discovery agree, conversion needs proof.",
      },
      strategic_diagnosis_json: {
        career_stage: "Developing",
        platform_shape: "TikTok-led",
        market_shape: "Lagos-first",
        catalog_shape: "Song-first spike",
        strongest_signal: "TikTok and Shazam",
        biggest_risk: "Audience watches but does not attach",
        current_priority: "Conversion",
      },
      signal_map_json: [
        {
          signal_id: "sig_1",
          signal_type: "Attention",
          interpretation: "TikTok is creating public attention.",
          evidence_strength: "High",
          evidence_ids: ["ev_1"],
        },
      ],
      management_insights_json: [
        {
          insight_id: "insight_1",
          insight: "Route the spike into saves and follows.",
          recommended_next_move: "Use Lagos as the first conversion market.",
          avoid: "Do not increase broad spend until conversion moves.",
          confidence_level: "Medium",
          evidence_ids: ["ev_1"],
        },
      ],
      mission_seed_json: {
        primary_mission_direction: "Build a Lagos-first conversion mission.",
      },
      conversation_memory_seed_json: {
        what_manager_should_remember: ["Attention is ahead of owned fanbase."],
      },
      supporting_evidence_json: [{ id: "ev_1", metric: "tiktok_track_posts" }],
      internal_only_json: {
        playbooks_applied: ["social_contagion", "no_engine"],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects unsafe or under-supported packet shapes", () => {
    const result = validateManagerIntelligencePacket({
      executive_read_json: {
        priority: "OpenAI says this is a breakout",
        manager_read: "The Social Contagion playbook says scale now.",
        confidence_level: "High",
      },
      strategic_diagnosis_json: {},
      signal_map_json: [],
      management_insights_json: [
        {
          insight_id: "insight_1",
          insight: "Spend nationally.",
          recommended_next_move: "Increase ad spend everywhere.",
          evidence_ids: [],
        },
      ],
      mission_seed_json: {},
      conversation_memory_seed_json: {},
      supporting_evidence_json: [],
      internal_only_json: {},
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "executive_read_json.confidence_reason is required",
        "management_insights_json[0].avoid is required",
        "management_insights_json[0].evidence_ids must not be empty",
        "visible packet fields must not expose provider, prompt, or playbook language",
      ]),
    );
  });
});
