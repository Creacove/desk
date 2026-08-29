import { createBrowserSupabaseClient } from "../lib/supabaseClient";

export type TaskExecutionState = {
  id: string;
  status: string;
  availableFrom: string | null;
  deadline: string | null;
  estimatedMinutes: number | null;
};

export type TaskMoveReview = {
  planImpact: "no_change" | "local_change" | "downstream_risk";
  summary: string;
  managerInterpretation: string;
  missionRecommendation: string;
  nextHumanMove: string;
  requiresReplan: boolean;
};

export type TaskExecutionResponse = {
  task: TaskExecutionState;
  managerReview?: TaskMoveReview | null;
  managerRunId?: string;
  reviewDeferred?: boolean;
  idempotent?: boolean;
};

export async function loadTaskExecutionState(taskId: string): Promise<TaskExecutionState | null> {
  const client = createBrowserSupabaseClient();
  const { data, error } = await client
    .from("tasks")
    .select("id,status,available_from,deadline,estimated_minutes")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return taskExecutionState(data);
}

export async function startMissionTask(taskId: string): Promise<TaskExecutionResponse> {
  return invokeTaskExecution({ taskId, action: "start" });
}

export async function moveMissionTask(
  taskId: string,
  input: { availableFrom: string; note?: string },
): Promise<TaskExecutionResponse> {
  return invokeTaskExecution({
    taskId,
    action: "move",
    availableFrom: input.availableFrom,
    note: input.note?.trim() || undefined,
  });
}

async function invokeTaskExecution(body: Record<string, unknown>): Promise<TaskExecutionResponse> {
  const client = createBrowserSupabaseClient();
  const { data, error } = await client.functions.invoke("manager-task-execution", { body });
  if (error) throw await taskExecutionError(error, "Desk could not update this task.");
  if (!data || typeof data !== "object" || !data.task) throw new Error("Desk did not return the updated task state.");
  return {
    ...data,
    task: taskExecutionState(data.task),
  } as TaskExecutionResponse;
}

function taskExecutionState(value: any): TaskExecutionState {
  return {
    id: String(value?.id ?? ""),
    status: String(value?.status ?? "open"),
    availableFrom: value?.availableFrom ?? value?.available_from ?? null,
    deadline: value?.deadline ?? null,
    estimatedMinutes: typeof (value?.estimatedMinutes ?? value?.estimated_minutes) === "number"
      ? Number(value.estimatedMinutes ?? value.estimated_minutes)
      : null,
  };
}

async function taskExecutionError(error: any, fallback: string) {
  const response = error?.context as Response | undefined;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      if (payload?.error && typeof payload.error === "string") return new Error(payload.error);
    } catch {
      // Fall through to the provider error below.
    }
  }
  return new Error(typeof error?.message === "string" && error.message.trim() ? error.message : fallback);
}
