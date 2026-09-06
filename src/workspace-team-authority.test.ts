import { describe, expect, it, vi } from "vitest";

import {
  assertWorkspaceOperation,
  type WorkspaceAuthorizationResult,
} from "../supabase/functions/_shared/workspaceAuthorization";

const scope = {
  accountId: "11111111-1111-4111-8111-111111111111",
  artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
  artistId: "33333333-3333-4333-8333-333333333333",
};
const actorUserId = "44444444-4444-4444-8444-444444444444";
const taskId = "55555555-5555-4555-8555-555555555555";

function dbReturning(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn(async () => ({ data, error })),
  };
}

describe("assertWorkspaceOperation", () => {
  it("passes the full scope, actor, operation, and optional task to the SQL boundary", async () => {
    const db = dbReturning({
      authorized: true,
      role: "member",
      membershipId: "66666666-6666-4666-8666-666666666666",
      assignmentVersion: 3,
      assigneeUserId: actorUserId,
    });

    const result = await assertWorkspaceOperation(db, {
      scope,
      actorUserId,
      operation: "execute_task",
      taskId,
    });

    expect(db.rpc).toHaveBeenCalledWith("assert_workspace_operation_v1", {
      p_account_id: scope.accountId,
      p_artist_workspace_id: scope.artistWorkspaceId,
      p_artist_id: scope.artistId,
      p_actor_user_id: actorUserId,
      p_operation: "execute_task",
      p_task_id: taskId,
    });
    expect(result).toEqual<WorkspaceAuthorizationResult>({
      authorized: true,
      role: "member",
      membershipId: "66666666-6666-4666-8666-666666666666",
      assignmentVersion: 3,
      assigneeUserId: actorUserId,
    });
  });

  it("allows owner-only operations to use the same server boundary", async () => {
    const db = dbReturning({ authorized: true, role: "owner", membershipId: "66666666-6666-4666-8666-666666666666" });

    await assertWorkspaceOperation(db, {
      scope,
      actorUserId,
      operation: "approve",
    });

    expect(db.rpc).toHaveBeenCalledWith("assert_workspace_operation_v1", {
      p_account_id: scope.accountId,
      p_artist_workspace_id: scope.artistWorkspaceId,
      p_artist_id: scope.artistId,
      p_actor_user_id: actorUserId,
      p_operation: "approve",
      p_task_id: null,
    });
  });

  it("rejects malformed scope, actor, operation, and task before calling SQL", async () => {
    const db = dbReturning({ authorized: true, role: "owner", membershipId: "66666666-6666-4666-8666-666666666666" });

    await expect(assertWorkspaceOperation(db, {
      scope: { ...scope, artistId: "bad" },
      actorUserId,
      operation: "billing",
    })).rejects.toThrow("TEAM_BAD_INPUT");
    await expect(assertWorkspaceOperation(db, {
      scope,
      actorUserId: "bad",
      operation: "billing",
    })).rejects.toThrow("TEAM_BAD_INPUT");
    await expect(assertWorkspaceOperation(db, {
      scope,
      actorUserId,
      operation: "manage_workspace" as never,
    })).rejects.toThrow("TEAM_BAD_INPUT");
    await expect(assertWorkspaceOperation(db, {
      scope,
      actorUserId,
      operation: "execute_task",
      taskId: "bad",
    })).rejects.toThrow("TEAM_BAD_INPUT");
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("maps authorization failures to sanitized errors", async () => {
    const db = dbReturning(null, { message: "TEAM_FORBIDDEN: private membership row" });

    await expect(assertWorkspaceOperation(db, {
      scope,
      actorUserId,
      operation: "manage_team",
    })).rejects.toThrow("TEAM_FORBIDDEN");
    await expect(assertWorkspaceOperation(db, {
      scope,
      actorUserId,
      operation: "manage_team",
    })).rejects.not.toThrow("private membership row");
  });
});
