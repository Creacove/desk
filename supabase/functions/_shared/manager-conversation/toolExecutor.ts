type ManagerToolInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
};

type SupabaseLike = {
  from(table: string): any;
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
  throw new Error(`Unsupported Manager tool: ${name}`);
}

async function queryEvidenceItems(db: SupabaseLike, input: ManagerToolInput, args: Record<string, unknown>) {
  const rows = await selectScoped(db, "evidence_items", [
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
  ].join(","), input, numberArg(args.limit, 16, 40));
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
  const rows = await selectScoped(db, "manager_outputs", "id,output_type,subject_type,subject_id,summary,primary_recommendation_json,avoid_json,confidence_json,supporting_evidence_json,created_at", input, numberArg(args.limit, 10, 30));
  const outputType = stringArg(args.outputType);
  const subjectType = stringArg(args.subjectType);
  const subjectId = stringArg(args.subjectId);
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
