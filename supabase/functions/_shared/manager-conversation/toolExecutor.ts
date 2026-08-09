import { writeWorkspaceEvent } from "../workspaceEvents.ts";
import { manualSongWorkspaceCopy } from "../manualSongWorkspace.ts";
import { executeDiscoveryTool } from "../manager-agent/discoveryTools.ts";
import type { ManagerConversationCreatedWork } from "../openaiManagerConversation.ts";

type ManagerToolInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  conversationId?: string;
  runId?: string;
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
