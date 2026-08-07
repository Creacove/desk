export type ManualSongWorkspaceCopy = {
  missionTitle: string;
  missionObjective: string;
  missionSummary: string;
  checkpointTitle: string;
  checkpointQuestion: string;
  checkpointDecisionRule: string;
  firstTaskTitle: string;
  firstTaskPurpose: string;
  openingMessage: string;
};

const UNRELEASED_STAGES = new Set([
  "idea",
  "recording",
  "production",
  "mixing",
  "mastering",
  "ready",
  "scheduled",
]);

export function manualSongWorkspaceCopy(input: { title: string; lifecycleStage: string }): ManualSongWorkspaceCopy {
  const title = input.title.trim();
  const lifecycleStage = input.lifecycleStage.trim().toLowerCase();
  if (!title) throw new Error("Song title is required.");
  if (!UNRELEASED_STAGES.has(lifecycleStage)) throw new Error("Manual song workspace setup requires an unreleased lifecycle stage.");

  const stageLabel = titleCase(lifecycleStage);
  const packageTask = lifecycleStage === "scheduled"
    ? "Review the release package"
    : lifecycleStage === "ready"
      ? "Confirm the release-ready package"
      : "Add the current working audio";
  const packagePurpose = lifecycleStage === "scheduled"
    ? "Keep the delivery package accurate before any approved release work continues."
    : lifecycleStage === "ready"
      ? "Confirm the files and information that will support the next approved release decision."
      : "Give the song workspace a real audio reference before asking for more release information.";
  const openingMessage = lifecycleStage === "scheduled"
    ? `${title} is scheduled. Open Files to verify the master and supporting assets before I help with the next approved release step.`
    : lifecycleStage === "ready"
      ? `${title} is marked Ready. Start in Files and confirm the working audio is attached; then we can fill only the release details that are still missing.`
      : `${title} is at ${stageLabel}. Start in Files by adding the current working audio. Once it is there, I’ll help you capture the next details without turning this into a long questionnaire.`;

  return {
    missionTitle: `Prepare ${title} for release`,
    missionObjective: `Move ${title} from ${stageLabel} to a verified release-ready package at the artist’s pace.`,
    missionSummary: `Keep ${title}'s files, details, rights, and next production or release decision together in one song workspace.`,
    checkpointTitle: "Confirm the current song package",
    checkpointQuestion: `What is the next missing piece that prevents ${title} from moving forward safely?`,
    checkpointDecisionRule: "Use the current Song Room state before adding release work or external commitments.",
    firstTaskTitle: packageTask,
    firstTaskPurpose: packagePurpose,
    openingMessage,
  };
}

function titleCase(value: string) {
  return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : "Preparation";
}
