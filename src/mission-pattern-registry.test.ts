import { describe, expect, it } from "vitest";
import {
  getMissionPatternRegistry,
  selectMissionPatternsForPacket,
} from "../supabase/functions/_shared/mission-patterns/missionPatternRegistry";

describe("Mission pattern registry", () => {
  it("ships management-domain patterns with evidence, checkpoint, permission, and task guidance", () => {
    const registry = getMissionPatternRegistry();
    const domains = registry.map((pattern) => pattern.domain);

    expect(domains).toEqual(
      expect.arrayContaining([
        "Career Architecture",
        "Artist Positioning And Narrative",
        "A&R And Creative Development",
        "Audience And Fan Development",
        "Market Expansion",
        "Rights, Finance, And Business Affairs",
        "Data Sovereignty And Intelligence",
      ]),
    );
    expect(registry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "city_live_market_validation",
          domain: "Market Expansion",
          checkpointQuestions: expect.arrayContaining([expect.stringMatching(/market|city|live/i)]),
          permissionBoundaries: expect.arrayContaining([expect.stringMatching(/booking|outreach|spend/i)]),
        }),
        expect.objectContaining({
          key: "rights_cleanup",
          domain: "Rights, Finance, And Business Affairs",
          evidenceNeeds: expect.arrayContaining([expect.stringMatching(/split|ownership|metadata/i)]),
        }),
      ]),
    );
    expect(registry.every((pattern) => pattern.taskTypes.length > 0 && pattern.changeConditions.length > 0)).toBe(true);
  });

  it("selects composable runtime patterns from packet mission candidates and evidence", () => {
    const selected = selectMissionPatternsForPacket({
      artist: { homeMarket: "Lagos", goals: ["Build global demand without losing the home-market story"] },
      managerIntelligenceMissionSeed: {
        mission_candidates: [
          { domain: "Audience And Fan Development", direction: "Test repeatable fan behavior around OPERA MINI" },
          { domain: "Market Expansion", direction: "Validate Lagos before broader expansion" },
          { domain: "Data Sovereignty And Intelligence", direction: "Close private-data gaps" },
        ],
      },
      evidence: [
        { id: "ev_tiktok", label: "tiktok_track_posts", kind: "public_social_metric" },
        { id: "ev_lagos", label: "city_affinity_lagos", kind: "market_metric" },
        { id: "ev_rights", label: "split_sheet_missing", kind: "rights_risk" },
      ],
    });

    expect(selected.map((pattern) => pattern.key)).toEqual(
      expect.arrayContaining([
        "creator_content_validation",
        "city_live_market_validation",
        "rights_cleanup",
        "data_source_completeness",
      ]),
    );
    expect(selected.map((pattern) => pattern.key)).not.toEqual(["creator_content_validation"]);
  });
});
