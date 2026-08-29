import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAdaptivePlanOutput } from "../supabase/functions/_shared/openaiAdaptivePlanCompiler";

const compiler = read("supabase/functions/_shared/openaiAdaptivePlanCompiler.ts");
const runner = read("supabase/functions/manager-runtime-runner/index.ts");
const migration = read("supabase/migrations/20260829080300_world_model_question_engine.sql");
const missionGraph = read("supabase/functions/_shared/missionGraphPersistence.ts");

describe("Artist World Model + Question Engine", () => {
  it("makes needs_context a one-question suspension rather than partial planning", () => {
    expect(compiler).toContain('decision: "no_change" | "needs_context" | "replan"');
    expect(compiler).toContain("maxItems: 1");
    expect(compiler).toContain("A needs-context adaptive plan requires exactly one question.");
    expect(compiler).toContain("A needs-context adaptive plan cannot create replacement work before the answer exists.");
    expect(runner).toContain('if (output.decision === "needs_context")');
    expect(runner).toContain('status: "needs_context"');
    expect(runner).toContain("persist_manager_question_request_v1");
  });

  it("requires a concrete management hypothesis and fallback before asking", () => {
    expect(compiler).toContain("QUESTION QUALITY GATE");
    expect(compiler).toContain("hypothesis");
    expect(compiler).toContain("fallbackIfNo");
    expect(compiler).toContain("Never ask a generic inventory question");
    expect(compiler).toContain("What resources do you have for content creation?");
  });

  it("uses scoped and expiring operating facts instead of a permanent profile blob", () => {
    expect(migration).toContain("create table if not exists public.artist_operating_facts");
    expect(migration).toContain("scope_type text not null check (scope_type in ('artist', 'mission', 'task'))");
    expect(migration).toContain("valid_until timestamptz");
    expect(migration).toContain("supersedes_fact_id uuid");
    expect(migration).toContain("artist_operating_facts_current_uidx");
    expect(runner).toContain('.from("artist_operating_facts")');
    expect(runner).toContain('.eq("status", "active")');
    expect(runner).toContain("valid_until.gt.");
  });

  it("keeps question requests durable and automatically resumes the linked review", () => {
    expect(migration).toContain("create table if not exists public.manager_question_requests");
    expect(migration).toContain("context_request_id text not null unique");
    expect(migration).toContain("hypothesis text not null");
    expect(migration).toContain("fallback_if_no text not null");
    expect(migration).toContain("create or replace function public.capture_world_model_answer_v1()");
    expect(migration).toContain("manager_context_answered");
    expect(migration).toContain("create trigger capture_world_model_answer");
    expect(migration).toContain("/functions/v1/workflow-recovery");
    expect(migration).toContain("'source', 'world-model-answer'");
  });

  it("packs fresh World Model facts before deciding whether to ask", () => {
    expect(runner).toContain("operatingFacts");
    expect(runner).toContain("questionHistory");
    expect(runner).toContain("freshOperatingFactsBeatGenericProfileAssumptions: true");
    expect(runner).toContain("expiredQuestionUsesFallbackInsteadOfRepeating: true");
    expect(compiler).toContain("context.operatingFacts does not already contain a fresh answer");
    expect(compiler).toContain("context.questionHistory");
  });

  it("prevents a world-model answer conversation from creating a parallel Mission graph", () => {
    expect(missionGraph).toContain("isWorldModelContinuationRun");
    expect(missionGraph).toContain('contextRequestId.startsWith("world-model:")');
    expect(missionGraph).toContain("return persisted;");
  });

  it("rejects needs_context output that tries to emit replacement work", () => {
    expect(() => parseAdaptivePlanOutput({
      decision: "needs_context",
      reason: "Need one fact.",
      whatChanged: "Availability changed.",
      missionRecommendation: "Keep the current route while asking.",
      planSummary: "Current plan remains active.",
      strategyState: strategyState(),
      questions: [question()],
      checkpoints: [{
        key: "bad_checkpoint",
        title: "This should not exist yet",
        question: "Should we continue?",
        decisionRule: "After answer",
        managerRead: "Wait",
        nextAction: "Wait",
        watchedSignals: [],
      }],
      tasks: [],
      permissionRequests: [],
    }, validation())).toThrow("cannot create replacement work before the answer exists");
  });

  it("rejects a context question that writes outside the allowed scope", () => {
    expect(() => parseAdaptivePlanOutput({
      decision: "needs_context",
      reason: "Need one fact.",
      whatChanged: "Availability changed.",
      missionRecommendation: "Keep the current route while asking.",
      planSummary: "Current plan remains active.",
      strategyState: strategyState(),
      questions: [{ ...question(), factScopeKey: "mission:someone-else" }],
      checkpoints: [],
      tasks: [],
      permissionRequests: [],
    }, validation())).toThrow("outside the allowed operating scope");
  });
});

function question() {
  return {
    key: "car_access",
    question: "I have a stronger version of the first Odaeshi video if you can use a parked car for 30 minutes. Can you get one this week?",
    reason: "The car changes whether Desk uses the intimate conversation setup or the fallback location.",
    answerKind: "single_select",
    options: ["Yes", "No"],
    recommendedAnswer: "",
    recommendationReason: "",
    hypothesis: "Use a parked car for a low-cost intimate resilience conversation with two friends.",
    fallbackIfNo: "Use the same close conversation structure in a known quiet location.",
    factDomain: "access",
    factKey: "access.car_for_odaeshi_test",
    factScopeType: "mission",
    factScopeKey: "mission:mission-1",
    validForHours: 168,
  } as const;
}

function strategyState() {
  return {
    objective: "Establish Odaeshi as a cultural resilience expression.",
    strategicThesis: "Participation proof before broad spend.",
    desiredAudienceBehavior: "Share personal resilience stories.",
    creativePillars: ["Tough Skin Stories"],
    culturalMeaning: ["resilience", "still standing"],
    constraints: ["low budget"],
    scopedBudget: "",
    availableResources: ["phone"],
    horizon: "next 7 days",
    successIndicators: ["meaningful participation"],
    rejectedDirections: ["broad paid ads before proof"],
    guardrails: ["do not dilute cultural meaning"],
    updatedBecause: "Availability changed.",
  };
}

function validation() {
  return {
    allowedDeadlines: [],
    allowedAvailability: [],
    allowedFactScopes: ["artist", "mission:mission-1", "task:task-1"],
  };
}

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}