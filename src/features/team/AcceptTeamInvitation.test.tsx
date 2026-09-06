import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AcceptTeamInvitation } from "./AcceptTeamInvitation";
import type { WorkspaceScope } from "../../types/workspaceTeam";

const token = "A".repeat(43);
const scope: WorkspaceScope = {
  accountId: "11111111-1111-4111-8111-111111111111",
  artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
  artistId: "33333333-3333-4333-8333-333333333333",
};

describe("AcceptTeamInvitation", () => {
  afterEach(cleanup);

  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/join");
  });

  it("captures a fragment token, scrubs it immediately, and accepts it once authenticated", async () => {
    window.history.replaceState({}, "", `/join#token=${token}`);
    const acceptInvitation = vi.fn().mockResolvedValue(scope);
    const onAccepted = vi.fn();

    render(
      <AcceptTeamInvitation
        service={{ acceptInvitation } as never}
        user={{ id: "44444444-4444-4444-8444-444444444444", email: "person@example.com" }}
        onAccepted={onAccepted}
      />,
    );

    expect(window.location.hash).toBe("");
    expect(sessionStorage.getItem("ordersounds.team.invite.token")).toBe(token);
    expect(await screen.findByText("Workspace joined")).toBeInTheDocument();
    expect(acceptInvitation).toHaveBeenCalledWith(token);
    expect(onAccepted).toHaveBeenCalledWith(scope);
    expect(sessionStorage.getItem("ordersounds.team.invite.token")).toBeNull();
  });

  it("keeps the token through an authentication handoff and does not expose it in the UI", async () => {
    window.history.replaceState({}, "", `/join#token=${token}`);
    const acceptInvitation = vi.fn().mockResolvedValue(scope);
    render(
      <AcceptTeamInvitation
        service={{ acceptInvitation } as never}
        user={null}
        onAuthenticationRequired={() => undefined}
      />,
    );

    expect(await screen.findByText("Sign in to accept this invitation.")).toBeInTheDocument();
    expect(screen.queryByText(token)).not.toBeInTheDocument();
    expect(acceptInvitation).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("ordersounds.team.invite.token")).toBe(token);
  });

  it("clears an expired or revoked token and gives a safe retry message", async () => {
    window.history.replaceState({}, "", `/join#token=${token}`);
    const acceptInvitation = vi.fn().mockRejectedValue(Object.assign(new Error("expired"), { code: "TEAM_GONE" }));
    render(
      <AcceptTeamInvitation
        service={{ acceptInvitation } as never}
        user={{ id: "44444444-4444-4444-8444-444444444444", email: "person@example.com" }}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation has expired or was revoked.");
    expect(sessionStorage.getItem("ordersounds.team.invite.token")).toBeNull();
  });
});
