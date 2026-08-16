import { describe, expect, it } from "vitest";
import { buildManagerConversationInstructions } from "../supabase/functions/_shared/openaiManagerConversation";
import {
  managerConversationExplicitlyRequestsDecisionPackage,
  selectManagerConversationToolsForTurn,
} from "../supabase/functions/_shared/manager-conversation/agentLoop";
import { isReleaseSuccessArtifactTool, songDocumentWorkFromToolResult } from "../supabase/functions/_shared/manager-conversation/documentWork";
import { prepareFocusedSongDocumentDraft } from "../supabase/functions/_shared/songDocumentDraft";

const playlistDraft = JSON.stringify({
  purpose: "Prepare a truthful curator-ready pitch for a released song.",
  audience: "Independent playlist curator reviewing Afrobeat submissions.",
  coreNarrative: "Tarara is positioned as a focused post-release Afrobeat record whose strongest angle is the tension between melodic warmth and direct rhythmic momentum, using only verified workspace and public facts.",
  sections: [
    { key: "subject_line", title: "Subject line", content: "Tarara — a focused Afrobeat record for your current rotation", evidenceRefs: [] },
    { key: "opening", title: "Opening", content: "Sharing Tarara for consideration because its melodic approach and rhythmic feel align with the playlist's demonstrated Afrobeat lane.", evidenceRefs: [] },
    { key: "fit", title: "Why it fits", content: "The record belongs in a contemporary Afrobeat context without relying on invented performance claims, private contacts, or unsupported audience statistics.", evidenceRefs: [] },
    { key: "song_story", title: "Song story", content: "The pitch leads with the song's actual musical identity and release context rather than generic language about momentum or guaranteed traction.", evidenceRefs: [] },
    { key: "cta", title: "Call to action", content: "Please listen when useful and consider Tarara only if it genuinely fits the programming direction you are currently building.", evidenceRefs: [] }
  ],
  claims: [],
  missingInputs: ["Optional improvement: proof of a current performance signal"]
});

describe("premium Manager artifact resilience", () => {
  it("creates a useful document when a nonessential input is missing", () => {
    const prepared = prepareFocusedSongDocumentDraft("playlist_pitch", "Tarara — Everjamz playlist pitch", playlistDraft);
    expect(prepared).not.toBeNull();
    expect(prepared?.quality.blockers).toEqual([]);
    expect(prepared?.quality.readiness).toBe("needs_review");
    expect(prepared?.structure.missingInputs).toEqual(["Optional improvement: proof of a current performance signal"]);
  });

  it("preserves a generated draft when Files persistence fails", () => {
    const work = songDocumentWorkFromToolResult("song-1", {
      status: "draft_ready_unsaved",
      documentType: "epk",
      title: "Tarara EPK",
      draftBody: "# Tarara EPK\n\nA usable draft.",
      missingInputs: ["Optional improvement: artist press photo"],
      quality: { readiness: "needs_review" }
    });
    expect(work).toMatchObject({ artifactKind: "song_document", musicItemId: "song-1", readiness: "save_failed", status: "failed", content: expect.stringContaining("Tarara EPK") });
  });

  it("never promotes the internal Release narrative into user-visible created work", () => {
    expect(songDocumentWorkFromToolResult("song-1", { status: "drafted", documentId: "doc-internal", documentType: "release_narrative", title: "Release narrative", quality: { readiness: "ready" } })).toBeUndefined();
  });

  it("does not classify song-document creation as a release-success artifact", () => {
    expect(isReleaseSuccessArtifactTool("create_focused_song_document")).toBe(false);
    expect(isReleaseSuccessArtifactTool("read_focused_release_success")).toBe(true);
    expect(isReleaseSuccessArtifactTool("propose_focused_release_date_change")).toBe(true);
  });

  it("requires explicit decision-package intent", () => {
    expect(managerConversationExplicitlyRequestsDecisionPackage({ body: "Create an EPK and two playlist pitches" })).toBe(false);
    expect(managerConversationExplicitlyRequestsDecisionPackage({ body: "Create a decision package for this campaign" })).toBe(true);
  });

  it("keeps document creation available post-release without release-success tools", () => {
    const names = selectManagerConversationToolsForTurn({ body: "Create an EPK for this released song", hasAttachedUnreleasedSong: false })
      .filter((tool) => tool.type === "function")
      .map((tool) => tool.name);
    expect(names).toContain("create_focused_song_document");
    expect(names).not.toContain("read_focused_release_success");
    expect(names).not.toContain("propose_focused_release_date_change");
  });

  it("instructs the Manager to retrieve first, create before blocking, and preserve unsaved drafts", () => {
    const instructions = buildManagerConversationInstructions();
    expect(instructions).toContain("Retrieve before asking");
    expect(instructions).toContain("Create before blocking");
    expect(instructions).toContain("draft_ready_unsaved");
    expect(instructions).toContain("canonical Release narrative");
  });
});