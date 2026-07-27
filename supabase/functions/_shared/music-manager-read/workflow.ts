export type EvidenceInspection = {
  state: "fresh" | "missing" | "stale";
};

export type EnrichmentResult = {
  status: "completed" | "completed_with_limits" | "unresolved" | "failed";
};

export type WorkflowStep =
  | "evidence_check"
  | "chartmetric_enrichment"
  | "context_build"
  | "manager_synthesis"
  | "output_validation"
  | "output_activation";

export type WorkflowStepStatus =
  | "running"
  | "completed"
  | "completed_with_limits"
  | "failed";

type Awaitable<T> = T | Promise<T>;

export type InitialGeneration<TUsage> = {
  outputText: string;
  usage: TUsage;
  responseId: string;
};

export type ValidatedGeneration<TOutput, TUsage> = {
  output: TOutput;
  usage: TUsage;
  responseId: string;
  requestCount: number;
};

export type MusicManagerReadWorkflowResult<TOutput, TUsage> =
  ValidatedGeneration<TOutput, TUsage> & {
    outputId: string;
    completedWithLimits: boolean;
  };

export interface MusicManagerReadWorkflowDependencies<
  TContext,
  TOutput,
  TUsage,
> {
  markStep(step: WorkflowStep, status: WorkflowStepStatus): Awaitable<void>;
  inspectEvidence(): Awaitable<EvidenceInspection>;
  enrichEvidence(): Awaitable<EnrichmentResult>;
  buildContext(): Awaitable<TContext>;
  generateInitial(context: TContext): Awaitable<InitialGeneration<TUsage>>;
  validateAndRepair(
    context: TContext,
    initial: InitialGeneration<TUsage>,
  ): Awaitable<ValidatedGeneration<TOutput, TUsage>>;
  stageOutput(output: TOutput): Awaitable<string>;
  /**
   * Atomically and idempotently activates the staged output and persists the
   * output_activation completion, terminal run state, and usage. Implementors
   * must reconcile ambiguous network results before returning or rejecting.
   */
  finalizeOutput(
    result: MusicManagerReadWorkflowResult<TOutput, TUsage>,
  ): Awaitable<void>;
}

const FAILURE_BOOKKEEPING_MESSAGE =
  "Music Manager Read workflow failure bookkeeping failed.";

function reportFailureBookkeepingError(bookkeepingError: unknown): void {
  try {
    console.error(FAILURE_BOOKKEEPING_MESSAGE, bookkeepingError);
  } catch {
    // Reporting must never replace the workflow's primary error.
  }
}

async function rethrowAfterFailedTransition(
  dependencies: Pick<
    MusicManagerReadWorkflowDependencies<unknown, unknown, unknown>,
    "markStep"
  >,
  step: WorkflowStep,
  primaryError: unknown,
): Promise<never> {
  try {
    await dependencies.markStep(step, "failed");
  } catch (bookkeepingError) {
    reportFailureBookkeepingError(bookkeepingError);
  }

  throw primaryError;
}

async function runStep<T>(
  dependencies: Pick<
    MusicManagerReadWorkflowDependencies<unknown, unknown, unknown>,
    "markStep"
  >,
  step: WorkflowStep,
  operation: () => Awaitable<T>,
): Promise<T> {
  await dependencies.markStep(step, "running");

  try {
    const result = await operation();
    await dependencies.markStep(step, "completed");
    return result;
  } catch (error) {
    return rethrowAfterFailedTransition(dependencies, step, error);
  }
}

async function runEnrichment(
  dependencies: Pick<
    MusicManagerReadWorkflowDependencies<unknown, unknown, unknown>,
    "enrichEvidence" | "markStep"
  >,
): Promise<EnrichmentResult> {
  await dependencies.markStep("chartmetric_enrichment", "running");

  try {
    const result = await dependencies.enrichEvidence();

    if (result.status === "failed") {
      throw new Error("Chartmetric evidence refresh failed.");
    }

    const terminalStatus =
      result.status === "completed" ? "completed" : "completed_with_limits";
    await dependencies.markStep("chartmetric_enrichment", terminalStatus);
    return result;
  } catch (error) {
    return rethrowAfterFailedTransition(
      dependencies,
      "chartmetric_enrichment",
      error,
    );
  }
}

async function runEvidencePhase(
  dependencies: Pick<
    MusicManagerReadWorkflowDependencies<unknown, unknown, unknown>,
    "enrichEvidence" | "inspectEvidence" | "markStep"
  >,
): Promise<{
  evidence: EvidenceInspection;
  enrichmentWasLimited: boolean;
}> {
  await dependencies.markStep("evidence_check", "running");

  try {
    let evidence = await dependencies.inspectEvidence();
    let enrichmentWasLimited = false;

    if (evidence.state !== "fresh") {
      const enrichment = await runEnrichment(dependencies);
      enrichmentWasLimited =
        enrichment.status === "completed_with_limits" ||
        enrichment.status === "unresolved";
      evidence = await dependencies.inspectEvidence();
    }

    await dependencies.markStep(
      "evidence_check",
      evidence.state === "fresh" ? "completed" : "completed_with_limits",
    );
    return { evidence, enrichmentWasLimited };
  } catch (error) {
    return rethrowAfterFailedTransition(dependencies, "evidence_check", error);
  }
}

export async function runMusicManagerReadWorkflow<
  TContext,
  TOutput,
  TUsage,
>(
  dependencies: MusicManagerReadWorkflowDependencies<
    TContext,
    TOutput,
    TUsage
  >,
): Promise<MusicManagerReadWorkflowResult<TOutput, TUsage>> {
  const { evidence, enrichmentWasLimited } = await runEvidencePhase(
    dependencies,
  );
  const evidenceWasLimited = evidence.state !== "fresh";

  const context = await runStep(dependencies, "context_build", () =>
    dependencies.buildContext()
  );
  const initial = await runStep(dependencies, "manager_synthesis", () =>
    dependencies.generateInitial(context)
  );
  const validated = await runStep(dependencies, "output_validation", () =>
    dependencies.validateAndRepair(context, initial)
  );
  await dependencies.markStep("output_activation", "running");

  try {
    const outputId = await dependencies.stageOutput(validated.output);
    const result: MusicManagerReadWorkflowResult<TOutput, TUsage> = {
      ...validated,
      outputId,
      completedWithLimits: enrichmentWasLimited || evidenceWasLimited,
    };

    await dependencies.finalizeOutput(result);
    return result;
  } catch (error) {
    return rethrowAfterFailedTransition(
      dependencies,
      "output_activation",
      error,
    );
  }
}
