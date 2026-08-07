import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { musicReadRefreshMode, shouldAutomaticallyRefreshMusicRead } from "../_shared/music-manager-read/refreshPolicy.ts";

const MAX_EVENTS = 160;
const LOOKBACK_DAYS = 14;

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const workerSecret = Deno.env.get("WORKFLOW_WORKER_SECRET");
  if (!workerSecret || request.headers.get("x-workflow-worker-secret") !== workerSecret) {
    return json({ error: "Unauthorized." }, 401);
  }

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const db = createClient(supabaseUrl, serviceRoleKey);
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1_000).toISOString();
    const { data: events, error } = await db.from("operating_events")
      .select("id,account_id,artist_workspace_id,artist_id,event_type,target_type,target_id,payload,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_EVENTS);
    if (error) throw error;

    const candidates = latestEventsByMusicSubject(events ?? []);
    const modes = await loadSubjectModes(db, candidates);
    const dispatched = await dispatchEligibleReads(supabaseUrl, serviceRoleKey, candidates, modes);
    return json({ status: "completed", inspected: candidates.length, dispatched });
  } catch (error) {
    console.error("Music Manager Read refresh worker failed", error);
    return json({ error: "Music Manager Read refresh worker failed." }, 500);
  }
});

type MusicSubject = {
  type: "music_item" | "music_project";
  id: string;
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  eventId: string;
  eventType: string;
};

function latestEventsByMusicSubject(rows: any[]): MusicSubject[] {
  const selected = new Map<string, MusicSubject>();
  for (const row of rows) {
    const subject = subjectFromEvent(row);
    if (!subject) continue;
    const key = `${subject.artistWorkspaceId}:${subject.type}:${subject.id}`;
    if (!selected.has(key)) selected.set(key, subject);
  }
  return [...selected.values()].slice(0, 48);
}

function subjectFromEvent(row: any): MusicSubject | null {
  const type = row?.target_type === "music_item" || row?.target_type === "music_project" ? row.target_type : "";
  const targetId = stringValue(row?.target_id);
  const payload = record(row?.payload);
  const splitMusicItemId = row?.target_type === "music_split" ? stringValue(payload.music_item_id) : "";
  const subjectType = type || (splitMusicItemId ? "music_item" : "");
  const subjectId = targetId || splitMusicItemId;
  const accountId = stringValue(row?.account_id);
  const artistWorkspaceId = stringValue(row?.artist_workspace_id);
  const artistId = stringValue(row?.artist_id);
  const eventId = stringValue(row?.id);
  const eventType = stringValue(row?.event_type);
  if (!subjectType || !subjectId || !accountId || !artistWorkspaceId || !artistId || !eventId || !eventType) return null;
  return { type: subjectType as MusicSubject["type"], id: subjectId, accountId, artistWorkspaceId, artistId, eventId, eventType };
}

async function loadSubjectModes(db: any, subjects: MusicSubject[]) {
  const itemIds = subjects.filter((subject) => subject.type === "music_item").map((subject) => subject.id);
  const projectIds = subjects.filter((subject) => subject.type === "music_project").map((subject) => subject.id);
  const [items, projects] = await Promise.all([
    itemIds.length ? db.from("music_items").select("id,lifecycle_stage,released_at,planned_release_date").in("id", itemIds) : { data: [], error: null },
    projectIds.length ? db.from("music_projects").select("id,lifecycle_stage,released_at,planned_release_date").in("id", projectIds) : { data: [], error: null },
  ]);
  if (items.error) throw items.error;
  if (projects.error) throw projects.error;
  const modes = new Map<string, ReturnType<typeof musicReadRefreshMode>>();
  for (const row of items.data ?? []) modes.set(`music_item:${row.id}`, musicReadRefreshMode({ lifecycleStage: row.lifecycle_stage, releasedAt: row.released_at, plannedReleaseDate: row.planned_release_date }));
  for (const row of projects.data ?? []) modes.set(`music_project:${row.id}`, musicReadRefreshMode({ lifecycleStage: row.lifecycle_stage, releasedAt: row.released_at, plannedReleaseDate: row.planned_release_date }));
  return modes;
}

async function dispatchEligibleReads(supabaseUrl: string, serviceRoleKey: string, subjects: MusicSubject[], modes: Map<string, ReturnType<typeof musicReadRefreshMode>>) {
  let dispatched = 0;
  for (const subject of subjects) {
    const mode = modes.get(`${subject.type}:${subject.id}`);
    if (!mode || !shouldAutomaticallyRefreshMusicRead({ mode, eventType: subject.eventType })) continue;
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/generate-music-summary`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: subject.accountId,
        artistWorkspaceId: subject.artistWorkspaceId,
        artistId: subject.artistId,
        subjectType: subject.type,
        subjectId: subject.id,
        triggerEventId: subject.eventId,
        triggerReason: subject.eventType,
      }),
    });
    if (!response.ok) {
      console.error("Music Manager Read refresh dispatch failed", { subjectId: subject.id, eventId: subject.eventId, status: response.status });
      continue;
    }
    dispatched += 1;
  }
  return dispatched;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
