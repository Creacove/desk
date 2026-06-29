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
  // 1. Inspect specific task
  const taskId = "ade1bbfc-32c0-4f74-8aa8-ea5e979fbae1";
  console.log("=== INSPECTING TASK ===");
  const { data: task, error } = await db.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (error) console.error("Task query error:", error);
  console.log(JSON.stringify(task, null, 2));

  // 2. Let's list all missions in the system
  console.log("\n=== ALL MISSIONS ===");
  const { data: missions, error: missionsErr } = await db.from("missions").select("id, title, status, pattern_name, created_at");
  if (missionsErr) console.error("Missions query error:", missionsErr);
  console.log(JSON.stringify(missions, null, 2));

  // 3. Let's list all tasks in the system
  console.log("\n=== ALL TASKS ===");
  const { data: tasks, error: tasksErr } = await db.from("tasks").select("id, mission_id, title, status, created_at");
  if (tasksErr) console.error("Tasks query error:", tasksErr);
  console.log(JSON.stringify(tasks, null, 2));
}

main().catch(console.error);
