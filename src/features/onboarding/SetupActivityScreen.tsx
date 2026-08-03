import { Check, Circle, LoaderCircle, TriangleAlert } from "lucide-react";

import type { ProductionSetupStage, ProductionSetupStageStatus, ProductionWorkspace } from "../../types/productionApp";

export const setupStageCopy = {
  spotify_connected: "Connecting your music",
  catalog_bootstrap: "Understanding your catalogue",
  manager_discovery: "Learning about your artist profile",
  setup_brief: "Writing your first Manager brief",
  music_reads: "Preparing Manager Reads for your selected music",
} as const;

const visibleStages = Object.keys(setupStageCopy) as Array<keyof typeof setupStageCopy>;

export function SetupActivityScreen({
  status,
  stage,
  stageStatus = {},
  error,
  retrying = false,
  onRetry,
}: {
  status: NonNullable<ProductionWorkspace["setupStatus"]>;
  stage?: ProductionSetupStage;
  stageStatus?: ProductionSetupStageStatus;
  error?: string | null;
  retrying?: boolean;
  onRetry: () => void;
}) {
  const failed = status === "failed";
  const briefReady = status === "completed" && stage === "music_reads";
  const musicReadsRunning = briefReady && !["completed", "completed_with_limits"].includes(stageStatus.music_reads?.status ?? "running");
  const heading = failed ? "Setup paused" : briefReady ? "Your workspace is ready" : "Preparing your workspace";
  const description = failed
    ? "Setup paused while preparing your workspace. Your completed work is safe."
    : briefReady
      ? musicReadsRunning
        ? "Your workspace is ready. Some music insights are still being prepared."
        : "Your workspace is ready."
      : null;

  return (
    <main className="app-theme grid min-h-screen place-items-center bg-background px-4 py-8 text-foreground">
      <section
        data-testid="setup-activity-panel"
        className="w-full max-w-[34rem] rounded-[22px] border border-foreground/10 bg-background p-5 shadow-[0_28px_90px_rgba(17,19,24,0.12)] transition-colors motion-reduce:transition-none sm:p-7"
        aria-labelledby="setup-activity-title"
      >
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Workspace setup</p>
        <h1 id="setup-activity-title" className="mt-2 font-display text-[28px] font-semibold tracking-[-0.03em]">{heading}</h1>
        {description ? <p className="mt-3 max-w-[30rem] text-[13px] font-medium leading-relaxed text-muted-foreground">{description}</p> : null}

        <div className="mt-7 grid gap-2.5">
          {visibleStages.map((stageKey) => {
            const stageState = resolveStageState(stageKey, status, stage, stageStatus);
            return (
              <div key={stageKey} data-testid="setup-stage-row" className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3 rounded-[13px] border border-foreground/8 bg-foreground/[0.025] px-3.5 py-3">
                <SetupStageIcon state={stageState} />
                <span className={stageState === "pending" ? "text-[13px] font-semibold text-muted-foreground/65" : "text-[13px] font-semibold text-foreground"}>
                  {setupStageCopy[stageKey]}
                </span>
              </div>
            );
          })}
        </div>

        <p role="status" aria-live="polite" className="mt-5 text-[12px] font-semibold text-muted-foreground">
          {failed ? error || description : briefReady ? description : setupStageCopy[normalizeVisibleStage(stage)]}
        </p>

        {failed ? (
          <button type="button" disabled={retrying} onClick={onRetry} className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-foreground px-4 text-[12px] font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-50 motion-reduce:transition-none sm:w-auto">
            {retrying ? "Retrying setup…" : "Retry setup"}
          </button>
        ) : null}
      </section>
    </main>
  );
}

function SetupStageIcon({ state }: { state: "completed" | "running" | "failed" | "pending" }) {
  const className = "h-4 w-4";
  return (
    <span data-testid="setup-stage-icon" className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground/[0.055] text-muted-foreground" aria-hidden="true">
      {state === "completed" ? <Check className={className} /> : null}
      {state === "running" ? <LoaderCircle className={`${className} animate-spin motion-reduce:animate-none`} /> : null}
      {state === "failed" ? <TriangleAlert className={className} /> : null}
      {state === "pending" ? <Circle className={`${className} opacity-45`} /> : null}
    </span>
  );
}

function resolveStageState(
  stageKey: keyof typeof setupStageCopy,
  setupStatus: NonNullable<ProductionWorkspace["setupStatus"]>,
  currentStage: ProductionSetupStage | undefined,
  stageStatus: ProductionSetupStageStatus,
): "completed" | "running" | "failed" | "pending" {
  const persisted = stageStatus[stageKey]?.status;
  if (persisted === "failed") return "failed";
  if (persisted === "completed" || persisted === "completed_with_limits") return "completed";
  if (persisted === "running" || persisted === "queued") return "running";
  const currentIndex = visibleStages.indexOf(normalizeVisibleStage(currentStage));
  const stageIndex = visibleStages.indexOf(stageKey);
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex > currentIndex) return "pending";
  if (setupStatus === "failed") return "failed";
  if (setupStatus === "completed" && stageKey !== "music_reads") return "completed";
  return "running";
}

function normalizeVisibleStage(stage?: ProductionSetupStage): keyof typeof setupStageCopy {
  return stage && stage in setupStageCopy ? stage as keyof typeof setupStageCopy : "spotify_connected";
}
