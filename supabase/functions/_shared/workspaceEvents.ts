export type WorkspaceEventInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  eventType: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  workspaceSetupRunId?: string;
  dedupeKey?: string;
  displayMode?: "activity" | "toast" | "action";
  refreshScope?: string[];
  recipientUserId?: string;
  payload?: Record<string, unknown>;
};

const MAX_SUMMARY_LENGTH = 280;
const MAX_REFRESH_SCOPES = 8;
const MAX_PAYLOAD_BYTES = 8_192;

export async function writeWorkspaceEvent(db: any, input: WorkspaceEventInput): Promise<string> {
  const dedupeKey = cleanText(input.dedupeKey, 160) || null;
  const row = {
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    event_type: cleanText(input.eventType, 80) || "workspace_activity",
    actor_type: "manager",
    target_type: cleanText(input.targetType, 80) || null,
    target_id: input.targetId || null,
    workspace_setup_run_id: input.workspaceSetupRunId || null,
    dedupe_key: dedupeKey,
    display_mode: input.displayMode ?? null,
    refresh_scope: sanitizeRefreshScopes(input.refreshScope),
    recipient_user_id: input.recipientUserId || null,
    summary: cleanText(input.summary, MAX_SUMMARY_LENGTH) || "Workspace activity updated.",
    payload: sanitizePayload(input.payload),
  };

  const write = dedupeKey
    ? db.from("operating_events").upsert(row, {
        onConflict: "artist_workspace_id,dedupe_key",
        ignoreDuplicates: true,
      })
    : db.from("operating_events").insert(row);
  const { data, error } = await write.select("id").maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id;

  if (!dedupeKey) throw new Error("Workspace event insert returned no persisted ID.");
  const { data: existing, error: existingError } = await db
    .from("operating_events")
    .select("id")
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing?.id) throw new Error("Deduplicated workspace event could not be recovered.");
  return existing.id;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeRefreshScopes(scopes: string[] | undefined) {
  return [...new Set((scopes ?? [])
    .map((scope) => cleanText(scope, 48).toLowerCase())
    .filter((scope) => /^[a-z][a-z0-9-]*$/.test(scope)))]
    .slice(0, MAX_REFRESH_SCOPES);
}

function sanitizePayload(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  const sanitized = stripInternalBodies(payload ?? {}) as Record<string, unknown>;
  if (new TextEncoder().encode(JSON.stringify(sanitized)).length <= MAX_PAYLOAD_BYTES) return sanitized;
  return { truncated: true };
}

function stripInternalBodies(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 50).map(stripInternalBodies);
  if (!value || typeof value !== "object") {
    if (typeof value === "string") return value.slice(0, 1_000);
    return value;
  }

  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !/(?:provider|response|request|raw).*body|body.*(?:provider|response|request|raw)/i.test(key))
    .slice(0, 50)
    .map(([key, nested]) => [cleanText(key, 80), stripInternalBodies(nested)]));
}
