import { describe, expect, it, vi } from "vitest";

import {
  runMusicManagerReadWorkflow,
  type EnrichmentResult,
  type EvidenceInspection,
  type MusicManagerReadWorkflowDependencies,
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
  | "activateOutput"
  | "complete";

type FactoryOptions = {
  inspections?: EvidenceInspection[];
  enrichment?: EnrichmentResult;
  failures?: Partial<Record<Operation, Error>>;
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
    }),
    inspectEvidence: vi.fn(async () => {
      events.push("inspectEvidence");
      failIfConfigured("inspectEvidence");
      return inspections.shift() ?? { state: "fresh" as const };
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
    activateOutput: vi.fn(async () => {
      events.push("activateOutput");
      failIfConfigured("activateOutput");
    }),
    complete: vi.fn(async () => {
      events.push("complete");
      failIfConfigured("complete");
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
    expect(dependencies.activateOutput).toHaveBeenCalledOnce();
    expect(dependencies.complete).toHaveBeenCalledOnce();
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
    expect(dependencies.activateOutput).not.toHaveBeenCalled();
    expect(dependencies.complete).not.toHaveBeenCalled();
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
    expect(dependencies.activateOutput).not.toHaveBeenCalled();
    expect(dependencies.complete).not.toHaveBeenCalled();
  });

  it("marks activation failed and never completes after staging or activation errors", async () => {
    for (const operation of ["stageOutput", "activateOutput"] as const) {
      const error = new Error(`${operation} failed`);
      const { dependencies } = createDependencies({
        failures: { [operation]: error },
      });

      await expect(runMusicManagerReadWorkflow(dependencies)).rejects.toBe(error);

      expect(dependencies.markStep).toHaveBeenCalledWith(
        "output_activation",
        "failed",
      );
      if (operation === "stageOutput") {
        expect(dependencies.activateOutput).not.toHaveBeenCalled();
      } else {
        expect(dependencies.activateOutput).toHaveBeenCalledOnce();
      }
      expect(dependencies.complete).not.toHaveBeenCalled();
    }
  });

  it("passes the complete successful result through unchanged", async () => {
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
    expect(dependencies.complete).toHaveBeenCalledWith(result);
  });

  it("records evidence, context, synthesis, validation, activation, and completion in order", async () => {
    const { dependencies, events } = createDependencies({
      inspections: [{ state: "missing" }, { state: "fresh" }],
    });

    await runMusicManagerReadWorkflow(dependencies);

    const before = (first: string, second: string) => {
      expect(events.indexOf(first), `${first} before ${second}`).toBeLessThan(
        events.indexOf(second),
      );
    };

    before("evidence_check:running", "chartmetric_enrichment:running");
    expect(events.filter((event) => event === "inspectEvidence")).toHaveLength(2);
    expect(events.indexOf("chartmetric_enrichment:completed")).toBeLessThan(
      events.lastIndexOf("inspectEvidence"),
    );
    before("chartmetric_enrichment:completed", "context_build:running");
    before("evidence_check:completed", "context_build:running");
    before("context_build:completed", "manager_synthesis:running");
    before("manager_synthesis:completed", "output_validation:running");
    before("output_validation:completed", "output_activation:running");
    before("output_activation:completed", "complete");
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
    expect(dependencies.enrichEvidence).not.toHaveBeenCalled();
    expect(dependencies.buildContext).not.toHaveBeenCalled();
  });
});
