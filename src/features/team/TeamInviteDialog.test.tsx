import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeamInviteDialog } from "./TeamInviteDialog";

const mutation = {
  invitation: {
    id: "invite-1",
    artistWorkspaceId: "workspace-1",
    email: "manager@example.com",
    status: "pending" as const,
    expiresAt: "2026-09-13T10:00:00.000Z",
    operatingTitle: null,
    responsibilityTags: [],
  },
  token: "A".repeat(43),
  emailStatus: "failed" as const,
};

afterEach(cleanup);

describe("TeamInviteDialog", () => {
  it("focuses email first and progressively reveals role details", () => {
    render(<TeamInviteDialog open onOpenChange={vi.fn()} teamName="CBA — House 3" artistName="Godwinton" remainingSeats={5} onInvite={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Invite someone" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveFocus();
    expect(screen.queryByRole("combobox", { name: "Their role" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add role details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add role details" }));
    expect(screen.getByRole("combobox", { name: "Their role" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Responsibility 3" })).toBeInTheDocument();
  });

  it("submits the email and optional role details, then makes failed delivery recoverable", async () => {
    const onInvite = vi.fn().mockResolvedValue(mutation);
    const onOpenChange = vi.fn();
    render(<TeamInviteDialog open onOpenChange={onOpenChange} teamName="CBA — House 3" artistName="Godwinton" remainingSeats={5} onInvite={onInvite} />);

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "manager@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() => expect(onInvite).toHaveBeenCalledWith({ email: "manager@example.com", operatingTitle: null, responsibilityTags: [] }));
    expect(await screen.findByText("Invite created, but the email did not send")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy invite link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByDisplayValue(`${window.location.origin}/join#token=${mutation.token}`)).toBeInTheDocument();
  });

  it("does not allow an invite when there is no seat", () => {
    render(<TeamInviteDialog open onOpenChange={vi.fn()} teamName="CBA — House 3" artistName="Godwinton" remainingSeats={0} onInvite={vi.fn()} />);

    expect(screen.getByText("All seats are filled.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeDisabled();
  });
});
