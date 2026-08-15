import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { persistFocusedSongDocumentDraft } from "../supabase/functions/_shared/songDocumentDraft";
import type { StructuredSongDocument } from "../supabase/functions/_shared/songDocumentStandards";

function section(key: string, title: string, words = 38) {
  return {
    key,
    title,
    content: Array.from({ length: words }, (_, index) => `${key}${index + 1}`).join(" "),
    evidenceRefs: [`workspace:${key}`],
  };
}

function narrative(): StructuredSongDocument {
  return {
    purpose: "Establish one strategic story that every release artifact and campaign decision inherits.",
    audience: "The artist team and Manager running the release.",
    coreNarrative: "Down Below turns a private late-night tension into a controlled Afro-R&B release story built around intimacy, restraint and the audience already responding to the record.",
    sections: [
      section("positioning", "Positioning"),
      section("story", "Release story"),
      section("audience", "Audience"),
      section("campaign_thesis", "Campaign thesis"),
      section("proof", "Proof and signals"),
      section("creative_world", "Creative world"),
      section("language_guardrails", "Language guardrails"),
    ],
    claims: [{
      text: "The current workspace supports this positioning direction.",
      basis: "workspace",
      sourceRef: "workspace:manager-read",
      confidence: "medium",
    }],
    missingInputs: [],
  };
}

describe("structured song document persistence", () => {
  it("converts the supported press-angle transport into a canonical Release Narrative receipt", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        documentId: "document-narrative",
        versionId: "version-1",
        musicItemId: "song-1",
        documentType: "release_narrative",
        title: "Release narrative",
        status: "draft",
        created: true,
      },
      error: null,
    }));

    const result = await persistFocusedSongDocumentDraft(
      { rpc },
      {
        accountId: "account-1",
        artistWorkspaceId: "workspace-1",
        artistId: "artist-1",
        body: "Build the release narrative for this song.",
        musicSubject: { type: "music_item", id: "song-1" },
        documentType: "press_angle",
        title: "Release narrative",
      },
      "run-1",
      JSON.stringify(narrative()),
      false,
    );

    expect(result).toEqual(expect.objectContaining({
      documentId: "document-narrative",
      documentType: "release_narrative",
      title: "Release narrative",
      schemaVersion: "song_document_v2",
    }));
    expect(result?.quality?.requiredSections).toContain("campaign_thesis");
    expect(result?.quality?.blockers).toEqual([]);
    expect(rpc).toHaveBeenCalledWith("persist_focused_song_document_v2", expect.objectContaining({
      p_document_type: "press_angle",
      p_title: "Release narrative",
      p_music_item_id: "song-1",
    }));
  });

  it("keeps the database alias conversion out of the v1 press-angle upsert", () => {
    const source = readFileSync(join(process.cwd(), "supabase", "migrations", "20260815000100_structured_campaign_documents.sql"), "utf8");

    expect(source).toContain("v_release_narrative_alias := p_document_type = 'press_angle'");
    expect(source).toContain("if p_document_type <> 'release_narrative' and not v_release_narrative_alias then");
    expect(source).toContain("'Release narrative', 'release_narrative'");
  });
});
