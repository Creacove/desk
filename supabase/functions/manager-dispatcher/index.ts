import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { buildReminderSummary, type ReminderKind } from "../_shared/reminders.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BATCH_SIZE = 50;
const TERMINAL_TASK_STATUSES = new Set(["completed", "rejected", "archived", "superseded"]);

type ReminderRow = {
  id: string;
  account_id: string;
  artist_workspace_id: string;
  artist_id: string;
  user_id?: string | null;
  mission_id?: string | null;
  task_id?: string | null;
  kind: ReminderKind;
  channel: "in_app" | "email" | "push" | "whatsapp";
  status: string;
  scheduled_for: string;
  attempt_count: number;
  dedupe_key: string;
  payload: Record<string, unknown>;
};

type ReminderPreference = {
  timezone?: string | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
};

Deno.serve(withAppErrorCapture("manager-dispatcher", async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const suppliedSecret = request.headers.get("x-workflow-worker-secret") ?? "";
  const expectedSecret = requireEnv("WORKFLOW_WORKER_SECRET");
  if (!constantTimeEqual(suppliedSecret, expectedSecret)) return json({ error: "Unauthorized." }, 401);

  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const { data, error } = await db
    .from("reminder_queue")
    .select("id,account_id,artist_workspace_id,artist_id,user_id,mission_id,task_id,kind,channel,status,scheduled_for,attempt_count,dedupe_key,payload")
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .order("id", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) return json({ error: "Due reminders could not be listed." }, 503);

  const results: Array<Record<string, unknown>> = [];
  for (const candidate of (data ?? []) as ReminderRow[]) {
    try {
      const claimed = await claimReminder(db, candidate);
      if (!claimed) continue;

      if (claimed.task_id && await isTaskTerminal(db, claimed.task_id)) {
        await finishReminder(db, claimed.id, "skipped", "task_is_terminal");
        results.push({ id: claimed.id, status: "skipped_terminal_task" });
        continue;
      }

      const preference = await loadPreference(db, claimed);
      const allowedAt = nextAllowedReminderTime(new Date(), preference);
      if (allowedAt.getTime() > Date.now() + 30_000) {
        await requeueReminder(db, claimed.id, allowedAt, "quiet_hours");
        results.push({ id: claimed.id, status: "rescheduled_quiet_hours", scheduledFor: allowedAt.toISOString() });
        continue;
      }

      if (claimed.channel !== "in_app") {
        // Delivery adapters are intentionally explicit. Never report success for
        // email/push/WhatsApp until a real provider is configured.
        await finishReminder(db, claimed.id, "skipped", `channel_not_configured:${claimed.channel}`);
        results.push({ id: claimed.id, status: "skipped_unconfigured_channel", channel: claimed.channel });
        continue;
      }

      const summary = buildReminderSummary(claimed.kind, claimed.payload ?? {});
      await writeInAppReminder(db, claimed, summary);
      await finishReminder(db, claimed.id, "sent");
      results.push({ id: claimed.id, status: "sent", channel: claimed.channel });
    } catch (reminderError) {
      const message = reminderError instanceof Error ? reminderError.message : "Reminder dispatch failed.";
      await db.from("reminder_queue").update({
        status: "failed",
        last_error: message.slice(0, 500),
      }).eq("id", candidate.id).eq("status", "processing");
      results.push({ id: candidate.id, status: "failed" });
    }
  }

  return json({ processed: results.length, results });
}));

async function claimReminder(db: any, candidate: ReminderRow): Promise<ReminderRow | null> {
  const { data, error } = await db
    .from("reminder_queue")
    .update({ status: "processing", attempt_count: Number(candidate.attempt_count ?? 0) + 1, last_error: null })
    .eq("id", candidate.id)
    .eq("status", "queued")
    .select("id,account_id,artist_workspace_id,artist_id,user_id,mission_id,task_id,kind,channel,status,scheduled_for,attempt_count,dedupe_key,payload")
    .maybeSingle();
  if (error) throw error;
  return data as ReminderRow | null;
}

async function isTaskTerminal(db: any, taskId: string) {
  const { data, error } = await db.from("tasks").select("status").eq("id", taskId).maybeSingle();
  if (error) throw error;
  return !data || TERMINAL_TASK_STATUSES.has(String(data.status ?? ""));
}

async function loadPreference(db: any, reminder: ReminderRow): Promise<ReminderPreference | null> {
  if (!reminder.user_id) return null;
  const { data, error } = await db
    .from("notification_preferences")
    .select("timezone,quiet_hours_start,quiet_hours_end")
    .eq("artist_workspace_id", reminder.artist_workspace_id)
    .eq("user_id", reminder.user_id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function writeInAppReminder(db: any, reminder: ReminderRow, summary: string) {
  const refreshScope = ["activity"];
  if (reminder.mission_id) refreshScope.push(`mission:${reminder.mission_id}`);

  const { error } = await db.from("operating_events").insert({
    account_id: reminder.account_id,
    artist_workspace_id: reminder.artist_workspace_id,
    artist_id: reminder.artist_id,
    event_type: `task_reminder_${reminder.kind}`,
    actor_type: "manager",
    target_type: reminder.task_id ? "task" : "artist",
    target_id: reminder.task_id || reminder.artist_id,
    source_type: "reminder_queue",
    source_id: reminder.id,
    mission_id: reminder.mission_id ?? null,
    task_id: reminder.task_id ?? null,
    dedupe_key: `reminder:${reminder.id}`,
    display_mode: "action",
    refresh_scope: refreshScope,
    summary,
    payload: {
      reminderKind: reminder.kind,
      reminderQueueId: reminder.id,
      recipientUserId: reminder.user_id ?? null,
      actions: reminder.task_id ? ["start", "done", "move", "blocked"] : [],
      ...(reminder.payload ?? {}),
    },
  });
  if (error && error.code !== "23505") throw error;
}

async function requeueReminder(db: any, id: string, scheduledFor: Date, reason: string) {
  const { error } = await db.from("reminder_queue").update({
    status: "queued",
    scheduled_for: scheduledFor.toISOString(),
    last_error: reason,
  }).eq("id", id).eq("status", "processing");
  if (error) throw error;
}

async function finishReminder(db: any, id: string, status: "sent" | "skipped", errorMessage?: string) {
  const patch: Record<string, unknown> = { status, last_error: errorMessage ?? null };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  const { error } = await db.from("reminder_queue").update(patch).eq("id", id).eq("status", "processing");
  if (error) throw error;
}

function nextAllowedReminderTime(now: Date, preference: ReminderPreference | null) {
  const timezone = preference?.timezone || "UTC";
  const start = preference?.quiet_hours_start;
  const end = preference?.quiet_hours_end;
  if (!start || !end || start === end) return now;
  let candidate = new Date(now);
  for (let index = 0; index < 24 * 4; index += 1) {
    const minute = localMinuteOfDay(candidate, timezone);
    if (minute == null || !insideQuietHours(minute, parseClock(start), parseClock(end))) return candidate;
    candidate = new Date(candidate.getTime() + 15 * 60_000);
  }
  return now;
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

function constantTimeEqual(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
