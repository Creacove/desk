import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Manager production stabilization contracts", () => {
  it("defends both Manager endpoints from client-only pending conversation ids and provider-history growth", () => {
    for (const path of [
      "supabase/functions/manager-conversation/index.ts",
      "supabase/functions/manager-conversation-stream/index.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("pending-conversation-");
      expect(source).toContain('const previousResponseId = "";');
    }
  });

  it("guards streaming close/enqueue after browser cancellation", () => {
    const source = readFileSync("supabase/functions/manager-conversation-stream/index.ts", "utf8");
    expect(source).toContain("let streamClosed = false");
    expect(source).toContain("cancel()");
    expect(source).not.toContain("finally {\n        controller.close();");
  });
});
