import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureAppError } from "../_shared/appError.ts";
import { markErrorCaptured, withAppErrorCapture } from "../_shared/appFunction.ts";
import type { ReleaseSchedulePreview } from "../_shared/release-success/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HASH_PATTERN = /^[a-z0-9:_-]+$/i;
const IDEMPOTENCY_PATTERN = /^[a-z0-9._:-]+$/i;
const MAX_REASON_LENGTH = 2_000;
const MAX_HASH_LENGTH = 128;
const MAX_IDEMPOTENCY_LENGTH = 160;
const MAX_PREVIEW_BYTES = 128_000;
const PROPOSAL_TTL_MS = 30 * 60 * 1_000;
const CONFLICT_CODES = new Set([
  "release_plan_stale",
  "release_request_expired",
  "release_request_not_pending",
  "release_already_live",
  "release_schedule_stale",
  "release_preview_mismatch",
  "release_idempotency_conflict",
  "release_idempotency_race",
]);
const VALIDATION_CODES = new Set([
  "release_date_required",
  "release_reason_invalid",
  "release_preview_hash_invalid",
  "release_idempotency_key_invalid",
  "release_plan_revision_invalid",
  "release_date_noop",
]);
const OWNERSHIP_CODES = new Set([
  "release_request_owner_invalid",
  "release_approval_owner_invalid",
]);

type ReleasePlanChangeRequest =
  | {
    action: "propose";
    musicItemId: string;
    proposedDate: string;
    reason: string;
    expectedRevision: number;
    preview: ReleaseSchedulePreview;
    previewHash: string;
    idempotencyKey: string;
  }
  | {
    action: "approve";
    requestId: string;
    previewHash: string;
    idempotencyKey: string;
  };

type Scope = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  musicItemId?: string;
  releasePlanId?: string;
};

type SupabaseLike = ReturnType<typeof createClient>;

class ValidationError extends Error {}
class NotFoundError extends Error {}

Deno.serve(withAppErrorCapture("release-plan-change", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let input: ReleasePlanChangeRequest | null = null;
  let userId: string | undefined;
  let scope: Scope | undefined;

  try {
    input = validateInput(await request.json().catch(() => null));

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const authClient = createClient(supabaseUrl, requireEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized." }, 401);
    userId = user.id;

    const db = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    if (input.action === "propose") {
      scope = await resolveSongScope(db, input.musicItemId);
    } else {
      scope = await resolveRequestScope(db, input.requestId);
    }

    const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", {
      target_account_id: scope.accountId,
    });
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Forbidden." }, 403);

    if (input.action === "propose") {
      const { data, error } = await db.rpc("propose_release_date_change", {
        p_account_id: scope.accountId,
        p_artist_workspace_id: scope.artistWorkspaceId,
        p_artist_id: scope.artistId,
        p_music_item_id: input.musicItemId,
        p_proposed_date: input.proposedDate,
        p_reason: input.reason,
        p_expected_plan_revision: input.expectedRevision,
        p_preview: input.preview,
        p_preview_hash: input.previewHash,
        p_expires_at: new Date(Date.now() + PROPOSAL_TTL_MS).toISOString(),
        p_idempotency_key: input.idempotencyKey,
        p_requested_by: user.id,
      });
      if (error) throw error;
      return json({ status: "proposed", request: data });
    }

    const { data, error } = await db.rpc("approve_release_date_change", {
      p_account_id: scope.accountId,
      p_artist_workspace_id: scope.artistWorkspaceId,
      p_artist_id: scope.artistId,
      p_request_id: input.requestId,
      p_preview_hash: input.previewHash,
      p_idempotency_key: input.idempotencyKey,
      p_approved_by: user.id,
    });
    if (error) throw error;
    return json({ status: "applied", receipt: data });
  } catch (error) {
    if (error instanceof ValidationError) return json({ error: error.message }, 400);
    if (error instanceof NotFoundError) return json({ error: error.message }, 404);

    const databaseCode = readDatabaseCode(error);
    if (databaseCode && CONFLICT_CODES.has(databaseCode)) {
      return json({ error: conflictMessage(databaseCode), code: databaseCode }, 409);
    }
    if (databaseCode && VALIDATION_CODES.has(databaseCode)) {
      return json({ error: validationMessage(databaseCode), code: databaseCode }, 400);
    }
    if (databaseCode && OWNERSHIP_CODES.has(databaseCode)) {
      return json({
        error: "You do not have permission to change this release plan.",
        code: databaseCode,
      }, 403);
    }

    const action = input?.action === "approve" ? "approve" : "propose";
    const stage = action === "approve" ? "reschedule_approval" : "reschedule_preview";
    const errorEventId = await captureAppError(error, {
      functionName: "release-plan-change",
      operation: action,
      source: "edge",
      publicMessage: "The release date change could not be completed.",
      requestId: request.headers.get("x-request-id") ?? undefined,
      userId,
      accountId: scope?.accountId,
      artistWorkspaceId: scope?.artistWorkspaceId,
      artistId: scope?.artistId,
      refs: {
        music_item_id: scope?.musicItemId ?? (input?.action === "propose" ? input.musicItemId : undefined),
        stage,
      },
      context: {
        action,
        stage: action === "approve" ? "reschedule_approval" : "reschedule_preview",
        release_plan_id: scope?.releasePlanId ?? null,
        request_id: input?.action === "approve" ? input.requestId : null,
      },
    });
    return markErrorCaptured(json({
      error: "The release date change could not be completed.",
      errorEventId,
    }, 500), errorEventId);
  }
}));

async function resolveSongScope(db: SupabaseLike, musicItemId: string): Promise<Scope> {
  const { data, error } = await db
    .from("music_items")
    .select("id,account_id,artist_workspace_id,artist_id")
    .eq("id", musicItemId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id || !data.account_id || !data.artist_workspace_id || !data.artist_id) {
    throw new NotFoundError("The attached song could not be found.");
  }
  return {
    accountId: data.account_id,
    artistWorkspaceId: data.artist_workspace_id,
    artistId: data.artist_id,
    musicItemId: data.id,
  };
}

async function resolveRequestScope(db: SupabaseLike, requestId: string): Promise<Scope> {
  const { data: request, error: requestError } = await db
    .from("release_date_change_requests")
    .select("id,account_id,artist_workspace_id,artist_id,release_plan_id")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request?.id || !request.account_id || !request.artist_workspace_id || !request.artist_id || !request.release_plan_id) {
    throw new NotFoundError("The release date request could not be found.");
  }

  const { data: plan, error: planError } = await db
    .from("music_release_plans")
    .select("id,music_item_id,account_id,artist_workspace_id,artist_id")
    .eq("id", request.release_plan_id)
    .eq("account_id", request.account_id)
    .eq("artist_workspace_id", request.artist_workspace_id)
    .eq("artist_id", request.artist_id)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan?.id || !plan.music_item_id) throw new NotFoundError("The release plan could not be found.");

  return {
    accountId: request.account_id,
    artistWorkspaceId: request.artist_workspace_id,
    artistId: request.artist_id,
    musicItemId: plan.music_item_id,
    releasePlanId: plan.id,
  };
}

function validateInput(value: unknown): ReleasePlanChangeRequest {
  if (!isRecord(value)) throw new ValidationError("Release plan change payload is invalid.");
  if (value.action === "propose") {
    assertExactKeys(value, ["action", "musicItemId", "proposedDate", "reason", "expectedRevision", "preview", "previewHash", "idempotencyKey"]);
    const musicItemId = uuid(value.musicItemId, "Music item ID");
    const proposedDate = isoDate(value.proposedDate, "Proposed release date");
    const reason = boundedText(value.reason, "Release date reason", MAX_REASON_LENGTH);
    if (typeof value.expectedRevision !== "number" || !Number.isInteger(value.expectedRevision) || value.expectedRevision < 0) {
      throw new ValidationError("Expected release-plan revision is invalid.");
    }
    const preview = boundedPreview(value.preview);
    const previewHash = boundedPattern(value.previewHash, "Preview hash", MAX_HASH_LENGTH, HASH_PATTERN);
    const idempotencyKey = boundedPattern(value.idempotencyKey, "Idempotency key", MAX_IDEMPOTENCY_LENGTH, IDEMPOTENCY_PATTERN);
    return { action: "propose", musicItemId, proposedDate, reason, expectedRevision: value.expectedRevision, preview, previewHash, idempotencyKey };
  }
  if (value.action === "approve") {
    assertExactKeys(value, ["action", "requestId", "previewHash", "idempotencyKey"]);
    return {
      action: "approve",
      requestId: uuid(value.requestId, "Release request ID"),
      previewHash: boundedPattern(value.previewHash, "Preview hash", MAX_HASH_LENGTH, HASH_PATTERN),
      idempotencyKey: boundedPattern(value.idempotencyKey, "Idempotency key", MAX_IDEMPOTENCY_LENGTH, IDEMPOTENCY_PATTERN),
    };
  }
  throw new ValidationError("Release plan change action must be propose or approve.");
}

function boundedPreview(value: unknown): ReleaseSchedulePreview {
  if (!isRecord(value)) throw new ValidationError("Schedule preview is required.");
  const serialized = JSON.stringify(value);
  if (!serialized || new TextEncoder().encode(serialized).length > MAX_PREVIEW_BYTES) {
    throw new ValidationError("Schedule preview is too large.");
  }
  return value as unknown as ReleaseSchedulePreview;
}

function uuid(value: unknown, label: string) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new ValidationError(`${label} is invalid.`);
  return value;
}

function isoDate(value: unknown, label: string) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) throw new ValidationError(`${label} is invalid.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new ValidationError(`${label} is invalid.`);
  return value;
}

function boundedText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new ValidationError(`${label} is required.`);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new ValidationError(`${label} is invalid.`);
  return text;
}

function boundedPattern(value: unknown, label: string, maxLength: number, pattern: RegExp) {
  const text = boundedText(value, label, maxLength);
  if (!pattern.test(text)) throw new ValidationError(`${label} is invalid.`);
  return text;
}

function assertExactKeys(value: Record<string, unknown>, allowed: string[]) {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) throw new ValidationError("Release plan change payload contains unsupported fields.");
}

function readDatabaseCode(error: unknown) {
  if (!isRecord(error)) return null;
  const candidates = [error.code, error.message, error.details, error.hint].filter((item): item is string => typeof item === "string");
  const knownCodes = new Set([...CONFLICT_CODES, ...VALIDATION_CODES, ...OWNERSHIP_CODES]);
  return [...knownCodes].find((code) => candidates.some((candidate) => candidate.includes(code))) ?? null;
}

function conflictMessage(code: string) {
  if (code === "release_request_expired") return "This release-date proposal has expired. Generate a fresh preview.";
  if (code === "release_request_not_pending") return "This release-date proposal is no longer awaiting approval.";
  if (code === "release_already_live") return "This song is already live or catalogued, so its release date cannot be changed.";
  if (code === "release_idempotency_conflict" || code === "release_idempotency_race") return "This release-date request already exists with different details.";
  return "The release plan changed while this preview was open. Generate a fresh preview.";
}

function validationMessage(code: string) {
  if (code === "release_date_required") return "A proposed release date is required.";
  if (code === "release_reason_invalid") return "A release-date reason is required.";
  if (code === "release_preview_hash_invalid") return "The schedule preview hash is invalid.";
  if (code === "release_idempotency_key_invalid") return "The request idempotency key is invalid.";
  if (code === "release_plan_revision_invalid") return "The release-plan revision is invalid.";
  if (code === "release_date_noop") return "The proposed date is already the approved release date.";
  return "The release-plan change request is invalid.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
