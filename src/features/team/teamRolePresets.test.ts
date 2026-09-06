import { describe, expect, it } from "vitest";

import { TEAM_ROLE_PRESETS, findTeamRolePreset, parseResponsibilityTags } from "./teamRolePresets";

describe("team role presets", () => {
  it("keeps the first-run role labels and default responsibilities in one shared list", () => {
    expect(TEAM_ROLE_PRESETS.map((preset) => preset.label)).toEqual([
      "Artist Manager",
      "A&R",
      "DSP & Distribution",
      "PR",
      "Content & Social",
      "Rights & Royalties",
      "Marketing",
      "Other",
    ]);
    expect(findTeamRolePreset("DSP & Distribution")).toEqual(TEAM_ROLE_PRESETS[2]);
    expect(TEAM_ROLE_PRESETS[2].responsibilityTags).toEqual([
      "DSP pitching",
      "Distribution",
      "Metadata",
      "Platform relationships",
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
      operatingTitle: "DSP & Distribution",
      responsibilityTags: ["DSP pitching", "Distribution", "Metadata", "Platform relationships"],
    })).toEqual(TEAM_ROLE_PRESETS[2]);
    expect(findTeamRolePreset({
      operatingTitle: "DSP & Distribution",
      responsibilityTags: ["DSP pitching"],
    })).toBeUndefined();
  });
});
