import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { attachedKnowledge } from "../supabase/functions/_shared/manager-conversation/attachments";

const source = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "manager-conversation", "attachments.ts"), "utf8");

describe("manager conversation attachments", () => {
  it("deduplicates and caps attachment ids before persistence", () => {
    expect(source).toContain("[...new Set(value.map((item) => String(item || \"\").trim()).filter(Boolean))].slice(0, 12)");
  });

  it("keeps song assets canonical while allowing scoped knowledge documents", () => {
    expect(source).toContain("Song files can only be attached to their canonical song conversation.");
    expect(source).toContain("Knowledge documents can be attached to any Manager conversation.");
    expect(source).toContain('.from("music_assets")');
    expect(source).toContain('.from("documents")');
    expect(source).toContain('.from("document_versions")');
    expect(source).toContain('.eq("account_id", input.accountId)');
    expect(source).toContain('.eq("artist_workspace_id", input.artistWorkspaceId)');
    expect(source).toContain('.eq("artist_id", input.artistId)');
    expect(source).toContain('.eq("music_item_id", musicItemId)');
    expect(source).toContain('.in("id", ids)');
    expect(source).toContain("One or more attached files are not available in this workspace or song conversation.");
  });

  it("bounds the total private document content added to a model request", () => {
    const attachments = Array.from({ length: 4 }, (_, index) => ({
      id: `doc-${index}`,
      kind: "knowledge_document" as const,
      title: `Document ${index}`,
      documentId: `doc-${index}`,
      extractedText: String(index).repeat(40_000),
    }));
    const packet = attachedKnowledge(attachments);
    const totalCharacters = packet.reduce((sum, item) => sum + item.content.length, 0);
    expect(totalCharacters).toBeLessThanOrEqual(60_000);
    expect(packet).toHaveLength(4);
  });
});
