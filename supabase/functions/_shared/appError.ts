export type AppErrorContext = {
  functionName: string;
  operation: string;
  source?: "client" | "edge" | "worker" | "database" | "provider";
  severity?: "warning" | "error" | "critical";
  publicMessage?: string;
  route?: string;
  requestId?: string;
  traceId?: string;
  parentErrorEventId?: string;
  userId?: string;
  accountEmail?: string;
  accountId?: string;
  artistWorkspaceId?: string;
  artistId?: string;
  provider?: string;
  providerRequestId?: string;
  httpStatus?: number;
  latencyMs?: number;
  context?: Record<string, unknown>;
  refs?: Record<string, string | number | null | undefined>;
};

type DenoEnvironment = {
  env?: { get(name: string): string | undefined };
};

const MAX_MESSAGE_BYTES = 8_192;
const MAX_STACK_BYTES = 32_768;
const MAX_DETAILS_BYTES = 32_768;
const MAX_CONTEXT_BYTES = 16_384;
const REDACTED = "[REDACTED]";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREDENTIAL_KEY = /(?:authorization|cookie|password|passcode|secret|token|api[_-]?key|service[_-]?role|beta[_-]?code|checkout[_-]?correlation|card|cvv|signed[_-]?url)/i;
const HIGH_RISK_BODY_KEY = /(?:^|[_-])(?:prompt|lyrics?|document(?:_body)?|raw[_-]?webhook|request[_-]?body|response[_-]?body|file[_-]?contents?|content[_-]?body)(?:$|[_-])/i;
const PROVIDER_REQUEST_KEYS = new Set(["request_id", "requestid", "x-request-id", "x_request_id"]);
const REF_COLUMNS = new Set([
  "setup_run_id",
  "manager_run_id",
  "source_sync_job_id",
  "usage_event_id",
  "billing_event_id",
  "operating_event_id",
  "conversation_id",
  "mission_id",
  "task_id",
  "music_item_id",
  "music_project_id",
  "stage",
  "attempt",
]);

export function normalizeAppError(
  error: unknown,
  context: AppErrorContext,
): Record<string, unknown> {
  const errorRecord = readRecord(error);
  const cause = error instanceof Error ? error.cause : errorRecord?.cause;
  const details = limitObject(normalizeErrorDetails(error), MAX_DETAILS_BYTES);
  const operationalContext = limitObject(
    scrubValue(context.context ?? {}, new WeakSet()) as Record<string, unknown>,
    MAX_CONTEXT_BYTES,
  );
  const errorMessage = truncateUtf8(readErrorMessage(error), MAX_MESSAGE_BYTES);
  const stackTrace = error instanceof Error && error.stack
    ? truncateUtf8(error.stack, MAX_STACK_BYTES)
    : null;
  const errorClass = readText(error instanceof Error ? error.name : errorRecord?.name) ?? typeof error;
  const errorCode = firstText(
    errorRecord?.code,
    readRecord(cause)?.code,
    readRecord(errorRecord?.error)?.code,
  );
  const providerRequestId = context.providerRequestId ?? findProviderRequestId(error);
  const providerStatus = findProviderStatus(error);
  const fingerprintSource = [
    context.functionName,
    context.operation,
    errorClass,
    errorCode ?? "",
    context.provider ?? "",
    firstStackFrame(stackTrace),
  ].join("|");

  const row: Record<string, unknown> = {
    environment: readEnvironment("APP_ENVIRONMENT") ?? "production",
    release_version: readEnvironment("APP_RELEASE") ?? null,
    severity: context.severity ?? "error",
    status: "open",
    source: context.source ?? "edge",
    function_name: truncateUtf8(context.functionName, 256),
    operation: truncateUtf8(context.operation, 256),
    route: nullableText(context.route, 1_024),
    error_class: nullableText(errorClass, 256),
    error_code: nullableText(errorCode, 512),
    fingerprint: stableFingerprint(fingerprintSource),
    error_message: errorMessage,
    error_details: details,
    stack_trace: stackTrace,
    public_message: nullableText(context.publicMessage, MAX_MESSAGE_BYTES),
    context: operationalContext,
    user_id: uuidOrNull(context.userId),
    account_email: nullableText(context.accountEmail, 512),
    account_id: uuidOrNull(context.accountId),
    artist_workspace_id: uuidOrNull(context.artistWorkspaceId),
    artist_id: uuidOrNull(context.artistId),
    trace_id: uuidOrNull(context.traceId),
    request_id: uuidOrNull(context.requestId),
    parent_error_event_id: uuidOrNull(context.parentErrorEventId),
    provider: nullableText(context.provider, 128),
    provider_request_id: nullableText(providerRequestId, 1_024),
    http_status: validStatus(context.httpStatus),
    provider_status: validStatus(providerStatus),
    latency_ms: validNonNegativeInteger(context.latencyMs),
  };

  for (const [key, value] of Object.entries(context.refs ?? {})) {
    if (!REF_COLUMNS.has(key)) continue;
    if (key === "attempt") row[key] = validNonNegativeInteger(value);
    else if (key === "stage") row[key] = nullableText(value, 256);
    else row[key] = uuidOrNull(value);
  }

  return row;
}

export async function captureAppError(
  error: unknown,
  context: AppErrorContext,
): Promise<string | null> {
  const row = normalizeAppError(error, context);
  console.error("app_error_event", row);

  try {
    const supabaseUrl = requireRuntimeEnvironment("SUPABASE_URL").replace(/\/$/, "");
    const serviceRoleKey = requireRuntimeEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    const response = await fetch(`${supabaseUrl}/rest/v1/app_error_events`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Error telemetry insert failed with ${response.status}: ${truncateUtf8(responseText, 2_048)}`);
    }
    const result = responseText ? JSON.parse(responseText) : [];
    const id = Array.isArray(result) ? result[0]?.id : result?.id;
    return UUID_PATTERN.test(String(id ?? "")) ? String(id) : null;
  } catch (persistenceError) {
    console.error("app_error_persistence_failed", {
      functionName: context.functionName,
      operation: context.operation,
      requestId: context.requestId ?? null,
      persistenceError: readErrorMessage(persistenceError),
    });
    return null;
  }
}

function normalizeErrorDetails(error: unknown): Record<string, unknown> {
  const seen = new WeakSet<object>();
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: truncateUtf8(error.message, MAX_MESSAGE_BYTES),
    };
    for (const key of Object.getOwnPropertyNames(error)) {
      if (key === "name" || key === "message" || key === "stack") continue;
      details[key] = scrubValue((error as unknown as Record<string, unknown>)[key], seen);
    }
    return details;
  }

  const scrubbed = scrubValue(error, seen);
  if (isRecord(scrubbed)) return scrubbed;
  return { value: scrubbed };
}

function scrubValue(value: unknown, seen: WeakSet<object>, key = ""): unknown {
  if (CREDENTIAL_KEY.test(key) || HIGH_RISK_BODY_KEY.test(key)) return REDACTED;
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;

  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
  }

  if (value instanceof Error) {
    const nested: Record<string, unknown> = { name: value.name, message: scrubString(value.message) };
    for (const property of Object.getOwnPropertyNames(value)) {
      if (property === "name" || property === "message" || property === "stack") continue;
      nested[property] = scrubValue((value as unknown as Record<string, unknown>)[property], seen, property);
    }
    return nested;
  }

  if (Array.isArray(value)) return value.slice(0, 100).map((item) => scrubValue(item, seen));

  const output: Record<string, unknown> = {};
  for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
    output[nestedKey] = scrubValue(nestedValue, seen, nestedKey);
  }
  return output;
}

function scrubString(value: string): string {
  const trimmed = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ");
  if (!/^https?:\/\//i.test(trimmed)) return truncateUtf8(trimmed, MAX_DETAILS_BYTES);
  try {
    const parsed = new URL(trimmed);
    const hasSensitiveQuery = [...parsed.searchParams.keys()].some((key) => CREDENTIAL_KEY.test(key) || /signature|expires/i.test(key));
    if (hasSensitiveQuery) {
      parsed.search = "";
      parsed.hash = "";
      return `${parsed.toString()}[QUERY_REDACTED]`;
    }
  } catch {
    // Keep the bounded original when it is not a parseable URL.
  }
  return truncateUtf8(trimmed, MAX_DETAILS_BYTES);
}

function limitObject(value: Record<string, unknown>, maxBytes: number): Record<string, unknown> {
  const serialized = safeStringify(value);
  const bytes = new TextEncoder().encode(serialized).length;
  if (bytes <= maxBytes) return value;
  return { __truncated: true, originalBytes: bytes };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ serializationFailed: true });
  }
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const record = readRecord(error);
  const message = readText(record?.message) ?? readText(record?.error);
  if (message) return message;
  if (typeof error === "string") return error;
  return safeStringify(scrubValue(error, new WeakSet()));
}

function findProviderRequestId(value: unknown, seen = new WeakSet<object>()): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (PROVIDER_REQUEST_KEYS.has(key.toLowerCase()) && typeof nested === "string" && nested.trim()) return nested.trim();
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = findProviderRequestId(nested, seen);
    if (found) return found;
  }
  if (value instanceof Error && value.cause) return findProviderRequestId(value.cause, seen);
  return undefined;
}

function findProviderStatus(value: unknown, seen = new WeakSet<object>()): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);
  const record = value as Record<string, unknown>;
  for (const key of ["status", "statusCode", "status_code"]) {
    const status = validStatus(record[key]);
    if (status) return status;
  }
  for (const nested of Object.values(record)) {
    const found = findProviderStatus(nested, seen);
    if (found) return found;
  }
  if (value instanceof Error && value.cause) return findProviderStatus(value.cause, seen);
  return undefined;
}

function firstStackFrame(stack: string | null): string {
  if (!stack) return "";
  return stack.split("\n").map((line) => line.trim()).find((line) => line.startsWith("at ")) ?? stack.split("\n")[0] ?? "";
}

function stableFingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function truncateUtf8(value: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length <= maxBytes) return value;
  return new TextDecoder().decode(encoded.slice(0, maxBytes));
}

function nullableText(value: unknown, maxBytes: number): string | null {
  const text = readText(value);
  return text ? truncateUtf8(text, maxBytes) : null;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = readText(value);
    if (text) return text;
  }
  return undefined;
}

function readText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uuidOrNull(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function validStatus(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 100 && number <= 599 ? number : null;
}

function validNonNegativeInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function readEnvironment(name: string): string | undefined {
  try {
    return (globalThis as typeof globalThis & { Deno?: DenoEnvironment }).Deno?.env?.get(name);
  } catch {
    return undefined;
  }
}

function requireRuntimeEnvironment(name: string): string {
  const value = readEnvironment(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}
