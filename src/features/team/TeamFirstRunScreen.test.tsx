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
  teamName: null,
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
    completeFirstRun: vi.fn().mockResolvedValue({ ...capability, teamName: "North Star Records", firstRunCompletedAt: "2026-09-06T10:00:00.000Z" }),
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

async function completeOwnerSetup(service: WorkspaceTeamService) {
  fireEvent.change(screen.getByLabelText("Team or company name"), { target: { value: "North Star Records" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Your role" }), { target: { value: "Artist / performer" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Responsibility 1" }), { target: { value: "Creative direction" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await waitFor(() => expect(service.completeFirstRun).toHaveBeenCalledWith({
    artistWorkspaceId: scope.artistWorkspaceId,
    teamName: "North Star Records",
    operatingTitle: "Artist / performer",
    responsibilityTags: ["Creative direction", "Recording & performance", "Artist development"],
  }));
}

describe("TeamFirstRunScreen", () => {
  it("reveals team identity, role, and responsibilities one decision at a time", async () => {
    const service = createService();
    render(<TeamFirstRunScreen service={service} scope={scope} artistName="Nova Vale" capability={capability} onComplete={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Name your team" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Your role" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Team or company name"), { target: { value: "North Star Records" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Your role on the team" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Responsibility 1" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Your role" }), { target: { value: "Artist / performer" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "What will you handle?" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Responsibility 3" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Responsibility 1" }), { target: { value: "Creative direction" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(service.completeFirstRun).toHaveBeenCalled());
    expect(await screen.findByRole("heading", { name: "Bring in your team" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Invite email")).not.toBeInTheDocument();
  });

  it("lets the owner use a custom role without displaying owner as a work role", () => {
    const service = createService();
    render(<TeamFirstRunScreen service={service} scope={scope} artistName="Nova Vale" capability={capability} onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Team or company name"), { target: { value: "North Star Records" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Your role" }), { target: { value: "Other" } });

    expect(screen.getByLabelText("Custom role")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Owner" })).not.toBeInTheDocument();
  });

  it("makes inviting optional and keeps it behind one next action", async () => {
    const service = createService();
    const onComplete = vi.fn();
    render(<TeamFirstRunScreen service={service} scope={scope} artistName="Nova Vale" capability={capability} onComplete={onComplete} />);

    await completeOwnerSetup(service);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ teamName: "North Star Records" })));
    expect(service.invite).not.toHaveBeenCalled();
  });

  it("opens the invite form only after the owner chooses to invite someone", async () => {
    const service = createService();
    const onComplete = vi.fn();
    render(<TeamFirstRunScreen service={service} scope={scope} artistName="Nova Vale" capability={capability} onComplete={onComplete} />);

    await completeOwnerSetup(service);
    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    fireEvent.change(screen.getByLabelText("Invite email"), { target: { value: "manager@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(await screen.findByText("Invite link ready")).toBeInTheDocument();
    expect(screen.queryByText(/email sent/i)).not.toBeInTheDocument();
    expect(service.invite).toHaveBeenCalledWith(expect.objectContaining({
      artistWorkspaceId: scope.artistWorkspaceId,
      email: "manager@example.com",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Desk" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });
});
