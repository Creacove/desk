import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("split confirmation edge functions", () => {
  it("ships Resend-backed email delivery with hashed confirmation tokens", () => {
    const functionPath = join(process.cwd(), "supabase", "functions", "send-split-confirmations", "index.ts");
    expect(existsSync(functionPath)).toBe(true);

    const source = readFileSync(functionPath, "utf8");
    expect(source).toContain("RESEND_API_KEY");
    expect(source).toContain("https://api.resend.com/emails");
    expect(source).toContain("confirmation_token_hash");
    expect(source).toContain("/split-confirmation?token=");
    expect(source).toContain("music_split_confirmations");
    expect(source).toContain("music_split_confirmation_sent");
    expect(source).not.toContain("confirmation_token text");
  });

  it("ships token-scoped load and submit functions without exposing the app workspace", () => {
    const loadPath = join(process.cwd(), "supabase", "functions", "load-split-confirmation", "index.ts");
    const confirmPath = join(process.cwd(), "supabase", "functions", "confirm-split", "index.ts");
    expect(existsSync(loadPath)).toBe(true);
    expect(existsSync(confirmPath)).toBe(true);

    const loadSource = readFileSync(loadPath, "utf8");
    const confirmSource = readFileSync(confirmPath, "utf8");
    expect(loadSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(confirmSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(loadSource).toContain("confirmation_token_hash");
    expect(loadSource).toContain("music_split_contributors");
    expect(loadSource).toContain("songTitle");
    expect(loadSource).not.toContain("missions");
    expect(loadSource).not.toContain("conversations");
    expect(confirmSource).toContain("music_split_confirmed");
    expect(confirmSource).toContain("music_split_rejected");
    expect(confirmSource).toContain("partially_confirmed");
    expect(confirmSource).toContain("cleared");
  });
});
