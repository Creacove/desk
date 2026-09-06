import { describe, expect, it, vi } from "vitest";
import { handleAccountTeamRequest } from "../supabase/functions/_shared/accountTeamHandler";

const userId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const token = "A".repeat(43);
function setup(user: any = { id: userId, email: "OWNER@Example.com", email_confirmed_at: "2026-01-01" }) {
  const rpc = vi.fn().mockResolvedValue({ data: { id: "invite" }, error: null });
  return { rpc, authenticate: vi.fn().mockResolvedValue(user), token: async () => token, hash: vi.fn(async () => "hashed-token"), allowedOrigins: ["https://app.example.com"] };
}
function request(body: unknown, origin = "https://app.example.com") {
  return new Request("https://api.example.com/account-team", { method: "POST", headers: { authorization: "Bearer verified-test-session", origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
describe("account-team authenticated boundary", () => {
  it("issues a hashed invitation using only the verified actor", async () => {
    const deps = setup();
    const response = await handleAccountTeamRequest(request({ action: "invite", artistWorkspaceId: workspaceId, email: " Sarah@Example.com ", operatingTitle: " DSP ", responsibilityTags: ["distribution", "distribution"], actorUserId: "forged" }), deps);
    expect(response.status).toBe(200);
    expect(deps.rpc).toHaveBeenCalledWith("invite_account_member_v1", { p_actor_user_id: userId, p_artist_workspace_id: workspaceId, p_email: "sarah@example.com", p_token_hash: "hashed-token", p_operating_title: "DSP", p_responsibility_tags: ["distribution"] });
    expect(await response.json()).toEqual({ invitation: { id: "invite" }, token });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("accepts only a confirmed auth email and never a supplied email", async () => {
    const deps = setup();
    await handleAccountTeamRequest(request({ action: "accept_invite", token, email: "forged@example.com" }), deps);
    expect(deps.rpc).toHaveBeenCalledWith("accept_account_invitation_v1", { p_actor_user_id: userId, p_email: "owner@example.com", p_token_hash: "hashed-token" });
    const unverified = setup({ id: userId, email: "owner@example.com" });
    expect((await handleAccountTeamRequest(request({ action: "accept_invite", token }), unverified)).status).toBe(403);
    expect(unverified.rpc).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated and foreign-origin requests before mutation", async () => {
    const missing = setup(null);
    expect((await handleAccountTeamRequest(request({ action: "revoke_invite", invitationId: workspaceId }), missing)).status).toBe(401);
    const deps = setup();
    expect((await handleAccountTeamRequest(request({ action: "revoke_invite", invitationId: workspaceId }, "https://evil.example"), deps)).status).toBe(403);
    expect(deps.rpc).not.toHaveBeenCalled();
  });
  it("validates UUIDs, tokens, title/tags, and assignment version", async () => {
    const cases = [
      { action: "accept_invite", token: "short" },
      { action: "remove_member", artistWorkspaceId: "bad", memberUserId: userId },
      { action: "reassign_task", taskId: workspaceId, assigneeUserId: userId, expectedAssignmentVersion: -1 },
      { action: "invite", artistWorkspaceId: workspaceId, email: "bad", operatingTitle: null, responsibilityTags: [] },
      { action: "update_responsibilities", artistWorkspaceId: workspaceId, memberUserId: userId, operatingTitle: "x".repeat(81), responsibilityTags: [] },
      { action: "update_responsibilities", artistWorkspaceId: workspaceId, memberUserId: userId, operatingTitle: null, responsibilityTags: [42] },
      { action: "unknown" },
    ];
    for (const body of cases) {
      const deps = setup();
      expect((await handleAccountTeamRequest(request(body), deps)).status).toBe(400);
      expect(deps.rpc).not.toHaveBeenCalled();
    }
  });
  it("maps transaction conflicts without exposing token or SQL detail", async () => {
    for (const [code, status] of [["TEAM_CONFLICT", 409], ["TEAM_GONE", 410], ["TEAM_RATE_LIMIT", 429], ["TEAM_FORBIDDEN", 403], ["TEAM_NOT_FOUND", 404]]) {
      const deps = setup();
      deps.rpc.mockResolvedValue({ data: null, error: { message: `${code}: private detail ${token}` } });
      const response = await handleAccountTeamRequest(request({ action: "accept_invite", token }), deps);
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain(token);
    }
  });
  it("fails closed on unknown backend failure", async () => {
    const deps = setup();
    deps.rpc.mockRejectedValue(new Error(`database secret ${token}`));
    const response = await handleAccountTeamRequest(request({ action: "accept_invite", token }), deps);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(token);
  });
});
