import { describe, expect, it, vi } from "vitest";

import {
  loadActiveWorkspaceRoster,
  type WorkspaceRoster,
  type WorkspaceScope,
} from "../supabase/functions/_shared/workspaceRoster";

const scope: WorkspaceScope = {
  accountId: "11111111-1111-4111-8111-111111111111",
  artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
  artistId: "33333333-3333-4333-8333-333333333333",
};

function dbReturning(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn(async () => ({ data, error })),
  };
}

describe("loadActiveWorkspaceRoster", () => {
  it("loads a scoped roster through the authorized RPC and omits private fields", async () => {
    const db = dbReturning({
      scope,
      members: [
        {
          userId: "44444444-4444-4444-8444-444444444444",
          displayName: "Owner",
          accessRole: "owner",
          operatingTitle: null,
          responsibilityTags: [],
          email: "owner@example.com",
        },
        {
          userId: "55555555-5555-4555-8555-555555555555",
          displayName: "",
          accessRole: "member",
          operatingTitle: "Distribution",
          responsibilityTags: ["distribution", "distribution"],
          email: "member@example.com",
        },
      ],
      loadedAt: "2026-09-05T09:00:00.000Z",
    });

    const roster = await loadActiveWorkspaceRoster(db, scope);

    expect(db.rpc).toHaveBeenCalledWith("get_workspace_roster_v1", {
      p_artist_workspace_id: scope.artistWorkspaceId,
    });
    expect(roster).toEqual<WorkspaceRoster>({
      scope,
      members: [
        {
          userId: "44444444-4444-4444-8444-444444444444",
          displayName: "Owner",
          accessRole: "owner",
          operatingTitle: null,
          responsibilityTags: [],
        },
        {
          userId: "55555555-5555-4555-8555-555555555555",
          displayName: "Team member",
          accessRole: "member",
          operatingTitle: "Distribution",
          responsibilityTags: ["distribution"],
        },
      ],
      loadedAt: "2026-09-05T09:00:00.000Z",
    });
    expect(JSON.stringify(roster)).not.toContain("@example.com");
  });

  it("rejects a response bound to another account, artist, or workspace", async () => {
    const db = dbReturning({
      scope: { ...scope, accountId: "99999999-9999-4999-8999-999999999999" },
      members: [],
      loadedAt: "2026-09-05T09:00:00.000Z",
    });

    await expect(loadActiveWorkspaceRoster(db, scope)).rejects.toThrow("TEAM_FORBIDDEN");
  });

  it("fails closed when the roster is not a bounded active human roster", async () => {
    const db = dbReturning({
      scope,
      members: Array.from({ length: 7 }, (_, index) => ({
        userId: `44444444-4444-4444-8444-${String(index + 1).padStart(12, "0")}`,
        displayName: `Member ${index + 1}`,
        accessRole: "member",
        operatingTitle: null,
        responsibilityTags: [],
      })),
      loadedAt: "2026-09-05T09:00:00.000Z",
    });

    await expect(loadActiveWorkspaceRoster(db, scope)).rejects.toThrow("TEAM_CONFLICT");
  });

  it("sanitizes database failures without returning internal SQL details", async () => {
    const db = dbReturning(null, { message: "permission denied: internal roster table" });

    await expect(loadActiveWorkspaceRoster(db, scope)).rejects.toThrow("Workspace roster is unavailable");
    await expect(loadActiveWorkspaceRoster(db, scope)).rejects.not.toThrow("internal roster table");
  });
});
