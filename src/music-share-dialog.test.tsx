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

    expect(screen.getByRole("button", { name: "Press kit" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Press release" })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Lyrics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Release date" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Send by email" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByRole("heading", { name: "Jam" })).toBeInTheDocument();
    expect(screen.getByLabelText("Listen to Jam")).toHaveAttribute("src", "https://files.example/audio-1");
    expect(screen.getByRole("heading", { name: "Press release" })).toBeInTheDocument();
  });

  it("creates first, then offers copy, open, email, revoke, and another package", async () => {
    const onCreate = vi.fn(async () => ({ id: "share-1", label: "Jam private package", preset: "listen" as const, url: "https://desk.ordersounds.com/share/token", createdAt: "2026-08-09T12:00:00Z" }));
    render(<MusicShareDialog song={song} onCancel={vi.fn()} onCreate={onCreate} onSend={vi.fn()} onRevoke={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Listen" }));
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ preset: "listen", assetIds: ["audio-1", "cover-1"] })));
    expect(await screen.findByRole("heading", { name: "Link ready" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open package" })).toHaveAttribute("href", "https://desk.ordersounds.com/share/token");
    expect(screen.getByRole("button", { name: "Send by email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create another" })).toBeInTheDocument();
  });
});
