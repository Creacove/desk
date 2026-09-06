export type WorkspaceScope = { accountId: string; artistWorkspaceId: string; artistId: string };
export type WorkspaceRoster = {
  scope: WorkspaceScope;
  members: Array<{
    userId: string;
    displayName: string;
    accessRole: "owner" | "member";
    operatingTitle: string | null;
    responsibilityTags: string[];
  }>;
  loadedAt: string;
};

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validScope(value: unknown): value is WorkspaceScope {
  if (!value || typeof value !== "object") return false;
  const scope = value as Record<string, unknown>;
  return UUID.test(String(scope.accountId)) && UUID.test(String(scope.artistWorkspaceId)) && UUID.test(String(scope.artistId));
}

export async function loadActiveWorkspaceRoster(db: RpcClient, scope: WorkspaceScope): Promise<WorkspaceRoster> {
  if (!validScope(scope)) throw new Error("TEAM_BAD_INPUT");
  const { data, error } = await db.rpc("get_workspace_roster_v1", { p_artist_workspace_id: scope.artistWorkspaceId });
  if (error) throw new Error("Workspace roster is unavailable");
  if (!data || typeof data !== "object") throw new Error("TEAM_CONFLICT");

  const raw = data as Record<string, unknown>;
  if (!validScope(raw.scope)) throw new Error("TEAM_FORBIDDEN");
  if (raw.scope.accountId !== scope.accountId || raw.scope.artistWorkspaceId !== scope.artistWorkspaceId || raw.scope.artistId !== scope.artistId) {
    throw new Error("TEAM_FORBIDDEN");
  }
  if (!Array.isArray(raw.members) || raw.members.length < 1 || raw.members.length > 6) throw new Error("TEAM_CONFLICT");

  const members = raw.members.map((value) => {
    if (!value || typeof value !== "object") throw new Error("TEAM_CONFLICT");
    const member = value as Record<string, unknown>;
    if (!UUID.test(String(member.userId)) || (member.accessRole !== "owner" && member.accessRole !== "member")) throw new Error("TEAM_CONFLICT");
    const tags = Array.isArray(member.responsibilityTags)
      ? [...new Set(member.responsibilityTags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim()))]
      : [];
    return {
      userId: String(member.userId),
      displayName: typeof member.displayName === "string" && member.displayName.trim() ? member.displayName.trim() : "Team member",
      accessRole: member.accessRole as "owner" | "member",
      operatingTitle: typeof member.operatingTitle === "string" && member.operatingTitle.trim() ? member.operatingTitle.trim() : null,
      responsibilityTags: tags,
    };
  });
  if (!members.some((member) => member.accessRole === "owner")) throw new Error("TEAM_CONFLICT");
  if (typeof raw.loadedAt !== "string" || Number.isNaN(Date.parse(raw.loadedAt))) throw new Error("TEAM_CONFLICT");
  return { scope, members, loadedAt: raw.loadedAt };
}
