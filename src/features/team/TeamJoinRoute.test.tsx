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
      operatingTitle: "Distribution lead",
      responsibilityTags: ["distribution", "DSPs"],
      expiresAt: "2026-09-12T09:00:00.000Z",
    }),
    acceptInvitation: vi.fn().mockResolvedValue(scope),
    ...overrides,
  } as unknown as Pick<WorkspaceTeamService, "previewInvitation" | "acceptInvitation">;
}

function renderRoute({ user = null, service = createService(), authAdapter: suppliedAuth }: { user?: ProductionUser | null; service?: ReturnType<typeof createService>; authAdapter?: ProductionAuthAdapter } = {}) {
  let currentUser = user;
  const authAdapter: ProductionAuthAdapter = suppliedAuth ?? {
    getSession: vi.fn().mockImplementation(async () => ({ user: currentUser })),
    signInWithPassword: vi.fn().mockResolvedValue({ user: currentUser }),
    signUpWithPassword: vi.fn().mockImplementation(async () => ({ user: currentUser, authenticated: false, message: "Check your email to confirm the account." })),
  };
  const onAccepted = vi.fn((nextScope: WorkspaceScope) => { currentUser = member; void nextScope; });
  return { service, authAdapter, onAccepted, ...render(<TeamJoinRoute service={service} authAdapter={authAdapter} onAccepted={onAccepted} />) };
}

describe("TeamJoinRoute PR3 flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", `/join#token=${token}`);
  });
  afterEach(cleanup);

  it("shows the allowlisted invitation context and carries the token into signup verification", async () => {
    const { authAdapter, service } = renderRoute();

    expect(await screen.findByText("Northstar Team")).toBeInTheDocument();
    expect(screen.getByText(/You.ve been invited to work with Northstar/i)).toBeInTheDocument();
    expect(screen.getByText("Distribution lead")).toBeInTheDocument();
    expect(screen.getByText("distribution")).toBeInTheDocument();
    expect(screen.queryByText("person@example.com")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByLabelText("Your name")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada Member" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.com" } });
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

  it("accepts into the selected workspace and announces the member landing without owner funnel controls", async () => {
    const { onAccepted, service } = renderRoute({ user: member });

    expect(await screen.findByRole("heading", { name: "You’re in." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Today" })).toBeInTheDocument();
    expect(screen.getByText("Distribution lead")).toBeInTheDocument();
    expect(service.acceptInvitation).toHaveBeenCalledWith(token);
    expect(onAccepted).toHaveBeenCalledWith(scope);
    expect(screen.queryByText(/billing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/setup/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/manage team/i)).not.toBeInTheDocument();
  });
});
