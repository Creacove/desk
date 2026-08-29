export type ReminderIntensity = "light" | "standard" | "stay_on_me";
export type ReminderKind =
  | "task_ready"
  | "task_start"
  | "check_in"
  | "due_soon"
  | "due_now"
  | "overdue"
  | "blocked_followup"
  | "plan_at_risk";

type TaskReminderInput = {
  id: string;
  account_id: string;
  artist_workspace_id: string;
  artist_id: string;
  mission_id?: string | null;
  assignee_user_id?: string | null;
  owner_role?: string | null;
  title: string;
  purpose?: string | null;
  risk_if_late?: string | null;
  available_from?: string | null;
  deadline?: string | null;
  estimated_minutes?: number | null;
  reminder_policy?: Record<string, unknown> | null;
};

type NotificationPreference = {
  user_id: string;
  timezone?: string | null;
  reminder_intensity?: ReminderIntensity | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  in_app_enabled?: boolean | null;
};

type ReminderDraft = {
  kind: ReminderKind;
  scheduledFor: Date;
};

export async function enqueueTaskReminders(db: any, task: TaskReminderInput, now = new Date()) {
  if (!task?.id || isManagerOwned(task.owner_role)) return [];
  if (task.reminder_policy?.enabled === false) return [];

  const userId = task.assignee_user_id || await resolveReminderUser(db, task.account_id);
  if (!userId) return [];
  const preference = await loadPreference(db, task.artist_workspace_id, userId);
  if (preference?.in_app_enabled === false) return [];

  const intensity = preference?.reminder_intensity || "standard";
  const timezone = preference?.timezone || "UTC";
  const drafts = buildReminderDrafts(task, intensity, now)
    .map((draft) => ({
      ...draft,
      scheduledFor: moveOutsideQuietHours(
        draft.scheduledFor,
        timezone,
        preference?.quiet_hours_start,
        preference?.quiet_hours_end,
      ),
    }))
    .filter((draft) => draft.scheduledFor.getTime() >= now.getTime() - 60_000);

  if (!drafts.length) return [];

  const rows = drafts.map((draft) => ({
    account_id: task.account_id,
    artist_workspace_id: task.artist_workspace_id,
    artist_id: task.artist_id,
    user_id: userId,
    mission_id: task.mission_id ?? null,
    task_id: task.id,
    kind: draft.kind,
    scheduled_for: draft.scheduledFor.toISOString(),
    channel: "in_app",
    status: "queued",
    dedupe_key: reminderDedupeKey(task.id, draft.kind, draft.scheduledFor),
    payload: {
      taskTitle: task.title,
      purpose: task.purpose ?? "",
      riskIfLate: task.risk_if_late ?? "",
      estimatedMinutes: task.estimated_minutes ?? null,
      availableFrom: task.available_from ?? null,
      deadline: task.deadline ?? null,
      intensity,
    },
  }));

  const { data, error } = await db
    .from("reminder_queue")
    .upsert(rows, { onConflict: "artist_workspace_id,dedupe_key", ignoreDuplicates: true })
    .select("id,kind,scheduled_for,status");
  if (error) throw error;
  return data ?? [];
}

export async function cancelPendingTaskReminders(db: any, taskId: string, reason = "task_state_changed") {
  if (!taskId) return;
  const { error } = await db
    .from("reminder_queue")
    .update({ status: "cancelled", last_error: reason })
    .eq("task_id", taskId)
    .in("status", ["queued", "processing"]);
  if (error) throw error;
}

export function buildReminderDrafts(
  task: Pick<TaskReminderInput, "available_from" | "deadline">,
  intensity: ReminderIntensity,
  now = new Date(),
): ReminderDraft[] {
  const start = parseDate(task.available_from) ?? now;
  const deadline = parseDate(task.deadline);
  const drafts: ReminderDraft[] = [];

  if (intensity === "light") {
    if (deadline) drafts.push({ kind: "due_soon", scheduledFor: maxDate(now, addMinutes(deadline, -120)) });
    else drafts.push({ kind: "task_ready", scheduledFor: maxDate(now, start) });
    return uniqueDrafts(drafts);
  }

  drafts.push({ kind: start.getTime() > now.getTime() + 60_000 ? "task_start" : "task_ready", scheduledFor: maxDate(now, start) });

  if (deadline) {
    const durationMs = Math.max(0, deadline.getTime() - start.getTime());
    if (intensity === "stay_on_me" && durationMs >= 4 * 60 * 60 * 1000) {
      drafts.push({ kind: "check_in", scheduledFor: new Date(start.getTime() + Math.min(durationMs / 2, 6 * 60 * 60 * 1000)) });
    }
    drafts.push({ kind: "due_soon", scheduledFor: maxDate(now, addMinutes(deadline, -120)) });
    drafts.push({ kind: "due_now", scheduledFor: maxDate(now, deadline) });
    drafts.push({ kind: "overdue", scheduledFor: addMinutes(deadline, intensity === "stay_on_me" ? 60 : 180) });
  }

  return uniqueDrafts(drafts);
}

export function buildReminderSummary(kind: ReminderKind, payload: Record<string, unknown>) {
  const title = readString(payload.taskTitle) || "this task";
  const minutes = Number(payload.estimatedMinutes);
  const time = Number.isFinite(minutes) && minutes > 0 ? ` It should take about ${Math.round(minutes)} min.` : "";
  const consequence = readString(payload.riskIfLate);
  const consequenceText = consequence ? ` ${consequence}` : "";

  switch (kind) {
    case "task_ready": return `You're up: ${title}.${time}`;
    case "task_start": return `It's time for ${title}.${time}`;
    case "check_in": return `Checking in on ${title}.${time}`;
    case "due_soon": return `${title} is still due soon.${time}${consequenceText}`;
    case "due_now": return `${title} is due now.${consequenceText}`;
    case "overdue": return `${title} is overdue.${consequenceText}`;
    case "blocked_followup": return `${title} is still blocked. Desk can adjust the plan.`;
    case "plan_at_risk": return consequence || `The plan is at risk because ${title} has not moved.`;
  }
}

function buildReminderDedupeStamp(date: Date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function reminderDedupeKey(taskId: string, kind: ReminderKind, scheduledFor: Date) {
  return `task:${taskId}:${kind}:${buildReminderDedupeStamp(scheduledFor)}`;
}

async function resolveReminderUser(db: any, accountId: string) {
  const { data: owner, error: ownerError } = await db
    .from("account_memberships")
    .select("user_id")
    .eq("account_id", accountId)
    .eq("status", "active")
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (ownerError) throw ownerError;
  if (owner?.user_id) return String(owner.user_id);

  const { data: member, error: memberError } = await db
    .from("account_memberships")
    .select("user_id")
    .eq("account_id", accountId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (memberError) throw memberError;
  return member?.user_id ? String(member.user_id) : null;
}

async function loadPreference(db: any, workspaceId: string, userId: string): Promise<NotificationPreference | null> {
  const { data, error } = await db
    .from("notification_preferences")
    .select("user_id,timezone,reminder_intensity,quiet_hours_start,quiet_hours_end,in_app_enabled")
    .eq("artist_workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

function moveOutsideQuietHours(date: Date, timezone: string, start?: string | null, end?: string | null) {
  if (!start || !end || start === end) return date;
  let candidate = new Date(date);
  for (let index = 0; index < 24 * 60; index += 15) {
    const minute = localMinuteOfDay(candidate, timezone);
    if (minute == null || !insideQuietHours(minute, parseClock(start), parseClock(end))) return candidate;
    candidate = addMinutes(candidate, 15);
  }
  return date;
}

function localMinuteOfDay(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
  } catch {
    return null;
  }
}

function parseClock(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return Math.max(0, Math.min(1439, (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)));
}

function insideQuietHours(value: number, start: number, end: number) {
  return start < end ? value >= start && value < end : value >= start || value < end;
}

function uniqueDrafts(drafts: ReminderDraft[]) {
  const seen = new Set<string>();
  return drafts
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
    .filter((draft) => {
      const key = `${draft.kind}:${draft.scheduledFor.toISOString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function maxDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
}

function isManagerOwned(ownerRole?: string | null) {
  return /^(manager|desk|ai)$/i.test(String(ownerRole ?? "").trim());
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
