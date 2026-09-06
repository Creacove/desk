const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const TEAM_INVITE_TOKEN_STORAGE_KEY = "ordersounds.team.invite.token";
export const ACTIVE_WORKSPACE_STORAGE_KEY = "ordersounds.workspace.active";

export function createTeamInviteLink(origin: string, token: string): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error("Invalid invitation token");
  return `${origin.replace(/\/$/, "")}/join#token=${encodeURIComponent(token)}`;
}

export function consumeTeamInviteToken(
  location: Pick<Location, "hash"> & Partial<Pick<Location, "pathname" | "search">>,
  history: Pick<History, "replaceState">,
): string | null {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = params.get("token");
  const pathname = location.pathname || "/join";
  const search = location.search || "";
  history.replaceState(null, "", `${pathname}${search}`);
  return token && TOKEN_PATTERN.test(token) ? token : null;
}
