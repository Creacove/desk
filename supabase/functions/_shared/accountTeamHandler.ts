type AuthenticatedUser = { id: string; email?: string; email_confirmed_at?: string | null };
type Dependencies = {
  authenticate: (authorization: string) => Promise<AuthenticatedUser | null>;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  token: () => Promise<string>;
  hash: (token: string) => Promise<string>;
  allowedOrigins: string[];
};

const messages: Record<string, [number, string]> = {
  TEAM_BAD_INPUT: [400, "Check the team request and try again."],
  TEAM_FORBIDDEN: [403, "You cannot perform this team action. Check your account and verified email."],
  TEAM_NOT_FOUND: [404, "This team item is unavailable."],
  TEAM_CONFLICT: [409, "The team or task changed, or no seat is available. Refresh and try again."],
  TEAM_GONE: [410, "This invitation has expired or was revoked."],
  TEAM_RATE_LIMIT: [429, "Too many invitations. Try again later."],
};

export async function handleAccountTeamRequest(request: Request, deps: Dependencies): Promise<Response> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", Vary: "Origin" };
  if (origin && deps.allowedOrigins.includes(origin)) headers["access-control-allow-origin"] = origin;
  headers["access-control-allow-headers"] = "authorization, x-client-info, apikey, content-type";
  headers["access-control-allow-methods"] = "POST, OPTIONS";
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !deps.allowedOrigins.includes(origin)) return respond({ error: "Origin is not allowed." }, 403);
  if (request.method === "OPTIONS") return respond({ ok: true });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Sign in to continue." }, 401);
  try {
    const user = await deps.authenticate(authorization);
    if (!user?.id) return respond({ error: "Sign in to continue." }, 401);
    const raw = await request.text();
    if (raw.length > 16384) return respond({ error: "Request is too large." }, 413);
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed;
    } catch { return respond({ error: messages.TEAM_BAD_INPUT[1] }, 400); }

    const actor = { p_actor_user_id: user.id };
    let name: string;
    let args: Record<string, unknown>;
    let invitationToken: string | undefined;
    switch (body.action) {
      case "invite":
        name = "invite_account_member_v1";
        args = { ...actor, p_artist_workspace_id: uuid(body.artistWorkspaceId), p_email: email(body.email), ...responsibilities(body) };
        invitationToken = await deps.token();
        args.p_token_hash = await deps.hash(invitationToken);
        break;
      case "rotate_invite":
        name = "rotate_account_invitation_v1";
        args = { ...actor, p_invitation_id: uuid(body.invitationId) };
        invitationToken = await deps.token();
        args.p_token_hash = await deps.hash(invitationToken);
        break;
      case "revoke_invite":
        name = "revoke_account_invitation_v1";
        args = { ...actor, p_invitation_id: uuid(body.invitationId) };
        break;
      case "accept_invite":
        if (!user.email || !user.email_confirmed_at) throw new Error("TEAM_FORBIDDEN");
        if (typeof body.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) throw new Error("TEAM_BAD_INPUT");
        name = "accept_account_invitation_v1";
        args = { ...actor, p_email: email(user.email), p_token_hash: await deps.hash(body.token) };
        break;
      case "remove_member":
        name = "remove_account_member_v1";
        args = { ...actor, p_artist_workspace_id: uuid(body.artistWorkspaceId), p_member_user_id: uuid(body.memberUserId) };
        break;
      case "update_responsibilities":
        name = "update_member_responsibilities_v1";
        args = { ...actor, p_artist_workspace_id: uuid(body.artistWorkspaceId), p_member_user_id: uuid(body.memberUserId), ...responsibilities(body) };
        break;
      case "reassign_task":
        if (!Number.isSafeInteger(body.expectedAssignmentVersion) || Number(body.expectedAssignmentVersion) < 0) throw new Error("TEAM_BAD_INPUT");
        name = "reassign_workspace_task_v1";
        args = { ...actor, p_task_id: uuid(body.taskId), p_assignee_user_id: body.assigneeUserId === null ? null : uuid(body.assigneeUserId), p_expected_assignment_version: body.expectedAssignmentVersion };
        break;
      default: throw new Error("TEAM_BAD_INPUT");
    }
    const { data, error } = await deps.rpc(name, args);
    if (error) throw error;
    if (data == null) throw new Error("Missing transaction result");
    return respond(invitationToken ? { invitation: data, token: invitationToken } : data);
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    const code = Object.keys(messages).find((candidate) => message.startsWith(candidate));
    const [status, safeMessage] = code ? messages[code] : [503, "Team changes are temporarily unavailable. Try again."];
    if (status === 429) headers["retry-after"] = "3600";
    return respond({ error: safeMessage, code: code ?? "TEAM_UNAVAILABLE" }, status);
  }
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("TEAM_BAD_INPUT");
  return value;
}
function email(value: unknown): string {
  if (typeof value !== "string") throw new Error("TEAM_BAD_INPUT");
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("TEAM_BAD_INPUT");
  return normalized;
}
function responsibilities(body: Record<string, unknown>) {
  if (body.operatingTitle !== null && typeof body.operatingTitle !== "string") throw new Error("TEAM_BAD_INPUT");
  const title = typeof body.operatingTitle === "string" ? body.operatingTitle.trim() || null : null;
  if (title && title.length > 80) throw new Error("TEAM_BAD_INPUT");
  if (!Array.isArray(body.responsibilityTags) || body.responsibilityTags.length > 12) throw new Error("TEAM_BAD_INPUT");
  const tags = body.responsibilityTags.map((tag) => {
    if (typeof tag !== "string" || !tag.trim() || tag.trim().length > 48) throw new Error("TEAM_BAD_INPUT");
    return tag.trim();
  });
  return { p_operating_title: title, p_responsibility_tags: [...new Set(tags)] };
}
