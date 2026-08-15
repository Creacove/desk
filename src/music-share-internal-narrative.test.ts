import { describe, expect, it } from "vitest";

import { isShareableSongDocument } from "./features/music/MusicShareDialog";
import type { SongMaterialViewModel } from "./types/cleanProduction";

type DocumentMaterial = Extract<SongMaterialViewModel, { kind: "document" }>;

function document(overrides: Partial<DocumentMaterial> = {}): DocumentMaterial {
  return {
    id: "document-1",
    kind: "document",
    group: "Documents",
    materialType: "epk",
    title: "EPK",
    status: "ready",
    origin: "manager_generated",
    reviewState: "ready",
    body: "# EPK\n\nApproved recipient-facing copy.",
    ...overrides,
  };
}

describe("music share package document safety", () => {
  it("never exposes the internal Release Narrative to a share package", () => {
    const narrative = document({
      materialType: "other",
      title: "Release narrative",
      status: "ready",
      reviewState: "ready",
      body: "# Release narrative\n\nInternal campaign strategy.",
    });

    expect(isShareableSongDocument(narrative)).toBe(false);
  });

  it("still allows an approved recipient-facing EPK", () => {
    expect(isShareableSongDocument(document())).toBe(true);
  });

  it("keeps Manager drafts with unresolved review state out of packages", () => {
    expect(isShareableSongDocument(document({ reviewState: "needs_review" }))).toBe(false);
  });
});
