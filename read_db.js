import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const envContent = readFileSync(join(process.cwd(), ".env"), "utf8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join("=").trim();
    if (key && !key.startsWith("#")) envVars[key] = value;
  }
});

const db = createClient(envVars.VITE_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const MISSION_ID = "09abf012-fca4-4a71-8880-93b8e271991a";
  console.log("=== MISSION DETAIL ===");
  const { data: mission, error: missionErr } = await db.from("missions").select("*").eq("id", MISSION_ID).single();
  if (missionErr) console.error("Mission error:", missionErr);
  console.log(JSON.stringify(mission, null, 2));

  console.log("\n=== PLAN VERSIONS ===");
  const { data: plans, error: plansErr } = await db.from("mission_plan_versions").select("*").eq("mission_id", MISSION_ID).order("version", { ascending: false });
  if (plansErr) console.error("Plans error:", plansErr);
  for (const p of plans ?? []) {
    console.log(`\nVer ${p.version} [${p.status}] ID: ${p.id} Created: ${p.created_at}`);
    console.log(JSON.stringify(p, null, 2));
  }

  console.log("\n=== ALL CHECKPOINTS FOR MISSION (by mission_id) ===");
  const { data: checkpoints, error: cpErr } = await db.from("checkpoints").select("id, title, question, status, mission_plan_version_id, created_at").eq("mission_id", MISSION_ID);
  if (cpErr) console.error("Checkpoints error:", cpErr);
  console.log(`Found ${checkpoints?.length ?? 0} checkpoints`);
  for (const cp of checkpoints ?? []) {
    console.log(`  [${cp.status}] "${cp.title}" | Plan: ${cp.mission_plan_version_id} | Created: ${cp.created_at}`);
  }

  console.log("\n=== ALL TASKS FOR MISSION (by mission_id) ===");
  const { data: tasks, error: taskErr } = await db.from("tasks").select("id, title, status, mission_plan_version_id, primary_checkpoint_id, created_at").eq("mission_id", MISSION_ID);
  if (taskErr) console.error("Tasks error:", taskErr);
  console.log(`Found ${tasks?.length ?? 0} tasks`);
  for (const t of tasks ?? []) {
    console.log(`  [${t.status}] "${t.title}" | Plan: ${t.mission_plan_version_id} | Checkpoint: ${t.primary_checkpoint_id} | Created: ${t.created_at}`);
  }

  console.log("\n=== MISSION PLAN CHECKPOINTS (link table) ===");
  const { data: links, error: linkErr } = await db.from("mission_plan_checkpoints").select("*").eq("mission_id", MISSION_ID);
  if (linkErr) console.error("Links error:", linkErr);
  console.log(`Found ${links?.length ?? 0} plan-checkpoint links`);
  for (const l of links ?? []) {
    console.log(`  Plan: ${l.mission_plan_version_id} | Checkpoint: ${l.checkpoint_id} | Order: ${l.order_index}`);
  }

  console.log("\n=== RECENT MANAGER SYNTHESIS RUNS ===");
  const { data: runs, error: runsErr } = await db.from("manager_synthesis_runs").select("id, status, run_type, error_message, created_at").order("created_at", { ascending: false }).limit(5);
  if (runsErr) console.error("Runs error:", runsErr);
  for (const r of runs ?? []) {
    console.log(`  [${r.status}] ${r.run_type} | Error: ${r.error_message ?? "none"} | Created: ${r.created_at} | ID: ${r.id}`);
  }

  console.log("\n=== RECENT MANAGER RUN ACTIONS ===");
  const { data: actions, error: actionsErr } = await db.from("manager_run_actions").select("id, run_id, status, action_type, target_id, result_payload, error_message, created_at").order("created_at", { ascending: false }).limit(5);
  if (actionsErr) console.error("Actions error:", actionsErr);
  for (const a of actions ?? []) {
    console.log(`  [${a.status}] ${a.action_type} | Target: ${a.target_id} | Error: ${a.error_message ?? "none"} | Created: ${a.created_at}`);
    console.log(`  Result: ${JSON.stringify(a.result_payload)}`);
  }

  console.log("\n=== TASK STEPS ===");
  const taskIds = (tasks ?? []).map(t => t.id);
  if (taskIds.length) {
    const { data: steps, error: stepsErr } = await db.from("task_steps").select("id, task_id, body, order_index").in("task_id", taskIds).order("order_index");
    if (stepsErr) console.error("Steps error:", stepsErr);
    console.log(`Found ${steps?.length ?? 0} steps`);
    for (const s of steps ?? []) {
      console.log(`  Task ${s.task_id} [${s.order_index}]: "${s.body}"`);
    }
  }
}

main().catch(console.error);
