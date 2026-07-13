import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";
import {
  buildPublicWebContextRequest,
  normalizePublicWebContextOutput,
  type PublicWebContextOutput,
} from "../_shared/manager-intelligence/publicWebContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RefreshPublicContextInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let input: RefreshPublicContextInput | null = null;
  let runId: string | null = null;
  let usageId: string | null = null;

  try {
    input = (await request.json()) as RefreshPublicContextInput;
    validateInput(input);

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized." }, 401);

    const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", {
      target_account_id: input.accountId,
    });
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Forbidden." }, 403);
    await assertActiveWorkspaceEntitlement(authClient, input);

    const db = createClient(supabaseUrl, serviceRoleKey);
    const profile = await loadArtistProfile(db, input);
    runId = await createManagerRun(db, input, profile);
    usageId = await createUsageEvent(db, input, runId);

    const output = await callOpenAIPublicWebContext(profile);
    const evidenceRows = normalizePublicWebContextOutput({
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      artistName: profile.artistName,
      output,
      createdFromRunId: runId,
    }).map(({ metadata: _metadata, ...row }) => row);

    let insertedEvidenceIds: string[] = [];
    if (evidenceRows.length) {
      const { data, error } = await db.from("evidence_items").insert(evidenceRows).select("id");
      if (error) throw error;
      insertedEvidenceIds = (data ?? []).map((row: { id: string }) => row.id);
    }

    await writeOperatingEvent(db, input, runId, insertedEvidenceIds);
    await completeManagerRun(db, runId, insertedEvidenceIds);
    await completeUsageEvent(db, usageId);

    return json({
      status: "completed",
      managerSynthesisRunId: runId,
      evidenceItemIds: insertedEvidenceIds,
    });
  } catch (error) {
    const message = describeError(error, "Public context refresh failed.");
    if (runId) await markRunFailedSafe(runId, message);
    if (usageId) await markUsageFailedSafe(usageId, message);
    return json({ error: message }, 500);
  }
});

function validateInput(input: RefreshPublicContextInput) {
  for (const [key, value] of Object.entries({
    accountId: input?.accountId,
    artistWorkspaceId: input?.artistWorkspaceId,
    artistId: input?.artistId,
  })) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`Missing required field: ${key}.`);
  }
}

async function loadArtistProfile(db: any, input: RefreshPublicContextInput) {
  const { data, error } = await db
    .from("artist_profiles")
    .select("display_name,genres,home_market,social_handles")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Artist profile was not found.");
  return {
    artistName: readString(data.display_name) ?? "the artist",
    homeMarket: readString(data.home_market),
    genres: Array.isArray(data.genres) ? data.genres.filter((item: unknown): item is string => typeof item === "string") : [],
    socialHandles: isRecord(data.social_handles) ? data.social_handles as Record<string, string> : {},
  };
}

async function callOpenAIPublicWebContext(profile: {
  artistName: string;
  homeMarket?: string;
  genres: string[];
  socialHandles: Record<string, string>;
}): Promise<PublicWebContextOutput> {
  const request = buildPublicWebContextRequest(profile);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...request,
      model: Deno.env.get("OPENAI_PUBLIC_CONTEXT_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || request.model,
      text: {
        format: {
          type: "json_schema",
          name: "public_web_context_v1",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["findings"],
            properties: {
              findings: {
                type: "array",
                maxItems: 12,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "url", "sourceDomain", "publishedAt", "contextType", "claim", "managementUse", "strategyFields"],
                  properties: {
                    title: { type: "string" },
                    url: { type: "string" },
                    sourceDomain: { type: "string" },
                    publishedAt: { type: "string" },
                    contextType: { type: "string" },
                    claim: { type: "string" },
                    managementUse: { type: "string" },
                    strategyFields: {
                      type: "object",
                      additionalProperties: false,
                      required: ["publicNarrative", "artistIdentityClues", "collaborationClues", "marketClues", "riskClues", "missionImplications"],
                      properties: {
                        publicNarrative: { type: "string" },
                        artistIdentityClues: { type: "array", items: { type: "string" } },
                        collaborationClues: { type: "array", items: { type: "string" } },
                        marketClues: { type: "array", items: { type: "string" } },
                        riskClues: { type: "array", items: { type: "string" } },
                        missionImplications: { type: "array", items: { type: "string" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI public context search failed with status ${response.status}: ${body.slice(0, 500)}`);
  }
  return JSON.parse(readOutputText(await response.json())) as PublicWebContextOutput;
}

async function createManagerRun(db: any, input: RefreshPublicContextInput, profile: unknown) {
  const { data, error } = await db.from("manager_synthesis_runs").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    trigger_type: "evidence_triggered",
    status: "running",
    classification: "public_web_context_refresh",
    confidence: "low",
    context_payload: { profile },
    steps_payload: [{ step: "web_search", status: "running" }],
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function createUsageEvent(db: any, input: RefreshPublicContextInput, runId: string) {
  const { data, error } = await db.from("ai_run_usage_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    workflow_key: "source_sync",
    run_type: "source_sync",
    manager_synthesis_run_id: runId,
    subject_type: "artist",
    subject_id: input.artistId,
    provider: "openai",
    model_or_tool: Deno.env.get("OPENAI_PUBLIC_CONTEXT_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
    operation_key: "public_web_context_refresh",
    status: "started",
    provider_request_count: 1,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function writeOperatingEvent(db: any, input: RefreshPublicContextInput, runId: string, evidenceItemIds: string[]) {
  const { error } = await db.from("operating_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    event_type: "public_web_context_refreshed",
    actor_type: "manager",
    target_type: "artist",
    target_id: input.artistId,
    source_type: "public_web_context_refresh",
    source_id: runId,
    manager_synthesis_run_id: runId,
    summary: evidenceItemIds.length
      ? `Saved ${evidenceItemIds.length} public web context evidence item${evidenceItemIds.length === 1 ? "" : "s"}.`
      : "Public web context refresh completed with no URL-backed findings.",
    payload: { evidenceItemIds },
  });
  if (error) throw error;
}

async function completeManagerRun(db: any, runId: string, evidenceItemIds: string[]) {
  const { error } = await db.from("manager_synthesis_runs").update({
    status: "completed",
    steps_payload: [{ step: "web_search", status: "completed" }, { step: "evidence_written", status: "completed" }],
    action_plan: evidenceItemIds,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
  if (error) throw error;
}

async function completeUsageEvent(db: any, usageId: string) {
  const { error } = await db.from("ai_run_usage_events").update({
    status: "succeeded",
    completed_at: new Date().toISOString(),
  }).eq("id", usageId);
  if (error) throw error;
}

async function markRunFailedSafe(runId: string, message: string) {
  try {
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await db.from("manager_synthesis_runs").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", runId);
  } catch { /* preserve original error */ }
}

async function markUsageFailedSafe(usageId: string, message: string) {
  try {
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await db.from("ai_run_usage_events").update({ status: "failed", failure_reason: message, completed_at: new Date().toISOString() }).eq("id", usageId);
  } catch { /* preserve original error */ }
}

function readOutputText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string" && content.text.trim()) return content.text;
    }
  }
  throw new Error("OpenAI public context response did not contain structured output text.");
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function describeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) return error.message.trim();
  return fallback;
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
