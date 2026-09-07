import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { YourTeamPanel } from "./YourTeamPanel";
import type { TeamInvitation, WorkspaceMember, WorkspaceRoster, WorkspaceScope, WorkspaceTeamCapability } from "../../types/workspaceTeam";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";

const scope: WorkspaceScope = {
  accountId: "11111111-1111-4111-8111-111111111111",
  artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
  artistId: "33333333-3333-4333-8333-333333333333",
};

const owner: WorkspaceMember = { userId: "44444444-4444-4444-8444-444444444444", displayName: "Amina", accessRole: "owner", operatingTitle: "Artist", responsibilityTags: ["direction"] };
const member: WorkspaceMember = { userId: "55555555-5555-4555-8555-555555555555", displayName: "Sarah", accessRole: "member", operatingTitle: "Distribution lead", responsibilityTags: ["distribution", "DSPs"] };
const roster: WorkspaceRoster = { scope, members: [owner, member], loadedAt: "2026-09-05T09:00:00.000Z" };
const capability: WorkspaceTeamCapability = { ...scope, planKey: "team_6", enabled: true, entitled: true, source: "pilot", seatLimit: 6, occupiedSeats: 2, reservedSeats: 1, endsAt: null };
const pendingInvitation: TeamInvitation = { id: "66666666-6666-4666-8666-666666666666", artistWorkspaceId: scope.artistWorkspaceId, email: "daniel@example.com", status: "pending", expiresAt: "2026-09-12T09:00:00.000Z", operatingTitle: "Mastering", responsibilityTags: ["audio"] };

function createService(overrides: Partial<WorkspaceTeamService> = {}) {
  return {
    loadRoster: vi.fn().mockResolvedValue(roster),
    loadCapability: vi.fn().mockResolvedValue(capability),
    listInvitations: vi.fn().mockResolvedValue([pendingInvitation]),
    invite: vi.fn().mockResolvedValue({ invitation: pendingInvitation, token: "A".repeat(43), emailStatus: "sent" as const }),
    rotateInvitation: vi.fn().mockResolvedValue({ invitation: pendingInvitation, token: "B".repeat(43), emailStatus: "sent" as const }),
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
  return { service, ...render(<YourTeamPanel service={service} scope={scope} artistName="Odaeshi" viewerUserId={owner.userId} capability={capability} roster={roster} invitations={[pendingInvitation]} {...overrides} />) };
}

describe("YourTeamPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("shows a calm roster and one invite action without metric cards", async () => {
    renderPanel();

    expect(await screen.findByText("2 of 6 people")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite teammate" })).toBeInTheDocument();
    expect(screen.getByText("Amina")).toBeInTheDocument();
    expect(screen.getByText("Sarah")).toBeInTheDocument();
    expect(screen.queryByText("Occupied")).not.toBeInTheDocument();
    expect(screen.queryByText("Reserved")).not.toBeInTheDocument();
  });

  it("keeps optional role details out of the first invite step", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Invite teammate" }));

    expect(screen.getByRole("button", { name: "Adjust details" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Operating title")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Add responsibility")).not.toBeInTheDocument();
  });

  it("keeps the roster read only for a member", async () => {
    renderPanel({ viewerUserId: member.userId });

    expect(await screen.findByText("Sarah")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Invite teammate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit responsibilities/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove Sarah/i })).not.toBeInTheDocument();
  });

  it("explains a full six-person workspace without rendering an invite form", async () => {
    renderPanel({ capability: { ...capability, occupiedSeats: 5, reservedSeats: 1 }, roster: { ...roster, members: [owner, member] }, invitations: [] });

    expect(await screen.findByText("5 of 6 people")).toBeInTheDocument();
    expect(screen.getByText("All 6 people are already here or invited.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite teammate" })).not.toBeInTheDocument();
  });

  it("lets the owner choose a preset and reports a sent invitation", async () => {
    const { service } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Invite teammate" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "newperson@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "DSP & Distribution" }));
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(await screen.findByText("Invitation sent")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\/join#token=A+/)).toBeInTheDocument();
    expect(service.invite).toHaveBeenCalledWith({ artistWorkspaceId: scope.artistWorkspaceId, email: "newperson@example.com", operatingTitle: "DSP & Distribution", responsibilityTags: ["DSP pitching", "Distribution", "Metadata", "Platform relationships"] });
  });

  it("keeps a copy link prominent when email delivery fails", async () => {
    const service = createService({ invite: vi.fn().mockResolvedValue({ invitation: pendingInvitation, token: "A".repeat(43), emailStatus: "failed" as const }) });
    renderPanel({ service });
    fireEvent.click(screen.getByRole("button", { name: "Invite teammate" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "newperson@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(await screen.findByText("Invite created, but the email did not send")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy invite link" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("#token=")));
  });

  it("resends and revokes a pending invitation", async () => {
    const { service } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Resend invitation to daniel@example.com" }));
    expect(await screen.findByDisplayValue(/\/join#token=B+/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke invitation for daniel@example.com" }));
    await waitFor(() => expect(service.revokeInvitation).toHaveBeenCalledWith(pendingInvitation.id));
  });

  it("uses the shared role picker when editing a member", async () => {
    const { service } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Edit responsibilities for Sarah" }));
    fireEvent.click(screen.getByRole("button", { name: "PR" }));
    fireEvent.click(screen.getByRole("button", { name: "Save responsibilities for Sarah" }));

    await waitFor(() => expect(service.updateResponsibilities).toHaveBeenCalledWith({ artistWorkspaceId: scope.artistWorkspaceId, memberUserId: member.userId, operatingTitle: "PR", responsibilityTags: ["Press strategy", "Media relationships", "Announcements"] }));
  });

  it("requires an explicit removal step", async () => {
    const { service } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Remove Sarah" }));
    expect(screen.getByText("Remove Sarah?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal of Sarah" }));
    await waitFor(() => expect(service.removeMember).toHaveBeenCalledWith(scope.artistWorkspaceId, member.userId));
  });
});
