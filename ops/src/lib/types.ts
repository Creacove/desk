export type Stage = "new" | "qualifying" | "meeting" | "activation" | "active" | "closed";
export type ReleaseTiming = "upcoming" | "released" | "unknown";
export type ProcessingStatus = "unprocessed" | "processing" | "processed" | "failed";

export type OpsCase = {
  id: string;
  display_name: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_handle: string | null;
  preferred_channel: string | null;
  source: string;
  stage: Stage;
  release_timing: ReleaseTiming;
  release_date: string | null;
  music_url: string | null;
  music_file_path: string | null;
  assigned_user_id: string | null;
  desk_workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OpsMeeting = {
  id: string;
  ops_case_id: string;
  meeting_type: "onboarding" | "check_in" | "monthly_review" | "other";
  scheduled_at: string | null;
  completed_at: string | null;
  owner_user_id: string | null;
  transcript: string | null;
  outcome: "ready_to_start" | "needs_follow_up" | "not_ready" | "inquiry_questions" | "not_a_fit" | null;
  processing_status: ProcessingStatus;
  processed_at: string | null;
  desk_run_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OpsFollowup = {
  id: string;
  ops_case_id: string;
  assigned_user_id: string | null;
  due_at: string;
  kind: string;
  completed_at: string | null;
  created_at: string;
};

export type OpsActivity = {
  id: string;
  ops_case_id: string;
  actor_user_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type TodayItem = {
  item_key: string;
  kind: string;
  priority: number;
  case_id: string;
  meeting_id: string | null;
  followup_id: string | null;
  display_name: string;
  reason: string;
  action: string;
  due_at: string | null;
};

export type LinkableWorkspace = {
  artist_workspace_id: string;
  workspace_name: string;
  workspace_status: string;
  artist_name: string | null;
  account_id: string;
  account_name: string | null;
};
