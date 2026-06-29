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
  console.log("=== RECENT RUN ACTIONS ===");
  const { data: actions, error } = await db
    .from("manager_run_actions")
    .select("id, manager_synthesis_run_id, action_type, status, payload, result_payload, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Query error:", error);
    return;
  }

  for (const a of actions ?? []) {
    console.log(`\nAction ID: ${a.id} Created: ${a.created_at}`);
    console.log(`Type: ${a.action_type} | Status: ${a.status}`);
    console.log(`Error: ${a.error_message ?? "none"}`);
    console.log(`Result: ${JSON.stringify(a.result_payload, null, 2)}`);
    console.log(`Payload outcome: ${a.payload?.outcome}`);
    console.log(`Payload checkpoints count: ${a.payload?.checkpoints?.length}`);
    console.log(`Payload tasks count: ${a.payload?.tasks?.length}`);
    if (a.payload?.checkpoints?.length) {
      console.log(`Checkpoints: ${JSON.stringify(a.payload.checkpoints, null, 2)}`);
    }
    if (a.payload?.tasks?.length) {
      console.log(`Tasks: ${JSON.stringify(a.payload.tasks, null, 2)}`);
    }
  }
}

main().catch(console.error);
