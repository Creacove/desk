import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";
import { manualSongWorkspaceCopy } from "../_shared/manualSongWorkspace.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SONG_TYPES = new Set(["song", "demo", "alternate_version"]);
const UNRELEASED_STAGES = new Set(["idea", "recording", "production", "mixing", "mastering", "ready", "scheduled"]);

type InitializeSongWorkspaceInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  requestId: string;
  title: string;
  itemType: string;
  lifecycleStage: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const input = validateInput(await request.json() as InitializeSongWorkspaceInput);
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const authClient = createClient(supabaseUrl, requireEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized." }, 401);

    const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", {
      target_account_id: input.accountId,
    });
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Forbidden." }, 403);
    await assertActiveWorkspaceEntitlement(authClient, input);

    const copy = manualSongWorkspaceCopy(input);
    const db = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const { data, error } = await db.rpc("create_manual_song_workspace_v1", {
      p_account_id: input.accountId,
      p_artist_workspace_id: input.artistWorkspaceId,
      p_artist_id: input.artistId,
      p_request_id: input.requestId,
      p_title: input.title,
      p_item_type: input.itemType,
      p_lifecycle_stage: input.lifecycleStage,
      p_mission_title: copy.missionTitle,
      p_mission_objective: copy.missionObjective,
      p_mission_summary: copy.missionSummary,
      p_checkpoint_title: copy.checkpointTitle,
      p_checkpoint_question: copy.checkpointQuestion,
      p_checkpoint_decision_rule: copy.checkpointDecisionRule,
      p_first_task_title: copy.firstTaskTitle,
      p_first_task_purpose: copy.firstTaskPurpose,
      p_opening_message: copy.openingMessage,
    });
    if (error) throw error;
    return json(data, 201);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Song workspace setup failed.";
    console.error("initialize-song-workspace failed", { message });
    return json({ error: message }, 400);
  }
});

function validateInput(value: InitializeSongWorkspaceInput) {
  const title = text(value?.title, 180);
  const itemType = text(value?.itemType, 80).toLowerCase();
  const lifecycleStage = text(value?.lifecycleStage, 80).toLowerCase();
  if (!isUuid(value?.accountId) || !isUuid(value?.artistWorkspaceId) || !isUuid(value?.artistId)) {
    throw new Error("Song workspace identity is invalid.");
  }
  if (!REQUEST_ID_PATTERN.test(value?.requestId ?? "")) throw new Error("Song workspace request ID is invalid.");
  if (!title) throw new Error("Song title is required.");
  if (!SONG_TYPES.has(itemType)) throw new Error("Song type is invalid.");
  if (!UNRELEASED_STAGES.has(lifecycleStage)) throw new Error("Choose an unreleased song stage.");
  return { ...value, title, itemType, lifecycleStage };
}

function isUuid(value: unknown) {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

function text(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
