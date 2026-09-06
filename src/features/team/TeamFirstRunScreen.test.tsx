import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeamFirstRunScreen } from "./TeamFirstRunScreen";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";
import type { WorkspaceScope, WorkspaceTeamCapability } from "../../types/workspaceTeam";

const scope: WorkspaceScope = {
  accountId: "11111111-1111-4111-8111-111111111111",
  artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
  artistId: "33333333-3333-4333-8333-333333333333",
};

const capability: WorkspaceTeamCapability = {
  ...scope,
  planKey: "team_6",
  enabled: true,
  entitled: true,
  source: "pilot",
  seatLimit: 6,
  occupiedSeats: 1,
  reservedSeats: 0,
  endsAt: null,
  firstRunCompletedAt: null,
};

function createService() {
  return {
    completeFirstRun: vi.fn().mockResolvedValue({ ...capability, firstRunCompletedAt: "2026-09-06T10:00:00.000Z" }),
    invite: vi.fn().mockResolvedValue({
      invitation: {
        id: "66666666-6666-4666-8666-666666666666",
        artistWorkspaceId: scope.artistWorkspaceId,
        email: "manager@example.com",
        status: "pending" as const,
        expiresAt: "2026-09-13T10:00:00.000Z",
        operatingTitle: null,
        responsibilityTags: [],
      },
      token: "A".repeat(43),
    }),
  } as unknown as WorkspaceTeamService;
}

afterEach(cleanup);

describe("TeamFirstRunScreen", () => {
  it("saves team identity and editable owner responsibilities before showing invite step", async () => {
    const service = createService();
    const onComplete = vi.fn();
    render(
      <TeamFirstRunScreen
        service={service}
        scope={scope}
        artistName="Nova Vale"
        capability={capability}
        onComplete={onComplete}
      />,
    );

    expect(screen.getByRole("heading", { name: "Set up your team" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Team or company name"), { target: { value: "North Star Records" } });
    fireEvent.click(screen.getByRole("button", { name: "Artist Manager" }));
    fireEvent.change(screen.getByLabelText("Operating title"), { target: { value: "Founder / artist" } });
    fireEvent.change(screen.getByLabelText("Responsibilities"), { target: { value: "direction, approvals" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to invites" }));

    await waitFor(() => expect(service.completeFirstRun).toHaveBeenCalledWith({
      artistWorkspaceId: scope.artistWorkspaceId,
      teamName: "North Star Records",
      operatingTitle: "Founder / artist",
      responsibilityTags: ["direction", "approvals"],
    }));
    expect(await screen.findByRole("heading", { name: "Bring in your team" })).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("lets the owner skip invites and finish at Desk", async () => {
    const service = createService();
    const onComplete = vi.fn();
    render(
      <TeamFirstRunScreen
        service={service}
        scope={scope}
        artistName="Nova Vale"
        capability={capability}
        onComplete={onComplete}
      />,
    );

    fireEvent.change(screen.getByLabelText("Team or company name"), { target: { value: "North Star Records" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to invites" }));
    await screen.findByRole("heading", { name: "Bring in your team" });
    fireEvent.click(screen.getByRole("button", { name: "I’ll do this later" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ firstRunCompletedAt: expect.any(String) })));
    expect(service.invite).not.toHaveBeenCalled();
  });

  it("creates an invite without claiming an email was sent, then continues to Desk", async () => {
    const service = createService();
    const onComplete = vi.fn();
    render(
      <TeamFirstRunScreen
        service={service}
        scope={scope}
        artistName="Nova Vale"
        capability={capability}
        onComplete={onComplete}
      />,
    );

    fireEvent.change(screen.getByLabelText("Team or company name"), { target: { value: "North Star Records" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to invites" }));
    await screen.findByRole("heading", { name: "Bring in your team" });
    fireEvent.change(screen.getByLabelText("Invite email"), { target: { value: "manager@example.com" } });
    fireEvent.change(screen.getByLabelText("Invite role"), { target: { value: "DSP & Distribution" } });
    fireEvent.change(screen.getByLabelText("Invite responsibilities"), { target: { value: "DSP pitching, Distribution, Metadata" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(await screen.findByText("Invite link ready")).toBeInTheDocument();
    expect(screen.queryByText(/email sent/i)).not.toBeInTheDocument();
    expect(service.invite).toHaveBeenCalledWith(expect.objectContaining({
      artistWorkspaceId: scope.artistWorkspaceId,
      email: "manager@example.com",
      operatingTitle: "DSP & Distribution",
      responsibilityTags: ["DSP pitching", "Distribution", "Metadata"],
    }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Desk" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });
});
