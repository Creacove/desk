import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { captureAppError } from "../_shared/appError.ts";
import { buildCareerWatchRequest, normalizeCareerWatchOutput, type CareerWatchOutput } from "../_shared/manager-intelligence/careerWatch.ts";
import { boundedProviderTimeoutMs, claimRuntimeAdmission, fetchProviderWithTimeout, finishRuntimeAdmission } from "../_shared/managerRuntimeGuardrails.ts";

const OPPORTUNITY_SCHEMA = { type: "object", additionalProperties: false, required: ["findings"], properties: { findings: { type: "array", maxItems: 16, items: { type: "object", additionalProperties: false, required: ["title", "url", "sourceDomain", "publishedAt", "opportunityType", "subjectName", "claim", "whyItMatters", "fitReason", "recommendedDecision", "urgency", "confidence", "missionObjective", "nextMove", "riskOrLimitation"], properties: { title: { type: "string" }, url: { type: "string" }, sourceDomain: { type: "string" }, publishedAt: { type: "string" }, opportunityType: { type: "string", enum: ["playlist", "press", "collaboration", "live", "brand", "sync", "market", "audience", "cultural_moment", "risk", "other"] }, subjectName: { type: "string" }, claim: { type: "string" }, whyItMatters: { type: "string" }, fitReason: { type: "string" }, recommendedDecision: { type: "string", enum: ["act", "watch", "ignore"] }, urgency: { type: "string", enum: ["now", "soon", "later"] }, confidence: { type: "string", enum: ["high", "medium", "low"] }, missionObjective: { type: "string" }, nextMove: { type: "string" }, riskOrLimitation: { type: "string" } } } } } };
type Input = { accountId: string; artistWorkspaceId: string; artistId: string; executionToken: string; trigger?: "scheduled" };

Deno.serve(withAppErrorCapture("manager-career-watch", async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const auth = request.headers.get("Authorization") ?? "";
  const workerSecret = request.headers.get("x-workflow-worker-secret") ?? "";
  if (!constantTimeEqual(auth, `Bearer ${serviceRoleKey}`) && !constantTimeEqual(workerSecret, requireEnv("WORKFLOW_WORKER_SECRET"))) return json({ error: "Unauthorized." }, 401);
  const input = await request.json() as Input;
  for (const [key, value] of Object.entries({ accountId: input?.accountId, artistWorkspaceId: input?.artistWorkspaceId, artistId: input?.artistId, executionToken: input?.executionToken })) if (typeof value !== "string" || !value.trim()) return json({ error: `Missing required field: ${key}.` }, 400);

  const db = createClient(requireEnv("SUPABASE_URL"), serviceRoleKey);
  let runId: string | null = null;
  let usageId: string | null = null;
  let admissionId: string | null = null;
  try {
    const { data: leaseStarted, error: leaseError } = await db.rpc("begin_manager_career_watch_execution_v1", { p_account_id: input.accountId, p_artist_workspace_id: input.artistWorkspaceId, p_artist_id: input.artistId, p_execution_token: input.executionToken });
    if (leaseError) throw leaseError;
    if (leaseStarted !== true) return json({ status: "not_claimed" }, 202);
    const admission = await claimRuntimeAdmission(db, { accountId: input.accountId, artistWorkspaceId: input.artistWorkspaceId, artistId: input.artistId, operationKey: "career_watch", requestSlots: 1, ttlSeconds: 180 });
    if (!admission.allowed) {
      await finishCareerWatchExecution(db, input, null, false, `Runtime admission deferred: ${admission.reason ?? "runtime_capacity"}`);
      return json({ status: "deferred", reason: admission.reason ?? "runtime_capacity" }, 202);
    }
    admissionId = typeof admission.admissionId === "string" ? admission.admissionId : null;
    const [profile, knowledge] = await Promise.all([loadProfile(db, input), loadManagerKnowledge(db, input)]);
    runId = await createRun(db, input, profile, knowledge);
    usageId = await createUsageEvent(db, input, runId);
    const providerResult = await searchCareerWatch(profile, knowledge);
    await completeUsageEvent(db, usageId, providerResult.usage);

    const rows = normalizeCareerWatchOutput({ ...input, artistName: profile.artistName, output: providerResult.output, createdFromRunId: runId });
    const evidence = await persistEvidence(db, input, rows) as Array<{ id: string; metadata: any; subject_label: string }>;
    const actionable = evidence.filter((row) => row.metadata?.recommended_decision === "act");
    await writeEvents(db, input, runId, evidence);
    const reviewIds = await queueManagerReviews(db, runId, actionable);
    const dispatched = await dispatchManagerReviews(reviewIds);
    await db.from("manager_synthesis_runs").update({ status: "completed", action_plan: evidence.map((row) => row.id), steps_payload: [{ step: "career_watch_search", status: "completed", count: evidence.length }, { step: "adaptive_manager_reviews_queued", status: "completed", count: reviewIds.length }, { step: "adaptive_manager_reviews_dispatched", status: "completed", count: dispatched }], completed_at: new Date().toISOString() }).eq("id", runId);
    if (!await finishCareerWatchExecution(db, input, runId, true)) throw new Error("Career Watch execution lease was superseded before completion.");
    try { await finishRuntimeAdmission(db, admissionId, "completed"); } catch (error) { console.warn("manager-career-watch: admission finalization failed after durable completion", describe(error)); }
    return json({ status: "completed", runId, findings: evidence.length, actionable: actionable.length, reviewIds, dispatched, evidenceItemIds: evidence.map((row) => row.id) });
  } catch (error) {
    const message = describe(error);
    try { await finishRuntimeAdmission(db, admissionId, "failed", message); } catch { /* Lease expiry is the fallback. */ }
    if (usageId) try { await db.from("ai_run_usage_events").update({ status: "failed", failure_reason: message.slice(0, 1000), completed_at: new Date().toISOString() }).eq("id", usageId).eq("status", "started"); } catch { /* Recovery owns stale started rows. */ }
    if (runId) try { await db.from("manager_synthesis_runs").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", runId).eq("status", "running"); } catch { /* Recovery owns stale running rows. */ }
    try { await finishCareerWatchExecution(db, input, runId, false, message); } catch { /* A newer lease owns state. */ }
    await captureAppError(error, { functionName: "manager-career-watch", operation: "career_watch", source: "worker", publicMessage: "Career Watch could not complete.", accountId: input?.accountId, artistWorkspaceId: input?.artistWorkspaceId, artistId: input?.artistId, provider: "openai", refs: { manager_run_id: runId, usage_event_id: usageId } }).catch(() => undefined);
    return json({ error: message }, 500);
  }
}));

async function loadProfile(db: any, input: Input) { const { data, error } = await db.from("artist_profiles").select("display_name,home_market,genres,current_goal,artist_direction,social_handles").eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId).maybeSingle(); if (error) throw error; if (!data) throw new Error("Artist profile was not found."); return { artistName: String(data.display_name || "the artist"), homeMarket: data.home_market, genres: Array.isArray(data.genres) ? data.genres : [], currentGoal: data.current_goal, artistDirection: data.artist_direction, socialHandles: isRecord(data.social_handles) ? data.social_handles : {} }; }
async function loadManagerKnowledge(db: any, input: Input) { const { data, error } = await db.rpc("manager_knowledge_context_v1", { p_account_id: input.accountId, p_artist_workspace_id: input.artistWorkspaceId, p_artist_id: input.artistId, p_focus_type: null, p_focus_id: null }); if (error) throw error; return data ?? {}; }
async function createRun(db: any, input: Input, profile: unknown, knowledge: unknown) { const { data, error } = await db.from("manager_synthesis_runs").insert({ account_id: input.accountId, artist_workspace_id: input.artistWorkspaceId, artist_id: input.artistId, trigger_type: "evidence_triggered", status: "running", classification: "manager_career_watch_v1", confidence: "unknown", context_payload: { trigger: input.trigger ?? "scheduled", profile, knowledge }, steps_payload: [{ step: "career_watch_search", status: "running" }], started_at: new Date().toISOString() }).select("id").single(); if (error) throw error; return String(data.id); }
async function createUsageEvent(db: any, input: Input, runId: string) { const { data, error } = await db.from("ai_run_usage_events").insert({ account_id: input.accountId, artist_workspace_id: input.artistWorkspaceId, artist_id: input.artistId, workflow_key: "review_run", run_type: "manager_synthesis", manager_synthesis_run_id: runId, subject_type: "artist", subject_id: input.artistId, provider: "openai", model_or_tool: careerWatchModel(), operation_key: "manager_career_watch_v1", status: "started", provider_request_count: 1 }).select("id").single(); if (error) throw error; return String(data.id); }
async function completeUsageEvent(db: any, usageId: string, usage: Record<string, unknown>) { const outputDetails = record(usage.output_tokens_details); const inputDetails = record(usage.input_tokens_details); const { error } = await db.from("ai_run_usage_events").update({ status: "succeeded", input_tokens: numericUsage(usage.input_tokens), cached_input_tokens: numericUsage(inputDetails.cached_tokens), output_tokens: numericUsage(usage.output_tokens), reasoning_tokens: numericUsage(outputDetails.reasoning_tokens), tool_call_count: numericUsage(usage.tool_call_count), provider_request_count: 1, completed_at: new Date().toISOString(), metadata: usage }).eq("id", usageId).eq("status", "started"); if (error) throw error; }
async function searchCareerWatch(profile: any, knowledge: unknown): Promise<{ output: CareerWatchOutput; usage: Record<string, unknown> }> { const req = buildCareerWatchRequest(profile, knowledge); const response = await fetchProviderWithTimeout("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...req, model: careerWatchModel(), text: { format: { type: "json_schema", name: "manager_career_watch_v1", strict: true, schema: OPPORTUNITY_SCHEMA } } }) }, boundedProviderTimeoutMs(Deno.env.get("OPENAI_PROVIDER_TIMEOUT_MS"), 90_000)); if (!response.ok) throw new Error(`Career Watch search failed with status ${response.status}: ${(await response.text()).slice(0, 500)}`); const payload = await response.json(); const output = JSON.parse(readOutputText(payload)) as CareerWatchOutput; if (!output || !Array.isArray(output.findings)) throw new Error("Career Watch response violated its structured contract."); return { output, usage: record(payload.usage) }; }
async function persistEvidence(db: any, input: Input, rows: unknown[]) { if (!rows.length) return []; const { data, error } = await db.rpc("persist_manager_career_watch_evidence_v1", { p_account_id: input.accountId, p_artist_workspace_id: input.artistWorkspaceId, p_artist_id: input.artistId, p_rows: rows }); if (error) throw error; return Array.isArray(data) ? data : []; }
async function finishCareerWatchExecution(db: any, input: Input, runId: string | null, succeeded: boolean, errorMessage?: string) { const { data, error } = await db.rpc("finish_manager_career_watch_execution_v1", { p_account_id: input.accountId, p_artist_workspace_id: input.artistWorkspaceId, p_artist_id: input.artistId, p_execution_token: input.executionToken, p_run_id: runId, p_succeeded: succeeded, p_error: errorMessage ?? null }); if (error) throw error; return data === true; }
async function writeEvents(db: any, input: Input, runId: string, rows: any[]) { const events = rows.map((row) => ({ account_id: input.accountId, artist_workspace_id: input.artistWorkspaceId, artist_id: input.artistId, event_type: row.metadata?.recommended_decision === "act" ? "manager_career_watch_actionable" : "manager_career_watch_observed", actor_type: "manager", target_type: "artist", target_id: input.artistId, source_type: "manager_career_watch", source_id: row.id, manager_synthesis_run_id: runId, display_mode: row.metadata?.recommended_decision === "act" ? "action" : "evidence", refresh_scope: ["activity", "today"], summary: `${row.subject_label}: ${row.metadata?.why_it_matters || row.metadata?.claim || "Career Watch found relevant public context."}`, payload: { evidenceItemId: row.id, ...row.metadata } })); if (!events.length) return; const { error } = await db.from("operating_events").insert(events); if (error) throw error; }
async function queueManagerReviews(db: any, runId: string, rows: any[]) { const ids: string[] = []; for (const row of rows.slice(0, 4)) { const { data, error } = await db.rpc("queue_manager_career_watch_review_v1", { p_evidence_id: row.id, p_run_id: runId }); if (error) throw error; if (data) ids.push(String(data)); } return ids; }
async function dispatchManagerReviews(reviewIds: string[]) { let dispatched = 0; const base = requireEnv("SUPABASE_URL").replace(/\/$/, ""); const secret = requireEnv("WORKFLOW_WORKER_SECRET"); for (const reviewId of reviewIds) { try { const response = await fetchProviderWithTimeout(`${base}/functions/v1/workflow-recovery`, { method: "POST", headers: { "Content-Type": "application/json", "x-workflow-worker-secret": secret }, body: JSON.stringify({ mode: "adaptive_replan", reviewId, source: "manager-career-watch" }) }, 30_000); if (response.ok) dispatched += 1; } catch { /* Durable due review remains recoverable by the scheduled runtime dispatcher. */ } } return dispatched; }
function careerWatchModel() { return Deno.env.get("OPENAI_CAREER_WATCH_MODEL") || Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || "gpt-5-mini"; }
function readOutputText(payload: any) { if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text; for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (typeof content?.text === "string" && content.text.trim()) return content.text; throw new Error("Career Watch response contained no structured output."); }
function numericUsage(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null; }
function record(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }
function isRecord(value: unknown): value is Record<string, any> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function requireEnv(key: string) { const value = Deno.env.get(key); if (!value) throw new Error(`Missing required environment variable: ${key}`); return value; }
function describe(error: unknown) { return error instanceof Error ? error.message : typeof error === "string" ? error : "Career Watch failed."; }
function constantTimeEqual(left: string, right: string) { if (!left || !right || left.length !== right.length) return false; let diff = 0; for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i); return diff === 0; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
