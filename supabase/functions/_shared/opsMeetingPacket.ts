import type { ManagerConversationOutput } from "./openaiManagerConversation.ts";

const MAX_TRANSCRIPT_CHARS = 24_000;

export type OpsMeetingContext = {
  meeting: {
    id: string;
    opsCaseId: string;
    meetingType: string;
    transcript: string;
    outcome: string | null;
    completedAt: string | null;
  };
  caseRow: {
    id: string;
    displayName: string;
    primaryContactName: string | null;
    primaryContactEmail: string | null;
    primaryContactHandle: string | null;
    releaseTiming: string;
    releaseDate: string | null;
    deskWorkspaceId: string;
  };
  workspace: {
    id: string;
    accountId: string;
    artistId: string;
    name: string;
    status: string;
    accountName: string | null;
    artistName: string | null;
  };
  packet: Record<string, unknown>;
};

export async function loadOpsMeetingContext(
  db: any,
  opsMeetingId: string,
  targetWorkspaceId: string,
  operatorUserId: string,
): Promise<OpsMeetingContext> {
  const { data: meeting, error: meetingError } = await db
    .from("ops_meetings")
    .select("id,ops_case_id,meeting_type,transcript,outcome,completed_at,processing_status,desk_run_id")
    .eq("id", opsMeetingId)
    .maybeSingle();
  if (meetingError) throw meetingError;
  if (!meeting) throw new Error("Ops meeting was not found.");

  const { data: caseRow, error: caseError } = await db
    .from("ops_cases")
    .select("id,display_name,primary_contact_name,primary_contact_email,primary_contact_handle,release_timing,release_date,desk_workspace_id")
    .eq("id", meeting.ops_case_id)
    .maybeSingle();
  if (caseError) throw caseError;
  if (!caseRow || caseRow.desk_workspace_id !== targetWorkspaceId) {
    throw new Error("Ops meeting workspace link does not match the requested Desk workspace.");
  }

  const transcript = clipTranscript(meeting.transcript);
  if (!transcript) throw new Error("Add a transcript before processing this meeting.");

  const { data: workspace, error: workspaceError } = await db
    .from("artist_workspaces")
    .select("id,account_id,artist_id,name,status,accounts(name),artists(display_name)")
    .eq("id", targetWorkspaceId)
    .neq("status", "archived")
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace) throw new Error("The linked Desk workspace is not available.");

  const [profile, missions, tasks, checkpoints, memory, evidence] = await Promise.all([
    readOne(db, "artist_profiles", "artist_workspace_id", targetWorkspaceId, "display_name,spotify_identity,genres,home_market,stage,current_goal,budget_context,artist_direction"),
    readMany(db, "missions", "artist_workspace_id", targetWorkspaceId, "id,title,objective,status,summary,current_recommendation,review_point", 12),
    readMany(db, "tasks", "artist_workspace_id", targetWorkspaceId, "id,mission_id,title,status,deadline,purpose,completion_expectation", 20),
    readMany(db, "checkpoints", "artist_workspace_id", targetWorkspaceId, "id,mission_id,title,status,question,recommendation,next_action", 12),
    readMany(db, "memory_entries", "artist_workspace_id", targetWorkspaceId, "id,kind,content,confidence,source_type,created_at", 20),
    readMany(db, "evidence_items", "artist_workspace_id", targetWorkspaceId, "id,source,evidence_type,subject_label,metric_name,metric_value,metric_unit,confidence,limitation,captured_at", 20),
  ]);

  return {
    meeting: {
      id: meeting.id,
      opsCaseId: meeting.ops_case_id,
      meetingType: meeting.meeting_type,
      transcript,
      outcome: meeting.outcome,
      completedAt: meeting.completed_at,
    },
    caseRow: {
      id: caseRow.id,
      displayName: caseRow.display_name,
      primaryContactName: caseRow.primary_contact_name,
      primaryContactEmail: caseRow.primary_contact_email,
      primaryContactHandle: caseRow.primary_contact_handle,
      releaseTiming: caseRow.release_timing,
      releaseDate: caseRow.release_date,
      deskWorkspaceId: caseRow.desk_workspace_id,
    },
    workspace: {
      id: workspace.id,
      accountId: workspace.account_id,
      artistId: workspace.artist_id,
      name: workspace.name,
      status: workspace.status,
      accountName: one(workspace.accounts)?.name ?? null,
      artistName: one(workspace.artists)?.display_name ?? null,
    },
    packet: {
      source: {
        type: "ops_meeting",
        sourceId: meeting.id,
        opsCaseId: caseRow.id,
        meetingType: meeting.meeting_type,
        operatorUserId,
      },
      transcript,
      workspaceContext: {
        workspaceId: workspace.id,
        accountId: workspace.account_id,
        artistId: workspace.artist_id,
        workspaceName: workspace.name,
        workspaceStatus: workspace.status,
        artistName: one(workspace.artists)?.display_name ?? null,
        accountName: one(workspace.accounts)?.name ?? null,
        artistProfile: profile,
        opsCase: {
          displayName: caseRow.display_name,
          primaryContactName: caseRow.primary_contact_name,
          primaryContactEmail: caseRow.primary_contact_email,
          primaryContactHandle: caseRow.primary_contact_handle,
          releaseTiming: caseRow.release_timing,
          releaseDate: caseRow.release_date,
        },
      },
      currentMissions: missions,
      currentTasks: tasks,
      checkpoints,
      memory,
      evidence,
    },
  };
}

export function reviewPayload(run: any): ManagerConversationOutput | null {
  const output = run?.result_payload?.output;
  return output && typeof output === "object" ? output as ManagerConversationOutput : null;
}

export function clipTranscript(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length <= MAX_TRANSCRIPT_CHARS) return text;
  return `${text.slice(0, MAX_TRANSCRIPT_CHARS - 1).trimEnd()}…`;
}

async function readOne(db: any, table: string, key: string, value: string, fields: string) {
  const { data, error } = await db.from(table).select(fields).eq(key, value).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function readMany(db: any, table: string, key: string, value: string, fields: string, limit: number) {
  const { data, error } = await db.from(table).select(fields).eq(key, value).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

function one(value: unknown) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
