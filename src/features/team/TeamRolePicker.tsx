import { Plus } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { cn } from "../../lib/utils";
import type { TeamResponsibilities } from "../../types/workspaceTeam";
import { findTeamRolePreset, TEAM_RESPONSIBILITY_OPTIONS, TEAM_ROLE_PRESETS } from "./teamRolePresets";

type TeamRolePickerMode = "role" | "responsibilities" | "all";

export function TeamRolePicker({
  value,
  onChange,
  disabled = false,
  titleLabel,
  responsibilitiesLabel,
  detailsInitiallyOpen = true,
  mode = "all",
}: {
  value: TeamResponsibilities;
  onChange: (value: TeamResponsibilities) => void;
  disabled?: boolean;
  titleLabel?: string;
  responsibilitiesLabel?: string;
  detailsInitiallyOpen?: boolean;
  mode?: TeamRolePickerMode;
}) {
  const roleLabel = titleLabel ?? "Your role";
  const selectedPreset = useMemo(() => findTeamRolePreset(value.operatingTitle ?? ""), [value.operatingTitle]);
  const [roleChoice, setRoleChoice] = useState(selectedPreset?.label ?? (value.operatingTitle ? "Other" : ""));
  const selectedRole = roleChoice;
  const [detailsOpen, setDetailsOpen] = useState(detailsInitiallyOpen);
  const [visibleSlots, setVisibleSlots] = useState(() => Math.max(3, value.responsibilityTags.length));
  const showRole = mode !== "responsibilities";
  const showResponsibilities = mode !== "role";
  const roleOptions = TEAM_ROLE_PRESETS;
  const responsibilityOptions = useMemo(
    () => [...new Set([...TEAM_RESPONSIBILITY_OPTIONS, ...value.responsibilityTags])],
    [value.responsibilityTags],
  );

  useEffect(() => {
    setVisibleSlots((current) => Math.max(current, value.responsibilityTags.length, 3));
  }, [value.responsibilityTags.length]);

  useEffect(() => {
    if (selectedPreset) setRoleChoice(selectedPreset.label);
    else if (!value.operatingTitle && roleChoice !== "Other") setRoleChoice("");
  }, [roleChoice, selectedPreset, value.operatingTitle]);

  function selectRole(event: ChangeEvent<HTMLSelectElement>) {
    const nextRole = event.target.value;
    setRoleChoice(nextRole);
    const preset = findTeamRolePreset(nextRole);
    if (!preset || preset.label === "Other") {
      onChange({ ...value, operatingTitle: nextRole === "Other" ? (selectedRole === "Other" ? value.operatingTitle : null) : null });
      return;
    }
    onChange({ operatingTitle: preset.operatingTitle, responsibilityTags: [...preset.responsibilityTags] });
  }

  function changeCustomRole(event: ChangeEvent<HTMLInputElement>) {
    onChange({ ...value, operatingTitle: event.target.value || null });
  }

  function changeResponsibility(index: number, nextTag: string) {
    const nextTags = [...value.responsibilityTags];
    nextTags[index] = nextTag;
    onChange({ ...value, responsibilityTags: nextTags.filter(Boolean) });
  }

  return (
    <div className="grid gap-4" data-testid="team-role-picker">
      {mode === "all" && !detailsOpen ? (
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          disabled={disabled}
          className="inline-flex w-fit items-center gap-1.5 rounded-[8px] px-1 py-1 text-[12px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.045] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25 disabled:pointer-events-none disabled:opacity-45"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add role details
        </button>
      ) : null}

      {(mode !== "all" || detailsOpen) && showRole ? (
        <div className="grid gap-2">
          <label className="grid gap-2 text-[11px] font-semibold text-foreground" htmlFor={`team-role-${slug(roleLabel)}`}>
            {roleLabel}
            <select
              id={`team-role-${slug(roleLabel)}`}
              aria-label={roleLabel}
              value={selectedRole}
              onChange={selectRole}
              disabled={disabled}
              className="h-11 appearance-none rounded-[9px] border border-foreground/12 bg-background px-3 text-[13px] font-medium outline-none transition-colors focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10 disabled:opacity-55"
            >
              <option value="">Choose a role</option>
              {roleOptions.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}
            </select>
          </label>
          {selectedRole === "Other" ? (
            <label className="grid gap-2 text-[11px] font-semibold text-foreground" htmlFor={`team-custom-role-${slug(roleLabel)}`}>
              Custom role
              <input
                id={`team-custom-role-${slug(roleLabel)}`}
                aria-label="Custom role"
                value={selectedRole === "Other" ? value.operatingTitle ?? "" : ""}
                onChange={changeCustomRole}
                maxLength={80}
                disabled={disabled}
                placeholder="e.g. House coordinator"
                className="h-11 rounded-[9px] border border-foreground/12 bg-background px-3 text-[13px] font-medium outline-none transition-colors placeholder:text-muted-foreground/48 focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10 disabled:opacity-55"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {(mode !== "all" || detailsOpen) && showResponsibilities ? (
        <fieldset className="grid gap-2.5">
          <legend className="text-[11px] font-semibold text-foreground">{responsibilitiesLabel ?? "What will you handle?"}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: visibleSlots }, (_, index) => (
              <select
                key={`responsibility-${index}`}
                aria-label={`Responsibility ${index + 1}`}
                value={value.responsibilityTags[index] ?? ""}
                onChange={(event) => changeResponsibility(index, event.target.value)}
                disabled={disabled}
                className="h-10 min-w-0 appearance-none rounded-[8px] border border-foreground/12 bg-background px-2.5 text-[12px] font-medium outline-none transition-colors focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10 disabled:opacity-55"
              >
                <option value="">Choose responsibility</option>
                {responsibilityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setVisibleSlots((current) => current + 1)}
            disabled={disabled}
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-[8px] px-1 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25 disabled:pointer-events-none disabled:opacity-45",
              visibleSlots > 3 ? "mt-0" : "",
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add responsibility
          </button>
        </fieldset>
      ) : null}
    </div>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
