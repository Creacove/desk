import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("recipient-aware release sharing", () => {
  it("keeps press kits recipient-safe and treats documents as first-class public content", () => {
    const dialog = readFileSync("src/features/music/MusicShareDialog.tsx", "utf8");
    const packagePolicy = readFileSync("src/features/music/musicSharePackage.ts", "utf8");
    const publicService = readFileSync("src/services/publicMusicShare.ts", "utf8");
    const publicEdge = readFileSync("supabase/functions/public-music-share/index.ts", "utf8");

    expect(packagePolicy).not.toMatch(/PRESS_DOCUMENT_TYPES[\s\S]*spotify_editorial_pitch/);
    expect(packagePolicy).not.toMatch(/PRESS_DOCUMENT_TYPES[\s\S]*press_pitch/);
    expect(packagePolicy).toContain('return "Press / media"');
    expect(dialog).toContain("Recommended package");
    expect(dialog).toContain("sharePurposeShortLabel");
    expect(dialog).toContain("recipientSafeDocumentBody");
    expect(publicService).toContain("documents?: PublicMusicShareDocument[]");
    expect(publicEdge).toContain("recipientSafeDocumentBody");
    expect(publicEdge).toContain("publicDocumentTitle");
  });
});
