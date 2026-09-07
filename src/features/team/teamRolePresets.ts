import type { TeamResponsibilities } from "../../types/workspaceTeam";

export type TeamRolePreset = {
  label: string;
  operatingTitle: string;
  responsibilityTags: string[];
};

export const TEAM_ROLE_PRESETS: readonly TeamRolePreset[] = [
  { label: "House / team lead", operatingTitle: "House / team lead", responsibilityTags: ["Team coordination", "Approvals", "Planning"] },
  { label: "Artist / performer", operatingTitle: "Artist / performer", responsibilityTags: ["Creative direction", "Recording & performance", "Artist development"] },
  { label: "Manager / project lead", operatingTitle: "Manager / project lead", responsibilityTags: ["Strategy", "Artist coordination", "Approvals"] },
  { label: "Label / company", operatingTitle: "Label / company", responsibilityTags: ["Release planning", "Budget & approvals", "Partnerships"] },
  { label: "A&R / talent", operatingTitle: "A&R / talent", responsibilityTags: ["Talent development", "Repertoire", "Collaborators"] },
  { label: "Producer / creative", operatingTitle: "Producer / creative", responsibilityTags: ["Recording & production", "Creative direction", "Session coordination"] },
  { label: "Songwriter / composer", operatingTitle: "Songwriter / composer", responsibilityTags: ["Songwriting", "Composition", "Credits"] },
  { label: "Marketing / growth", operatingTitle: "Marketing / growth", responsibilityTags: ["Campaign strategy", "Audience growth", "Paid media"] },
  { label: "PR / communications", operatingTitle: "PR / communications", responsibilityTags: ["Press strategy", "Media relationships", "Announcements"] },
  { label: "Content / social", operatingTitle: "Content / social", responsibilityTags: ["Content planning", "Social publishing", "Community"] },
  { label: "DSP / distribution", operatingTitle: "DSP / distribution", responsibilityTags: ["DSP pitching", "Distribution", "Metadata"] },
  { label: "Rights / business affairs", operatingTitle: "Rights / business affairs", responsibilityTags: ["Rights administration", "Royalty tracking", "Registrations"] },
  { label: "Finance / operations", operatingTitle: "Finance / operations", responsibilityTags: ["Budgeting", "Reporting", "Team operations"] },
  { label: "Recording / engineering", operatingTitle: "Recording / engineering", responsibilityTags: ["Recording", "Mixing", "Mastering"] },
  { label: "Other", operatingTitle: "", responsibilityTags: [] },
];

export const TEAM_RESPONSIBILITY_OPTIONS = [...new Set([
  ...TEAM_ROLE_PRESETS.flatMap((preset) => preset.responsibilityTags),
  "Release strategy",
  "Live & booking",
  "Brand partnerships",
  "Licensing",
  "Visuals & design",
])] as string[];

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
