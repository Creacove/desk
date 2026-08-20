import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Manager canonical document preview contract", () => {
  it("opens saved song documents in the conversation and keeps Files as a secondary destination", () => {
    const manager = readFileSync("src/features/manager/ManagerScreens.tsx", "utf8");
    const editor = readFileSync("src/features/music/SongDocumentEditor.tsx", "utf8");
    const legacy = readFileSync("src/features/manager/ManagerScreensLegacy.tsx", "utf8");

    expect(manager).toContain('musicRepository.loadMusicObject(id,"music_item")');
    expect(manager).toContain('material.kind === "document" && material.id === artifactId');
    expect(manager).toContain("setDocumentPreviewTarget({ song,document })");
    expect(manager).toContain("onOpenCreatedWork={openCreatedWorkInContext}");
    expect(manager).toContain("previewOnly");
    expect(manager).toContain("You can find this document there anytime.");
    expect(manager).toContain('onOpenCreatedWork("music_item",target.song.id,"files",target.document.id)');
    expect(editor).toContain("previewOnly = false");
    expect(editor).toContain("Open in Files");
    expect(legacy).toContain('return "View document"');
  });
});
