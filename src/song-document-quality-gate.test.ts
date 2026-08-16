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

  it("persists a structurally valid sparse EPK as needs-review instead of pretending persistence failed", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        documentId: "document-1",
        versionId: "version-1",
        musicItemId: "song-1",
        documentType: "epk",
        title: "Oleku EPK",
        status: "draft",
        created: true,
      },
      error: null,
    }));
    const sparseEpk = JSON.stringify({
      purpose: "Prepare a factual review draft for future press use.",
      audience: "Music press and editorial teams.",
      coreNarrative: "Oleku is a developing catalog record and this draft intentionally uses only verified workspace facts while the artist team supplies the missing creative and contact material.",
      sections: [
        {
          key: "proof",
          title: "Proof",
          content: "Current workspace evidence can support a limited factual performance snapshot, but it does not prove fan conversion, editorial support, campaign ROI, or breakout momentum.",
          evidenceRefs: ["workspace:song-1"],
        },
        {
          key: "contact",
          title: "Contact",
          content: "No approved public press contact is currently stored for this record, so the review draft does not invent one.",
          evidenceRefs: [],
        },
      ],
      claims: [{
        text: "The workspace contains a limited performance snapshot for this song.",
        basis: "workspace",
        sourceRef: "workspace:song-1",
        confidence: "high",
      }],
      missingInputs: [
        "Artist snapshot and approved biography",
        "Release story and song story",
        "Why now",
        "Sound and context",
        "Press angles",
        "Assets and links",
        "Approved press contact",
      ],
    });

    const result = await persistFocusedSongDocumentDraft(
      { rpc },
      {
        accountId: "account-1",
        artistWorkspaceId: "workspace-1",
        artistId: "artist-1",
        body: "Create EPK for this record.",
        musicSubject: { type: "music_item", id: "song-1" },
        documentType: "epk",
        title: "Oleku EPK",
      },
      "run-1",
      sparseEpk,
      false,
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "draft",
      documentType: "epk",
      quality: expect.objectContaining({ readiness: "needs_review" }),
    });
    expect(result?.quality?.blockers.length).toBeGreaterThan(0);
  });
});
