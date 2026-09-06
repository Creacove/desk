import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { handleAccountTeamRequest } from "../supabase/functions/_shared/accountTeamHandler";

const ownerId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const token = "A".repeat(43);

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://api.example.com/account-team", {
    method: "POST",
    headers: { origin: "https://app.example.com", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    authenticate: vi.fn().mockResolvedValue({ id: ownerId, email: "owner@example.com", email_confirmed_at: "2026-01-01" }),
    rpc: vi.fn().mockResolvedValue({
      data: {
        id: "invite-id",
        accountId: "should-not-leak",
        artistWorkspaceId: workspaceId,
        email: "person@example.com",
        status: "pending",
        expiresAt: "2026-09-12T09:00:00.000Z",
        operatingTitle: "Distribution lead",
        responsibilityTags: ["distribution"],
        rawToken: token,
        teamName: "Northstar Team",
        artistName: "Northstar",
      },
      error: null,
    }),
    token: vi.fn().mockResolvedValue(token),
    hash: vi.fn().mockResolvedValue("hashed-token"),
    allowedOrigins: ["https://app.example.com"],
    ...overrides,
  };
}

describe("PR3 invitation boundary", () => {
  it("returns only the safe invitation preview without requiring a session", async () => {
    const source = readFileSync(join(process.cwd(), "supabase/functions/preview-team-invitation/index.ts"), "utf8");
    const config = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");
    expect(source).toContain('rpc("preview_account_invitation_v1"');
    expect(source).toContain("teamName,");
    expect(source).toContain("artistName,");
    expect(source).toContain("operatingTitle:");
    expect(source).toContain("responsibilityTags:");
    expect(source).toContain("expiresAt,");
    expect(config).toMatch(/\[functions\.account-team\]\s*verify_jwt = true/);
    expect(config).toMatch(/\[functions\.preview-team-invitation\]\s*verify_jwt = false/);
  });

  it("emails an invite only after the database mutation and keeps a copy-link result when delivery fails", async () => {
    const order: string[] = [];
    const sendInvitationEmail = vi.fn().mockImplementation(async () => { order.push("email"); });
    const deps = dependencies({
      sendInvitationEmail,
      rpc: vi.fn().mockImplementation(async (name: string) => {
        order.push(name);
        return { data: { id: "invite-id", email: "person@example.com", status: "pending", expiresAt: "2026-09-12T09:00:00.000Z", operatingTitle: null, responsibilityTags: [] }, error: null };
      }),
    });

    const response = await handleAccountTeamRequest(request({
      action: "invite",
      artistWorkspaceId: workspaceId,
      email: "person@example.com",
      operatingTitle: null,
      responsibilityTags: [],
    }, { authorization: "Bearer verified-session" }), deps);

    expect(response.status).toBe(200);
    expect(order).toEqual(["invite_account_member_v1", "email"]);
    expect(await response.json()).toMatchObject({ token, emailStatus: "sent" });

    const failed = dependencies({
      sendInvitationEmail: vi.fn().mockRejectedValue(new Error(`provider failed ${token}`)),
    });
    const failedResponse = await handleAccountTeamRequest(request({
      action: "invite",
      artistWorkspaceId: workspaceId,
      email: "person@example.com",
      operatingTitle: null,
      responsibilityTags: [],
    }, { authorization: "Bearer verified-session" }), failed);
    expect(failedResponse.status).toBe(200);
    expect(await failedResponse.json()).toMatchObject({ token, emailStatus: "failed" });
  });
});
