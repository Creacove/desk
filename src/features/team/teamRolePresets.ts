import type { TeamResponsibilities } from "../../types/workspaceTeam";

export type TeamRolePreset = {
  label: string;
  operatingTitle: string;
  responsibilityTags: string[];
};

export const TEAM_ROLE_PRESETS: readonly TeamRolePreset[] = [
  { label: "Artist Manager", operatingTitle: "Artist Manager", responsibilityTags: ["Strategy", "Artist coordination", "Approvals"] },
  { label: "A&R", operatingTitle: "A&R", responsibilityTags: ["Repertoire", "Creative development", "Collaborators"] },
  { label: "DSP & Distribution", operatingTitle: "DSP & Distribution", responsibilityTags: ["DSP pitching", "Distribution", "Metadata", "Platform relationships"] },
  { label: "PR", operatingTitle: "PR", responsibilityTags: ["Press strategy", "Media relationships", "Announcements"] },
  { label: "Content & Social", operatingTitle: "Content & Social", responsibilityTags: ["Content planning", "Social publishing", "Community"] },
  { label: "Rights & Royalties", operatingTitle: "Rights & Royalties", responsibilityTags: ["Rights administration", "Royalty tracking", "Registrations"] },
  { label: "Marketing", operatingTitle: "Marketing", responsibilityTags: ["Campaign strategy", "Audience growth", "Paid media"] },
  { label: "Other", operatingTitle: "", responsibilityTags: [] },
];

export function findTeamRolePreset(value: string | TeamResponsibilities): TeamRolePreset | undefined {
  if (typeof value === "string") return TEAM_ROLE_PRESETS.find((preset) => preset.label === value);
  return TEAM_ROLE_PRESETS.find((preset) => (
    preset.operatingTitle === (value.operatingTitle ?? "")
    && preset.responsibilityTags.length === value.responsibilityTags.length
    && preset.responsibilityTags.every((tag, index) => tag === value.responsibilityTags[index])
  ));
}

export function parseResponsibilityTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}
