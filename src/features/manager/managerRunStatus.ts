import type { ManagerRunStepViewModel } from "../../types/cleanProduction";

const fallbackStatus = "Manager is working…";
const rawToolNamePattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

export function managerRunStatusLabel(steps: ManagerRunStepViewModel[] = []) {
  const latestRunning = [...steps].reverse().find((step) => step.status === "running" && friendlyLabel(step.label));
  const latestCompleted = [...steps].reverse().find((step) => step.status === "completed" && friendlyLabel(step.label));
  return formatStatus(latestRunning?.label ?? latestCompleted?.label);
}

function friendlyLabel(value: string | undefined) {
  const label = value?.trim() ?? "";
  return Boolean(label && !rawToolNamePattern.test(label));
}

function formatStatus(value: string | undefined) {
  const label = value?.trim();
  if (!label || !friendlyLabel(label)) return fallbackStatus;
  return `${label.replace(/[.…]+$/u, "").trimEnd()}…`;
}
