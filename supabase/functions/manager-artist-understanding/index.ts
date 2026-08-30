import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { captureAppError } from "../_shared/appError.ts";
import { boundedProviderTimeoutMs, claimRuntimeAdmission, fetchProviderWithTimeout, finishRuntimeAdmission } from "../_shared/managerRuntimeGuardrails.ts";

type QueueRow = {
  id: string;
  account_id: string;
  artist_workspace_id: string;
  artist_id: string;
  source_kind: "conversation_message" | "context_answer" | "document";
  source_id: string;
  source_version_id: string | null;
  attempt_count: number;
  max_attempts: number;
  lease_token: string;
};

type AllowedScope = {
  scopeType: "artist" | "music_item" | "music_project";
  scopeId: string;
  label: string;
};

type SourceMaterial = {
  text: string;
  sourceLabel: string;
  sourceKind: "artist_statement" | "lyrics_document" | "uploaded_document";
  authority: "artist_confirmed" | "supported";
  sourceType: string;
  sourceRef: string;
  allowedScopes: AllowedScope[];
};

type ExtractedClaim = {
  scopeType: "artist" | "music_item" | "music_project";
  scopeId: string;
  key: string;
  category: string;
  statement: string;
  confidence: "high" | "medium" | "low";
  directlyAsserted: boolean;
};

const SEMANTIC_CATEGORIES = new Set([
  "artist_identity",
  "creative_direction",
  "positioning",
  "influence",
  "song_meaning",
  "theme",
  "cultural_context",
  "creative_intent",
  "communication",
  "audience_context",
  "community_context",
  "narrative",
  "why_it_matters",
]);

const SEMANTIC_KEY_PREFIXES = [
  "artist.identity",
  "artist.creative_direction",
  "artist.positioning",
  "artist.influence",
  "artist.communication",
  "artist.audience_context",
  "artist.community_context",
  "artist.narrative",
  "music.meaning",
  "music.theme",
  "music.cultural_context",
  "music.creative_intent",
  "music.communication",
  "music.audience_context",
  "music.community_context",
  "music.narrative",
  "music.why_it_matters",
  "song.meaning",
  "song.theme",
  "song.cultural_context",
  "song.creative_intent",
  "song.communication",
  "song.audience_context",
  "song.community_context",
  "song.narrative",
  "song.why_it_matters",
];

const extractionSchema = {
  name: "artist_understanding_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["claims"],
    properties: {
      claims: {
        type: "array",
        maxItems: 18,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["scopeType", "scopeId", "key", "category", "statement", "confidence", "directlyAsserted"],
          properties: {
            scopeType: { type: "string", enum: ["artist", "music_item", "music_project"] },
            scopeId: { type: "string" },
            key: { type: "string" },
            category: { type: "string", enum: [...SEMANTIC_CATEGORIES] },
            statement: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            directlyAsserted: { type: "boolean" },
          },
        },
      },
    },
  },
} as const;

Deno.serve(withAppErrorCapture("manager-artist-understanding", async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const suppliedSecret = request.headers.get("x-workflow-worker-secret") ?? "";
  const expectedSecret = requireEnv("WORKFLOW_WORKER_SECRET");
  if (!constantTimeEqual(suppliedSecret, expectedSecret)) return json({ error: "Unauthorized." }, 401);

  const body = await request.json().catch(() => ({}));
  const batchSize = Math.max(1, Math.min(20, integer(body?.batchSize, 6)));
  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const results: Array<Record<string, unknown>> = [];
  const startedAt = Date.now();

  for (let index = 0; index < batchSize && Date.now() - startedAt < 100_000; index += 1) {
    const { data: claimed, error: claimError } = await db.rpc("claim_artist_understanding_ingestion_v1", { batch_size: 1 });
    if (claimError) throw claimError;
    const row = Array.isArray(claimed) ? claimed.find(isQueueRow) : null;
    if (!row) break;
    let admissionId: string | null = null;
    let usageId: string | null = null;
    try {
      const material = await loadSourceMaterial(db, row);
      if (!material || !material.text.trim()) {
        await completeEmptyQueue(db, row);
        results.push({ id: row.id, status: "completed_no_current_text", claims: 0 });
        continue;
      }

      const remainingProviderBudgetMs = 100_000 - (Date.now() - startedAt) - 5_000;
      if (remainingProviderBudgetMs < 10_000) {
        await deferQueue(db, row, "Artist Understanding worker reached its safe invocation budget.");
        results.push({ id: row.id, status: "deferred", reason: "invocation_budget" });
        break;
      }

      const admission = await claimRuntimeAdmission(db, {
        accountId: row.account_id,
        artistWorkspaceId: row.artist_workspace_id,
        artistId: row.artist_id,
        operationKey: "artist_understanding",
        requestSlots: 1,
        ttlSeconds: 180,
      });
      if (!admission.allowed) {
        await deferQueue(db, row, `Manager runtime admission deferred: ${admission.reason ?? "capacity_limit"}`);
        results.push({ id: row.id, status: "deferred", reason: admission.reason ?? "capacity_limit" });
        continue;
      }
      admissionId = typeof admission.admissionId === "string" ? admission.admissionId : null;
      usageId = await createUsageEvent(db, row);
      const extraction = await extractSemanticClaims(material, row.source_kind, remainingProviderBudgetMs);
      const acceptedClaims = validateClaims(extraction.claims, material, row.source_kind);
      await completeUsageEvent(db, usageId, extraction.usage);
      await finalizeQueue(db, row, material, acceptedClaims);
      try {
        await finishRuntimeAdmission(db, admissionId, "completed");
      } catch (error) {
        console.warn("manager-artist-understanding: admission finalization failed after durable completion", describeError(error));
      }
      results.push({ id: row.id, status: "completed", claims: acceptedClaims.length });
    } catch (error) {
      const message = describeError(error);
      await failUsageSafe(db, usageId, message);
      try {
        await finishRuntimeAdmission(db, admissionId, "failed", message);
      } catch {
        // The admission lease expires automatically; preserve the original failure.
      }
      try {
        await db.rpc("fail_artist_understanding_ingestion_v2", { p_queue_id: row.id, p_lease_token: row.lease_token, p_error: message });
      } catch {
        // Best effort only; capture the original ingestion error below.
      }
      await captureAppError(error, {
        functionName: "manager-artist-understanding",
        operation: "semantic_understanding_ingestion",
        source: "worker",
        publicMessage: "Artist understanding ingestion failed.",
        accountId: row.account_id,
        artistWorkspaceId: row.artist_workspace_id,
        artistId: row.artist_id,
        provider: "openai",
        refs: { queue_id: row.id, source_id: row.source_id, source_kind: row.source_kind },
        context: { attempt: row.attempt_count, maxAttempts: row.max_attempts },
      }).catch(() => undefined);
      results.push({ id: row.id, status: "requeued_or_failed", error: message });
    }
  }

  return json({ processed: results.length, results });
}));

async function loadSourceMaterial(db: any, row: QueueRow): Promise<SourceMaterial | null> {
  const allowedScopes = await loadCatalogScopes(db, row);

  if (row.source_kind === "conversation_message") {
    const { data, error } = await db.from("conversation_messages")
      .select("id,speaker,body,conversation_id,created_at")
      .eq("id", row.source_id)
      .eq("account_id", row.account_id)
      .eq("artist_workspace_id", row.artist_workspace_id)
      .eq("artist_id", row.artist_id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.speaker !== "artist") return null;
    return {
      text: String(data.body ?? "").trim(),
      sourceLabel: "Artist conversation statement",
      sourceKind: "artist_statement",
      authority: "artist_confirmed",
      sourceType: "conversation_message",
      sourceRef: `conversation_message:${data.id}`,
      allowedScopes,
    };
  }

  if (row.source_kind === "context_answer") {
    const { data: answer, error } = await db.from("manager_context_answers")
      .select("id,question_id,answer,created_at")
      .eq("id", row.source_id)
      .eq("account_id", row.account_id)
      .eq("artist_workspace_id", row.artist_workspace_id)
      .eq("artist_id", row.artist_id)
      .maybeSingle();
    if (error) throw error;
    if (!answer) return null;
    const { data: question, error: questionError } = await db.from("manager_context_questions")
      .select("question")
      .eq("id", answer.question_id)
      .maybeSingle();
    if (questionError) throw questionError;
    const questionText = String(question?.question ?? "").trim();
    const answerText = String(answer.answer ?? "").trim();
    return {
      text: questionText ? `Question: ${questionText}\nArtist answer: ${answerText}` : answerText,
      sourceLabel: "Artist answer to Manager context question",
      sourceKind: "artist_statement",
      authority: "artist_confirmed",
      sourceType: "manager_context_answer",
      sourceRef: `manager_context_answer:${answer.id}`,
      allowedScopes,
    };
  }

  const { data: document, error: documentError } = await db.from("documents")
    .select("id,title,document_type,origin,status,summary,current_version_id,metadata")
    .eq("id", row.source_id)
    .eq("account_id", row.account_id)
    .eq("artist_workspace_id", row.artist_workspace_id)
    .eq("artist_id", row.artist_id)
    .maybeSingle();
  if (documentError) throw documentError;
  if (!document || !document.current_version_id) return null;
  if (["superseded", "revoked", "failed"].includes(String(document.status ?? ""))) return null;

  const currentVersionId = String(document.current_version_id);
  if (row.source_version_id && row.source_version_id !== currentVersionId) return null;
  const versionId = currentVersionId;
  const { data: version, error: versionError } = await db.from("document_versions")
    .select("id,version_number,manager_output_id,file_name,file_type,extraction_status,extracted_text_ref,metadata")
    .eq("id", versionId)
    .eq("document_id", document.id)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version) return null;

  let managerOutput: Record<string, unknown> | null = null;
  if (version.manager_output_id) {
    const { data, error } = await db.from("manager_outputs")
      .select("summary,render_json,blocks_json,hero_json,primary_recommendation_json")
      .eq("id", version.manager_output_id)
      .maybeSingle();
    if (error) throw error;
    managerOutput = isRecord(data) ? data : null;
  }

  const documentScopes = await loadDocumentScopes(db, row, document.id, allowedScopes);
  const text = compactSourceText([
    document.summary,
    textFromJson(document.metadata),
    textFromJson(version.metadata),
    managerOutput?.summary,
    textFromJson(managerOutput?.render_json),
    textFromJson(managerOutput?.blocks_json),
    textFromJson(managerOutput?.hero_json),
    textFromJson(managerOutput?.primary_recommendation_json),
  ]);
  const isLyrics = /lyric/i.test(String(document.document_type ?? "")) || /lyric/i.test(String(document.title ?? ""));

  return {
    text,
    sourceLabel: `${document.document_type ?? "document"}: ${document.title ?? "Untitled"}`,
    sourceKind: isLyrics ? "lyrics_document" : "uploaded_document",
    authority: "supported",
    sourceType: "document_semantic_extraction",
    sourceRef: `document:${document.id}:version:${version.id}`,
    allowedScopes: documentScopes,
  };
}

async function loadCatalogScopes(db: any, row: QueueRow): Promise<AllowedScope[]> {
  const [itemsResult, projectsResult] = await Promise.all([
    db.from("music_items").select("id,title").eq("artist_workspace_id", row.artist_workspace_id).eq("artist_id", row.artist_id).eq("status", "active").limit(80),
    db.from("music_projects").select("id,title").eq("artist_workspace_id", row.artist_workspace_id).eq("artist_id", row.artist_id).eq("status", "active").limit(40),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (projectsResult.error) throw projectsResult.error;
  return [
    { scopeType: "artist", scopeId: "", label: "Artist" },
    ...((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((item) => ({ scopeType: "music_item" as const, scopeId: String(item.id), label: String(item.title ?? "Song") })),
    ...((projectsResult.data ?? []) as Array<Record<string, unknown>>).map((project) => ({ scopeType: "music_project" as const, scopeId: String(project.id), label: String(project.title ?? "Project") })),
  ];
}

async function loadDocumentScopes(db: any, row: QueueRow, documentId: string, fallback: AllowedScope[]) {
  const { data, error } = await db.from("artifact_links")
    .select("target_type,target_id")
    .eq("account_id", row.account_id)
    .eq("artist_workspace_id", row.artist_workspace_id)
    .eq("artist_id", row.artist_id)
    .eq("source_type", "document")
    .eq("source_id", documentId)
    .in("target_type", ["music_item", "music_project"]);
  if (error) throw error;
  const linkedKeys = new Set((data ?? []).map((link: Record<string, unknown>) => `${link.target_type}:${link.target_id}`));
  const linked = fallback.filter((scope) => scope.scopeType === "artist" || linkedKeys.has(`${scope.scopeType}:${scope.scopeId}`));
  return linked.length > 1 ? linked : fallback;
}

async function extractSemanticClaims(material: SourceMaterial, sourceKind: QueueRow["source_kind"], remainingProviderBudgetMs: number): Promise<{ claims: ExtractedClaim[]; usage: Record<string, unknown> }> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const artistControlled = sourceKind === "conversation_message" || sourceKind === "context_answer";
  const allowedScopeText = material.allowedScopes.map((scope) => `${scope.scopeType}:${scope.scopeId || "artist"} = ${scope.label}`).join("\n");
  const instructions = [
    "You extract durable semantic artist/music understanding for Desk, an artist Manager. This is knowledge extraction, not campaign planning.",
    "Extract ONLY semantic meaning that can matter to future management decisions: artist identity, creative direction, positioning, influences, song/project meaning, themes, cultural context, creative intent, what the artist is trying to communicate, audience/community context, narrative, or why the music matters.",
    "DO NOT extract resources, budget, collaborators, equipment, locations, availability, team capacity, deadlines, operational constraints or other execution facts. Those belong to the World Model.",
    artistControlled
      ? "This is artist-controlled text. A claim is eligible only when the artist directly states or clearly confirms it. Do not infer hidden meaning, cultural references, identity, or positioning. directlyAsserted must be true for every returned claim. If the artist is merely asking a question, brainstorming, quoting someone else, or discussing an unconfirmed possibility, return no claim."
      : "This is source material. You may form a careful supported interpretation, but never label interpretation as artist-confirmed. Keep claims close to the actual text and use low/medium confidence when meaning is ambiguous.",
    "Use artist scope for durable artist-level identity/direction/positioning. Use a music_item or music_project scope only when the source explicitly concerns that named music asset. Never invent a scope ID.",
    "Allowed scopes are listed below. scopeId must be empty for artist scope and must exactly match an allowed UUID for music_item/music_project.",
    "Keys must be durable namespaced semantic keys. Artist keys begin artist.identity, artist.creative_direction, artist.positioning, artist.influence, artist.communication, artist.audience_context, artist.community_context, or artist.narrative. Music keys begin music.meaning, music.theme, music.cultural_context, music.creative_intent, music.communication, music.audience_context, music.community_context, music.narrative, or music.why_it_matters. Add a short stable suffix only when multiple independent claims of the same kind are needed.",
    "Do not repeat the raw lyrics. Summarize semantic understanding in your own short statement.",
    `Allowed scopes:\n${allowedScopeText}`,
    `Source label: ${material.sourceLabel}`,
  ].join("\n");

  const response = await fetchProviderWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      reasoning: { effort: "low" },
      max_output_tokens: 3000,
      instructions,
      input: material.text.slice(0, 24000),
      text: { format: { type: "json_schema", ...extractionSchema } },
    }),
  }, Math.min(boundedProviderTimeoutMs(Deno.env.get("OPENAI_PROVIDER_TIMEOUT_MS"), 90_000), remainingProviderBudgetMs));
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI Artist Understanding extraction failed with status ${response.status}: ${body.slice(0, 500)}`);
  }
  const payload = await response.json();
  const parsed = JSON.parse(readOutputText(payload));
  return {
    claims: Array.isArray(parsed?.claims) ? parsed.claims as ExtractedClaim[] : [],
    usage: isRecord(payload?.usage) ? payload.usage : {},
  };
}

function validateClaims(claims: ExtractedClaim[], material: SourceMaterial, sourceKind: QueueRow["source_kind"]) {
  const allowed = new Set(material.allowedScopes.map((scope) => `${scope.scopeType}:${scope.scopeId}`));
  const artistControlled = sourceKind === "conversation_message" || sourceKind === "context_answer";
  const seen = new Set<string>();
  const valid: ExtractedClaim[] = [];

  for (const raw of claims.slice(0, 18)) {
    if (!raw || !SEMANTIC_CATEGORIES.has(raw.category)) continue;
    const scopeId = raw.scopeType === "artist" ? "" : String(raw.scopeId ?? "");
    if (!allowed.has(`${raw.scopeType}:${scopeId}`)) continue;
    const key = normalizeKey(raw.key);
    if (!SEMANTIC_KEY_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}.`))) continue;
    if (raw.scopeType === "artist" && (key.startsWith("music.") || key.startsWith("song."))) continue;
    if (raw.scopeType !== "artist" && key.startsWith("artist.")) continue;
    if (artistControlled && raw.directlyAsserted !== true) continue;
    const statement = String(raw.statement ?? "").trim().replace(/\s+/g, " ").slice(0, 700);
    if (!statement) continue;
    const dedupe = `${raw.scopeType}:${scopeId}:${key}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    valid.push({ ...raw, scopeId, key, statement });
  }
  return valid;
}

async function finalizeQueue(db: any, row: QueueRow, material: SourceMaterial, claims: ExtractedClaim[]) {
  const { data, error } = await db.rpc("finalize_artist_understanding_ingestion_v1", {
    p_queue_id: row.id,
    p_lease_token: row.lease_token,
    p_claims: claims,
    p_source_label: material.sourceLabel,
    p_source_kind: material.sourceKind,
    p_source_ref: material.sourceRef,
  });
  if (error) throw error;
  if (data !== true) throw new Error("Artist Understanding lease expired before finalization.");
}

async function completeEmptyQueue(db: any, row: QueueRow) {
  const { data, error } = await db.rpc("complete_artist_understanding_ingestion_v2", { p_queue_id: row.id, p_lease_token: row.lease_token });
  if (error) throw error;
  if (data !== true) throw new Error("Artist Understanding lease expired before completion.");
}

async function deferQueue(db: any, row: QueueRow, reason: string) {
  const { data, error } = await db.rpc("defer_artist_understanding_ingestion_v1", { p_queue_id: row.id, p_lease_token: row.lease_token, p_reason: reason });
  if (error) throw error;
  if (data !== true) throw new Error("Artist Understanding lease expired before deferral.");
}

async function createUsageEvent(db: any, row: QueueRow) {
  const { data, error } = await db.from("ai_run_usage_events").insert({
    account_id: row.account_id,
    artist_workspace_id: row.artist_workspace_id,
    artist_id: row.artist_id,
    workflow_key: "evidence_extraction",
    run_type: "evidence_extraction",
    subject_type: row.source_kind,
    subject_id: row.source_id,
    provider: "openai",
    model_or_tool: Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
    operation_key: "artist_understanding",
    status: "started",
    provider_request_count: 1,
    metadata: { queueId: row.id, attempt: row.attempt_count },
  }).select("id").single();
  if (error) throw error;
  return String(data.id);
}

async function completeUsageEvent(db: any, usageId: string, usage: Record<string, unknown>) {
  const inputDetails = isRecord(usage.input_tokens_details) ? usage.input_tokens_details : {};
  const outputDetails = isRecord(usage.output_tokens_details) ? usage.output_tokens_details : {};
  const { error } = await db.from("ai_run_usage_events").update({
    status: "succeeded",
    input_tokens: nonNegativeInteger(usage.input_tokens),
    cached_input_tokens: nonNegativeInteger(inputDetails.cached_tokens),
    output_tokens: nonNegativeInteger(usage.output_tokens),
    reasoning_tokens: nonNegativeInteger(outputDetails.reasoning_tokens),
    provider_request_count: 1,
    completed_at: new Date().toISOString(),
    metadata: usage,
  }).eq("id", usageId).eq("status", "started");
  if (error) throw error;
}

async function failUsageSafe(db: any, usageId: string | null, message: string) {
  if (!usageId) return;
  try {
    await db.from("ai_run_usage_events").update({
      status: "failed",
      failure_reason: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    }).eq("id", usageId).eq("status", "started");
  } catch {
    // The started event still accounts for the provider request if finalization fails.
  }
}

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function compactSourceText(values: unknown[]) {
  const chunks: string[] = [];
  for (const value of values) {
    const text = typeof value === "string" ? value : textFromJson(value);
    const clean = text.trim();
    if (!clean || chunks.includes(clean)) continue;
    chunks.push(clean);
  }
  return chunks.join("\n\n").slice(0, 30000);
}

function textFromJson(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textFromJson).filter(Boolean).join("\n");
  if (!isRecord(value)) return "";
  const preferred = ["body", "text", "content", "lyrics", "narrative", "story", "summary", "description", "copy"];
  const preferredText = preferred.flatMap((key) => key in value ? [textFromJson(value[key])] : []).filter(Boolean);
  if (preferredText.length) return preferredText.join("\n");
  return Object.values(value).map(textFromJson).filter(Boolean).join("\n");
}

function normalizeKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/_+/g, "_").slice(0, 160);
}

function readOutputText(payload: unknown) {
  if (!isRecord(payload)) throw new Error("OpenAI Artist Understanding response is invalid.");
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string" && content.text.trim()) return content.text;
    }
  }
  throw new Error("OpenAI Artist Understanding response contained no structured output.");
}

function isQueueRow(value: unknown): value is QueueRow {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.account_id === "string" && typeof value.artist_workspace_id === "string" && typeof value.artist_id === "string" &&
    (value.source_kind === "conversation_message" || value.source_kind === "context_answer" || value.source_kind === "document") && typeof value.source_id === "string" && typeof value.lease_token === "string";
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function integer(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a[index % Math.max(a.length, 1)] ?? 0) ^ (b[index % Math.max(b.length, 1)] ?? 0);
  return mismatch === 0;
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown Artist Understanding ingestion failure.";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
