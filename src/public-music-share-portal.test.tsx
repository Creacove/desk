import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { PublicMusicSharePortal } from "./features/music/PublicMusicSharePortal";

describe("PublicMusicSharePortal", () => {
  it("shows only the selected package assets and their direct downloads", async () => {
    const loadShare = vi.fn(async () => ({
      label: "Jam release package",
      preset: "epk_press",
      assets: [
        { id: "asset-master", title: "Final master", assetType: "final_master", fileName: "jam-master.wav", fileType: "audio/wav", downloadUrl: "https://files.example/master" },
        { id: "asset-cover", title: "Cover artwork", assetType: "cover_art", fileName: "jam-cover.jpg", fileType: "image/jpeg", downloadUrl: "https://files.example/cover" },
      ],
    }));

    render(<PublicMusicSharePortal token={"a".repeat(64)} loadShare={loadShare} />);

    expect(screen.getByText("Loading shared package...")).toBeInTheDocument();
    await waitFor(() => expect(loadShare).toHaveBeenCalledWith("a".repeat(64)));
    expect(await screen.findByRole("heading", { name: "Jam release package" })).toBeInTheDocument();
    expect(screen.getByText("EPK / press package")).toBeInTheDocument();
    expect(screen.getByText("Final master")).toBeInTheDocument();
    expect(screen.getByText("Cover artwork")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Download/ })).toHaveLength(2);
    expect(screen.getByLabelText("Listen to Final master")).toHaveAttribute("src", "https://files.example/master");
    expect(screen.queryByLabelText("Listen to Cover artwork")).not.toBeInTheDocument();
    expect(screen.queryByText("Catalog")).not.toBeInTheDocument();
  });

  it("keeps an unavailable package neutral", async () => {
    render(<PublicMusicSharePortal token={"b".repeat(64)} loadShare={async () => { throw new Error("Internal storage trace"); }} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("This share link is unavailable.");
    expect(screen.queryByText("Internal storage trace")).not.toBeInTheDocument();
  });
});
