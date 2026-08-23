import { lazy, Suspense, useMemo, type ReactNode } from "react";
import { Check, Circle, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "../../design-system/desktopPrimitives";
import { createBrowserSupabaseClient } from "../../lib/supabaseClient";
import { createSupabaseSetupPresentationLoader, type SetupPresentationLoader } from "../../services/setupPresentation";
import type { ProductionSetupStage, ProductionSetupStageStatus, ProductionWorkspace } from "../../types/productionApp";
import { SetupPresentationErrorBoundary } from "./setup-presentation/SetupPresentationErrorBoundary";
import { readDevelopmentSetupFixture } from "./setup-presentation/setupPresentationFixtures";
import { useSetupPresentation } from "./setup-presentation/useSetupPresentation";
import { useSetupPresentationFlag } from "./setup-presentation/useSetupPresentationFlag";

const SetupPresentationV2 = lazy(() => import("./setup-presentation/SetupPresentationV2"));

export const setupStageCopy = {
  spotify_connected: "Connecting your music",
  catalog_bootstrap: "Understanding your catalogue",
  manager_discovery: "Learning about your artist profile",
  setup_brief: "Writing your first Manager brief",
  music_reads: "Preparing Manager Reads for your selected music",
} as const;

const visibleStages = Object.keys(setupStageCopy) as Array<keyof typeof setupStageCopy>;

type SetupActivityProps = {
  artistWorkspaceId?: string;
  setupRunId?: string;
  status: NonNullable<ProductionWorkspace["setupStatus"]>;
  stage?: ProductionSetupStage;
  stageStatus?: ProductionSetupStageStatus;
  error?: string | null;
  retrying?: boolean;
  onRetry: () => void;
};

export function SetupActivityScreen(props: SetupActivityProps) {
  const presentationEnabled = useSetupPresentationFlag();
  const fixture = readDevelopmentSetupFixture();
  const canUsePresentation = (presentationEnabled || Boolean(fixture)) && Boolean(props.artistWorkspaceId) && props.status !== "failed";

  const legacy = <LegacySetupActivityScreen {...props} />;
  if (!canUsePresentation || !props.artistWorkspaceId) return legacy;

  return (
    <SetupPresentationErrorBoundary artistWorkspaceId={props.artistWorkspaceId} fallback={legacy}>
      <Suspense fallback={legacy}>
        <SetupPresentationController
          artistWorkspaceId={props.artistWorkspaceId}
          setupRunId={props.setupRunId}
          fixture={fixture}
          fallback={legacy}
        />
      </Suspense>
    </SetupPresentationErrorBoundary>
  );
}

function SetupPresentationController({
  artistWorkspaceId,
  setupRunId,
  fixture,
  fallback,
}: {
  artistWorkspaceId: string;
  setupRunId?: string;
  fixture: ReturnType<typeof readDevelopmentSetupFixture>;
  fallback: ReactNode;
}) {
  const loader = useMemo<SetupPresentationLoader>(() => {
    if (fixture) return async () => fixture;
    return createSupabaseSetupPresentationLoader(createBrowserSupabaseClient());
  }, [fixture]);
  const presentation = useSetupPresentation({
    artistWorkspaceId,
    setupRunId,
    enabled: true,
    loadSnapshot: loader,
    fixture,
  });

  if (presentation.state === "degraded" || presentation.snapshot?.setup.status === "failed") return <>{fallback}</>;
  if (!presentation.snapshot) return <SetupPresentationPrelude />;
  return <SetupPresentationV2 snapshot={presentation.snapshot} />;
}

function SetupPresentationPrelude() {
  return (
    <main
      data-testid="setup-presentation-prelude"
      className="app-theme relative grid min-h-screen place-items-center overflow-x-hidden bg-background px-4 py-8 text-foreground"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(hsl(var(--foreground)/0.035)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.028)_1px,transparent_1px)] [background-size:56px_56px]" />
      <section className="relative z-10 w-full max-w-[42rem]">
        <div className="flex items-center gap-2 font-ui text-[9px] font-bold uppercase tracking-[0.16em] text-brand-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" aria-hidden="true" />
          Desk setup
        </div>
        <h1 className="mt-5 font-display text-[clamp(2.35rem,6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.045em]">Building your Desk</h1>
        <p role="status" aria-live="polite" className="mt-5 max-w-[34rem] text-[14px] font-medium leading-[1.75] text-muted-foreground sm:text-[15px]">
          Loading the work already in progress.
        </p>
      </section>
    </main>
  );
}

export function LegacySetupActivityScreen({
  status,
  stage,
  stageStatus = {},
  error,
  retrying = false,
  onRetry,
}: SetupActivityProps) {
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
          <Button type="button" pending={retrying} onClick={onRetry} className="mt-5 w-full sm:w-auto">
            Retry setup
          </Button>
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
