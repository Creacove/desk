import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("music share server safety", () => {
  it("rejects internal narrative and unapproved Manager documents in the Edge function", () => {
    const source = readFileSync(
      join(process.cwd(), "supabase", "functions", "music-share-links", "index.ts"),
      "utf8",
    );

    expect(source).toContain('document.document_type === "release_narrative"');
    expect(source).toContain('cleanText(document.title, 180).toLowerCase() === "release narrative"');
    expect(source).toContain('document.origin === "manager_generated" && document.status !== "accepted"');
    expect(source.indexOf('document.document_type === "release_narrative"')).toBeLessThan(
      source.indexOf("const { data: versions"),
    );
  });
});
