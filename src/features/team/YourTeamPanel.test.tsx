import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

import { YourTeamPanel } from "./YourTeamPanel";
import type {
  TeamInvitation,
  WorkspaceMember,
  WorkspaceRoster,
  WorkspaceScope,
  WorkspaceTeamCapability,
} from "../../types/workspaceTeam";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";

const scope: WorkspaceScope = {
  accountId: "11111111-1111-4111-8111-111111111111",
  artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
  artistId: "33333333-3333-4333-8333-333333333333",
};

const owner: WorkspaceMember = {
  userId: "44444444-4444-4444-8444-444444444444",
  displayName: "Amina",
  accessRole: "owner",
  operatingTitle: "Artist",
  responsibilityTags: ["direction"],
};

const member: WorkspaceMember = {
  userId: "55555555-5555-4555-8555-555555555555",
  displayName: "Sarah",
  accessRole: "member",
  operatingTitle: "Distribution lead",
  responsibilityTags: ["distribution", "DSPs"],
};

const roster: WorkspaceRoster = {
  scope,
  members: [owner, member],
  loadedAt: "2026-09-05T09:00:00.000Z",
};

const capability: WorkspaceTeamCapability = {
  ...scope,
  planKey: "team_6",
  enabled: true,
  entitled: true,
  source: "pilot",
  seatLimit: 6,
  occupiedSeats: 2,
  reservedSeats: 1,
  endsAt: null,
};

const pendingInvitation: TeamInvitation = {
  id: "66666666-6666-4666-8666-666666666666",
  artistWorkspaceId: scope.artistWorkspaceId,
  email: "daniel@example.com",
  status: "pending",
  expiresAt: "2026-09-12T09:00:00.000Z",
  operatingTitle: "Mastering",
  responsibilityTags: ["audio"],
};

function createService(overrides: Partial<WorkspaceTeamService> = {}) {
  return {
    loadRoster: vi.fn().mockResolvedValue(roster),
    loadCapability: vi.fn().mockResolvedValue(capability),
    listInvitations: vi.fn().mockResolvedValue([pendingInvitation]),
    invite: vi.fn().mockResolvedValue({ invitation: pendingInvitation, token: "A".repeat(43) }),
    rotateInvitation: vi.fn().mockResolvedValue({ invitation: pendingInvitation, token: "B".repeat(43) }),
    revokeInvitation: vi.fn().mockResolvedValue({ ok: true as const }),
    acceptInvitation: vi.fn(),
    removeMember: vi.fn().mockResolvedValue({ ok: true as const }),
    updateResponsibilities: vi.fn().mockResolvedValue({ ok: true as const }),
    reassignTask: vi.fn(),
    ...overrides,
  } as unknown as WorkspaceTeamService;
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof YourTeamPanel>> = {}) {
  const service = overrides.service ?? createService();
  return {
    service,
    ...render(
      <YourTeamPanel
        service={service}
        scope={scope}
        artistName="Odaeshi"
        viewerUserId={owner.userId}
        capability={capability}
        {...overrides}
      />,
    ),
  };
}

describe("YourTeamPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("shows the scoped roster and separates occupied and reserved seats for an owner", async () => {
    renderPanel();

    expect(await screen.findByText("2 of 6 people")).toBeInTheDocument();
    expect(screen.getByText("2 occupied")).toBeInTheDocument();
    expect(screen.getByText("1 reserved")).toBeInTheDocument();
    expect(screen.getByText("Amina")).toBeInTheDocument();
    expect(screen.getByText("Sarah")).toBeInTheDocument();
    expect(screen.getByText("daniel@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create invite link" })).toBeInTheDocument();
  });

  it("keeps the roster read only for a member", async () => {
    const { service } = renderPanel({ viewerUserId: member.userId });

    expect(await screen.findByText("Sarah")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create invite link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit responsibilities/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove Sarah/i })).not.toBeInTheDocument();
    expect(screen.getByText("Only the workspace owner can manage team access.")).toBeInTheDocument();
    expect(service.listInvitations).not.toHaveBeenCalled();
    expect(screen.queryByText("daniel@example.com")).not.toBeInTheDocument();
  });

  it("disables invitations when all six seats are occupied or reserved", async () => {
    renderPanel({
      capability: { ...capability, occupiedSeats: 5, reservedSeats: 1 },
      roster: { ...roster, members: [owner, ...Array.from({ length: 4 }, (_, index) => ({ ...member, userId: `${member.userId.slice(0, -1)}${index}`, displayName: `Member ${index + 1}` }))] },
      invitations: [],
    });

    expect(await screen.findByText("5 of 6 people")).toBeInTheDocument();
    expect(screen.getByText("All 6 seats are occupied or reserved.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create invite link" })).not.toBeInTheDocument();
  });

  it("shows a loading state and retries a failed roster load", async () => {
    const service = createService({
      loadRoster: vi.fn()
        .mockRejectedValueOnce(new Error("Workspace roster is unavailable"))
        .mockResolvedValueOnce(roster),
      listInvitations: vi.fn()
        .mockRejectedValueOnce(new Error("Workspace invitations are unavailable"))
        .mockResolvedValueOnce([pendingInvitation]),
    });
    renderPanel({ service });

    expect(screen.getByRole("status", { name: "Loading your team" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Workspace roster is unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry team" }));
    expect(await screen.findByText("Sarah")).toBeInTheDocument();
    expect(service.loadRoster).toHaveBeenCalledTimes(2);
  });

  it("creates and copies a join link without claiming to send an email", async () => {
    const { service } = renderPanel();
    await screen.findByText("Sarah");

    fireEvent.change(screen.getByLabelText("Invite email"), { target: { value: "newperson@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));

    expect(await screen.findByDisplayValue(/\/join#token=A+/)).toBeInTheDocument();
    expect(screen.getByText("Copy this link and share it with the person you want to join.")).toBeInTheDocument();
    expect(screen.queryByText(/email sent/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy invite link" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("#token=")));
    expect(service.invite).toHaveBeenCalledWith(expect.objectContaining({
      artistWorkspaceId: scope.artistWorkspaceId,
      email: "newperson@example.com",
    }));
  });

  it("rotates and revokes a pending invitation", async () => {
    const { service } = renderPanel();
    await screen.findByText("daniel@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Rotate link for daniel@example.com" }));
    expect(await screen.findByDisplayValue(/\/join#token=B+/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke invitation for daniel@example.com" }));
    await waitFor(() => expect(service.revokeInvitation).toHaveBeenCalledWith(pendingInvitation.id));
  });

  it("preserves an unsaved responsibility draft after a failed save", async () => {
    const service = createService({ updateResponsibilities: vi.fn().mockRejectedValue(new Error("Changes could not be saved.")) });
    renderPanel({ service });
    await screen.findByText("Sarah");

    fireEvent.click(screen.getByRole("button", { name: "Edit responsibilities for Sarah" }));
    fireEvent.change(screen.getByLabelText("Operating title for Sarah"), { target: { value: "Release operations" } });
    fireEvent.change(screen.getByLabelText("Responsibility tags for Sarah"), { target: { value: "distribution, release ops" } });
    fireEvent.click(screen.getByRole("button", { name: "Save responsibilities for Sarah" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Changes could not be saved.");
    expect(screen.getByDisplayValue("Release operations")).toBeInTheDocument();
    expect(screen.getByDisplayValue("distribution, release ops")).toBeInTheDocument();
  });

  it("requires an explicit removal step and removes only a member", async () => {
    const { service } = renderPanel();
    await screen.findByText("Sarah");

    fireEvent.click(screen.getByRole("button", { name: "Remove Sarah" }));
    expect(screen.getByText("Their open work will need a new owner.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal of Sarah" }));
    await waitFor(() => expect(service.removeMember).toHaveBeenCalledWith(scope.artistWorkspaceId, member.userId));
  });
});
