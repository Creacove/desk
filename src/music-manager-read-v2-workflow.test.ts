import { describe, expect, it, vi } from "vitest";

import {
  runMusicManagerReadWorkflow,
  type EnrichmentResult,
  type EvidenceInspection,
  type MusicManagerReadWorkflowDependencies,
  type WorkflowStep,
  type WorkflowStepStatus,
} from "../supabase/functions/_shared/music-manager-read/workflow";

type Context = { subject: string; limited: boolean };
type Output = { summary: string };
type Usage = { inputTokens: number; outputTokens: number };

const context: Context = { subject: "track-1", limited: false };
const initial = {
  outputText: "initial draft",
  usage: { inputTokens: 3, outputTokens: 2 },
  responseId: "response-initial",
};
const validated = {
  output: { summary: "validated manager read" },
  usage: { inputTokens: 8, outputTokens: 5 },
  responseId: "response-final",
  requestCount: 2,
};

type Operation =
  | "inspectEvidence"
  | "enrichEvidence"
  | "buildContext"
  | "generateInitial"
  | "validateAndRepair"
  | "stageOutput"
  | "finalizeOutput";

type MarkStepFailure = {
  step: WorkflowStep;
  status: WorkflowStepStatus;
  error: Error;
};

type FactoryOptions = {
  inspections?: Array<EvidenceInspection | Error>;
  enrichment?: EnrichmentResult;
  failures?: Partial<Record<Operation, Error>>;
  markStepFailures?: MarkStepFailure[];
};

function createDependencies(options: FactoryOptions = {}) {
  const events: string[] = [];
  const inspections = [...(options.inspections ?? [{ state: "fresh" }])];
  const failures = options.failures ?? {};

  const failIfConfigured = (operation: Operation) => {
    const error = failures[operation];
    if (error) {
      throw error;
    }
  };

  const dependencies = {
    markStep: vi.fn(async (step, status) => {
      events.push(`${step}:${status}`);
      const configuredFailure = options.markStepFailures?.find(
        (failure) => failure.step === step && failure.status === status,
      );
      if (configuredFailure) {
        throw configuredFailure.error;
      }
    }),
    inspectEvidence: vi.fn(async () => {
      events.push("inspectEvidence");
      failIfConfigured("inspectEvidence");
      const inspection = inspections.shift() ?? { state: "fresh" as const };
      if (inspection instanceof Error) {
        throw inspection;
      }
      return inspection;
    }),
    enrichEvidence: vi.fn(async () => {
      events.push("enrichEvidence");
      failIfConfigured("enrichEvidence");
      return options.enrichment ?? { status: "completed" as const };
    }),
    buildContext: vi.fn(async () => {
      events.push("buildContext");
      failIfConfigured("buildContext");
      return context;
    }),
    generateInitial: vi.fn(async () => {
      events.push("generateInitial");
      failIfConfigured("generateInitial");
      return initial;
    }),
    validateAndRepair: vi.fn(async () => {
      events.push("validateAndRepair");
      failIfConfigured("validateAndRepair");
      return validated;
    }),
    stageOutput: vi.fn(async () => {
      events.push("stageOutput");
      failIfConfigured("stageOutput");
      return "output-1";
    }),
    finalizeOutput: vi.fn(async () => {
      events.push("finalizeOutput");
      failIfConfigured("finalizeOutput");
    }),
  } satisfies MusicManagerReadWorkflowDependencies<Context, Output, Usage>;

  return { dependencies, events };
}

describe("Music Manager Read v2 workflow", () => {
  it("skips enrichment for fresh evidence and completes one output", async () => {
    const { dependencies } = createDependencies();

    const result = await runMusicManagerReadWorkflow(dependencies);

    expect(dependencies.enrichEvidence).not.toHaveBeenCalled();
    expect(dependencies.generateInitial).toHaveBeenCalledOnce();
    expect(dependencies.validateAndRepair).toHaveBeenCalledOnce();
    expect(dependencies.validateAndRepair).toHaveBeenCalledWith(context, initial);
    expect(dependencies.stageOutput).toHaveBeenCalledOnce();
    expect(dependencies.finalizeOutput).toHaveBeenCalledOnce();
    expect(result.outputId).toBe("output-1");
  });

  it("refreshes missing and stale evidence, then inspects it again", async () => {
    for (const state of ["missing", "stale"] as const) {
      const { dependencies } = createDependencies({
        inspections: [{ state }, { state: "fresh" }],
      });

      await runMusicManagerReadWorkflow(dependencies);

      expect(dependencies.enrichEvidence).toHaveBeenCalledOnce();
      expect(dependencies.inspectEvidence).toHaveBeenCalledTimes(2);
      expect(dependencies.buildContext).toHaveBeenCalledOnce();
    }
  });

  it("stops before context and OpenAI when enrichment reports failed", async () => {
    const { dependencies } = createDependencies({
      inspections: [{ state: "missing" }],
      enrichment: { status: "failed" },
    });

    await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toThrow(
      "Chartmetric evidence refresh failed.",
    );

    expect(dependencies.markStep).toHaveBeenCalledWith(
      "chartmetric_enrichment",
      "failed",
    );
    expect(
      dependencies.markStep.mock.calls.filter(
        ([step, status]) => step === "evidence_check" && status === "failed",
      ),
    ).toHaveLength(1);
    expect(
      dependencies.markStep.mock.calls.map(([step, status]) => `${step}:${status}`),
    ).toEqual([
      "evidence_check:running",
      "chartmetric_enrichment:running",
      "chartmetric_enrichment:failed",
      "evidence_check:failed",
    ]);
    expect(dependencies.buildContext).not.toHaveBeenCalled();
    expect(dependencies.generateInitial).not.toHaveBeenCalled();
  });

  it("preserves thrown enrichment errors and stops before OpenAI", async () => {
    const error = new Error("chartmetric transport unavailable");
    const { dependencies } = createDependencies({
      inspections: [{ state: "stale" }],
      failures: { enrichEvidence: error },
    });

    await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(error);

    expect(dependencies.markStep).toHaveBeenCalledWith(
      "chartmetric_enrichment",
      "failed",
    );
    expect(dependencies.markStep).toHaveBeenCalledWith(
      "evidence_check",
      "failed",
    );
    expect(dependencies.generateInitial).not.toHaveBeenCalled();
  });

  it("allows limited enrichment outcomes and records a limited completion", async () => {
    for (const status of ["unresolved", "completed_with_limits"] as const) {
      const { dependencies } = createDependencies({
        inspections: [{ state: "stale" }, { state: "fresh" }],
        enrichment: { status },
      });

      const result = await runMusicManagerReadWorkflow(dependencies);

      expect(dependencies.markStep).toHaveBeenCalledWith(
        "chartmetric_enrichment",
        "completed_with_limits",
      );
      expect(dependencies.generateInitial).toHaveBeenCalledOnce();
      expect(result.completedWithLimits).toBe(true);
    }
  });

  it("proceeds with limited context when refreshed evidence remains missing or stale", async () => {
    for (const state of ["missing", "stale"] as const) {
      const { dependencies } = createDependencies({
        inspections: [{ state }, { state }],
      });

      const result = await runMusicManagerReadWorkflow(dependencies);

      expect(dependencies.markStep).toHaveBeenCalledWith(
        "evidence_check",
        "completed_with_limits",
      );
      expect(dependencies.buildContext).toHaveBeenCalledOnce();
      expect(result.completedWithLimits).toBe(true);
    }
  });

  it("marks synthesis failed and stops when initial generation fails", async () => {
    const error = new Error("initial generation failed");
    const { dependencies } = createDependencies({
      failures: { generateInitial: error },
    });

    await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(error);

    expect(dependencies.markStep).toHaveBeenCalledWith(
      "manager_synthesis",
      "failed",
    );
    expect(dependencies.validateAndRepair).not.toHaveBeenCalled();
    expect(dependencies.stageOutput).not.toHaveBeenCalled();
    expect(dependencies.finalizeOutput).not.toHaveBeenCalled();
  });

  it("marks validation failed and stops when validation fails", async () => {
    const error = new Error("output could not be repaired");
    const { dependencies } = createDependencies({
      failures: { validateAndRepair: error },
    });

    await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(error);

    expect(dependencies.markStep).toHaveBeenCalledWith(
      "output_validation",
      "failed",
    );
    expect(dependencies.stageOutput).not.toHaveBeenCalled();
    expect(dependencies.finalizeOutput).not.toHaveBeenCalled();
  });

  it("marks activation failed and never finalizes after staging errors", async () => {
    const error = new Error("stageOutput failed");
    const { dependencies } = createDependencies({
      failures: { stageOutput: error },
    });

    await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(error);

    expect(dependencies.markStep).toHaveBeenCalledWith(
      "output_activation",
      "failed",
    );
    expect(dependencies.finalizeOutput).not.toHaveBeenCalled();
  });

  it("marks activation failed after finalization errors", async () => {
    const error = new Error("finalizeOutput failed");
    const { dependencies } = createDependencies({
      failures: { finalizeOutput: error },
    });

    await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(error);

    expect(dependencies.stageOutput).toHaveBeenCalledOnce();
    expect(dependencies.finalizeOutput).toHaveBeenCalledOnce();
    expect(dependencies.markStep).toHaveBeenCalledWith(
      "output_activation",
      "failed",
    );
  });

  it("preserves primary errors when failed-transition bookkeeping rejects", async () => {
    const scenarios: Array<{
      operation: Operation;
      step: WorkflowStep;
      inspections?: Array<EvidenceInspection | Error>;
    }> = [
      { operation: "buildContext", step: "context_build" },
      { operation: "generateInitial", step: "manager_synthesis" },
      { operation: "validateAndRepair", step: "output_validation" },
      {
        operation: "enrichEvidence",
        step: "chartmetric_enrichment",
        inspections: [{ state: "missing" }],
      },
      { operation: "inspectEvidence", step: "evidence_check" },
    ];

    for (const { operation, step, inspections } of scenarios) {
      const primaryError = new Error(`${operation} primary failure`);
      const bookkeepingError = new Error(`${step} bookkeeping failure`);
      const reporter = vi.spyOn(console, "error").mockImplementation(() => {});
      const { dependencies } = createDependencies({
        inspections,
        failures: { [operation]: primaryError },
        markStepFailures: [{ step, status: "failed", error: bookkeepingError }],
      });

      try {
        await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(
          primaryError,
        );
        expect(reporter).toHaveBeenCalledWith(
          "Music Manager Read workflow failure bookkeeping failed.",
          bookkeepingError,
        );
      } finally {
        reporter.mockRestore();
      }
    }
  });

  it("preserves staging and finalization errors when activation failure bookkeeping rejects", async () => {
    for (const operation of ["stageOutput", "finalizeOutput"] as const) {
      const error = new Error(`${operation} failed`);
      const bookkeepingError = new Error("activation bookkeeping failed");
      const reporter = vi.spyOn(console, "error").mockImplementation(() => {});
      const { dependencies } = createDependencies({
        failures: { [operation]: error },
        markStepFailures: [
          {
            step: "output_activation",
            status: "failed",
            error: bookkeepingError,
          },
        ],
      });

      try {
        await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(
          error,
        );
        expect(reporter).toHaveBeenCalledWith(
          "Music Manager Read workflow failure bookkeeping failed.",
          bookkeepingError,
        );
      } finally {
        reporter.mockRestore();
      }
    }
  });

  it("preserves the primary error even if the bookkeeping reporter throws", async () => {
    const primaryError = new Error("context primary failure");
    const bookkeepingError = new Error("context bookkeeping failure");
    const reporterError = new Error("console unavailable");
    const reporter = vi.spyOn(console, "error").mockImplementation(() => {
      throw reporterError;
    });
    const { dependencies } = createDependencies({
      failures: { buildContext: primaryError },
      markStepFailures: [
        {
          step: "context_build",
          status: "failed",
          error: bookkeepingError,
        },
      ],
    });

    try {
      await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(
        primaryError,
      );
    } finally {
      reporter.mockRestore();
    }
  });

  it("passes the full successful result to finalization and returns it", async () => {
    const { dependencies } = createDependencies();

    const result = await runMusicManagerReadWorkflow(dependencies);

    expect(result).toEqual({
      output: validated.output,
      usage: validated.usage,
      responseId: validated.responseId,
      requestCount: validated.requestCount,
      outputId: "output-1",
      completedWithLimits: false,
    });
    expect(dependencies.finalizeOutput).toHaveBeenCalledOnce();
    expect(dependencies.finalizeOutput).toHaveBeenCalledWith(result);
  });

  it("records every transition once and performs downstream calls in exact order", async () => {
    const { dependencies, events } = createDependencies({
      inspections: [{ state: "missing" }, { state: "fresh" }],
    });

    await runMusicManagerReadWorkflow(dependencies);

    expect(events).toEqual([
      "evidence_check:running",
      "inspectEvidence",
      "chartmetric_enrichment:running",
      "enrichEvidence",
      "chartmetric_enrichment:completed",
      "inspectEvidence",
      "evidence_check:completed",
      "context_build:running",
      "buildContext",
      "context_build:completed",
      "manager_synthesis:running",
      "generateInitial",
      "manager_synthesis:completed",
      "output_validation:running",
      "validateAndRepair",
      "output_validation:completed",
      "output_activation:running",
      "stageOutput",
      "finalizeOutput",
    ]);

    const expectedTransitions = events.filter((event) => event.includes(":"));
    for (const transition of expectedTransitions) {
      expect(events.filter((event) => event === transition)).toHaveLength(1);
    }
  });

  it("marks the evidence check failed when initial inspection throws", async () => {
    const error = new Error("evidence read failed");
    const { dependencies } = createDependencies({
      failures: { inspectEvidence: error },
    });

    await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(error);

    expect(dependencies.markStep).toHaveBeenCalledWith(
      "evidence_check",
      "failed",
    );
    expect(
      dependencies.markStep.mock.calls.filter(
        ([step, status]) => step === "evidence_check" && status === "failed",
      ),
    ).toHaveLength(1);
    expect(dependencies.enrichEvidence).not.toHaveBeenCalled();
    expect(dependencies.buildContext).not.toHaveBeenCalled();
  });

  it("marks the evidence check failed exactly once when reinspection throws", async () => {
    const error = new Error("refreshed evidence read failed");
    const { dependencies } = createDependencies({
      inspections: [{ state: "stale" }, error],
    });

    await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(error);

    expect(dependencies.markStep.mock.calls).toEqual([
      ["evidence_check", "running"],
      ["chartmetric_enrichment", "running"],
      ["chartmetric_enrichment", "completed"],
      ["evidence_check", "failed"],
    ]);
    expect(dependencies.buildContext).not.toHaveBeenCalled();
    expect(dependencies.generateInitial).not.toHaveBeenCalled();
  });
});
