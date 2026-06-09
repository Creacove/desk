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
          { name: "Nova Vale", role: "Artist / writer", publishingShare: "50%", masterShare: "70%", approval: "pending" },
          { name: "Mara Vale", role: "Producer / writer", publishingShare: "50%", masterShare: "30%", approval: "pending" },
        ],
      }),
      submitSplitConfirmation: submit,
    } as Partial<MusicRepository> as MusicRepository;

    render(<SplitConfirmationPortal token="raw-token" musicRepository={repository} />);

    expect(await screen.findByRole("heading", { name: "Confirm split details" })).toBeInTheDocument();
    expect(screen.getByText("North Star")).toBeInTheDocument();
    expect(screen.getByText("Mara Vale")).toBeInTheDocument();
    expect(screen.getByText("50% publishing")).toBeInTheDocument();
    expect(screen.getByText("30% master")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Ordersounds Desk navigation" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("I confirm these split details are correct for my contribution."));
    fireEvent.click(screen.getByRole("button", { name: "Confirm split details" }));

    expect(await screen.findByText("Split details confirmed")).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith("raw-token", {
      decision: "confirmed",
      confirmationText: "I confirm these split details are correct for my contribution.",
    });
  });
});
