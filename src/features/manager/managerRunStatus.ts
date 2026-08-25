import type { OrbState } from "thinking-orbs";
import type { ManagerRunStepViewModel } from "../../types/cleanProduction";

const fallbackActivity = { label: "Reviewing your request…", orbState: "listening" as OrbState };
const rawToolNamePattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

export function managerRunStatusLabel(steps: ManagerRunStepViewModel[] = []) {
  return managerRunActivity(steps).label;
}

export function managerRunActivity(steps: ManagerRunStepViewModel[] = []): { label: string; orbState: OrbState } {
  const latestRunning = [...steps].reverse().find((step) => step.status === "running");
  const latestCompleted = [...steps].reverse().find((step) => step.status === "completed");
  return activityForLabel(latestRunning?.label ?? latestCompleted?.label);
}

function activityForLabel(value: string | undefined): { label: string; orbState: OrbState } {
  const label = value?.trim() ?? "";
  if (!label || rawToolNamePattern.test(label) || /starting manager run/i.test(label)) return fallbackActivity;

  const clean = label.replace(/[.…]+$/u, "").trimEnd();
  const normalized = clean.toLowerCase();

  if (normalized.includes("reading workspace packet")) return activity("Reviewing workspace context", "listening");
  if (normalized.includes("economics and trade-offs")) return activity(clean, "solving");
  if (normalized === "preparing the answer") return activity("Working through the recommendation", "solving");
  if (normalized.includes("checking evidence")) return activity("Checking the relevant evidence", "searching");
  if (normalized.includes("checking catalog")) return activity("Reviewing catalog position", "searching");
  if (normalized.includes("searching the web")) return activity("Searching public sources", "searching");
  if (normalized.includes("researching public release targets")) return activity("Researching release opportunities", "searching");
  if (normalized.includes("release materials checked")) return activity("Reviewing release materials", "searching");
  if (normalized.includes("release date impact")) return activity("Reviewing release-date impact", "solving");
  if (normalized.includes("reviewing mission state")) return activity("Reviewing active work", "listening");
  if (normalized.includes("reading manager memory")) return activity("Reviewing previous context", "listening");
  if (normalized.includes("reviewing prior decisions")) return activity("Reviewing previous decisions", "listening");
  if (normalized.includes("preparing song document")) return activity("Creating the document", "shaping");
  if (normalized.includes("creating song workspace")) return activity("Setting up the song workspace", "shaping");
  if (normalized.includes("saving release targets")) return activity("Saving release opportunities", "shaping");
  if (normalized.includes("recording outreach outcome")) return activity("Recording the outreach outcome", "shaping");
  if (normalized.includes("using manager tool")) return activity("Working through the details", "working");
  if (normalized.includes("preparing manager answer")) return activity("Structuring the answer", "composing");

  return activity(clean, inferOrbState(normalized));
}

function activity(label: string, orbState: OrbState) {
  return { label: `${label}…`, orbState };
}

function inferOrbState(label: string): OrbState {
  if (/search|research|evidence|catalog|signal|source/.test(label)) return "searching";
  if (/create|creating|saving|recording|setting up|updating/.test(label)) return "shaping";
  if (/preparing|structuring|composing|writing/.test(label)) return "composing";
  if (/review|reading|context|memory|mission/.test(label)) return "listening";
  if (/working through|calculating|recommendation|strategy|trade-off|impact/.test(label)) return "solving";
  return "working";
}
