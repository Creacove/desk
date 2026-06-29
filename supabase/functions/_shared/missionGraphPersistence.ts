import type {
  ManagerConversationCreatedWork,
  ManagerConversationOutput,
  ManagerMissionGraphDecision,
} from "./openaiManagerConversation.ts";
import type { MissionGenesisOutput } from "./openaiMissionGenesis.ts";

type MissionGraphInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
};

type ManagerGraphContext = {
  conversationId?: string;
  runId: string;
  actionId?: string;
  sourceType: "manager_conversation" | "mission_genesis";
  trigger: string;
};

export async function persistManagerMissionGraphDecisions(
  db: any,
  input: MissionGraphInput,
  context: ManagerGraphContext,
  output: ManagerConversationOutput,
): Promise<ManagerConversationCreatedWork[]> {
  const persisted: ManagerConversationCreatedWork[] = output.createdWork.filter((work) => work.type === "music_item");

  for (const decision of output.missionGraphDecisions) {
    if (decision.outcome === "activate_mission") {
      const mission = await createMission(db, input, context, decision);
      const taskWork = await writeMissionPlan(db, input, context, mission.id, decision);
      await writeOperatingEvent(db, input, context, {
        event_type: "manager_created_mission",
        target_type: "mission",
        target_id: mission.id,
        mission_id: mission.id,
        summary: `Manager created mission: ${mission.title}`,
        payload: decision,
      });
      persisted.push({
        type: "mission",
        id: mission.id,
        title: mission.title,
        body: mission.summary || decision.decisionSummary,
        status: "created",
      });
      persisted.push(...taskWork);
      continue;
    }

    if (decision.outcome === "update_existing_mission") {
      const missionId = decision.existingMissionId.trim();
      if (!missionId) {
        persisted.push({
          type: "mission",
          id: "",
          title: decision.mission.title,
          body: "Mission update needs an existing mission before the full graph can be written.",
          status: "approval_required",
        });
        continue;
      }

      const mission = await updateMission(db, input, missionId, decision);
      const taskWork = await writeMissionPlan(db, input, context, mission.id, decision);
      await writeOperatingEvent(db, input, context, {
        event_type: "manager_updated_mission",
        target_type: "mission",
        target_id: mission.id,
        mission_id: mission.id,
        summary: `Manager updated mission: ${mission.title}`,
        payload: decision,
      });
      persisted.push({
        type: "mission",
        id: mission.id,
        title: mission.title,
        body: mission.summary || decision.decisionSummary,
        status: "updated",
      });
      persisted.push(...taskWork);
    }
  }

  return persisted;
}

export async function persistMissionGenesisGraphPlan(
  db: any,
  input: MissionGraphInput,
  context: { runId: string; actionId: string },
  missionId: string,
  output: MissionGenesisOutput,
) {
  const decision: ManagerMissionGraphDecision = {
    outcome: output.outcome === "update_existing_mission" ? "update_existing_mission" : "activate_mission",
    confidence: output.confidence,
    decisionSummary: output.decisionSummary,
    existingMissionId: output.existingMissionId,
    reasons: output.reasons,
    evidenceNeeded: output.evidenceNeeded,
    mission: output.mission,
    checkpoints: output.checkpoints,
    tasks: output.tasks,
    permissionRequests: output.permissionRequests,
  };

  return writeMissionPlan(db, input, {
    runId: context.runId,
    actionId: context.actionId,
    sourceType: "mission_genesis",
    trigger: "mission_genesis",
  }, missionId, decision);
}

async function createMission(db: any, input: MissionGraphInput, context: ManagerGraphContext, decision: ManagerMissionGraphDecision) {
  const { data, error } = await db.from("missions").insert({
    ...missionRow(input, context, decision),
    status: "active",
    priority: 1,
  }).select("id,title,summary").single();
  if (error) throw error;
  return data;
}

async function updateMission(db: any, input: MissionGraphInput, missionId: string, decision: ManagerMissionGraphDecision) {
  const { data, error } = await db.from("missions").update({
    title: decision.mission.title,
    objective: decision.mission.objective,
    reason: decision.mission.reason,
    summary: decision.mission.summary,
    pattern_name: decision.mission.patternName,
    pattern_confidence: decision.confidence === "limited" ? "low" : decision.confidence,
    current_recommendation: decision.mission.currentRecommendation || decision.decisionSummary,
    change_conditions: decision.mission.changeConditions,
    review_point: decision.checkpoints[0]?.title ?? "Manager review",
    required_evidence: unique(decision.checkpoints.flatMap((checkpoint) => checkpoint.requiredEvidence)),
    missing_evidence: unique([...decision.evidenceNeeded, ...decision.checkpoints.flatMap((checkpoint) => checkpoint.missingEvidence)]),
    updated_at: new Date().toISOString(),
  })
    .eq("id", missionId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .select("id,title,summary")
    .single();
  if (error) throw error;
  return data;
}

function missionRow(input: MissionGraphInput, context: ManagerGraphContext, decision: ManagerMissionGraphDecision) {
  return {
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    title: decision.mission.title,
    objective: decision.mission.objective,
    reason: decision.mission.reason,
    progress: 0,
    summary: decision.mission.summary,
    pattern_name: decision.mission.patternName,
    pattern_confidence: decision.confidence === "limited" ? "low" : decision.confidence,
    originating_trigger: context.trigger,
    originating_run_id: context.runId,
    originating_conversation_id: context.conversationId ?? null,
    current_recommendation: decision.mission.currentRecommendation || decision.decisionSummary,
    change_conditions: decision.mission.changeConditions,
    review_point: decision.checkpoints[0]?.title ?? "Manager review",
    required_evidence: unique(decision.checkpoints.flatMap((checkpoint) => checkpoint.requiredEvidence)),
    missing_evidence: unique([...decision.evidenceNeeded, ...decision.checkpoints.flatMap((checkpoint) => checkpoint.missingEvidence)]),
    created_from_run_id: context.runId,
  };
}

async function writeMissionPlan(
  db: any,
  input: MissionGraphInput,
  context: ManagerGraphContext,
  missionId: string,
  decision: ManagerMissionGraphDecision,
) {
  const taskWork: ManagerConversationCreatedWork[] = [];
  const { data: existingPlans, error: queryError } = await db
    .from("mission_plan_versions")
    .select("id,version")
    .eq("mission_id", missionId)
    .order("version", { ascending: false });
  if (queryError) throw queryError;

  const nextVersion = existingPlans?.length ? Number(existingPlans[0].version ?? 0) + 1 : 1;
  const { data: plan, error: planError } = await db.from("mission_plan_versions").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    mission_id: missionId,
    version: nextVersion,
    status: "active",
    generated_from_run_id: context.runId,
    generated_from_action_id: context.actionId ?? null,
    summary: `${decision.mission.timeline}. ${decision.mission.summary}`,
  }).select("id").single();
  if (planError) throw planError;

  if (nextVersion > 1 && existingPlans?.length) {
    const supersededPlanIds = existingPlans.map((item: any) => item.id);
    const { error: planSupersedeError } = await db.from("mission_plan_versions").update({
      status: "superseded",
      superseded_at: new Date().toISOString(),
      superseded_by_plan_id: plan.id,
    }).in("id", supersededPlanIds).in("status", ["active", "draft"]);
    if (planSupersedeError) throw planSupersedeError;

    const { error: checkpointSupersedeError } = await db.from("checkpoints").update({
      status: "skipped",
      updated_at: new Date().toISOString(),
    }).in("mission_plan_version_id", supersededPlanIds).in("status", ["waiting", "blocked", "ready_for_manager_check", "watching_signal", "needs_revision"]);
    if (checkpointSupersedeError) throw checkpointSupersedeError;

    const { error: taskSupersedeError } = await db.from("tasks").update({
      status: "superseded",
      updated_at: new Date().toISOString(),
    }).in("mission_plan_version_id", supersededPlanIds).in("status", ["proposed", "open", "needs_approval", "approved", "in_progress", "blocked", "missed"]);
    if (taskSupersedeError) throw taskSupersedeError;
  }

  const checkpointIds = new Map<string, string>();
  for (const [index, checkpoint] of decision.checkpoints.entries()) {
    const { data, error } = await db.from("checkpoints").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      mission_id: missionId,
      mission_plan_version_id: plan.id,
      title: checkpoint.title,
      status: "waiting",
      question: checkpoint.question,
      reason_for_checkpoint: checkpoint.question,
      watched_signals: checkpoint.sourceRefs,
      decision_rule: checkpoint.decisionRule,
      recommendation: decision.mission.currentRecommendation,
      required_evidence: checkpoint.requiredEvidence,
      missing_evidence: checkpoint.missingEvidence,
      custom_reason: `Manager-authored checkpoint grounded in packet refs: ${checkpoint.sourceRefs.join(", ")}`,
      created_from_run_id: context.runId,
      created_from_action_id: context.actionId ?? null,
    }).select("id").single();
    if (error) throw error;
    checkpointIds.set(checkpoint.key, data.id);

    const { error: linkError } = await db.from("mission_plan_checkpoints").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      mission_plan_version_id: plan.id,
      mission_id: missionId,
      checkpoint_id: data.id,
      order_index: index + 1,
      phase_label: checkpoint.title,
      unlock_rule: checkpoint.decisionRule,
    });
    if (linkError) throw linkError;
  }

  for (const task of decision.tasks) {
    const checkpointId = checkpointIds.get(task.primaryCheckpointKey);
    if (!checkpointId) throw new Error(`Manager mission graph task references missing checkpoint: ${task.primaryCheckpointKey}`);
    const { data: taskRow, error } = await db.from("tasks").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      scope: "mission",
      mission_id: missionId,
      mission_plan_version_id: plan.id,
      primary_checkpoint_id: checkpointId,
      title: task.title,
      owner_role: task.ownerRole || "Manager",
      priority: 1,
      status: "proposed",
      approval_state: "not_required",
      purpose: task.purpose,
      evidence_needed: task.evidenceNeeded,
      completion_expectation: task.completionExpectation,
      risk_if_late: task.riskIfLate,
      created_from_run_id: context.runId,
      created_from_action_id: context.actionId ?? null,
    }).select("id").single();
    if (error) throw error;
    taskWork.push({
      type: "task",
      id: taskRow.id,
      parentMissionId: missionId,
      title: task.title,
      body: task.purpose,
      status: "created",
    });

    if (task.steps.length) {
      const { error: stepError } = await db.from("task_steps").insert(task.steps.map((body, index) => ({
        account_id: input.accountId,
        artist_workspace_id: input.artistWorkspaceId,
        artist_id: input.artistId,
        task_id: taskRow.id,
        order_index: index + 1,
        body,
      })));
      if (stepError) throw stepError;
    }
  }

  for (const permission of decision.permissionRequests) {
    const { error } = await db.from("permission_requests").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      mission_id: missionId,
      request_type: permission.requestType,
      title: permission.title,
      body: permission.body,
      risk: permission.risk,
      status: "pending",
      created_from_run_id: context.runId,
      created_from_action_id: context.actionId ?? null,
    });
    if (error) throw error;
  }

  const { error: missionError } = await db.from("missions").update({ active_plan_version_id: plan.id }).eq("id", missionId);
  if (missionError) throw missionError;
  return taskWork;
}

async function writeOperatingEvent(db: any, input: MissionGraphInput, context: ManagerGraphContext, event: Record<string, unknown>) {
  const { error } = await db.from("operating_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    actor_type: "manager",
    source_type: context.sourceType,
    manager_synthesis_run_id: context.runId,
    ...event,
  });
  if (error) throw error;
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value && value.trim()).map((value) => value.trim()))];
}
