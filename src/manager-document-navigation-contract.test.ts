import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Manager canonical document navigation contract", () => {
  it("carries the saved document id from Manager into the song document editor", () => {
    const manager = readFileSync("src/features/manager/ManagerScreensLegacy.tsx", "utf8");
    const app = readFileSync("src/app/ProductionApp.tsx", "utf8");
    const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");

    expect(manager).toContain('onOpenCreatedWork("music_item", musicItemId, "files", item.id)');
    expect(app).toContain("targetSongDocumentId");
    expect(app).toContain("targetDocumentId={targetSongDocumentId}");
    expect(app).toContain("artifactId?: string");
    expect(music).toContain("targetDocumentId?: string | null");
    expect(music).toContain('material.kind === "document" && material.id === targetDocumentId');
    expect(music).toContain("setDocumentEditorTarget({ song: refreshed, document })");
  });
});
