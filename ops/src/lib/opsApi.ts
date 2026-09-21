import type { User } from "@supabase/supabase-js";
import { buildMusicPath } from "./opsService";
import type { LinkableWorkspace, OpsActivity, OpsCase, OpsFollowup, OpsMeeting, TodayItem } from "./types";
import { requireSupabase } from "./supabase";

async function result<T>(request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("The Ops request returned no data.");
  return data;
}

async function resultMaybe<T>(request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data;
}

async function ensure(request: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await request;
  if (error) throw new Error(error.message);
}

export async function getSessionUser(): Promise<{ user: User; operator: { user_id: string; active: boolean } } | null> {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!sessionData.session?.user) return null;
  const operator = await resultMaybe<{ user_id: string; active: boolean }>(client.from("ordersounds_operators").select("user_id, active").eq("user_id", sessionData.session.user.id).maybeSingle());
  if (!operator?.active) throw new Error("Your account is signed in, but it is not enabled for Ops.");
  return { user: sessionData.session.user, operator };
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const client = requireSupabase();
  await ensure(client.auth.signInWithPassword({ email, password }));
}

export async function sendMagicLink(email: string): Promise<void> {
  const client = requireSupabase();
  await ensure(client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }));
}

export async function signOut(): Promise<void> {
  await requireSupabase().auth.signOut();
}

export async function onAuthStateChange(callback: () => void): Promise<() => void> {
  const client = requireSupabase();
  const { data } = client.auth.onAuthStateChange(() => callback());
  return () => data.subscription.unsubscribe();
}

export async function listToday(): Promise<TodayItem[]> {
  return result<TodayItem[]>(requireSupabase().rpc("list_ops_today_v1"));
}

export async function listCases(): Promise<OpsCase[]> {
  return result<OpsCase[]>(requireSupabase().from("ops_cases").select("*").order("updated_at", { ascending: false }));
}

export async function listMeetings(): Promise<(OpsMeeting & { caseName: string })[]> {
  const client = requireSupabase();
  const meetings = await result<Array<OpsMeeting & { ops_cases: { display_name: string } | null }>>(client.from("ops_meetings").select("*, ops_cases(display_name)").order("scheduled_at", { ascending: true, nullsFirst: false }));
  return (meetings as Array<OpsMeeting & { ops_cases: { display_name: string } | null }>).map((meeting) => ({
    ...meeting,
    caseName: meeting.ops_cases?.display_name || "Untitled case",
  }));
}

export async function getCase(caseId: string): Promise<{
  caseRow: OpsCase;
  meetings: OpsMeeting[];
  followups: OpsFollowup[];
  activity: OpsActivity[];
}> {
  const client = requireSupabase();
  const [caseRow, meetings, followups, activity] = await Promise.all([
    result<OpsCase>(client.from("ops_cases").select("*").eq("id", caseId).single()),
    result<OpsMeeting[]>(client.from("ops_meetings").select("*").eq("ops_case_id", caseId).order("scheduled_at", { ascending: false })),
    result<OpsFollowup[]>(client.from("ops_followups").select("*").eq("ops_case_id", caseId).order("due_at", { ascending: true })),
    result<OpsActivity[]>(client.from("ops_activity").select("*").eq("ops_case_id", caseId).order("created_at", { ascending: false })),
  ]);
  return { caseRow, meetings, followups, activity };
}

export async function createCase(input: {
  display_name: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_handle?: string;
  preferred_channel?: string;
  source: string;
  release_timing: string;
  release_date?: string;
  music_url?: string;
  music_file?: File | null;
}): Promise<OpsCase> {
  const client = requireSupabase();
  const id = crypto.randomUUID();
  const musicFilePath = input.music_file ? buildMusicPath(id, input.music_file.name) : null;
  const { data: currentUser } = await client.auth.getUser();
  const row = await result<OpsCase>(client.from("ops_cases").insert({
    id,
    display_name: input.display_name.trim(),
    primary_contact_name: input.primary_contact_name?.trim() || null,
    primary_contact_email: input.primary_contact_email?.trim() || null,
    primary_contact_handle: input.primary_contact_handle?.trim() || null,
    preferred_channel: input.preferred_channel?.trim() || null,
    source: input.source.trim(),
    release_timing: input.release_timing,
    release_date: input.release_date || null,
    music_url: input.music_url?.trim() || null,
    music_file_path: musicFilePath,
    assigned_user_id: currentUser.user?.id || null,
  }).select().single());

  if (input.music_file && musicFilePath) {
    const upload = await client.storage.from("ops-music").upload(musicFilePath, input.music_file, {
      cacheControl: "3600",
      upsert: true,
      contentType: input.music_file.type || undefined,
    });
    if (upload.error) throw new Error(`Case created, but upload failed: ${upload.error.message}`);
  }
  return row;
}

export async function updateCase(caseId: string, patch: Partial<Pick<OpsCase, "stage" | "assigned_user_id" | "desk_workspace_id" | "release_date" | "preferred_channel" | "primary_contact_name" | "primary_contact_email" | "primary_contact_handle">>): Promise<OpsCase> {
  return result<OpsCase>(requireSupabase().from("ops_cases").update(patch).eq("id", caseId).select().single());
}

export async function createMeeting(input: Pick<OpsMeeting, "ops_case_id" | "meeting_type" | "scheduled_at"> & Partial<Pick<OpsMeeting, "owner_user_id">>): Promise<OpsMeeting> {
  return result<OpsMeeting>(requireSupabase().from("ops_meetings").insert(input).select().single());
}

export async function updateMeeting(meetingId: string, patch: Partial<Pick<OpsMeeting, "scheduled_at" | "completed_at" | "transcript" | "outcome" | "processing_status" | "processed_at">>): Promise<OpsMeeting> {
  return result<OpsMeeting>(requireSupabase().from("ops_meetings").update(patch).eq("id", meetingId).select().single());
}

export async function createFollowup(input: Pick<OpsFollowup, "ops_case_id" | "due_at" | "kind"> & Partial<Pick<OpsFollowup, "assigned_user_id">>): Promise<OpsFollowup> {
  return result<OpsFollowup>(requireSupabase().from("ops_followups").insert(input).select().single());
}

export async function completeFollowup(id: string): Promise<void> {
  await result<{ id: string }>(requireSupabase().from("ops_followups").update({ completed_at: new Date().toISOString() }).eq("id", id).select("id").single());
}

export async function searchLinkableWorkspaces(query: string): Promise<LinkableWorkspace[]> {
  return result<LinkableWorkspace[]>(requireSupabase().rpc("list_ops_linkable_workspaces_v1", { p_query: query, p_limit: 20 }));
}

export async function linkCaseWorkspace(caseId: string, workspaceId: string, expectedCurrentWorkspaceId: string | null): Promise<OpsCase> {
  return result<OpsCase>(requireSupabase().rpc("link_ops_case_workspace_v1", {
    p_case_id: caseId,
    p_workspace_id: workspaceId,
    p_expected_current_workspace_id: expectedCurrentWorkspaceId,
  }));
}
