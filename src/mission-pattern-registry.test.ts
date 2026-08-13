import { describe, expect, it } from "vitest";
import {
  getMissionPatternRegistry,
  selectMissionPatternsForPacket,
} from "../supabase/functions/_shared/mission-patterns/missionPatternRegistry";
import { buildMissionGenesisInstructions } from "../supabase/functions/_shared/openaiMissionGenesis";

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

    expect(selected.map((pattern) => pattern.key)).toEqual([
      "creator_content_validation",
      "city_live_market_validation",
    ]);
  });

  it("does not invent a thesis or upload mission when no pattern is relevant", () => {
    const selected = selectMissionPatternsForPacket({
      artist: { homeMarket: "", goals: [] },
      managerIntelligenceMissionSeed: { mission_candidates: [] },
      evidence: [],
    });

    expect(selected).toEqual([]);
  });

  it("keeps analysis in checkpoint reads and task hints limited to human actions", () => {
    const registry = getMissionPatternRegistry();
    for (const key of ["focus_asset_selection", "collaboration_strategy", "catalog_asset_narrative", "fan_ownership"]) {
      const pattern = registry.find((candidate) => candidate.key === key);
      expect(pattern?.taskTypes.join(" ")).not.toMatch(/\b(compare|map feature attachment|measure artist attachment|review fan language)\b/i);
      expect(pattern?.taskTypes.join(" ")).toMatch(/\b(approve|choose|publish|report|authorize)\b/i);
    }

    const sourcePattern = registry.find((candidate) => candidate.key === "data_source_completeness");
    expect(sourcePattern?.blockageState).toMatch(/limitation|conservative recommendation/i);
    expect(sourcePattern?.taskTypes.join(" ")).not.toMatch(/upload CSV|upload file/i);
  });

  it("defines release planning as the six-workstream Release Success Mission", () => {
    const pattern = getMissionPatternRegistry().find((candidate) => candidate.key === "release_planning");

    expect(pattern).toEqual(expect.objectContaining({
      name: "Release Success Mission",
      taskTypes: [
        "release foundation",
        "playlist and discovery",
        "press and media",
        "content rollout",
        "launch",
        "post-release",
      ],
    }));
    expect(pattern?.successState).toMatch(/campaign execution/i);
    expect(pattern?.taskTypes.join(" ")).not.toMatch(/research|comparison|drafting|find emails/i);
    expect(pattern?.permissionBoundaries.join(" ")).toMatch(/submission/i);
    expect(pattern?.permissionBoundaries.join(" ")).toMatch(/external outreach/i);
  });

  it("requires stable schedule keys while keeping Manager research out of artist tasks", () => {
    const instructions = buildMissionGenesisInstructions("initial");

    expect(instructions).toMatch(/research|comparison|synthesis.*Manager work/i);
    expect(instructions).toMatch(/artist.*(approval|private facts|external submissions|recording outcomes)/i);
    expect(instructions).toContain("scheduleKey");
    expect(instructions).toMatch(/title text/i);
  });
});
