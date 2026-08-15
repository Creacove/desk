import { describe, expect, it, vi } from "vitest";
import { persistFocusedSongDocumentDraft } from "../supabase/functions/_shared/songDocumentDraft";

describe("song document quality gate", () => {
  it("rejects plain-text recipient collateral before any persistence write", async () => {
    const rpc = vi.fn();

    await expect(persistFocusedSongDocumentDraft(
      { rpc },
      {
        accountId: "account-1",
        artistWorkspaceId: "workspace-1",
        artistId: "artist-1",
        body: "Create the press pitch for this song.",
        musicSubject: { type: "music_item", id: "song-1" },
        documentType: "press_pitch",
        title: "After Midnight press pitch",
      },
      "run-1",
      "A concise song-specific press pitch draft.",
      false,
    )).rejects.toThrow(/structured JSON artifact/i);

    expect(rpc).not.toHaveBeenCalled();
  });
});
