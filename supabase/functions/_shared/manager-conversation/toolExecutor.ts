import { writeWorkspaceEvent } from "../workspaceEvents.ts";
import { manualSongWorkspaceCopy } from "../manualSongWorkspace.ts";
import { executeDiscoveryTool } from "../manager-agent/discoveryTools.ts";
import { captureAppError } from "../appError.ts";
import type { ManagerConversationCreatedWork } from "../openaiManagerConversation.ts";
import { assessReleaseSuccess } from "../release-success/readiness.ts";
import {
  dedupeOpportunityCandidates,
  normalizeOpportunityBrief,
  normalizePublicEmail,
  normalizePublicUrl,
} from "../release-success/opportunities.ts";
import { createSchedulePreview } from "../release-success/schedule.ts";
import type {
  ReleaseFact,
  ReleaseOpportunityBrief,
  ReleaseOpportunityCandidate,
  ReleaseOpportunitySongContext,
  ReleaseSuccessPacket,
  ReleaseTaskScheduleBindingInput,
} from "../release-success/types.ts";
import { persistFocusedSongDocumentDraft } from "../songDocumentDraft.ts";

type ManagerToolInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  conversationId?: string;
  runId?: string;
  userId?: string;
  musicSubject?: { type: "music_item" | "music_project"; id: string };
  createdWork?: ManagerConversationCreatedWork[];
};

type SupabaseLike = {
  from(table: string): any;
  rpc?(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};

export async function executeManagerConversationTool(
  db: SupabaseLike,
  input: ManagerToolInput,
  name: string,
  args: Record<string, unknown>,
) {
  if (name === "query_evidence_items") return queryEvidenceItems(db, input, args);
  if (name === "query_active_missions") return queryActiveMissions(db, input, args);
  if (name === "query_music_catalog") return queryMusicCatalog(db, input, args);
  if (name === "query_durable_memory") return queryDurableMemory(db, input, args);
  if (name === "query_manager_outputs") return queryManagerOutputs(db, input, args);
  if (name === "read_manager_output_section") return readManagerOutputSection(db, input, args);
  if (name === "read_focused_music_subject") return readFocusedMusicSubject(db, input);
  if (name === "read_focused_release_success") return readFocusedReleaseSuccess(db, input);
  if (name === "propose_focused_release_date_change") return proposeFocusedReleaseDateChange(db, input, args);
  if (name === "query_focused_release_opportunities") return queryFocusedReleaseOpportunities(db, input, args);
  if (name === "save_focused_release_opportunities") return saveFocusedReleaseOpportunities(db, input, args);
  if (name === "record_focused_release_opportunity_outcome") return recordFocusedReleaseOpportunityOutcome(db, input, args);
  if (name === "create_focused_song_document") return createFocusedSongDocument(db, input, args);
  if (name === "read_focused_release_readiness") return readFocusedReleaseReadiness(db, input);
  if (name === "refresh_focused_music_intelligence") return refreshFocusedMusicIntelligence(db, input);
  if (name === "update_focused_music_metadata") return updateFocusedMusicMetadata(db, input, args);
  if (name === "update_focused_music_lifecycle") return updateFocusedMusicLifecycle(db, input, args);
  if (name === "ensure_song_release_workspace") return ensureSongReleaseWorkspace(db, input, args);
  throw new Error(`Unsupported Manager tool: ${name}`);
}

async function queryEvidenceItems(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  let query = scopedQuery(db, "evidence_items", [
    "id",
    "source",
    "source_kind",
    "evidence_type",
    "subject_type",
    "subject_id",
    "subject_label",
    "metric_name",
    "metric_value",
    "metric_unit",
    "freshness",
    "confidence",
    "provenance",
    "limitation",
    "raw_ref",
    "created_at",
  ].join(","), input);
  query = applyExactSubjectFilters(query, args);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(numberArg(args.limit, 16, 40));
  if (error) throw error;
  const rows = data ?? [];
  return {
    items: filterRows(rows, args).map((row: any) => ({
      id: row.id,
      source: row.source,
      sourceKind: row.source_kind,
      evidenceType: row.evidence_type,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      subject: row.subject_label,
      metric: row.metric_name,
      value: row.metric_value == null ? "" : `${row.metric_value}${row.metric_unit ? ` ${row.metric_unit}` : ""}`,
      freshness: row.freshness,
      confidence: row.confidence,
      provenance: row.provenance,
      limitation: row.limitation,
      rawRef: row.raw_ref,
      createdAt: row.created_at,
    })),
  };
}

async function queryActiveMissions(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const status = stringArg(args.status);
  let query = scopedQuery(db, "missions", [
    "id",
    "title",
    "objective",
    "reason",
    "status",
    "priority",
    "progress",
    "summary",
    "pattern_name",
    "current_recommendation",
    "required_evidence",
    "missing_evidence",
    "change_conditions",
    "review_point",
    "created_at",
  ].join(","), input).order("created_at", { ascending: false }).limit(numberArg(args.limit, 12, 30));
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  const missions = filterRows(data ?? [], args);
  const missionIds = missions.map((mission: any) => mission.id).filter(Boolean);
  const includeTasks = Boolean(args.includeTasks);
  const includeCheckpoints = Boolean(args.includeCheckpoints);
  const [tasks, checkpoints] = await Promise.all([
    includeTasks && missionIds.length ? selectMissionChildren(db, "tasks", "id,mission_id,primary_checkpoint_id,title,owner_role,work_mode,status,purpose,evidence_needed,completion_expectation,risk_if_late", input, missionIds) : Promise.resolve([]),
    includeCheckpoints && missionIds.length ? selectMissionChildren(db, "checkpoints", "id,mission_id,title,question,status,recommendation,decision_rule,next_action,required_evidence,missing_evidence", input, missionIds) : Promise.resolve([]),
  ]);
  return {
    items: missions.map((mission: any) => ({
      ...mission,
      tasks: tasks.filter((task: any) => task.mission_id === mission.id),
      checkpoints: checkpoints.filter((checkpoint: any) => checkpoint.mission_id === mission.id),
    })),
  };
}

async function queryMusicCatalog(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const limit = numberArg(args.limit, 12, 30);
  const [items, projects] = await Promise.all([
    selectScoped(db, "music_items", "id,title,item_type,lifecycle_stage,released_at,source_kind,source_limit,metadata,created_at", input, limit),
    selectScoped(db, "music_projects", "id,title,project_type,lifecycle_stage,released_at,source_kind,source_limit,metadata,created_at", input, limit),
  ]);
  const itemType = stringArg(args.itemType);
  const lifecycleStage = stringArg(args.lifecycleStage);
  const normalized = [
    ...items.map((item: any) => ({ ...item, kind: "music_item", type: item.item_type })),
    ...projects.map((project: any) => ({ ...project, kind: "music_project", type: project.project_type })),
  ].filter((row) => !itemType || String(row.type ?? "").toLowerCase() === itemType.toLowerCase())
    .filter((row) => !lifecycleStage || String(row.lifecycle_stage ?? "").toLowerCase() === lifecycleStage.toLowerCase());
  return { items: filterRows(normalized, args).slice(0, limit) };
}

async function queryDurableMemory(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const rows = await selectScoped(db, "memory_entries", "id,scope,kind,content,source_type,confidence,reason,mission_id,conversation_id,created_at", input, numberArg(args.limit, 16, 40));
  const scope = stringArg(args.scope);
  return {
    items: filterRows(rows, args)
      .filter((row: any) => !scope || String(row.scope ?? "").toLowerCase() === scope.toLowerCase()),
  };
}

async function queryManagerOutputs(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const outputType = stringArg(args.outputType);
  const subjectType = stringArg(args.subjectType);
  const subjectId = stringArg(args.subjectId);
  let query = scopedQuery(db, "manager_outputs", "id,output_type,subject_type,subject_id,summary,primary_recommendation_json,avoid_json,confidence_json,supporting_evidence_json,created_at", input);
  if (outputType) query = query.eq("output_type", outputType);
  if (subjectType) query = query.eq("subject_type", subjectType);
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(numberArg(args.limit, 10, 30));
  if (error) throw error;
  const rows = data ?? [];
  return {
    items: filterRows(rows, args)
      .filter((row: any) => !outputType || row.output_type === outputType)
      .filter((row: any) => !subjectType || row.subject_type === subjectType)
      .filter((row: any) => !subjectId || row.subject_id === subjectId)
      .map((row: any) => ({
        id: row.id,
        outputType: row.output_type,
        subjectType: row.subject_type,
        subjectId: row.subject_id,
        summary: row.summary,
        primaryRecommendation: row.primary_recommendation_json,
        avoid: row.avoid_json,
        confidence: row.confidence_json,
        supportingEvidence: row.supporting_evidence_json,
        createdAt: row.created_at,
      })),
  };
}

async function refreshFocusedMusicIntelligence(db: SupabaseLike, input: ManagerToolInput) {
  const subject = requireFocusedMusicSubject(input);
  const name = subject.type === "music_item" ? "chartmetric_track_enrich" : "chartmetric_project_enrich";
  const args = subject.type === "music_item" ? { musicItemId: subject.id } : { musicProjectId: subject.id };
  return executeDiscoveryTool(db, {
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    reuseExistingSnapshots: false,
    managerRunId: input.runId,
  }, name, args);
}

async function readManagerOutputSection(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const outputId = stringArg(args.outputId);
  if (!outputId) return { status: "not_found", outputId: "" };
  const { data, error } = await scopedQuery(
    db,
    "manager_outputs",
    "id,summary,primary_recommendation_json,render_json",
    input,
  ).eq("id", outputId).maybeSingle();
  if (error) throw error;
  if (!data) return { status: "not_found", outputId };

  const maxChars = numberArg(args.maxChars, 4_000, 7_000);
  const content = selectOutputSection(readOutputText(data), stringArg(args.query));
  const truncated = content.length > maxChars;
  return {
    status: "found",
    outputId,
    content: truncated ? content.slice(0, maxChars) : content,
    truncated,
  };
}

async function readFocusedMusicSubject(db: SupabaseLike, input: ManagerToolInput) {
  const subject = requireFocusedMusicSubject(input);
  const target = musicTarget(subject);
  const identityColumns = subject.type === "music_item"
    ? "id,title,item_type,lifecycle_stage,planned_release_date,released_at,source_kind,source_limit,metadata"
    : "id,title,project_type,lifecycle_stage,planned_release_date,released_at,source_kind,source_limit,metadata";
  const [identity, assets, identifiers, credits, splits] = await Promise.all([
    scopedQuery(db, target.table, identityColumns, input)
      .eq("id", subject.id).maybeSingle(),
    scopedQuery(db, "music_assets", "id,asset_type,title,status,version_label,notes", input)
      .eq(target.foreignKey, subject.id).limit(40),
    scopedQuery(db, "music_identifiers", "id,identifier_type,identifier_value,confidence", input)
      .eq(target.foreignKey, subject.id).limit(30),
    scopedQuery(db, "music_credits", "id,role,name,status", input)
      .eq(target.foreignKey, subject.id).limit(50),
    subject.type === "music_item"
      ? scopedQuery(db, "music_splits", "id,status,publishing_total,master_total,summary", input).eq("music_item_id", subject.id).limit(12)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (identity.error) throw identity.error;
  if (assets.error) throw assets.error;
  if (identifiers.error) throw identifiers.error;
  if (credits.error) throw credits.error;
  if (splits.error) throw splits.error;
  if (!identity.data) return { status: "not_found", subject };
  return {
    status: "found",
    subject: {
      type: subject.type,
      id: identity.data.id,
      title: identity.data.title,
      lifecycleStage: identity.data.lifecycle_stage,
      plannedReleaseDate: identity.data.planned_release_date,
      releasedAt: identity.data.released_at,
      sourceKind: identity.data.source_kind,
      sourceLimit: identity.data.source_limit,
      metadata: manualDetails(identity.data.metadata),
      assets: assets.data ?? [],
      identifiers: identifiers.data ?? [],
      credits: credits.data ?? [],
      splits: splits.data ?? [],
    },
  };
}

async function readFocusedReleaseReadiness(db: SupabaseLike, input: ManagerToolInput) {
  const subject = requireFocusedMusicSubject(input);
  const target = musicTarget(subject);
  const { data: identity, error: identityError } = await scopedQuery(
    db,
    target.table,
    "id,title,lifecycle_stage,planned_release_date,released_at,metadata",
    input,
  ).eq("id", subject.id).maybeSingle();
  if (identityError) throw identityError;
  if (!identity?.id) return { status: "not_found", subject };

  const mode = releaseManagementMode(identity);
  if (mode === "post_release") {
    return {
      status: "ready",
      mode,
      subject: { type: subject.type, id: subject.id, title: identity.title },
      blockers: [],
      nextFocus: [
        "Monitor response and choose the next post-release move.",
        "Prepare approved press, playlist, or partner materials from existing assets when useful.",
      ],
    };
  }

  const [assets, identifiers, splits] = await Promise.all([
    scopedQuery(db, "music_assets", "asset_type,status", input).eq(target.foreignKey, subject.id).limit(40),
    scopedQuery(db, "music_identifiers", "identifier_type,identifier_value", input).eq(target.foreignKey, subject.id).limit(30),
    subject.type === "music_item"
      ? scopedQuery(db, "music_splits", "status", input).eq("music_item_id", subject.id).limit(12)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (assets.error) throw assets.error;
  if (identifiers.error) throw identifiers.error;
  if (splits.error) throw splits.error;

  const assetRows = assets.data ?? [];
  const identifierRows = identifiers.data ?? [];
  const splitRows = splits.data ?? [];
  const details = record(identity.metadata).manual_details;
  const manual = record(details);
  const blockers = [
    !hasReadyAsset(assetRows, ["final_master", "demo", "rough_mix"]) ? "A usable audio version is not attached." : "",
    !hasReadyAsset(assetRows, ["cover_art", "alternate_artwork"]) ? "Approved cover artwork is not attached." : "",
    subject.type === "music_item" && !splitRows.some((split: any) => stringArg(split.status).toLowerCase() === "cleared")
      ? "Split and rights confirmation is not cleared." : "",
    !hasReleaseDate(identity.planned_release_date, manual) ? "A release date is not set." : "",
    !hasIdentifier(identifierRows, "isrc") ? "ISRC is not recorded." : "",
  ].filter(Boolean);
  return {
    status: blockers.length ? "blocked" : "ready",
    mode,
    subject: { type: subject.type, id: subject.id, title: identity.title },
    blockers,
    nextFocus: blockers.length
      ? ["Resolve the listed release gates before planning external delivery or outreach."]
      : ["Confirm the artist’s release approval, timing, and budget before activating the release mission."],
  };
}

async function readFocusedReleaseSuccess(db: SupabaseLike, input: ManagerToolInput) {
  const subject = requireFocusedMusicSubject(input);
  if (subject.type !== "music_item") {
    return { status: "not_allowed", reason: "Release-success planning is currently scoped to an attached song." };
  }

  const { data: identity, error: identityError } = await scopedQuery(
    db,
    "music_items",
    "id,title,item_type,lifecycle_stage,planned_release_date,released_at,rights_state,metadata",
    input,
  ).eq("id", subject.id).maybeSingle();
  if (identityError) throw identityError;
  if (!identity?.id) return { status: "not_found", subject };

  const [plans, assets, identifiers, credits, splits, links] = await Promise.all([
    selectFocusedRows(db, "music_release_plans", "id,music_item_id,mission_id,status,approved_release_date,revision", input, [["music_item_id", subject.id]], 4),
    selectFocusedRows(db, "music_assets", "id,asset_type,title,status,version_label,notes,created_at", input, [["music_item_id", subject.id]], 60),
    selectFocusedRows(db, "music_identifiers", "id,identifier_type,identifier_value,confidence,created_at", input, [["music_item_id", subject.id]], 40),
    selectFocusedRows(db, "music_credits", "id,role,name,status,created_at", input, [["music_item_id", subject.id]], 60),
    selectFocusedRows(db, "music_splits", "id,status,summary,publishing_total,master_total,created_at", input, [["music_item_id", subject.id]], 20),
    selectFocusedRows(db, "artifact_links", "source_type,source_id,target_type,target_id,relationship,metadata,created_at", input, [["target_type", "music_item"], ["target_id", subject.id]], 100),
  ]);

  const plan = plans[0] as any | undefined;
  const releasePlanId = stringArg(plan?.id) || null;
  const missionId = stringArg(plan?.mission_id) || null;
  const [missions, tasks, bindings, managerOutputs] = await Promise.all([
    missionId
      ? selectFocusedRows(db, "missions", "id,title,status,pattern_name,summary,current_recommendation", input, [["id", missionId]], 1)
      : Promise.resolve([]),
    missionId
      ? selectFocusedRows(db, "tasks", "id,mission_id,title,status,deadline,schedule_key,owner_role,purpose", input, [["mission_id", missionId]], 80)
      : Promise.resolve([]),
    releasePlanId
      ? selectFocusedRows(db, "release_task_schedule_bindings", "id,task_id,offset_days,active,applied_plan_revision", input, [["release_plan_id", releasePlanId]], 80)
      : Promise.resolve([]),
    selectFocusedRows(db, "manager_outputs", "id,output_type,subject_type,subject_id,render_json,created_at", input, [["subject_type", "music_item"], ["subject_id", subject.id]], 60),
  ]);

  const musicAssets = (assets as any[]).filter((row) => row.music_item_id == null || row.music_item_id === subject.id);
  const musicIdentifiers = (identifiers as any[]).filter((row) => row.music_item_id == null || row.music_item_id === subject.id);
  const musicCredits = (credits as any[]).filter((row) => row.music_item_id == null || row.music_item_id === subject.id);
  const musicSplits = (splits as any[]).filter((row) => row.music_item_id == null || row.music_item_id === subject.id);
  const mission = (missions as any[])[0] ?? null;
  const missionTasks = (tasks as any[])
    .filter((task) => !["archived", "rejected", "superseded"].includes(stringArg(task.status).toLowerCase()))
    .sort((left, right) => stringArg(left.id).localeCompare(stringArg(right.id)));
  const bindingByTaskId = new Map((bindings as any[]).map((binding) => [stringArg(binding.task_id), binding]));
  const scheduleBindings = (bindings as any[])
    .map((binding) => {
      const task = missionTasks.find((candidate) => candidate.id === binding.task_id) ?? (tasks as any[]).find((candidate) => candidate.id === binding.task_id);
      return {
        taskId: stringArg(binding.task_id),
        title: stringArg(task?.title) || "Release task",
        deadline: typeof task?.deadline === "string" ? task.deadline : null,
        offsetDays: Number(binding.offset_days ?? 0),
        active: binding.active !== false,
        scheduleMode: "release_bound" as const,
        taskStatus: stringArg(task?.status) || "unknown",
      } satisfies ReleaseTaskScheduleBindingInput;
    })
    .filter((binding) => binding.taskId);
  const activeTasks = missionTasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    deadline: task.deadline ?? null,
    scheduleKey: task.schedule_key ?? null,
    ownerRole: task.owner_role ?? null,
    purpose: task.purpose ?? null,
    binding: bindingByTaskId.get(task.id) ?? null,
  }));

  const metadata = record(identity.metadata);
  const releaseSuccess = record(metadata.release_success);
  const campaign = normalizeCampaignConfig(releaseSuccess.campaign);
  const packet: ReleaseSuccessPacket & Record<string, unknown> = {
    musicItemId: identity.id,
    releasePlanId,
    releasePlanRevision: integerOrZero(plan?.revision),
    lifecycleStage: stringArg(identity.lifecycle_stage),
    releasedAt: stringOrNull(identity.released_at),
    providerReleaseDate: stringOrNull(identity.planned_release_date),
    approvedReleaseDate: stringOrNull(plan?.approved_release_date),
    today: new Date().toISOString().slice(0, 10),
    assets: {
      finalMaster: assetFact(musicAssets, "final_master"),
      artwork: assetFact(musicAssets, "cover_art") ?? assetFact(musicAssets, "alternate_artwork"),
    },
    metadata: factFromValue(releaseSuccess.metadata),
    credits: creditsFact(musicCredits),
    splits: splitsFact(musicSplits),
    clearances: factFromValue(releaseSuccess.clearances ?? metadata.clearances ?? identity.rights_state),
    identifiers: identifiersFact(musicIdentifiers),
    distributor: factFromValue(releaseSuccess.distributor ?? metadata.distributor) ?? assetFact(musicAssets, "distributor_export"),
    campaign,
    campaignFacts: normalizeCampaignFacts(releaseSuccess.campaignFacts),
    scheduleBindings,
    musicItem: {
      id: identity.id,
      title: identity.title,
      itemType: identity.item_type,
      lifecycleStage: identity.lifecycle_stage,
      rightsState: identity.rights_state ?? null,
    },
    releasePlan: plan
      ? { id: plan.id, status: plan.status, approvedReleaseDate: plan.approved_release_date ?? null, revision: integerOrZero(plan.revision), missionId }
      : null,
    mission,
    activeTasks,
    assetsRead: musicAssets.map(normalizeAsset),
    creditsRead: musicCredits,
    splitsRead: musicSplits,
    identifiersRead: musicIdentifiers.map((row) => ({ id: row.id, type: row.identifier_type, value: row.identifier_value, confidence: row.confidence })),
    clearancesRead: packetClearanceView(releaseSuccess, metadata, identity.rights_state),
    distributorRead: packetDistributorView(releaseSuccess, metadata, musicAssets),
    canonicalDocuments: { count: countCanonicalDocuments(links as any[]) },
    opportunityCounts: countOpportunities(links as any[], managerOutputs as any[]),
  };
  packet.assessment = assessReleaseSuccess(packet);

  if (packet.releasedAt || ["released", "catalog", "archived"].includes(packet.lifecycleStage)) {
    return { status: "found", packet: { ...packet, assessment: packet.assessment } };
  }
  return { status: "found", packet };
}

async function proposeFocusedReleaseDateChange(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const subject = requireFocusedMusicSubject(input);
  if (subject.type !== "music_item") return { status: "not_allowed", reason: "Release-date proposals are currently scoped to an attached song." };
  const packetResult = await readFocusedReleaseSuccess(db, input) as { status: string; packet?: ReleaseSuccessPacket & Record<string, unknown> };
  if (packetResult.status !== "found" || !packetResult.packet) return packetResult;
  const packet = packetResult.packet;
  if (packet.releasedAt || ["released", "catalog", "archived"].includes(packet.lifecycleStage)) {
    return { status: "not_allowed", reason: "Released and catalog music cannot receive a pre-release date proposal." };
  }
  const proposedDate = requiredIsoDate(args.proposedDate, "Proposed release date");
  const reason = requiredText(args.reason, "Release-date reason", 2_000);
  const preview = await createSchedulePreview({
    currentReleaseDate: packet.approvedReleaseDate ?? packet.providerReleaseDate,
    proposedReleaseDate: proposedDate,
    expectedRevision: packet.releasePlanRevision,
    bindings: packet.scheduleBindings ?? [],
  });
  if (!db.rpc) throw new Error("Release-date proposal command is unavailable.");
  const idempotencyKey = `manager:${subject.id}:${packet.releasePlanRevision}:${proposedDate}:${preview.previewHash?.slice(0, 24)}:${stableTextHash(reason)}`;
  const { data, error } = await db.rpc("propose_release_date_change", {
    p_account_id: input.accountId,
    p_artist_workspace_id: input.artistWorkspaceId,
    p_artist_id: input.artistId,
    p_music_item_id: subject.id,
    p_proposed_date: proposedDate,
    p_reason: reason,
    p_expected_plan_revision: packet.releasePlanRevision,
    p_preview: preview,
    p_preview_hash: preview.previewHash,
    p_expires_at: new Date(Date.now() + 30 * 60 * 1_000).toISOString(),
    p_idempotency_key: idempotencyKey,
    ...(input.userId ? { p_requested_by: input.userId } : {}),
  });
  if (error) throw error;
  return { status: "proposed", request: { ...record(data), preview, previewHash: preview.previewHash } };
}

async function queryFocusedReleaseOpportunities(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const subject = requireFocusedMusicSubject(input);
  if (subject.type !== "music_item") {
    return { status: "not_allowed", reason: "Playlist and press research is currently scoped to an attached song." };
  }
  const opportunityType = requiredOpportunityType(args.opportunityType);
  try {
    const context = await loadOpportunityContext(db, input, opportunityType);
    if (!context) return { status: "not_found", subject };
    return {
      status: "ready_for_research",
      song: context.song,
      evidence: context.evidence,
      existingOpportunities: context.existingOpportunities,
      searchPlan: {
        opportunityType,
        publicSourcesOnly: true,
        webSearchRequired: true,
        spotifyEditorialSeparate: opportunityType === "playlist",
        independentOutreachSeparate: opportunityType === "playlist",
        targetCount: { min: 5, max: 8 },
        preserveWatchTargets: true,
      },
    };
  } catch (error) {
    return failedOpportunityResult(error, input, "opportunity_search", "Playlist and press research could not be completed.");
  }
}

async function saveFocusedReleaseOpportunities(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const subject = requireFocusedMusicSubject(input);
  if (subject.type !== "music_item") {
    return { status: "not_allowed", reason: "Playlist and press research is currently scoped to an attached song." };
  }
  const opportunityType = requiredOpportunityType(args.opportunityType);
  const rawCandidates = Array.isArray(args.candidates) ? args.candidates : [];
  if (!rawCandidates.length) return { status: "no_matches", saved: [], watch: [], excluded: [], rejected: [] };
  if (rawCandidates.length > 12) throw new Error("A shortlist can contain at most 12 candidates.");

  // These are expected model-validation failures, not application failures. Do not
  // persist a source-less target or a contact that cannot be traced to a public page.
  rawCandidates.forEach((raw) => assertPublicOpportunityProvenance(record(raw)));

  let saved: ReleaseOpportunityBrief[] = [];
  const watch: ReleaseOpportunityBrief[] = [];
  const excluded: ReleaseOpportunityBrief[] = [];
  const rejected: Array<{ targetName: string; reason: string }> = [];
  try {
    const context = await loadOpportunityContext(db, input, opportunityType);
    if (!context) return { status: "not_found", subject };
    const planRows = await selectFocusedRows(
      db,
      "music_release_plans",
      "mission_id",
      input,
      [["music_item_id", subject.id]],
      1,
    );
    const missionId = stringArg((planRows as any[])[0]?.mission_id) || null;

    const normalizedCandidates = dedupeOpportunityCandidates(rawCandidates.map((raw) => {
      const source = record(raw);
      if (!isRecord(source.fit) || !Array.isArray(source.sourceEvidence) || !source.sourceEvidence.length) {
        throw new OpportunityCandidateError("Candidate fit and source evidence are required.");
      }
      return toOpportunityCandidate(source, opportunityType);
    }));

    for (const candidate of normalizedCandidates) {
      // Spotify editorial is a pitch/handoff route. Never carry an editor email
      // into the record, even if a model tries to attach one.
      if (isSpotifyEditorial(candidate)) candidate.publicContact = undefined;
      const brief = normalizeOpportunityBrief(candidate, context.song);
      if (!brief) {
        rejected.push({ targetName: candidate.targetName || "Unnamed target", reason: "The candidate lacks song-specific fit or public evidence." });
        continue;
      }
      if (brief.safetyState === "excluded") excluded.push(brief);
      else {
        saved.push(brief);
        if (brief.status === "watch") watch.push(brief);
      }
    }

    if (saved.length) {
      const rows = saved.map((brief) => opportunityRow(brief, input, subject.id, missionId));
      const { error } = await db.from("release_opportunities")
        .upsert(rows, { onConflict: "music_item_id,opportunity_type,dedupe_key" })
        .select("id");
      if (error) throw error;
      await writeWorkspaceEvent(db, {
        accountId: input.accountId,
        artistWorkspaceId: input.artistWorkspaceId,
        artistId: input.artistId,
        eventType: "release_opportunities_saved",
        targetType: "music_item",
        targetId: subject.id,
        dedupeKey: `release-opportunities:${subject.id}:${opportunityType}:${stableTextHash(saved.map((item) => item.dedupeKey).sort().join("|"))}`,
        summary: `${saved.length} ${opportunityType} research target${saved.length === 1 ? "" : "s"} saved for review.`,
        refreshScope: ["music", "missions", "conversations"],
        payload: {
          opportunityType,
          saved: saved.map((item) => ({ targetName: item.targetName, dedupeKey: item.dedupeKey, status: item.status })),
          excluded: excluded.map((item) => ({ targetName: item.targetName, reason: "unsafe placement claim" })),
        },
      });
    }

    return {
      status: saved.length ? "saved" : "no_matches",
      musicItemId: subject.id,
      missionId: missionId || undefined,
      saved,
      watch,
      excluded,
      rejected,
      handoffs: saved.filter(isSpotifyEditorial).map((item) => ({
        targetName: item.targetName,
        kind: "pitch",
        nextAction: "Prepare a song-specific editorial pitch for the platform's official route.",
        contact: null,
      })),
    };
  } catch (error) {
    const failure = await failedOpportunityResult(error, input, error instanceof OpportunityCandidateError ? "contact_verification" : "opportunity_persistence", "Release targets could not be saved safely.");
    return {
      ...failure,
      musicItemId: subject.id,
      saved,
      watch,
      excluded,
      rejected,
    };
  }
}

async function recordFocusedReleaseOpportunityOutcome(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const subject = requireFocusedMusicSubject(input);
  if (subject.type !== "music_item") {
    return { status: "not_allowed", reason: "Opportunity outcomes are currently scoped to an attached song." };
  }
  const opportunityId = requiredText(args.opportunityId, "Opportunity ID", 120);
  const outcome = requiredOpportunityStatus(args.status);
  const manualOutcome = requiredText(args.manualOutcome, "Manual outcome", 2_000);
  const { data, error } = await scopedUpdate(db, "release_opportunities", {
    status: outcome,
    manual_outcome: manualOutcome,
  }, input)
    .eq("id", opportunityId)
    .eq("music_item_id", subject.id)
    .select("id,status,manual_outcome")
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) return { status: "not_found", opportunityId };
  await writeMusicManagerEvent(db, input, {
    eventType: "release_opportunity_outcome_recorded",
    subject,
    summary: `Recorded the ${outcome.replace(/_/g, " ")} outcome for a release target.`,
    payload: { opportunityId, outcome, manualOutcome },
  });
  return { status: "recorded", opportunityId, outcome, manualOutcome };
}

async function createFocusedSongDocument(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const subject = requireFocusedMusicSubject(input);
  if (subject.type !== "music_item") {
    return { status: "not_allowed", reason: "Song documents are currently scoped to an attached song." };
  }
  const documentType = requiredSongDocumentType(args.documentType);
  const title = requiredText(args.title, "Document title", 240);
  const body = requiredText(args.body, "Document body", 60_000);
  try {
    const persisted = await persistFocusedSongDocumentDraft(
      db,
      { ...input, body: `Create a draft ${documentType} titled ${title}.`, documentType, title },
      input.runId ?? `manager-document-${subject.id}`,
      body,
      false,
    );
    return { ...persisted, status: "drafted", musicItemId: subject.id, documentType, title };
  } catch (error) {
    return failedOpportunityResult(error, input, "opportunity_persistence", "The song document could not be saved.");
  }
}

async function loadOpportunityContext(db: SupabaseLike, input: ManagerToolInput, opportunityType: "playlist" | "press") {
  const subject = requireFocusedMusicSubject(input);
  const { data: identity, error: identityError } = await scopedQuery(
    db,
    "music_items",
    "id,title,item_type,lifecycle_stage,metadata",
    input,
  ).eq("id", subject.id).maybeSingle();
  if (identityError) throw identityError;
  if (!identity?.id) return null;

  const [evidenceRows, opportunityRows] = await Promise.all([
    selectFocusedRows(
      db,
      "evidence_items",
      "id,source,source_kind,evidence_type,subject_type,subject_id,subject_label,provenance,confidence,limitation,raw_ref,created_at",
      input,
      [["subject_type", "music_item"], ["subject_id", subject.id]],
      40,
    ),
    selectFocusedRows(
      db,
      "release_opportunities",
      "id,music_item_id,opportunity_type,platform,target_name,source_url,target_url,public_organization,contact_kind,public_contact_value,public_contact_source_url,contact_verified_at,fit_json,evidence_json,confidence,limitations_json,safety_state,requirements_json,package_json,status,manual_outcome,dedupe_key,created_at,updated_at",
      input,
      [["music_item_id", subject.id], ["opportunity_type", opportunityType]],
      40,
    ),
  ]);

  return {
    song: opportunitySongContext(identity),
    evidence: (evidenceRows as any[]).map(normalizeOpportunityEvidence),
    existingOpportunities: (opportunityRows as any[]).map(normalizeExistingOpportunity),
  };
}

function opportunitySongContext(identity: any): ReleaseOpportunitySongContext {
  const metadata = record(identity.metadata);
  const details = record(metadata.manual_details);
  return {
    musicItemId: stringArg(identity.id),
    title: stringArg(identity.title),
    genres: firstStringList(details, metadata, ["genre", "genres", "style"]),
    moods: firstStringList(details, metadata, ["mood", "moods", "tone"]),
    markets: firstStringList(details, metadata, ["market", "markets", "territory", "territories"]),
    comparableArtists: firstStringList(details, metadata, ["comparable_artist", "comparable_artists", "similar_artists"]),
    artistStage: stringArg(identity.lifecycle_stage) || undefined,
  };
}

function firstStringList(primary: Record<string, unknown>, secondary: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const values = stringList(primary[key] ?? secondary[key]);
    if (values.length) return values;
  }
  return [];
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.map(stringArg).filter(Boolean).slice(0, 12);
  return stringArg(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeOpportunityEvidence(row: any) {
  return {
    id: row.id,
    source: row.source,
    sourceKind: row.source_kind,
    evidenceType: row.evidence_type,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    subject: row.subject_label,
    provenance: row.provenance,
    confidence: row.confidence,
    limitation: row.limitation,
    rawRef: row.raw_ref,
    createdAt: row.created_at,
  };
}

function normalizeExistingOpportunity(row: any) {
  return {
    id: row.id,
    opportunityType: row.opportunity_type,
    platform: row.platform,
    targetName: row.target_name,
    sourceUrl: row.source_url,
    targetUrl: row.target_url,
    publicOrganization: row.public_organization,
    publicContact: row.contact_kind && row.public_contact_value
      ? { kind: row.contact_kind, value: row.public_contact_value, sourceUrl: row.public_contact_source_url, verifiedAt: row.contact_verified_at }
      : undefined,
    fit: row.fit_json,
    sourceEvidence: row.evidence_json,
    confidence: row.confidence,
    limitations: row.limitations_json,
    safetyState: row.safety_state,
    requirements: row.requirements_json,
    package: row.package_json,
    status: row.status,
    manualOutcome: row.manual_outcome,
    dedupeKey: row.dedupe_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toOpportunityCandidate(source: Record<string, unknown>, defaultType: "playlist" | "press"): ReleaseOpportunityCandidate {
  const fit = source.fit as Record<string, unknown>;
  const publicContact = isRecord(source.publicContact) ? source.publicContact : undefined;
  return {
    opportunityType: source.opportunityType === "press" || source.opportunityType === "playlist" ? source.opportunityType : defaultType,
    platform: stringArg(source.platform) || undefined,
    targetName: stringArg(source.targetName),
    sourceUrl: stringArg(source.sourceUrl),
    targetUrl: stringArg(source.targetUrl) || undefined,
    publicOrganization: stringArg(source.publicOrganization) || undefined,
    publicContact: publicContact
      ? {
          kind: publicContact.kind as "email" | "submission_form" | "contact_page",
          value: stringArg(publicContact.value),
          sourceUrl: stringArg(publicContact.sourceUrl),
          verifiedAt: stringArg(publicContact.verifiedAt) || undefined,
        }
      : undefined,
    fit: {
      songCriteria: stringList(fit.songCriteria),
      targetCriteria: stringList(fit.targetCriteria),
      explanation: stringArg(fit.explanation),
      recency: stringArg(fit.recency) || undefined,
      market: stringArg(fit.market) || undefined,
    },
    sourceEvidence: (source.sourceEvidence as any[]).map((item) => {
      const evidence = record(item);
      return { source: stringArg(evidence.source), ref: stringArg(evidence.ref) || undefined, observedAt: stringArg(evidence.observedAt) || undefined };
    }),
    confidence: ["high", "medium", "low", "unknown"].includes(stringArg(source.confidence))
      ? stringArg(source.confidence) as ReleaseOpportunityCandidate["confidence"]
      : "unknown",
    limitations: stringList(source.limitations),
    paidPlacementClaim: source.paidPlacementClaim === true,
    requirements: stringList(source.requirements),
  };
}

function opportunityRow(brief: ReleaseOpportunityBrief, input: ManagerToolInput, musicItemId: string, missionId: string | null) {
  return {
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    music_item_id: musicItemId,
    mission_id: missionId,
    opportunity_type: brief.opportunityType,
    platform: brief.platform ?? null,
    target_name: brief.targetName,
    source_url: brief.sourceUrl,
    target_url: brief.targetUrl ?? null,
    public_organization: brief.publicOrganization ?? null,
    contact_kind: brief.publicContact?.kind ?? null,
    public_contact_value: brief.publicContact?.value ?? null,
    public_contact_source_url: brief.publicContact?.sourceUrl ?? null,
    contact_verified_at: brief.publicContact?.verifiedAt ?? null,
    fit_json: brief.fit,
    evidence_json: brief.sourceEvidence,
    confidence: brief.confidence,
    limitations_json: brief.limitations,
    safety_state: brief.safetyState,
    requirements_json: brief.requirements ?? [],
    package_json: { handoffOnly: true, sendEnabled: false },
    status: brief.status,
    dedupe_key: brief.dedupeKey,
  };
}

function assertPublicOpportunityProvenance(source: Record<string, unknown>) {
  if (!normalizePublicUrl(stringArg(source.sourceUrl))) throw new Error("A public HTTPS source URL is required for opportunity provenance.");
  if (source.publicContact == null) return;
  const contact = record(source.publicContact);
  const sourceUrl = normalizePublicUrl(stringArg(contact.sourceUrl));
  if (!sourceUrl) throw new Error("A public contact must include its source URL.");
  const kind = stringArg(contact.kind);
  const value = stringArg(contact.value);
  const validValue = kind === "email" ? normalizePublicEmail(value) : normalizePublicUrl(value);
  if (!validValue || !stringArg(contact.verifiedAt)) throw new Error("A public contact must be verifiable from its cited source.");
}

function isSpotifyEditorial(candidate: Pick<ReleaseOpportunityCandidate, "platform" | "targetName">) {
  return /spotify\s+editorial|spotify\s+for\s+artists|editorial\s+playlist/i.test(`${candidate.platform ?? ""} ${candidate.targetName}`);
}

function requiredOpportunityType(value: unknown): "playlist" | "press" {
  const type = stringArg(value).toLowerCase();
  if (type !== "playlist" && type !== "press") throw new Error("Opportunity type must be playlist or press.");
  return type;
}

function requiredOpportunityStatus(value: unknown) {
  const status = stringArg(value).toLowerCase();
  if (!["watch", "shortlisted", "approved", "submitted_manually", "replied", "accepted", "declined", "skipped"].includes(status)) {
    throw new Error("Opportunity outcome is invalid.");
  }
  return status;
}

function requiredSongDocumentType(value: unknown) {
  const type = stringArg(value).toLowerCase();
  if (!["epk", "spotify_editorial_pitch", "playlist_pitch", "press_target_brief", "press_pitch", "content_plan", "release_calendar", "press_release", "press_angle", "artist_biography", "one_sheet", "lyrics", "credits", "distributor_notes"].includes(type)) {
    throw new Error("Song document type is invalid.");
  }
  return type;
}

class OpportunityCandidateError extends Error {}

async function failedOpportunityResult(error: unknown, input: ManagerToolInput, stage: "opportunity_search" | "contact_verification" | "opportunity_persistence", publicMessage: string) {
  const errorEventId = await captureAppError(error, {
    functionName: "manager-conversation-tool-executor",
    operation: "release_opportunity_workflow",
    source: "edge",
    publicMessage,
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    refs: {
      conversation_id: input.conversationId,
      manager_run_id: input.runId,
      music_item_id: input.musicSubject?.type === "music_item" ? input.musicSubject.id : null,
      stage,
    },
  });
  return { status: "failed", stage, retryable: true, reference: errorEventId ?? undefined };
}

async function updateFocusedMusicMetadata(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const subject = requireFocusedMusicSubject(input);
  const group = requiredText(args.group, "Metadata group", 100);
  const label = requiredText(args.label, "Metadata label", 120);
  const value = requiredText(args.value, "Metadata value", 2_000);
  const target = musicTarget(subject);
  const { data: current, error: readError } = await scopedQuery(db, target.table, "id,metadata", input)
    .eq("id", subject.id)
    .maybeSingle();
  if (readError) throw readError;
  if (!current?.id) return { status: "not_found", subjectId: subject.id };

  const key = normalizeManualDetailKey(label);
  const metadata = record(current.metadata);
  const manual = record(metadata.manual_details);
  const groups = record(metadata.manual_detail_groups);
  const nextMetadata = {
    ...metadata,
    manual_details: { ...manual, [key]: value },
    manual_detail_groups: { ...groups, [key]: group },
  };
  const updateValues: Record<string, unknown> = { metadata: nextMetadata };
  if (subject.type === "music_item" && key === "song_title") updateValues.title = value;
  const { error: updateError } = await scopedUpdate(db, target.table, updateValues, input)
    .eq("id", subject.id);
  if (updateError) throw updateError;
  await writeMusicManagerEvent(db, input, {
    eventType: "music_metadata_updated",
    subject,
    summary: `Manager updated ${label} metadata.`,
    payload: { group, label, value, key },
  });
  return { status: "updated", subjectId: subject.id, detail: { group, label, key, value } };
}

async function updateFocusedMusicLifecycle(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const subject = requireFocusedMusicSubject(input);
  const lifecycleStage = requiredLifecycleStage(args.lifecycleStage);
  const target = musicTarget(subject);
  const { data: current, error: readError } = await scopedQuery(db, target.table, "id,lifecycle_stage,released_at", input)
    .eq("id", subject.id)
    .maybeSingle();
  if (readError) throw readError;
  if (!current?.id) return { status: "not_found", subjectId: subject.id };
  if (current.released_at || isReleasedLifecycle(current.lifecycle_stage)) {
    return { status: "not_allowed", reason: "Released and catalog music is managed through post-release work, not pre-release stage changes." };
  }
  const { error: updateError } = await scopedUpdate(db, target.table, { lifecycle_stage: lifecycleStage }, input)
    .eq("id", subject.id);
  if (updateError) throw updateError;
  await writeMusicManagerEvent(db, input, {
    eventType: "music_lifecycle_updated",
    subject,
    summary: `Manager moved this ${subject.type === "music_item" ? "song" : "project"} to ${lifecycleStage}.`,
    payload: { lifecycleStage },
  });
  return { status: "updated", subjectId: subject.id, lifecycleStage };
}

async function ensureSongReleaseWorkspace(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const title = requiredText(args.title, "Song title", 180);
  const lifecycleStage = requiredLifecycleStage(args.lifecycleStage);
  if (!input.conversationId) throw new Error("A release workspace can only be created from a Manager conversation.");
  if (!input.runId) throw new Error("Manager run context is required to create a release workspace.");
  if (!db.rpc) throw new Error("Manager release workspace command is unavailable.");

  const copy = manualSongWorkspaceCopy({ title, lifecycleStage });
  const { data, error } = await db.rpc("create_conversational_song_workspace_v2", {
    p_account_id: input.accountId,
    p_artist_workspace_id: input.artistWorkspaceId,
    p_artist_id: input.artistId,
    p_request_id: input.runId,
    p_title: title,
    p_item_type: "song",
    p_lifecycle_stage: lifecycleStage,
    p_mission_title: copy.missionTitle,
    p_mission_objective: copy.missionObjective,
    p_mission_summary: copy.missionSummary,
    p_checkpoint_title: copy.checkpointTitle,
    p_checkpoint_question: copy.checkpointQuestion,
    p_checkpoint_decision_rule: copy.checkpointDecisionRule,
    p_first_task_title: copy.firstTaskTitle,
    p_first_task_purpose: copy.firstTaskPurpose,
    p_opening_message: copy.openingMessage,
    p_conversation_id: input.conversationId,
  });
  if (error) throw error;
  const workspace = record(data);
  const songId = stringArg(workspace.songId);
  const missionId = stringArg(workspace.missionId);
  const taskId = stringArg(workspace.taskId);
  const songTitle = stringArg(workspace.songTitle) || title;
  const committedLifecycleStage = stringArg(workspace.lifecycleStage) || lifecycleStage;
  if (!songId || !missionId || !taskId) throw new Error("Release workspace creation returned an incomplete workspace.");

  input.musicSubject = { type: "music_item", id: songId };
  const receipts: ManagerConversationCreatedWork[] = [
    {
      type: "music_item",
      id: songId,
      title: songTitle,
      body: "Song Workspace created. Files, Details, Rights, and release planning now share this conversation.",
      status: "created",
    },
    {
      type: "mission",
      id: missionId,
      title: copy.missionTitle,
      body: copy.missionSummary,
      status: "created",
    },
    {
      type: "task",
      id: taskId,
      parentMissionId: missionId,
      title: copy.firstTaskTitle,
      body: copy.firstTaskPurpose,
      status: "created",
    },
  ];
  for (const receipt of receipts) {
    if (!input.createdWork?.some((work) => work.type === receipt.type && work.id === receipt.id)) {
      input.createdWork?.push(receipt);
    }
  }

  return {
    status: "ready",
    subject: { type: "music_item", id: songId, title: songTitle, lifecycleStage: committedLifecycleStage },
    workspace: { songId, missionId, taskId, conversationId: input.conversationId },
  };
}

function requireFocusedMusicSubject(input: ManagerToolInput) {
  if (input.musicSubject?.id && (input.musicSubject.type === "music_item" || input.musicSubject.type === "music_project")) {
    return input.musicSubject;
  }
  throw new Error("This action requires a focused music conversation.");
}

function musicTarget(subject: NonNullable<ManagerToolInput["musicSubject"]>) {
  return subject.type === "music_item"
    ? { table: "music_items", foreignKey: "music_item_id" }
    : { table: "music_projects", foreignKey: "music_project_id" };
}

async function writeMusicManagerEvent(
  db: SupabaseLike,
  input: ManagerToolInput,
  value: { eventType: string; subject: NonNullable<ManagerToolInput["musicSubject"]>; summary: string; payload: Record<string, unknown> },
) {
  await writeWorkspaceEvent(db, {
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    eventType: value.eventType,
    targetType: value.subject.type,
    targetId: value.subject.id,
    summary: value.summary,
    refreshScope: ["music"],
    payload: {
      ...value.payload,
      source: "manager_conversation",
      conversationId: input.conversationId ?? "",
      runId: input.runId ?? "",
    },
  });
}

function manualDetails(value: unknown) {
  const metadata = record(value);
  const details = record(metadata.manual_details);
  const groups = record(metadata.manual_detail_groups);
  return Object.entries(details).slice(0, 100).map(([key, detailValue]) => ({ key, value: stringArg(detailValue), group: stringArg(groups[key]) }));
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = stringArg(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} is too long.`);
  return text;
}

const SAFE_MANAGER_LIFECYCLE_STAGES = new Set(["idea", "recording", "production", "mixing", "mastering", "ready", "scheduled"]);

function requiredLifecycleStage(value: unknown) {
  const lifecycleStage = stringArg(value).toLowerCase();
  if (!SAFE_MANAGER_LIFECYCLE_STAGES.has(lifecycleStage)) {
    throw new Error("Manager can only set verified internal unreleased lifecycle stages.");
  }
  return lifecycleStage;
}

function isReleasedLifecycle(value: unknown) {
  const lifecycleStage = stringArg(value).toLowerCase();
  return lifecycleStage === "released" || lifecycleStage === "catalog";
}

function normalizeCampaignConfig(value: unknown): ReleaseSuccessPacket["campaign"] {
  const source = record(value);
  return {
    spotifyEditorialEnabled: booleanOrUndefined(source.spotifyEditorialEnabled ?? source.spotify_editorial_enabled),
    independentPlaylistsEnabled: booleanOrUndefined(source.independentPlaylistsEnabled ?? source.independent_playlists_enabled),
    pressEnabled: booleanOrUndefined(source.pressEnabled ?? source.press_enabled),
    contentEnabled: booleanOrUndefined(source.contentEnabled ?? source.content_enabled),
    postReleaseMeasurementEnabled: booleanOrUndefined(source.postReleaseMeasurementEnabled ?? source.post_release_measurement_enabled),
  };
}

function normalizeCampaignFacts(value: unknown): ReleaseSuccessPacket["campaignFacts"] {
  const source = record(value);
  return {
    spotifyEditorialPitch: factFromValue(source.spotifyEditorialPitch ?? source.spotify_editorial_pitch),
    independentPlaylistTargets: factFromValue(source.independentPlaylistTargets ?? source.independent_playlist_targets),
    pressPackage: factFromValue(source.pressPackage ?? source.press_package),
    contentPlan: factFromValue(source.contentPlan ?? source.content_plan),
    postReleaseMeasurement: factFromValue(source.postReleaseMeasurement ?? source.post_release_measurement),
  };
}

function factFromValue(value: unknown, fallbackSource = "release_success_packet"): ReleaseFact | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") {
    return { state: factStateFromText(value), source: fallbackSource, detail: value };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  return {
    state: factStateFromText(source.state),
    source: stringArg(source.source) || fallbackSource,
    ref: stringArg(source.ref) || undefined,
    observedAt: stringArg(source.observedAt ?? source.observed_at) || undefined,
    detail: stringArg(source.detail) || undefined,
  };
}

function assetFact(rows: any[], assetType: string): ReleaseFact | undefined {
  const row = rows.find((candidate) => stringArg(candidate.asset_type).toLowerCase() === assetType);
  if (!row) return undefined;
  return {
    state: assetStatusToFactState(row.status),
    source: "music_assets",
    ref: stringArg(row.id) || undefined,
    observedAt: stringArg(row.created_at) || undefined,
    detail: stringArg(row.title) || undefined,
  };
}

function creditsFact(rows: any[]): ReleaseFact {
  if (!rows.length) return { state: "missing", source: "music_credits" };
  const statuses = rows.map((row) => stringArg(row.status).toLowerCase());
  return {
    state: statuses.every((status) => ["confirmed", "cleared", "approved"].includes(status)) ? "confirmed" : "pending",
    source: "music_credits",
    detail: `${rows.length} credit record${rows.length === 1 ? "" : "s"} supplied.`,
  };
}

function splitsFact(rows: any[]): ReleaseFact {
  if (!rows.length) return { state: "missing", source: "music_splits" };
  const statuses = rows.map((row) => stringArg(row.status).toLowerCase());
  return {
    state: statuses.every((status) => ["confirmed", "cleared", "approved"].includes(status))
      ? "confirmed"
      : statuses.some((status) => ["pending", "draft"].includes(status)) ? "pending" : "unknown",
    source: "music_splits",
    detail: `${rows.length} split record${rows.length === 1 ? "" : "s"} supplied.`,
  };
}

function identifiersFact(rows: any[]): ReleaseFact {
  const applicable = rows.filter((row) => ["isrc", "upc", "distributor_id"].includes(stringArg(row.identifier_type).toLowerCase()));
  return applicable.length
    ? { state: "confirmed", source: "music_identifiers", detail: `${applicable.length} applicable identifier${applicable.length === 1 ? "" : "s"} recorded.` }
    : { state: "missing", source: "music_identifiers" };
}

function normalizeAsset(row: any) {
  return {
    id: row.id,
    assetType: row.asset_type,
    title: row.title,
    status: row.status,
    versionLabel: row.version_label ?? null,
    notes: row.notes ?? null,
  };
}

function packetClearanceView(releaseSuccess: Record<string, unknown>, metadata: Record<string, unknown>, rightsState: unknown) {
  return factFromValue(releaseSuccess.clearances ?? metadata.clearances ?? rightsState, "music_items.rights_state")
    ?? { state: "unknown", source: "music_items.rights_state" };
}

function packetDistributorView(releaseSuccess: Record<string, unknown>, metadata: Record<string, unknown>, assets: any[]) {
  return factFromValue(releaseSuccess.distributor ?? metadata.distributor, "music_items.metadata")
    ?? assetFact(assets, "distributor_export")
    ?? { state: "unknown", source: "music_items.metadata" };
}

function countCanonicalDocuments(links: any[]) {
  return new Set(links
    .filter((link) => stringArg(link.source_type).toLowerCase() === "document" && stringArg(link.relationship).toLowerCase() === "references")
    .map((link) => stringArg(link.source_id))
    .filter(Boolean)).size;
}

function countOpportunities(links: any[], outputs: any[]) {
  const seen = new Set<string>();
  const counts = { playlist: 0, press: 0, total: 0 };
  const add = (kind: string, id: string) => {
    const normalizedKind = kind.toLowerCase();
    const normalizedId = id || `${normalizedKind}:${counts.total}`;
    const key = `${normalizedKind}:${normalizedId}`;
    if (seen.has(key)) return;
    if (!normalizedKind.includes("playlist") && !normalizedKind.includes("press") && !normalizedKind.includes("media")) return;
    seen.add(key);
    if (normalizedKind.includes("playlist")) counts.playlist += 1;
    else counts.press += 1;
    counts.total += 1;
  };
  for (const link of links) {
    const sourceType = stringArg(link.source_type).toLowerCase();
    if (!sourceType.includes("opportunity") && !sourceType.includes("playlist") && !sourceType.includes("press") && !sourceType.includes("media")) continue;
    const metadata = record(link.metadata);
    add(stringArg(link.opportunity_type) || stringArg(metadata.opportunityType) || `${sourceType}:${stringArg(link.source_id)}`, stringArg(link.source_id));
  }
  for (const output of outputs) {
    if (stringArg(output.output_type) !== "release_opportunity_brief") continue;
    const render = record(output.render_json);
    add(stringArg(render.opportunityType ?? render.opportunity_type), stringArg(output.id));
  }
  return counts;
}

function factStateFromText(value: unknown): ReleaseFact["state"] {
  const normalized = stringArg(value).toLowerCase();
  if (["confirmed", "cleared", "approved", "complete", "declared", "accepted"].includes(normalized)) return "confirmed";
  if (["missing", "required", "blocked"].includes(normalized)) return "missing";
  if (["pending", "in_review", "awaiting_approval"].includes(normalized)) return "pending";
  if (["draft", "planned"].includes(normalized)) return "draft";
  if (normalized === "uploaded") return "uploaded";
  if (["not_applicable", "n/a"].includes(normalized)) return "not_applicable";
  return "unknown";
}

function assetStatusToFactState(value: unknown): ReleaseFact["state"] {
  return factStateFromText(value);
}

function booleanOrUndefined(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function integerOrZero(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredIsoDate(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} is invalid.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${label} is invalid.`);
  return value;
}

function stableTextHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function releaseManagementMode(value: { lifecycle_stage?: unknown; released_at?: unknown; planned_release_date?: unknown }) {
  if (value.released_at || isReleasedLifecycle(value.lifecycle_stage)) return "post_release";
  if (stringArg(value.lifecycle_stage).toLowerCase() === "scheduled" || stringArg(value.planned_release_date)) return "release_window";
  return "pre_release";
}

function hasReadyAsset(rows: any[], types: string[]) {
  return rows.some((row) => types.includes(stringArg(row.asset_type)) && ["uploaded", "confirmed", "cleared"].includes(stringArg(row.status).toLowerCase()));
}

function hasReleaseDate(plannedReleaseDate: unknown, manual: Record<string, unknown>) {
  return Boolean(stringArg(plannedReleaseDate) || stringArg(manual.release_date) || stringArg(manual.planned_release_date));
}

function hasIdentifier(rows: any[], type: string) {
  return rows.some((row) => stringArg(row.identifier_type) === type && Boolean(stringArg(row.identifier_value)));
}

function normalizeManualDetailKey(label: string) {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "detail";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function selectScoped(db: SupabaseLike, table: string, columns: string, input: ManagerToolInput, limit: number) {
  const { data, error } = await scopedQuery(db, table, columns, input)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function selectFocusedRows(
  db: SupabaseLike,
  table: string,
  columns: string,
  input: ManagerToolInput,
  filters: Array<[string, unknown]>,
  limit: number,
) {
  let query = scopedQuery(db, table, columns, input);
  for (const [column, value] of filters) query = query.eq(column, value);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

function scopedQuery(db: SupabaseLike, table: string, columns: string, input: ManagerToolInput) {
  return db
    .from(table)
    .select(columns)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId);
}

function scopedUpdate(db: SupabaseLike, table: string, values: Record<string, unknown>, input: ManagerToolInput) {
  return db
    .from(table)
    .update(values)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId);
}

async function selectMissionChildren(db: SupabaseLike, table: string, columns: string, input: ManagerToolInput, missionIds: string[]) {
  const { data, error } = await scopedQuery(db, table, columns, input)
    .in("mission_id", missionIds)
    .limit(80);
  if (error) throw error;
  return data ?? [];
}

function filterRows(rows: any[], args: Record<string, unknown>) {
  const query = stringArg(args.query).toLowerCase();
  const category = stringArg(args.category).toLowerCase();
  const subjectType = stringArg(args.subjectType);
  const subjectId = stringArg(args.subjectId);
  return rows
    .filter((row) => !subjectType || row.subject_type === subjectType || row.kind === subjectType)
    .filter((row) => !subjectId || row.subject_id === subjectId || row.id === subjectId)
    .filter((row) => !category || haystack(row).includes(category))
    .filter((row) => !query || haystack(row).includes(query));
}

function applyExactSubjectFilters(query: any, args: Record<string, unknown>) {
  const subjectType = stringArg(args.subjectType);
  const subjectId = stringArg(args.subjectId);
  if (subjectType) query = query.eq("subject_type", subjectType);
  if (subjectId) query = query.eq("subject_id", subjectId);
  return query;
}

function haystack(row: unknown) {
  return JSON.stringify(row ?? {}).toLowerCase();
}

function numberArg(value: unknown, fallback: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), max) : fallback;
}

function stringArg(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOutputText(row: any) {
  const render = row?.render_json && typeof row.render_json === "object" ? row.render_json : {};
  if (typeof render.content === "string" && render.content.trim()) return render.content.trim();
  const recommendation = row?.primary_recommendation_json && typeof row.primary_recommendation_json === "object"
    ? row.primary_recommendation_json.recommendation
    : "";
  if (typeof recommendation === "string" && recommendation.trim()) return recommendation.trim();
  return typeof row?.summary === "string" ? row.summary.trim() : "";
}

function selectOutputSection(content: string, query: string) {
  if (!content || !query) return content;
  const index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return content;
  const sectionStart = Math.max(0, content.lastIndexOf("\n\n", index));
  const firstBreak = content.indexOf("\n\n", index + query.length);
  const nextBreak = firstBreak < 0 ? -1 : content.indexOf("\n\n", firstBreak + 2);
  return content.slice(sectionStart, nextBreak < 0 ? content.length : nextBreak).trim();
}
