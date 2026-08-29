import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

const foundationMigration = read("supabase", "migrations", "20260829070000_manager_runtime_foundation.sql");
const schedulerMigration = read("supabase", "migrations", "20260829070100_schedule_manager_dispatcher.sql");
const continuationMigration = read("supabase", "migrations", "20260829070200_persist_manager_review_continuation.sql");
const taskReminderMigration = read("supabase", "migrations", "20260829070300_task_reminder_lifecycle.sql");
const dispatcherSource = read("supabase", "functions", "manager-dispatcher", "index.ts");
const publicContextSource = read("supabase", "functions", "refresh-public-context", "index.ts");
const missionWorkSource = read("src", "features", "missions", "MissionWorkSurface.tsx");

describe("Manager Runtime foundation", () => {
  it("adds channel-agnostic reminder state without replacing the existing Mission system", () => {
    expect(foundationMigration).toContain("create table if not exists public.notification_preferences");
    expect(foundationMigration).toContain("create table if not exists public.reminder_queue");
    expect(foundationMigration).toContain("'light', 'standard', 'stay_on_me'");
    expect(foundationMigration).toContain("'in_app', 'email', 'push', 'whatsapp'");
    expect(foundationMigration).toContain("add column if not exists available_from");
    expect(foundationMigration).toContain("add column if not exists estimated_minutes");
  });

  it("uses one guarded global dispatcher instead of per-artist cron jobs", () => {
    expect(schedulerMigration).toContain("manager-reminder-dispatcher");
    expect(schedulerMigration).toContain("'*/5 * * * *'");
    expect(schedulerMigration).toContain("exists (");
    expect(schedulerMigration).toContain("from public.reminder_queue");
    expect(schedulerMigration).not.toContain("artist_workspace_id =");
  });

  it("never reports an unconfigured outbound channel as successfully sent", () => {
    expect(dispatcherSource).toContain("channel_not_configured");
    expect(dispatcherSource).toContain("skipped_unconfigured_channel");
    expect(dispatcherSource).toContain("rescheduled_quiet_hours");
    expect(dispatcherSource).toContain('["start", "done", "move", "blocked"]');
  });

  it("turns Manager review continuation into durable human work and permission gates", () => {
    expect(continuationMigration).toContain("followUpTasks");
    expect(continuationMigration).toContain("permissionRequests");
    expect(continuationMigration).toContain("insert into public.tasks");
    expect(continuationMigration).toContain("insert into public.permission_requests");
    expect(continuationMigration).toContain("lower(owner_role_text) in ('manager', 'desk', 'ai', 'ai manager')");
  });

  it("makes reminders follow task state rather than living as an unrelated feature", () => {
    expect(taskReminderMigration).toContain("queue_reminders_for_task");
    expect(taskReminderMigration).toContain("queue_active_plan_task_reminders");
    expect(taskReminderMigration).toContain("blocked_followup");
    expect(taskReminderMigration).toContain("task_is_terminal");
    expect(taskReminderMigration).toContain("manager_owned_work");
  });

  it("preserves semantic public-web evidence instead of dropping Manager-useful metadata", () => {
    expect(foundationMigration).toContain("alter table public.evidence_items");
    expect(foundationMigration).toContain("add column if not exists metadata");
    expect(publicContextSource).not.toContain("map(({ metadata: _metadata");
    expect(publicContextSource).toContain("Keep the distilled semantic payload");
  });

  it("renders machine-only checkpoints as Manager state, never a zero-task execution step", () => {
    expect(missionWorkSource).toContain('"Desk is watching"');
    expect(missionWorkSource).toContain('"Desk review"');
    expect(missionWorkSource).toContain("managerOnlyCheckpoint");
    expect(missionWorkSource).toContain("No action is needed from you here.");
  });
});
