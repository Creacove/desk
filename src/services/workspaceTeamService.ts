import type { TeamInvitation, TeamResponsibilities, WorkspaceRoster, WorkspaceScope, WorkspaceTeamCapability } from "../types/workspaceTeam";

type Result = { data: unknown; error: null | { message?: string } };
type Client = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<Result>;
  functions: { invoke: (name: string, options: { body: Record<string, unknown> }) => PromiseLike<Result> };
};

export function createWorkspaceTeamService(client: Client) {
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => unwrap<T>(await client.rpc(name, args));
  const mutate = async <T>(body: Record<string, unknown>): Promise<T> => unwrap<T>(await client.functions.invoke("account-team", { body }));
  return {
    loadRoster: (artistWorkspaceId: string) => rpc<WorkspaceRoster>("get_workspace_roster_v1", { p_artist_workspace_id: artistWorkspaceId }),
    loadCapability: (artistWorkspaceId: string) => rpc<WorkspaceTeamCapability>("get_workspace_team_capability_v1", { p_artist_workspace_id: artistWorkspaceId }),
    listInvitations: (artistWorkspaceId: string) => rpc<TeamInvitation[]>("list_account_invitations_v1", { p_artist_workspace_id: artistWorkspaceId }),
    invite: (input: { artistWorkspaceId: string; email: string } & TeamResponsibilities) => mutate<{ invitation: TeamInvitation; token: string }>({ action: "invite", ...input }),
    rotateInvitation: (invitationId: string) => mutate<{ invitation: TeamInvitation; token: string }>({ action: "rotate_invite", invitationId }),
    revokeInvitation: (invitationId: string) => mutate<{ ok: true }>({ action: "revoke_invite", invitationId }),
    acceptInvitation: (token: string) => mutate<WorkspaceScope>({ action: "accept_invite", token }),
    removeMember: (artistWorkspaceId: string, memberUserId: string) => mutate<{ ok: true }>({ action: "remove_member", artistWorkspaceId, memberUserId }),
    updateResponsibilities: (input: { artistWorkspaceId: string; memberUserId: string } & TeamResponsibilities) => mutate<{ ok: true }>({ action: "update_responsibilities", ...input }),
    reassignTask: (input: { taskId: string; assigneeUserId: string | null; expectedAssignmentVersion: number }) => mutate<{ taskId: string; assigneeUserId: string | null; assignmentVersion: number }>({ action: "reassign_task", ...input }),
  };
}

export type WorkspaceTeamService = ReturnType<typeof createWorkspaceTeamService>;

function unwrap<T>({ data, error }: Result): T {
  if (error) throw new Error(error.message || "Team request failed");
  if (data == null) throw new Error("Team request returned no data");
  return data as T;
}
