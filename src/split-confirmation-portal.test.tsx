import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SplitConfirmationPortal } from "./features/music/SplitConfirmationPortal";
import type { MusicRepository } from "./types/cleanProduction";

afterEach(() => {
  cleanup();
});

describe("Split confirmation portal", () => {
  it("renders a token-scoped public confirmation page without app navigation", async () => {
    const submit = vi.fn(async () => undefined);
    const repository = {
      loadSplitConfirmation: async () => ({
        songTitle: "North Star",
        contributorName: "Mara Vale",
        contributorRole: "Producer / writer",
        publishingShare: "50%",
        masterShare: "30%",
        status: "sent",
        contributors: [
          { name: "Nova Vale", role: "Artist / writer", publishingShare: "50%", masterShare: "70%" },
          { name: "Mara Vale", role: "Producer / writer", publishingShare: "50%", masterShare: "30%" },
        ],
      }),
      submitSplitConfirmation: submit,
    } as Partial<MusicRepository> as MusicRepository;

    render(<SplitConfirmationPortal token="raw-token" musicRepository={repository} />);

    expect(await screen.findByRole("heading", { name: "Review your shares" })).toBeInTheDocument();
    expect(screen.getByText("North Star")).toBeInTheDocument();
    expect(screen.getAllByText(/Mara Vale/).length).toBeGreaterThan(0);
    expect(screen.getByText("Your publishing share")).toBeInTheDocument();
    expect(screen.getByText("Your master share")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Ordersounds Desk navigation" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("I confirm these split details are correct for my contribution."));
    expect(screen.getByText("Publishing covers the song’s composition and songwriting ownership.")).toBeInTheDocument();
    expect(screen.getByText("Master covers ownership of this specific recording.")).toBeInTheDocument();
    expect(screen.getByText("Publishing total: 100%")).toBeInTheDocument();
    expect(screen.getByText("Master total: 100%")).toBeInTheDocument();
    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm my shares" }));

    expect(await screen.findByText("Split details confirmed")).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith("raw-token", {
      decision: "confirmed",
      confirmationText: "I confirm these split details are correct for my contribution.",
    });
  });

  it("requires a useful reason before requesting a correction", async () => {
    const submit = vi.fn(async () => undefined);
    const repository = {
      loadSplitConfirmation: async () => ({
        songTitle: "North Star",
        contributorName: "Mara Vale",
        contributorRole: "Producer / writer",
        publishingShare: "50%",
        masterShare: "30%",
        status: "sent",
        contributors: [
          { name: "Nova Vale", role: "Artist / writer", publishingShare: "50%", masterShare: "70%" },
          { name: "Mara Vale", role: "Producer / writer", publishingShare: "50%", masterShare: "30%" },
        ],
      }),
      submitSplitConfirmation: submit,
    } as Partial<MusicRepository> as MusicRepository;

    render(<SplitConfirmationPortal token="raw-token" musicRepository={repository} />);
    await screen.findByRole("heading", { name: "Review your shares" });
    fireEvent.click(screen.getByRole("button", { name: "Request a correction" }));
    const reason = screen.getByLabelText("What needs to change?");
    expect(screen.getByRole("button", { name: "Send correction request" })).toBeDisabled();
    fireEvent.change(reason, { target: { value: "My master share should be 40%." } });
    fireEvent.click(screen.getByRole("button", { name: "Send correction request" }));

    expect(await screen.findByText("Correction requested")).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith("raw-token", {
      decision: "correction_requested",
      correctionReason: "My master share should be 40%.",
    });
  });
});
