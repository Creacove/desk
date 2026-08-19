const DAY_MS = 24 * 60 * 60 * 1000;

export type OperatingBriefContextInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
};

export async function maybeRefreshChartmetricArtistForTodaysBrief(args: {
  db: any;
  input: OperatingBriefContextInput;
  authHeader: string;
  supabaseUrl: string;
}) {
  const { data, error } = await args.db
    .from("source_sync_jobs")
    .select("id,completed_at")
    .eq("account_id", args.input.accountId)
    .eq("artist_workspace_id", args.input.artistWorkspaceId)
    .eq("artist_id", args.input.artistId)
    .eq("job_type", "chartmetric_artist_enrichment")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1);
  if (error) throw error;

  const completedAt = typeof data?.[0]?.completed_at === "string" ? Date.parse(data[0].completed_at) : NaN;
  if (Number.isFinite(completedAt) && Date.now() - completedAt < DAY_MS) {
    return { attempted: false, refreshed: false, reason: "fresh" as const };
  }

  try {
    const response = await fetch(`${args.supabaseUrl}/functions/v1/chartmetric-artist-enrichment`, {
      method: "POST",
      headers: {
        Authorization: args.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...args.input,
        skipTodaysBriefHandoff: true,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn("Today's Brief Chartmetric refresh failed; using last saved evidence.", {
        status: response.status,
        body: body.slice(0, 240),
      });
      return { attempted: true, refreshed: false, reason: "failed" as const };
    }
    return { attempted: true, refreshed: true, reason: "refreshed" as const };
  } catch (error) {
    console.warn("Today's Brief Chartmetric refresh failed; using last saved evidence.", { error });
    return { attempted: true, refreshed: false, reason: "failed" as const };
  }
}

export async function loadTodaysBriefOperatingContext(db: any, input: OperatingBriefContextInput) {
  const [missions, tasks, conversations, memory, agentReports, events, currentMusicReads, previousBrief] = await Promise.all([
    selectMany(db, "missions", "id,title,objective,reason,status,priority,progress,summary,current_recommendation,required_evidence,missing_evidence,review_point,created_at", input, 8),
    selectMany(db, "tasks", "id,mission_id,primary_checkpoint_id,title,status,owner_role,work_mode,purpose,deadline,priority,approval_state,dependency,evidence_needed,completion_expectation,manager_responsibility,user_responsibility,risk_if_late,created_at", input, 16),
    selectMany(db, "conversations", "id,topic,status,summary,last_update_at,created_at", input, 8),
    selectMany(db, "memory_entries", "id,scope,kind,content,source_type,confidence,reason,mission_id,conversation_id,created_at", input, 8),
    selectMany(db, "agent_reports", "id,agent_key,mission_id,summary,confidence,limitations,finding,risk_or_opportunity,recommended_internal_action,created_at", input, 6),
    selectMeaningfulEvents(db, input, 16),
    selectCurrentMusicReads(db, input, 8),
    selectPreviousBrief(db, input),
  ]);

  const activeMissions = missions.filter((row: any) => !["candidate", "archived", "cancelled", "completed"].includes(String(row.status ?? "").toLowerCase())).slice(0, 6);
  const activeMissionIds = new Set(activeMissions.map((row: any) => row.id));
  const priorityTasks = tasks
    .filter((row: any) => !row.mission_id || activeMissionIds.has(row.mission_id))
    .sort(compareTaskPriority)
    .slice(0, 10);
  const recentConversations = await attachConversationMessages(db, input, conversations.slice(0, 6));

  return {
    version: "todays_brief_operating_context_v1",
    truthPriority: [
      "Current structured workspace state overrides older conversation prose, memory, and Manager Reads.",
      "Manager Reads and the previous Today's Brief are derived analysis and may be stale.",
      "Recent activity matters only when it changed a decision, deliverable, deadline, approval, blocker, mission, or music state.",
    ],
    activeMissions,
    priorityTasks,
    recentConversations,
    durableMemory: memory.slice(0, 6),
    recentAgentReports: agentReports.slice(0, 4),
    meaningfulEvents: events.slice(0, 12),
    currentMusicReads,
    previousBrief,
  };
}

async function selectMany(db: any, table: string, columns: string, input: OperatingBriefContextInput, limit: number) {
  const { data, error } = await db
    .from(table)
    .select(columns)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function selectMeaningfulEvents(db: any, input: OperatingBriefContextInput, limit: number) {
  const { data, error } = await db
    .from("operating_events")
    .select("id,event_type,target_type,target_id,source_type,source_id,summary,payload,created_at")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []).filter((row: any) => isMeaningfulEvent(row.event_type)).slice(0, limit);
}

function isMeaningfulEvent(eventType: unknown) {
  const value = String(eventType ?? "").toLowerCase();
  if (!value) return false;
  if (/sync|setup|brief|poll|provider|enrichment|connected|connection/.test(value)) return false;
  return /mission|task|release|date|split|right|approval|document|song|music|checkpoint|deliverable|credit|asset|opportunity/.test(value);
}

async function selectCurrentMusicReads(db: any, input: OperatingBriefContextInput, limit: number) {
  const { data, error } = await db
    .from("manager_outputs")
    .select("id,output_type,subject_type,subject_id,summary,primary_recommendation_json,render_json,created_at")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("is_current", true)
    .in("output_type", ["song_manager_read", "project_manager_read"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function selectPreviousBrief(db: any, input: OperatingBriefContextInput) {
  const { data, error } = await db
    .from("manager_outputs")
    .select("id,render_json,summary,created_at")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("output_type", "recurring_todays_brief")
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) return null;
  const render = record(data.render_json);
  return {
    id: data.id,
    generatedAt: typeof render.generatedAt === "string" ? render.generatedAt : data.created_at,
    headlineRead: typeof render.headlineRead === "string" ? render.headlineRead : "",
    managerRead: typeof render.managerRead === "string" ? render.managerRead : "",
    summary: data.summary ?? "",
  };
}

async function attachConversationMessages(db: any, input: OperatingBriefContextInput, conversations: any[]) {
  if (!conversations.length) return [];
  const ids = conversations.map((row) => row.id).filter(Boolean);
  const { data, error } = await db
    .from("conversation_messages")
    .select("id,conversation_id,speaker,label,body,created_at")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .in("conversation_id", ids)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw error;
  const messages = data ?? [];
  return conversations.map((conversation) => ({
    ...conversation,
    recentMessages: messages.filter((message: any) => message.conversation_id === conversation.id).slice(0, 3).reverse(),
  }));
}

function compareTaskPriority(left: any, right: any) {
  return taskPriority(right) - taskPriority(left);
}

function taskPriority(task: any) {
  const status = String(task.status ?? "").toLowerCase();
  const approval = String(task.approval_state ?? "").toLowerCase();
  let score = 0;
  if (/block/.test(status) || task.dependency) score += 100;
  if (/approval|required|review/.test(approval) || /approval/.test(status)) score += 90;
  if (task.deadline) {
    const deadline = Date.parse(task.deadline);
    if (Number.isFinite(deadline)) {
      const days = (deadline - Date.now()) / DAY_MS;
      if (days < 0) score += 85;
      else if (days <= 7) score += 70;
    }
  }
  if (/active|progress|working|ready/.test(status)) score += 40;
  if (/completed|done/.test(status)) score += 10;
  if (typeof task.priority === "number") score += Math.max(0, 20 - task.priority);
  return score;
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}
