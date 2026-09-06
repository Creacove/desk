export type WorkspaceOperation = "manage_team" | "approve" | "billing" | "execute_task" | "contribute";
export type WorkspaceAuthorizationResult = {
  authorized: true;
  role: "owner" | "member";
  membershipId: string;
  assignmentVersion?: number;
  assigneeUserId?: string;
};

type Scope = { accountId: string; artistWorkspaceId: string; artistId: string };
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATIONS = new Set<WorkspaceOperation>(["manage_team", "approve", "billing", "execute_task", "contribute"]);

export async function assertWorkspaceOperation(db: RpcClient, input: {
  scope: Scope;
  actorUserId: string;
  operation: WorkspaceOperation;
  taskId?: string;
}): Promise<WorkspaceAuthorizationResult> {
  const { scope, actorUserId, operation, taskId } = input;
  if (!scope || !UUID.test(scope.accountId) || !UUID.test(scope.artistWorkspaceId) || !UUID.test(scope.artistId) ||
      !UUID.test(actorUserId) || !OPERATIONS.has(operation) || (taskId !== undefined && !UUID.test(taskId))) {
    throw new Error("TEAM_BAD_INPUT");
  }
  const { data, error } = await db.rpc("assert_workspace_operation_v1", {
    p_account_id: scope.accountId,
    p_artist_workspace_id: scope.artistWorkspaceId,
    p_artist_id: scope.artistId,
    p_actor_user_id: actorUserId,
    p_operation: operation,
    p_task_id: taskId ?? null,
  });
  if (error) {
    const code = String((error as { message?: unknown })?.message ?? "").match(/TEAM_[A-Z_]+/)?.[0];
    throw new Error(code ?? "Workspace authorization is unavailable");
  }
  if (!data || typeof data !== "object") throw new Error("TEAM_FORBIDDEN");
  const result = data as Record<string, unknown>;
  if (result.authorized !== true || (result.role !== "owner" && result.role !== "member") || !UUID.test(String(result.membershipId))) {
    throw new Error("TEAM_FORBIDDEN");
  }
  const normalized: WorkspaceAuthorizationResult = {
    authorized: true,
    role: result.role,
    membershipId: String(result.membershipId),
  };
  if (Number.isInteger(result.assignmentVersion) && Number(result.assignmentVersion) >= 0) normalized.assignmentVersion = Number(result.assignmentVersion);
  if (typeof result.assigneeUserId === "string" && UUID.test(result.assigneeUserId)) normalized.assigneeUserId = result.assigneeUserId;
  return normalized;
}
