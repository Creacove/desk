import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildManagerReadInstructions,
  managerReadJsonSchema,
  parseManagerReadOutput,
  type ManagerReadOutput,
  type ManagerReadPacket,
  type ManagerReadSubjectType,
} from "../_shared/openaiManagerRead.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-chartmetric-backfill-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GenerateMusicSummaryInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  subjectType: ManagerReadSubjectType;
  subjectId: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let runId: string | null = null;
  let usageId: string | null = null;
  let input: GenerateMusicSummaryInput | null = null;

  try {
    input = (await request.json()) as GenerateMusicSummaryInput;
    validateInput(input);

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const configuredBackfillToken = Deno.env.get("CHARTMETRIC_BACKFILL_TOKEN");
    const presentedBackfillToken = request.headers.get("X-Chartmetric-Backfill-Token");
    const isServiceRoleInvocation =
      authHeader === `Bearer ${serviceRoleKey}` ||
      Boolean(
        configuredBackfillToken &&
        presentedBackfillToken &&
        configuredBackfillToken === presentedBackfillToken
      );
    const scopedAuthHeader = isServiceRoleInvocation ? `Bearer ${serviceRoleKey}` : authHeader;
    const authClient = createClient(supabaseUrl, isServiceRoleInvocation ? serviceRoleKey : anonKey, {
      global: { headers: { Authorization: scopedAuthHeader } },
    });

    if (!isServiceRoleInvocation) {
      const {
        data: { user },
        error: userError,
      } = await authClient.auth.getUser();
      if (userError || !user) return json({ error: "Unauthorized." }, 401);

      const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", {
        target_account_id: input.accountId,
      });
      if (membershipError) throw membershipError;
      if (!membership) return json({ error: "Forbidden." }, 403);
    }

    const packet = await buildManagerReadPacket(authClient, input);
    runId = await createManagerSynthesisRun(authClient, input, packet);
    usageId = await createUsageEvent(authClient, input, runId);
    const output = await callOpenAIManagerRead(packet);
    await persistGeneratedRead(authClient, input, output, runId);
    await completeManagerSynthesisRun(authClient, runId, packet, output);
    await completeUsageEvent(authClient, usageId, output);
    await writeOperatingEventSafe(authClient, input, {
      eventType: "music_manager_read_generated",
      summary: `Generated Manager Read for ${readSubjectTitle(packet)}.`,
      payload: {
        manager_synthesis_run_id: runId,
        confidence: output.confidence,
        evidence_ids_used: output.evidenceIdsUsed,
      },
    });

    return json({ status: "completed", managerSynthesisRunId: runId, read: output });
  } catch (error) {
    if (runId && input) await markRunFailedSafe(runId, input, error);
    if (usageId && input) await markUsageFailedSafe(usageId, input, error);
    return json({ error: describeError(error, "Music Manager Read generation failed.") }, 500);
  }
});

async function buildManagerReadPacket(supabase: any, input: GenerateMusicSummaryInput): Promise<ManagerReadPacket> {
  const subject = input.subjectType === "music_item"
    ? await loadMusicItem(supabase, input)
    : await loadMusicProject(supabase, input);
  const identifiers = await loadIdentifiers(supabase, input);
  const evidence = await loadEvidence(supabase, input);
  const tracklist = input.subjectType === "music_project" ? await loadProjectTracklist(supabase, input) : [];
  const limitations = [
    readString(subject.source_limit) ? `Catalog source limit: ${readString(subject.source_limit)}` : undefined,
    ...evidence.map((item: Record<string, unknown>) => readString(item.limitation)).filter(Boolean),
    "Do not claim saves, repeat listeners, source-of-stream, revenue, conversion, campaign ROI, or rights certainty unless the packet contains direct proof.",
  ].filter((item): item is string => Boolean(item));

  return {
    subjectType: input.subjectType,
    subject,
    identifiers,
    evidence,
    tracklist,
    limitations: Array.from(new Set(limitations)),
    sourcePanelInstruction: "Provider names, provenance, confidence, and limitations belong in the Sources panel; the Manager Read should speak as the Manager.",
  };
}

async function callOpenAIManagerRead(packet: ManagerReadPacket): Promise<ManagerReadOutput> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: buildManagerReadInstructions(packet.subjectType),
        },
        {
          role: "user",
          content: JSON.stringify(packet),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...managerReadJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI Manager Read request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  return parseManagerReadOutput(readOutputText(payload));
}

function readOutputText(payload: unknown) {
  const output = isRecord(payload) && Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") return content.text;
    }
  }
  if (isRecord(payload) && typeof payload.output_text === "string") return payload.output_text;
  throw new Error("OpenAI response did not include structured output text.");
}

async function persistGeneratedRead(supabase: any, input: GenerateMusicSummaryInput, output: ManagerReadOutput, runId: string) {
  const table = input.subjectType === "music_item" ? "music_items" : "music_projects";
  const existing = input.subjectType === "music_item" ? await loadMusicItem(supabase, input) : await loadMusicProject(supabase, input);
  const metadata = isRecord(existing.metadata) ? existing.metadata : {};
  const nextMetadata = {
    ...metadata,
    manager_read: {
      ...output,
      generatedAt: new Date().toISOString(),
      managerSynthesisRunId: runId,
    },
  };
  const { error } = await supabase
    .from(table)
    .update({ metadata: nextMetadata })
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("id", input.subjectId);
  if (error) throw error;
}

async function loadMusicItem(supabase: any, input: GenerateMusicSummaryInput) {
  const { data, error } = await supabase
    .from("music_items")
    .select("id,title,item_type,lifecycle_stage,source_kind,source_limit,released_at,metadata")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("id", input.subjectId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Music item was not found for Manager Read generation.");
  return data as Record<string, unknown>;
}

async function loadMusicProject(supabase: any, input: GenerateMusicSummaryInput) {
  const { data, error } = await supabase
    .from("music_projects")
    .select("id,title,project_type,lifecycle_stage,source_kind,source_limit,released_at,metadata")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("id", input.subjectId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Music project was not found for Manager Read generation.");
  return data as Record<string, unknown>;
}

async function loadIdentifiers(supabase: any, input: GenerateMusicSummaryInput) {
  const column = input.subjectType === "music_item" ? "music_item_id" : "music_project_id";
  const { data, error } = await supabase
    .from("music_identifiers")
    .select("identifier_type,identifier_value")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq(column, input.subjectId);
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function loadEvidence(supabase: any, input: GenerateMusicSummaryInput) {
  const { data, error } = await supabase
    .from("evidence_items")
    .select("id,source,source_kind,evidence_type,subject_type,subject_id,subject_label,metric_name,metric_value,metric_unit,freshness,confidence,provenance,limitation,raw_ref")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("subject_type", input.subjectType)
    .eq("subject_id", input.subjectId)
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function loadProjectTracklist(supabase: any, input: GenerateMusicSummaryInput) {
  const { data, error } = await supabase
    .from("music_project_items")
    .select("music_item_id,display_title,order_index,disc_number")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("music_project_id", input.subjectId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function createManagerSynthesisRun(supabase: any, input: GenerateMusicSummaryInput, packet: ManagerReadPacket) {
  const { data, error } = await supabase
    .from("manager_synthesis_runs")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      trigger_type: "evidence_triggered",
      status: "running",
      classification: `${input.subjectType}_manager_read`,
      context_payload: packet,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function completeManagerSynthesisRun(supabase: any, runId: string, packet: ManagerReadPacket, output: ManagerReadOutput) {
  const { error } = await supabase
    .from("manager_synthesis_runs")
    .update({
      status: "completed",
      confidence: output.confidence,
      context_payload: packet,
      action_plan: [output],
      limitations: output.missingProof,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw error;
}

async function createUsageEvent(supabase: any, input: GenerateMusicSummaryInput, runId: string) {
  const { data, error } = await supabase
    .from("ai_run_usage_events")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      workflow_key: "music_readiness_run",
      run_type: "manager_synthesis",
      manager_synthesis_run_id: runId,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      provider: "openai",
      model_or_tool: Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      operation_key: "music_manager_read",
      status: "started",
      provider_request_count: 1,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function completeUsageEvent(supabase: any, usageId: string, output: ManagerReadOutput) {
  const { error } = await supabase
    .from("ai_run_usage_events")
    .update({
      status: "succeeded",
      output_tokens: output.managerRead.split(/\s+/).length,
      completed_at: new Date().toISOString(),
    })
    .eq("id", usageId);
  if (error) throw error;
}

async function writeOperatingEvent(
  supabase: any,
  input: GenerateMusicSummaryInput,
  draft: { eventType: string; summary: string; payload?: Record<string, unknown> },
) {
  const { error } = await supabase.from("operating_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    event_type: draft.eventType,
    actor_type: "manager",
    target_type: input.subjectType,
    target_id: input.subjectId,
    summary: draft.summary,
    payload: draft.payload ?? {},
  });
  if (error) throw error;
}

async function writeOperatingEventSafe(
  supabase: any,
  input: GenerateMusicSummaryInput,
  draft: { eventType: string; summary: string; payload?: Record<string, unknown> },
) {
  try {
    await writeOperatingEvent(supabase, input, draft);
  } catch (error) {
    console.error("Manager Read operating event write failed:", describeError(error, "Unknown operating event error."));
  }
}

async function markRunFailedSafe(runId: string, input: GenerateMusicSummaryInput, error: unknown) {
  try {
    const serviceClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const failureMessage = describeError(error, "Manager Read generation failed.");
    await serviceClient.from("manager_synthesis_runs").update({
      status: "failed",
      error: failureMessage,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);
    await writeOperatingEventSafe(serviceClient, input, {
      eventType: "music_manager_read_failed",
      summary: failureMessage,
    });
  } catch {
    // Preserve the original response when failure logging fails.
  }
}

async function markUsageFailedSafe(usageId: string, _input: GenerateMusicSummaryInput, error: unknown) {
  try {
    const serviceClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await serviceClient.from("ai_run_usage_events").update({
      status: "failed",
      failure_reason: describeError(error, "Manager Read generation failed."),
      completed_at: new Date().toISOString(),
    }).eq("id", usageId);
  } catch {
    // Preserve the original response when failure logging fails.
  }
}

function validateInput(input: GenerateMusicSummaryInput) {
  for (const [key, value] of Object.entries({
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    subjectId: input.subjectId,
  })) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`Missing required field: ${key}.`);
  }
  if (input.subjectType !== "music_item" && input.subjectType !== "music_project") {
    throw new Error("subjectType must be music_item or music_project.");
  }
}

function readSubjectTitle(packet: ManagerReadPacket) {
  return readString(packet.subject.title) ?? "Music subject";
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
