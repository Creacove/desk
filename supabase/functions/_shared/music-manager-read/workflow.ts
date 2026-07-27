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
  activateOutput(outputId: string): Awaitable<void>;
  complete(
    result: MusicManagerReadWorkflowResult<TOutput, TUsage>,
  ): Awaitable<void>;
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
    await dependencies.markStep(step, "failed");
    throw error;
  }
}

async function inspectEvidence(
  dependencies: Pick<
    MusicManagerReadWorkflowDependencies<unknown, unknown, unknown>,
    "inspectEvidence" | "markStep"
  >,
): Promise<EvidenceInspection> {
  try {
    return await dependencies.inspectEvidence();
  } catch (error) {
    await dependencies.markStep("evidence_check", "failed");
    throw error;
  }
}

async function enrichEvidence(
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
    await dependencies.markStep("chartmetric_enrichment", "failed");
    throw error;
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
  await dependencies.markStep("evidence_check", "running");
  let evidence = await inspectEvidence(dependencies);
  let enrichmentWasLimited = false;

  if (evidence.state !== "fresh") {
    const enrichment = await enrichEvidence(dependencies);
    enrichmentWasLimited =
      enrichment.status === "completed_with_limits" ||
      enrichment.status === "unresolved";
    evidence = await inspectEvidence(dependencies);
  }

  const evidenceWasLimited = evidence.state !== "fresh";
  await dependencies.markStep(
    "evidence_check",
    evidenceWasLimited ? "completed_with_limits" : "completed",
  );

  const context = await runStep(dependencies, "context_build", () =>
    dependencies.buildContext()
  );
  const initial = await runStep(dependencies, "manager_synthesis", () =>
    dependencies.generateInitial(context)
  );
  const validated = await runStep(dependencies, "output_validation", () =>
    dependencies.validateAndRepair(context, initial)
  );
  const outputId = await runStep(dependencies, "output_activation", async () => {
    const stagedOutputId = await dependencies.stageOutput(validated.output);
    await dependencies.activateOutput(stagedOutputId);
    return stagedOutputId;
  });

  const result: MusicManagerReadWorkflowResult<TOutput, TUsage> = {
    ...validated,
    outputId,
    completedWithLimits: enrichmentWasLimited || evidenceWasLimited,
  };

  await dependencies.complete(result);
  return result;
}
