import { describe, expect, it } from "vitest";

import { TEAM_ROLE_PRESETS, findTeamRolePreset, parseResponsibilityTags } from "./teamRolePresets";

describe("team role presets", () => {
  it("keeps the first-run role labels and default responsibilities in one shared list", () => {
    expect(TEAM_ROLE_PRESETS.map((preset) => preset.label)).toEqual([
      "House / team lead",
      "Artist / performer",
      "Manager / project lead",
      "Label / company",
      "A&R / talent",
      "Producer / creative",
      "Songwriter / composer",
      "Marketing / growth",
      "PR / communications",
      "Content / social",
      "DSP / distribution",
      "Rights / business affairs",
      "Finance / operations",
      "Recording / engineering",
      "Other",
    ]);
    expect(findTeamRolePreset("DSP / distribution")).toEqual(TEAM_ROLE_PRESETS[10]);
    expect(TEAM_ROLE_PRESETS[10].responsibilityTags).toEqual([
      "DSP pitching",
      "Distribution",
      "Metadata",
    ]);
  });

  it("trims, removes duplicates, and caps responsibility tags", () => {
    const tags = parseResponsibilityTags(
      Array.from({ length: 13 }, (_, index) => index === 1 ? " first " : `tag-${index}`).join(","),
    );

    expect(tags).toEqual(["tag-0", "first", "tag-2", "tag-3", "tag-4", "tag-5", "tag-6", "tag-7", "tag-8", "tag-9", "tag-10", "tag-11"]);
  });

  it("matches a preset only when both title and responsibilities describe that preset", () => {
    expect(findTeamRolePreset({
      operatingTitle: "DSP / distribution",
      responsibilityTags: ["DSP pitching", "Distribution", "Metadata"],
    })).toEqual(TEAM_ROLE_PRESETS[10]);
    expect(findTeamRolePreset({
      operatingTitle: "DSP / distribution",
      responsibilityTags: ["DSP pitching"],
    })).toBeUndefined();
  });
});
