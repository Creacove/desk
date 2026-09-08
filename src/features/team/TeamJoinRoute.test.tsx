import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TeamJoinRoute } from "./TeamJoinRoute";
import type { WorkspaceScope } from "../../types/workspaceTeam";
import type { ProductionAuthAdapter, ProductionUser } from "../../types/productionApp";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";

const token = "A".repeat(43);
const scope: WorkspaceScope = {
  accountId: "11111111-1111-4111-8111-111111111111",
  artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
  artistId: "33333333-3333-4333-8333-333333333333",
};
const member: ProductionUser = { id: "44444444-4444-4444-8444-444444444444", email: "member@example.com", displayName: "New member" };

function createService(overrides: Partial<WorkspaceTeamService> = {}) {
  return {
    previewInvitation: vi.fn().mockResolvedValue({
      teamName: "Northstar Team",
      artistName: "Northstar",
      invitedEmail: "member@example.com",
      operatingTitle: "Distribution lead",
      responsibilityTags: ["distribution", "DSPs"],
      expiresAt: "2026-09-12T09:00:00.000Z",
    }),
    acceptInvitation: vi.fn().mockResolvedValue(scope),
    ...overrides,
  } as unknown as Pick<WorkspaceTeamService, "previewInvitation" | "acceptInvitation">;
}

function renderRoute({ user = null, service = createService(), authAdapter: suppliedAuth, onNavigateToDesk: suppliedNavigate }: { user?: ProductionUser | null; service?: ReturnType<typeof createService>; authAdapter?: ProductionAuthAdapter; onNavigateToDesk?: () => void } = {}) {
  let currentUser = user;
  const authAdapter: ProductionAuthAdapter = suppliedAuth ?? {
    getSession: vi.fn().mockImplementation(async () => ({ user: currentUser })),
    signInWithPassword: vi.fn().mockResolvedValue({ user: currentUser }),
    signUpWithPassword: vi.fn().mockImplementation(async () => ({ user: currentUser, authenticated: false, message: "Check your email to confirm the account." })),
  };
  const onAccepted = vi.fn((nextScope: WorkspaceScope) => { currentUser = member; void nextScope; });
  const onNavigateToDesk = suppliedNavigate ?? vi.fn();
  return { service, authAdapter, onAccepted, onNavigateToDesk, ...render(<TeamJoinRoute service={service} authAdapter={authAdapter} onAccepted={onAccepted} onNavigateToDesk={onNavigateToDesk} />) };
}

describe("TeamJoinRoute PR3 flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", `/join#token=${token}`);
  });
  afterEach(cleanup);

  it("opens the invite-specific account screen directly with the invited email locked", async () => {
    renderRoute();

    expect(await screen.findByRole("heading", { name: "Create your account to join." })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("member@example.com");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.queryByText("Sign in to accept this invitation.")).not.toBeInTheDocument();
  });

  it("shows the allowlisted invitation context and carries the token into signup verification", async () => {
    const { authAdapter, service } = renderRoute();

    expect(await screen.findByText("Northstar Team")).toBeInTheDocument();
    expect(screen.getByText("For Northstar")).toBeInTheDocument();
    expect(screen.getByText("Distribution lead · distribution · DSPs")).toBeInTheDocument();
    expect(screen.queryByText("person@example.com")).not.toBeInTheDocument();

    expect(await screen.findByLabelText("Your name")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada Member" } });
    expect(screen.getByLabelText("Email")).toHaveValue("member@example.com");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password-123" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(authAdapter.signUpWithPassword).toHaveBeenCalledWith({
      email: "member@example.com",
      password: "password-123",
      name: "Ada Member",
      emailRedirectTo: `${window.location.origin}/join#token=${token}`,
    }));
    expect(service.previewInvitation).toHaveBeenCalledWith(token);
    expect(screen.getByText(/check your email to confirm/i)).toBeInTheDocument();
  });

  it("accepts into the selected workspace and redirects directly to Desk", async () => {
    const { onAccepted, onNavigateToDesk, service } = renderRoute({ user: member });

    await waitFor(() => expect(onNavigateToDesk).toHaveBeenCalledOnce());
    expect(service.acceptInvitation).toHaveBeenCalledWith(token);
    expect(onAccepted).toHaveBeenCalledWith(scope);
    expect(screen.queryByRole("heading", { name: "You’re in." })).not.toBeInTheDocument();
  });
});
