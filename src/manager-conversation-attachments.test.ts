import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "manager-conversation", "attachments.ts"), "utf8");

describe("manager conversation attachments", () => {
  it("deduplicates and caps attachment ids before persistence", () => {
    expect(source).toContain("[...new Set(value.map((item) => String(item || \"\").trim()).filter(Boolean))].slice(0, 12)");
  });

  it("requires a durable song subject and scopes every asset lookup to it", () => {
    expect(source).toContain("Attachments can only be added to a song conversation.");
    expect(source).toContain('.from("music_assets")');
    expect(source).toContain('.eq("account_id", input.accountId)');
    expect(source).toContain('.eq("artist_workspace_id", input.artistWorkspaceId)');
    expect(source).toContain('.eq("artist_id", input.artistId)');
    expect(source).toContain('.eq("music_item_id", subject.id)');
    expect(source).toContain('.in("id", ids)');
    expect(source).toContain("One or more attached files are not available in this song workspace.");
  });
});
