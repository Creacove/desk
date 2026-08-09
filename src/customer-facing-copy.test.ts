import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const customerFacingFiles = [
  "src/features/music/MusicScreens.tsx",
  "src/features/music/MusicShareDialog.tsx",
  "src/features/music/SongDocumentEditor.tsx",
  "src/features/music/SongDocumentActions.tsx",
  "src/features/music/SplitConfirmationPortal.tsx",
];

describe("customer-facing song workflow copy", () => {
  it("does not explain internal infrastructure to artists and label teams", () => {
    const source = customerFacingFiles
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    for (const phrase of [
      "large-file path",
      "standard private upload path",
      "storage bucket",
      "storage ref",
      "provider trace",
      "processing pipeline",
    ]) {
      expect(source.toLowerCase()).not.toContain(phrase);
    }
  });
});
