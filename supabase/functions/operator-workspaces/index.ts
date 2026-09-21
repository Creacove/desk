import { withAppErrorCapture } from "../_shared/appFunction.ts";
import {
  isUuid,
  OperatorAuthorizationError,
  requireOperatorWorkspaceAccess,
} from "../_shared/operatorAuthorization.ts";

type OperatorWorkspaceRequest =
  | { action: "list"; query?: string }
  | { action: "load"; artistWorkspaceId: string };

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const MAX_OPERATOR_WORKSPACES = 25;

Deno.serve(withAppErrorCapture("operator-workspaces", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await request.json().catch(() => null) as Partial<OperatorWorkspaceRequest> | null;
    if (!body || (body.action !== "list" && body.action !== "load")) {
      return json({ error: "A valid workspace action is required." }, 400);
    }

    const targetId = body.action === "load" ? body.artistWorkspaceId : undefined;
    if (body.action === "load" && (typeof targetId !== "string" || !isUuid(targetId))) {
      return json({ error: "A valid workspace is required." }, 400);
    }

    const { actor, adminClient } = await requireOperatorWorkspaceAccess(request, targetId);
    if (body.action === "list") {
      return json({ workspaces: await listWorkspaces(adminClient, typeof body.query === "string" ? body.query : "") });
    }

    const workspace = await loadWorkspace(adminClient, targetId as string);
    if (!workspace) return json({ error: "Operator workspace access is not available." }, 403);

    const { error: auditError } = await adminClient.from("operator_workspace_events").insert({
      operator_user_id: actor.userId,
      artist_workspace_id: workspace.artistWorkspaceId,
      target_type: "artist_workspace",
      target_id: workspace.artistWorkspaceId,
      action: "workspace_opened",
      metadata: { accessMode: "operator" },
    });
    if (auditError) throw auditError;

    return json({ ...workspace, accessMode: "operator" });
  } catch (error) {
    if (error instanceof OperatorAuthorizationError) {
      return json({ error: error.message }, error.status);
    }
    console.error("operator-workspaces failed", error);
    return json({ error: "Operator workspace access is temporarily unavailable." }, 503);
  }
}));

async function listWorkspaces(adminClient: any, rawQuery: string) {
  const queryText = rawQuery.trim().slice(0, 120);
  let query = adminClient
    .from("artist_workspaces")
    .select(`
      id,
      account_id,
      artist_id,
      name,
      status,
      created_at,
      accounts!artist_workspaces_account_id_fkey(name),
      artists!artist_workspaces_artist_id_fkey(display_name, canonical_spotify_artist_id),
      ops_cases!ops_cases_desk_workspace_id_fkey(primary_contact_email, primary_contact_handle)
    `)
    .order("created_at", { ascending: false })
    .limit(500);
  const { data, error } = await query;
  if (error) throw error;
  const normalizedQuery = queryText.toLowerCase();
  return (data ?? []).filter((row: any) => {
    if (!normalizedQuery) return true;
    const caseRow = one(row.ops_cases);
    return [
      row.name,
      row.id,
      row.account_id,
      row.artist_id,
      one(row.artists)?.display_name,
      one(row.artists)?.canonical_spotify_artist_id,
      one(row.accounts)?.name,
      caseRow?.primary_contact_email,
      caseRow?.primary_contact_handle,
    ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
  }).slice(0, MAX_OPERATOR_WORKSPACES).map((row: any) => ({
    artistWorkspaceId: row.id,
    accountId: row.account_id,
    artistId: row.artist_id,
    workspaceName: row.name,
    workspaceStatus: row.status,
    artistName: one(row.artists)?.display_name ?? null,
    accountName: one(row.accounts)?.name ?? null,
    contactEmail: one(row.ops_cases)?.primary_contact_email ?? null,
    contactHandle: one(row.ops_cases)?.primary_contact_handle ?? null,
  }));
}

async function loadWorkspace(adminClient: any, artistWorkspaceId: string) {
  const { data, error } = await adminClient
    .from("artist_workspaces")
    .select(`
      id,
      account_id,
      artist_id,
      name,
      status,
      accounts!artist_workspaces_account_id_fkey(name),
      artists!artist_workspaces_artist_id_fkey(display_name, canonical_spotify_artist_id, canonical_spotify_url),
      artist_profiles!artist_profiles_artist_workspace_id_fkey(display_name, spotify_identity, genres, home_market, stage, artist_direction, current_goal, budget_context),
      source_sync_jobs!source_sync_jobs_artist_workspace_id_fkey(status, created_at),
      billing_subscriptions!billing_subscriptions_artist_workspace_id_fkey(provider, status, current_period_end, provider_customer_code, billing_checkout_sessions!billing_subscriptions_checkout_session_id_fkey(interval)),
      workspace_access_grants!workspace_access_grants_artist_workspace_id_fkey(access_type, status, starts_at, ends_at),
      workspace_setup_runs!workspace_setup_runs_artist_workspace_id_fkey(id, status, current_stage, stage_status, last_error, checkout_session_id, updated_at)
    `)
    .eq("id", artistWorkspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const artist = one(data.artists);
  const profile = one(data.artist_profiles);
  const subscriptions = data.billing_subscriptions ?? [];
  const grants = data.workspace_access_grants ?? [];
  const latestSubscription = latestBy(subscriptions, "current_period_end");
  const latestGrant = latestBy(grants, "starts_at");
  const subscriptionActive = subscriptions.some((row: any) =>
    ["active", "non-renewing", "attention"].includes(row.status) && (!row.current_period_end || Date.parse(row.current_period_end) > Date.now()),
  );
  const grantActive = grants.some((row: any) =>
    row.access_type === "private_beta" && row.status === "active" && row.ends_at && Date.parse(row.ends_at) > Date.now(),
  );
  const grantExpired = grants.some((row: any) =>
    row.access_type === "private_beta" && (row.status === "expired" || (row.ends_at && Date.parse(row.ends_at) <= Date.now())),
  );
  const entitlementActive = subscriptionActive || grantActive;

  return {
    accountId: data.account_id,
    artistWorkspaceId: data.id,
    artistId: data.artist_id,
    artistName: artist?.display_name ?? data.name,
    workspaceName: data.name,
    ...(one(data.accounts)?.name ? { teamName: one(data.accounts).name } : {}),
    status: data.status,
    spotifyConnected: Boolean(artist?.canonical_spotify_artist_id),
    spotifyArtistId: artist?.canonical_spotify_artist_id ?? undefined,
    spotifyArtistName: profile?.spotify_identity?.name ?? artist?.display_name ?? undefined,
    spotifyArtistUrl: artist?.canonical_spotify_url ?? profile?.spotify_identity?.url ?? undefined,
    spotifyImageUrl: profile?.spotify_identity?.imageUrl ?? undefined,
    contextComplete: Boolean(profile?.artist_direction || profile?.current_goal) && Boolean(profile?.budget_context),
    latestCatalogSyncStatus: latestBy(data.source_sync_jobs ?? [], "created_at")?.status,
    entitlementActive,
    subscriptionStatus: latestSubscription?.status ?? "none",
    billingProvider: latestSubscription?.provider ?? undefined,
    billingInterval: latestSubscription?.billing_checkout_sessions?.interval ?? undefined,
    paddleCustomerId: latestSubscription?.provider === "paddle" ? latestSubscription?.provider_customer_code ?? undefined : undefined,
    accessType: latestSubscription ? "paid_subscription" : latestGrant?.access_type === "private_beta" ? "private_beta" : "none",
    accessStatus: entitlementActive ? "active" : latestSubscription || grantExpired ? "expired" : "inactive",
    accessStartsAt: latestGrant?.starts_at ?? undefined,
    accessEndsAt: latestGrant?.ends_at ?? undefined,
    renewalAt: latestSubscription?.current_period_end ?? undefined,
    setupStatus: latestBy(data.workspace_setup_runs ?? [], "updated_at")?.status ?? "not_started",
    setupStage: latestBy(data.workspace_setup_runs ?? [], "updated_at")?.current_stage ?? undefined,
    setupStageStatus: latestBy(data.workspace_setup_runs ?? [], "updated_at")?.stage_status ?? undefined,
    setupLastError: latestBy(data.workspace_setup_runs ?? [], "updated_at")?.last_error ?? undefined,
    billingCheckoutSessionId: latestBy(data.workspace_setup_runs ?? [], "updated_at")?.checkout_session_id ?? undefined,
    setupRunId: latestBy(data.workspace_setup_runs ?? [], "updated_at")?.id ?? undefined,
  };
}

function one(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function latestBy(rows: any[], key: string) {
  return [...(rows ?? [])].sort((left, right) => (Date.parse(right?.[key] ?? "") || 0) - (Date.parse(left?.[key] ?? "") || 0))[0];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
