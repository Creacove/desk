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

    expect(screen.getByLabelText("Loading shared package")).toBeInTheDocument();
    await waitFor(() => expect(loadShare).toHaveBeenCalledWith("a".repeat(64)));
    expect(await screen.findByRole("heading", { name: "Jam release package" })).toBeInTheDocument();
    expect(screen.getByText("Press kit")).toBeInTheDocument();
    expect(screen.getAllByText("Final master")).not.toHaveLength(0);
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

  it("renders a music-first press package with one primary player and real artwork", async () => {
    const loadShare = vi.fn(async () => ({
      label: "Jam private package",
      preset: "epk_press",
      title: "Jam",
      artist: "Nova Vale",
      assets: [
        { id: "asset-master", title: "Final master", assetType: "final_master", fileName: "jam.wav", fileType: "audio/wav", inlineUrl: "https://files.example/inline-master", downloadUrl: "https://files.example/download-master" },
        { id: "asset-cover", title: "Cover artwork", assetType: "cover_art", fileName: "jam.jpg", fileType: "image/jpeg", inlineUrl: "https://files.example/inline-cover", downloadUrl: "https://files.example/download-cover" },
      ],
      information: [
        { key: "document:press", title: "Press release", value: "Jam is the new single.", documentType: "press_release" },
        { key: "genre", title: "Genre", value: "Alté" },
      ],
    }));

    render(<PublicMusicSharePortal token={"c".repeat(64)} loadShare={loadShare} />);

    expect(await screen.findByRole("heading", { name: "Jam" })).toBeInTheDocument();
    expect(screen.getByText("Nova Vale")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Jam artwork" })).toHaveAttribute("src", "https://files.example/inline-cover");
    expect(screen.getByLabelText("Listen to Jam")).toHaveAttribute("src", "https://files.example/inline-master");
    expect(screen.getAllByRole("link", { name: /Download/ }).slice(-2)).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Press release" })).toBeInTheDocument();
    expect(screen.getByText("Jam is the new single.")).toBeInTheDocument();
    expect(screen.getByText("Alté")).toBeInTheDocument();
    expect(screen.queryByText(/This package contains only/)).not.toBeInTheDocument();
  });
});
