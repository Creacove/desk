export type SongDomainScope = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  musicItemId: string;
  runId?: string;
  actionId?: string;
  userId?: string;
};

type SupabaseLike = { from(table: string): any };

const OWNERSHIP_ROLES = new Set(["songwriter", "composer", "lyricist", "publisher", "producer", "primary_artist", "featured_artist"]);

export async function setSongIdentifier(db: SupabaseLike, scope: SongDomainScope, input: { type: string; value: string; confidence?: string }) {
  const type = normalizeIdentifierType(input.type);
  const value = input.value.trim();
  if (!value) throw new Error("Identifier value is required.");
  if (type === "isrc") assertIsrc(value);

  const { data: existing, error: readError } = await scoped(
    db.from("music_identifiers").select("id,identifier_value"), scope,
  ).eq("music_item_id", scope.musicItemId).eq("identifier_type", type).order("created_at", { ascending: false }).limit(1);
  if (readError) throw readError;
  const row = existing?.[0];
  if (row?.id) {
    const { data, error } = await scoped(
      db.from("music_identifiers").update({ identifier_value: value, confidence: input.confidence ?? "high" }), scope,
    ).eq("id", row.id).select("id,identifier_type,identifier_value,confidence").single();
    if (error) throw error;
    return { status: "updated", identifier: data };
  }

  const { data, error } = await db.from("music_identifiers").insert({
    account_id: scope.accountId,
    artist_workspace_id: scope.artistWorkspaceId,
    artist_id: scope.artistId,
    music_item_id: scope.musicItemId,
    music_project_id: null,
    identifier_type: type,
    identifier_value: value,
    confidence: input.confidence ?? "high",
    created_from_run_id: scope.runId ?? null,
  }).select("id,identifier_type,identifier_value,confidence").single();
  if (error) throw error;
  return { status: "created", identifier: data };
}

export async function setInitialSongReleaseDate(db: SupabaseLike, scope: SongDomainScope, date: string) {
  assertIsoDate(date);
  const { data: song, error: songError } = await scoped(
    db.from("music_items").select("id,planned_release_date,lifecycle_stage"), scope,
  ).eq("id", scope.musicItemId).maybeSingle();
  if (songError) throw songError;
  if (!song) throw new Error("Song was not found.");

  const { data: plans, error: planError } = await scoped(
    db.from("music_release_plans").select("id,status,approved_release_date,revision"), scope,
  ).eq("music_item_id", scope.musicItemId).limit(1);
  if (planError) throw planError;
  const plan = plans?.[0];
  const establishedDate = plan?.approved_release_date ?? song.planned_release_date;
  if (establishedDate && establishedDate !== date && ["approved", "pending_approval"].includes(String(plan?.status ?? ""))) {
    return {
      status: "approval_required",
      reason: "Changing this date can move an active release schedule.",
      currentDate: establishedDate,
      proposedDate: date,
      releasePlanId: plan?.id ?? null,
      revision: Number(plan?.revision ?? 0),
    };
  }

  const { data, error } = await scoped(
    db.from("music_items").update({ planned_release_date: date, updated_at: new Date().toISOString() }), scope,
  ).eq("id", scope.musicItemId).select("id,planned_release_date").single();
  if (error) throw error;
  return { status: "updated", releaseDate: data.planned_release_date };
}

export async function upsertSongContributor(db: SupabaseLike, scope: SongDomainScope, input: {
  contributorId?: string;
  displayName: string;
  legalName?: string;
  email?: string;
}) {
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Contributor name is required.");

  if (input.contributorId) {
    const { data, error } = await scoped(db.from("music_contributors").update({
      display_name: displayName,
      legal_name: clean(input.legalName),
      email: clean(input.email),
      updated_at: new Date().toISOString(),
    }), scope).eq("id", input.contributorId).select("id,display_name,legal_name,email").single();
    if (error) throw error;
    return data;
  }

  const { data: candidates, error: candidateError } = await scoped(
    db.from("music_contributors").select("id,display_name,legal_name,email"), scope,
  ).ilike("display_name", displayName).limit(10);
  if (candidateError) throw candidateError;
  const email = clean(input.email)?.toLowerCase();
  const exact = (candidates ?? []).find((candidate: any) => email && String(candidate.email ?? "").toLowerCase() === email);
  if (exact) return exact;
  if (!email && (candidates ?? []).length === 1) return { status: "needs_identity_confirmation", candidate: candidates[0] };
  if ((candidates ?? []).length > 1) return { status: "needs_identity_confirmation", candidates };

  const { data, error } = await db.from("music_contributors").insert({
    account_id: scope.accountId,
    artist_workspace_id: scope.artistWorkspaceId,
    artist_id: scope.artistId,
    display_name: displayName,
    legal_name: clean(input.legalName),
    email: clean(input.email),
    created_by_type: "manager",
    created_by_id: scope.userId ?? null,
    created_from_run_id: scope.runId ?? null,
    created_from_action_id: scope.actionId ?? null,
  }).select("id,display_name,legal_name,email").single();
  if (error) throw error;
  return data;
}

export async function upsertSongCredit(db: SupabaseLike, scope: SongDomainScope, input: {
  contributorId: string;
  role: string;
  displayName: string;
  status?: string;
}) {
  const role = normalizeRole(input.role);
  const { data: existing, error: readError } = await scoped(
    db.from("music_credits").select("id"), scope,
  ).eq("music_item_id", scope.musicItemId).eq("contributor_id", input.contributorId).eq("role", role).limit(1);
  if (readError) throw readError;
  const id = existing?.[0]?.id;
  if (id) {
    const { data, error } = await scoped(
      db.from("music_credits").update({ name: input.displayName.trim(), status: input.status ?? "confirmed", updated_at: new Date().toISOString() }), scope,
    ).eq("id", id).select("id,contributor_id,role,name,status").single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await db.from("music_credits").insert({
    account_id: scope.accountId,
    artist_workspace_id: scope.artistWorkspaceId,
    artist_id: scope.artistId,
    music_item_id: scope.musicItemId,
    music_project_id: null,
    contributor_id: input.contributorId,
    role,
    name: input.displayName.trim(),
    status: input.status ?? "confirmed",
    created_by_type: "manager",
    created_by_id: scope.userId ?? null,
    created_from_run_id: scope.runId ?? null,
    created_from_action_id: scope.actionId ?? null,
  }).select("id,contributor_id,role,name,status").single();
  if (error) throw error;
  return data;
}

export async function previewSongSplitChange(db: SupabaseLike, scope: SongDomainScope, input: {
  contributorId: string;
  displayName: string;
  role?: string;
  email?: string;
  publishingShare: number;
  masterShare: number;
}) {
  validateShare(input.publishingShare);
  validateShare(input.masterShare);
  const split = await ensureSplit(db, scope);
  const { data: rows, error } = await scoped(
    db.from("music_split_contributors").select("id,contributor_id,name,role,email,publishing_share,master_share,approval_status"), scope,
  ).eq("music_split_id", split.id).limit(100);
  if (error) throw error;
  const others = (rows ?? []).filter((row: any) => row.contributor_id !== input.contributorId);
  const publishingTotal = round(others.reduce((total: number, row: any) => total + Number(row.publishing_share ?? 0), 0) + input.publishingShare);
  const masterTotal = round(others.reduce((total: number, row: any) => total + Number(row.master_share ?? 0), 0) + input.masterShare);
  return {
    status: "confirmation_required",
    splitId: split.id,
    proposed: { ...input, role: normalizeRole(input.role ?? "contributor") },
    totals: { publishing: publishingTotal, master: masterTotal },
    validTotals: publishingTotal <= 100 && masterTotal <= 100,
    reason: "Ownership changes always require explicit user confirmation before they are committed.",
  };
}

export async function applyConfirmedSongSplitChange(db: SupabaseLike, scope: SongDomainScope, input: {
  splitId: string;
  contributorId: string;
  displayName: string;
  role?: string;
  email?: string;
  publishingShare: number;
  masterShare: number;
}) {
  validateShare(input.publishingShare);
  validateShare(input.masterShare);
  const preview = await previewSongSplitChange(db, scope, input);
  if (!preview.validTotals) throw new Error("Publishing and master allocations cannot exceed 100%.");

  const { data: existing, error: existingError } = await scoped(
    db.from("music_split_contributors").select("id"), scope,
  ).eq("music_split_id", input.splitId).eq("contributor_id", input.contributorId).limit(1);
  if (existingError) throw existingError;

  const payload = {
    contributor_id: input.contributorId,
    name: input.displayName.trim(),
    role: normalizeRole(input.role ?? "contributor"),
    email: clean(input.email) ?? "",
    publishing_share: input.publishingShare,
    master_share: input.masterShare,
    approval_status: "draft",
    updated_at: new Date().toISOString(),
  };
  if (existing?.[0]?.id) {
    const { error } = await scoped(db.from("music_split_contributors").update(payload), scope).eq("id", existing[0].id);
    if (error) throw error;
  } else {
    const { error } = await db.from("music_split_contributors").insert({
      account_id: scope.accountId,
      artist_workspace_id: scope.artistWorkspaceId,
      artist_id: scope.artistId,
      music_split_id: input.splitId,
      ...payload,
    });
    if (error) throw error;
  }

  const { data: all, error: allError } = await scoped(
    db.from("music_split_contributors").select("publishing_share,master_share"), scope,
  ).eq("music_split_id", input.splitId).limit(100);
  if (allError) throw allError;
  const publishingTotal = round((all ?? []).reduce((total: number, row: any) => total + Number(row.publishing_share ?? 0), 0));
  const masterTotal = round((all ?? []).reduce((total: number, row: any) => total + Number(row.master_share ?? 0), 0));
  const { error: splitError } = await scoped(
    db.from("music_splits").update({ publishing_total: publishingTotal, master_total: masterTotal, status: "draft", updated_at: new Date().toISOString() }), scope,
  ).eq("id", input.splitId);
  if (splitError) throw splitError;
  return { status: "updated", totals: { publishing: publishingTotal, master: masterTotal } };
}

export function roleCanHaveZeroOwnership(role: string) { return !OWNERSHIP_ROLES.has(normalizeRole(role)); }

async function ensureSplit(db: SupabaseLike, scope: SongDomainScope) {
  const { data: existing, error } = await scoped(
    db.from("music_splits").select("id,status"), scope,
  ).eq("music_item_id", scope.musicItemId).order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  if (existing?.[0]) return existing[0];
  const { data, error: insertError } = await db.from("music_splits").insert({
    account_id: scope.accountId,
    artist_workspace_id: scope.artistWorkspaceId,
    artist_id: scope.artistId,
    music_item_id: scope.musicItemId,
    status: "draft",
    publishing_total: 0,
    master_total: 0,
    created_by_type: "manager",
    created_by_id: scope.userId ?? null,
    created_from_run_id: scope.runId ?? null,
    created_from_action_id: scope.actionId ?? null,
  }).select("id,status").single();
  if (insertError) throw insertError;
  return data;
}

function scoped(query: any, scope: SongDomainScope) {
  return query.eq("account_id", scope.accountId).eq("artist_workspace_id", scope.artistWorkspaceId).eq("artist_id", scope.artistId);
}
function clean(value?: string) { const next = value?.trim(); return next ? next : null; }
function normalizeRole(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "contributor"; }
function normalizeIdentifierType(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"); }
function validateShare(value: number) { if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Ownership share must be between 0 and 100."); }
function round(value: number) { return Number(value.toFixed(2)); }
function assertIsoDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) throw new Error("Release date must be YYYY-MM-DD."); }
function assertIsrc(value: string) { if (!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(value.replace(/-/g, ""))) throw new Error("ISRC format is invalid."); }
