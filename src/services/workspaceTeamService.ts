import type { TeamFirstRunInput, TeamInvitation, TeamInvitationMutation, TeamInvitationPreview, TeamResponsibilities, WorkspaceRoster, WorkspaceScope, WorkspaceTeamCapability } from "../types/workspaceTeam";

type Result = { data: unknown; error: null | { message?: string; context?: unknown } };
type Client = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<Result>;
  functions: { invoke: (name: string, options: { body: Record<string, unknown> }) => PromiseLike<Result> };
};

export function createWorkspaceTeamService(client: Client) {
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => unwrap<T>(await client.rpc(name, args));
  const mutate = async <T>(body: Record<string, unknown>): Promise<T> => unwrap<T>(await client.functions.invoke("account-team", { body }));
  const preview = async <T>(body: Record<string, unknown>): Promise<T> => unwrap<T>(await client.functions.invoke("preview-team-invitation", { body }));
  const completeFirstRun = (input: Pick<TeamFirstRunInput, "artistWorkspaceId" | "teamName" | "operatingTitle" | "responsibilityTags">) =>
    rpc<WorkspaceTeamCapability>("complete_team_first_run_v1", {
      p_artist_workspace_id: input.artistWorkspaceId,
      p_team_name: input.teamName,
      p_operating_title: input.operatingTitle,
      p_responsibility_tags: input.responsibilityTags,
    });
  return {
    previewInvitation: (token: string) => preview<TeamInvitationPreview>({ token }),
    loadRoster: (artistWorkspaceId: string) => rpc<WorkspaceRoster>("get_workspace_roster_v1", { p_artist_workspace_id: artistWorkspaceId }),
    loadCapability: (artistWorkspaceId: string) => rpc<WorkspaceTeamCapability>("get_workspace_team_capability_v1", { p_artist_workspace_id: artistWorkspaceId }),
    completeFirstRun,
    completeTeamFirstRun: completeFirstRun,
    listInvitations: (artistWorkspaceId: string) => rpc<TeamInvitation[]>("list_account_invitations_v1", { p_artist_workspace_id: artistWorkspaceId }),
    invite: (input: { artistWorkspaceId: string; email: string } & TeamResponsibilities) => mutate<TeamInvitationMutation>({ action: "invite", ...input }),
    rotateInvitation: (invitationId: string) => mutate<TeamInvitationMutation>({ action: "rotate_invite", invitationId }),
    revokeInvitation: (invitationId: string) => mutate<{ ok: true }>({ action: "revoke_invite", invitationId }),
    acceptInvitation: (token: string) => mutate<WorkspaceScope>({ action: "accept_invite", token }),
    removeMember: (artistWorkspaceId: string, memberUserId: string) => mutate<{ ok: true }>({ action: "remove_member", artistWorkspaceId, memberUserId }),
    updateResponsibilities: (input: { artistWorkspaceId: string; memberUserId: string } & TeamResponsibilities) => mutate<{ ok: true }>({ action: "update_responsibilities", ...input }),
    reassignTask: (input: { taskId: string; assigneeUserId: string | null; expectedAssignmentVersion: number }) => mutate<{ taskId: string; assigneeUserId: string | null; assignmentVersion: number }>({ action: "reassign_task", ...input }),
  };
}

export type WorkspaceTeamService = ReturnType<typeof createWorkspaceTeamService>;

async function unwrap<T>({ data, error }: Result): Promise<T> {
  if (error) throw await teamServiceError(error);
  if (data == null) throw new Error("Team request returned no data");
  return data as T;
}

async function teamServiceError(error: NonNullable<Result["error"]>) {
  const payload = await readErrorPayload(error.context);
  const code = payload && typeof payload.code === "string" && /^TEAM_[A-Z_]+$/.test(payload.code)
    ? payload.code
    : undefined;
  const message = payload && typeof payload.error === "string" && payload.error.trim()
    ? payload.error.trim()
    : error.message || "Team request failed";
  return Object.assign(new Error(message), code ? { code } : {});
}

async function readErrorPayload(context: unknown): Promise<Record<string, unknown> | null> {
  if (!context || typeof context !== "object") return null;
  const response = typeof (context as { clone?: unknown }).clone === "function"
    ? (context as { clone: () => unknown }).clone()
    : context;
  if (!response || typeof response !== "object" || typeof (response as { json?: unknown }).json !== "function") return null;
  try {
    const payload = await (response as { json: () => Promise<unknown> }).json();
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
