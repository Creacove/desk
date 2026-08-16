import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MusicShareDialog } from "./features/music/MusicShareDialog";
import type { MusicObjectViewModel } from "./types/cleanProduction";

const song: MusicObjectViewModel = {
  id: "song-1",
  kind: "song",
  title: "Jam",
  lifecycle: "mastering",
  blocker: "",
  sourceLimit: "",
  managerReadStatus: "ready",
  linkedMissionIds: [],
  linkedTaskCount: 0,
  fileAssets: [
    { assetId: "audio-1", group: "Audio", label: "Final master", status: "Uploaded", action: "Replace", assetType: "final_master" },
    { assetId: "cover-1", group: "Artwork", label: "Cover artwork", status: "Confirmed", action: "Replace", assetType: "cover_art" },
  ],
  materials: [
    { id: "press-1", kind: "document", group: "Documents", materialType: "press_release", title: "Press release", status: "Ready", origin: "manager_generated", reviewState: "ready", body: "Jam is the new single." },
    { id: "empty-lyrics", kind: "document", group: "Documents", materialType: "lyrics", title: "Lyrics", status: "Draft", origin: "user_uploaded", reviewState: "ready", body: "" },
  ],
  metadataFields: [
    { label: "Primary artist", value: "Nova Vale", status: "Confirmed" },
    { label: "Genre", value: "Alte", status: "Confirmed" },
    { label: "Record label", value: "", status: "Missing" },
  ],
  releaseFields: [{ label: "Release date", value: "", status: "Missing" }],
};

afterEach(cleanup);

describe("MusicShareDialog", () => {
  it("starts with a useful press package and never offers missing content", async () => {
    render(<MusicShareDialog song={song} onCancel={vi.fn()} onCreate={vi.fn()} onRequestAssetAccess={async (id) => `https://files.example/${id}`} />);

    expect(screen.getByRole("heading", { name: "Share Jam" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Press & media/ }));
    expect(screen.getAllByRole("heading", { name: "Jam — Press Kit" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Press release")).toBeInTheDocument();
    expect(screen.getByTestId("share-primary-cta")).toHaveTextContent("Preview press kit");
    expect(screen.queryByRole("textbox", { name: "Send by email" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Preview press kit/ }));
    expect(await screen.findByRole("heading", { name: "Jam" })).toBeInTheDocument();
    expect(screen.getByLabelText("Listen to Jam")).toHaveAttribute("src", "https://files.example/audio-1");
    expect(screen.getByRole("heading", { name: "Press release" })).toBeInTheDocument();
  });

  it("creates first, then offers copy, open, email, revoke, and another package", async () => {
    const onCreate = vi.fn(async () => ({ id: "share-1", label: "Jam private package", preset: "listen" as const, url: "https://desk.ordersounds.com/share/token", createdAt: "2026-08-09T12:00:00Z" }));
    render(<MusicShareDialog song={song} onCancel={vi.fn()} onCreate={onCreate} onSend={vi.fn()} onRevoke={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /A&R \/ private listen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Preview private listen/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Create private link" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ preset: "listen", assetIds: ["audio-1", "cover-1"] })));
    expect(await screen.findByRole("heading", { name: "Share link ready" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open package" })).toHaveAttribute("href", "https://desk.ordersounds.com/share/token");
    expect(screen.getByRole("button", { name: "Send by email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create another" })).toBeInTheDocument();
  });

  it("keeps outbound pitch documents available only for explicit custom sharing", () => {
    const releaseDocumentsSong = {
      ...song,
      materials: [
        ...(song.materials ?? []),
        { id: "press-pitch", kind: "document" as const, group: "Documents" as const, materialType: "press_pitch" as const, title: "Personalized press pitch", status: "Accepted", origin: "manager_generated" as const, reviewState: "ready" as const, body: "Pitch the song to the right outlet." },
        { id: "spotify-draft", kind: "document" as const, group: "Documents" as const, materialType: "spotify_editorial_pitch" as const, title: "Spotify editorial pitch", status: "Draft", origin: "manager_generated" as const, reviewState: "needs_review" as const, body: "Unapproved pitch." },
      ],
    };

    render(<MusicShareDialog song={releaseDocumentsSong} onCancel={vi.fn()} onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Build a custom package/ }));
    expect(screen.getByRole("checkbox", { name: "Personalized press pitch" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Spotify editorial pitch" })).not.toBeChecked();
  });
});
