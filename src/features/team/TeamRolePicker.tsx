import { ChevronDown, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { cn } from "../../lib/utils";
import type { TeamResponsibilities } from "../../types/workspaceTeam";
import { findTeamRolePreset, parseResponsibilityTags, TEAM_ROLE_PRESETS } from "./teamRolePresets";

export function TeamRolePicker({
  value,
  onChange,
  disabled = false,
  titleLabel,
  responsibilitiesLabel,
  detailsInitiallyOpen,
}: {
  value: TeamResponsibilities;
  onChange: (value: TeamResponsibilities) => void;
  disabled?: boolean;
  titleLabel?: string;
  responsibilitiesLabel?: string;
  detailsInitiallyOpen?: boolean;
}) {
  const selectedPreset = useMemo(() => {
    const preset = findTeamRolePreset(value);
    if (preset?.label === "Other" && !value.operatingTitle && !value.responsibilityTags.length) return undefined;
    return preset;
  }, [value]);
  const resolvedTitleLabel = titleLabel ?? "Operating title";
  const resolvedResponsibilitiesLabel = responsibilitiesLabel ?? "Add responsibility";
  const [responsibilityInput, setResponsibilityInput] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(() => detailsInitiallyOpen ?? true);
  const [selectedRoleLabel, setSelectedRoleLabel] = useState<string | null>(() => selectedPreset?.label ?? null);
  const valueTagsKey = value.responsibilityTags.join("|");

  useEffect(() => {
    if (!responsibilityInput) return;
    if (value.responsibilityTags.join("|") === parseResponsibilityTags(responsibilityInput).join("|")) return;
    setResponsibilityInput("");
  }, [valueTagsKey]);

  useEffect(() => {
    if (value.operatingTitle || value.responsibilityTags.length) {
      if (selectedRoleLabel !== "Other") setSelectedRoleLabel(selectedPreset?.label ?? null);
      return;
    }
    if (selectedRoleLabel !== "Other") setSelectedRoleLabel(null);
  }, [selectedPreset, selectedRoleLabel, value.operatingTitle, valueTagsKey]);

  function selectPreset(label: string) {
    const preset = findTeamRolePreset(label);
    if (!preset) return;
    setResponsibilityInput("");
    setDetailsOpen(detailsInitiallyOpen ?? true);
    setSelectedRoleLabel(preset.label);
    onChange({ operatingTitle: preset.operatingTitle || null, responsibilityTags: [...preset.responsibilityTags] });
  }

  function changeTitle(event: ChangeEvent<HTMLInputElement>) {
    onChange({ ...value, operatingTitle: event.target.value || null });
  }

  function changeResponsibilities(event: ChangeEvent<HTMLInputElement>) {
    const nextInput = event.target.value;
    setResponsibilityInput(nextInput);
    const parsed = parseResponsibilityTags(nextInput);
    if (nextInput.includes(",") || nextInput.trim()) onChange({ ...value, responsibilityTags: parsed });
  }

  function commitResponsibilities(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const parsed = parseResponsibilityTags(responsibilityInput);
    onChange({ ...value, responsibilityTags: parsed });
    setResponsibilityInput("");
  }

  function removeResponsibility(tag: string) {
    onChange({ ...value, responsibilityTags: value.responsibilityTags.filter((item) => item !== tag) });
  }

  const detailId = `team-role-details-${resolvedTitleLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="grid gap-4" data-testid="team-role-picker">
      <fieldset className="grid gap-2.5">
        <legend className="text-[12px] font-semibold text-foreground">What will they own?</legend>
        <div className="flex flex-wrap gap-2">
          {TEAM_ROLE_PRESETS.map((preset) => {
            const selected = selectedRoleLabel === preset.label;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => selectPreset(preset.label)}
                className={cn(
                  "rounded-[9px] border px-3 py-2 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25 disabled:pointer-events-none disabled:opacity-45",
                  selected
                    ? "border-brand-accent/35 bg-brand-ghost text-brand-accent"
                    : "border-foreground/10 bg-background text-muted-foreground hover:border-foreground/18 hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-start justify-between gap-3 rounded-[10px] bg-foreground/[0.035] px-3 py-2.5">
        <p className="min-w-0 text-[12px] font-medium leading-relaxed text-muted-foreground">
          {selectedPreset?.responsibilityTags.length
            ? <>Starts with {selectedPreset.responsibilityTags.join(", ")}.</>
            : selectedRoleLabel === "Other"
              ? "Add a title and the responsibilities they will handle."
            : value.responsibilityTags.length
              ? `${value.responsibilityTags.length} responsibilities selected.`
              : "Choose a role to add a starting set of responsibilities."}
        </p>
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls={detailId}
          disabled={disabled}
          onClick={() => setDetailsOpen((open) => !open)}
          className="inline-flex shrink-0 items-center gap-1 rounded-[7px] px-1.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25 disabled:pointer-events-none disabled:opacity-45"
        >
          {detailsOpen ? "Hide details" : "Adjust details"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", detailsOpen ? "rotate-180" : "")} aria-hidden="true" />
        </button>
      </div>

      {detailsOpen ? (
        <div id={detailId} className="grid gap-3 border-t border-foreground/8 pt-3 sm:grid-cols-2">
          <label className="grid gap-2 text-[11px] font-semibold text-foreground" htmlFor={`team-role-title-${resolvedTitleLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            {resolvedTitleLabel}
            <input
              id={`team-role-title-${resolvedTitleLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              aria-label={resolvedTitleLabel}
              value={value.operatingTitle ?? ""}
              onChange={changeTitle}
              maxLength={80}
              disabled={disabled}
              placeholder="e.g. Artist Manager"
              className="h-11 rounded-[9px] border border-foreground/12 bg-background px-3 text-[13px] font-medium outline-none transition-colors placeholder:text-muted-foreground/48 focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10 disabled:opacity-55"
            />
          </label>
          <label className="grid gap-2 text-[11px] font-semibold text-foreground" htmlFor={`team-role-responsibilities-${resolvedResponsibilitiesLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            {resolvedResponsibilitiesLabel}
            <input
              id={`team-role-responsibilities-${resolvedResponsibilitiesLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              aria-label={resolvedResponsibilitiesLabel}
              value={responsibilityInput}
              onChange={changeResponsibilities}
              onKeyDown={commitResponsibilities}
              disabled={disabled}
              placeholder={resolvedResponsibilitiesLabel === "Add responsibility" ? "Type one or more, then press Enter" : "e.g. Strategy, approvals"}
              className="h-11 rounded-[9px] border border-foreground/12 bg-background px-3 text-[13px] font-medium outline-none transition-colors placeholder:text-muted-foreground/48 focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10 disabled:opacity-55"
            />
          </label>

          {value.responsibilityTags.length ? (
            <div className="flex flex-wrap gap-1.5 sm:col-span-2" aria-label="Selected responsibilities">
              {value.responsibilityTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-foreground/[0.045] px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {tag}
                  <button type="button" aria-label={`Remove ${tag}`} disabled={disabled} onClick={() => removeResponsibility(tag)} className="rounded-full p-0.5 text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none">
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] font-medium text-muted-foreground/70 sm:col-span-2"><Plus className="mr-1 inline h-3 w-3" aria-hidden="true" />Add what they will handle, separated by commas.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
