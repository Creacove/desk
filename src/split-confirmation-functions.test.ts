import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const configPath = join(process.cwd(), "supabase", "config.toml");
const hardeningMigrationPath = join(process.cwd(), "supabase", "migrations", "20260809000100_release_operations_hardening.sql");

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
    expect(source).toContain("publishingShare");
    expect(source).toContain("masterShare");
    expect(source).toContain("contributorRole");
    expect(source).toContain("expiresAt");
    expect(source).toContain("Review split");
    expect(source).toContain("failed:");
    expect(source).toContain('requireEnv("DESK_APP_ORIGIN")');
    expect(source).toContain("fetchProviderWithTimeout");
    expect(source).not.toContain('`${input.appOrigin.replace');
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
    expect(loadSource).not.toContain('select("name,role,publishing_share,master_share,approval_status")');
    expect(loadSource).not.toContain("approval: item.approval_status");
    expect(confirmSource).toContain("music_split_confirmed");
    expect(confirmSource).toContain("music_split_rejected");
    expect(confirmSource).toContain("correction_requested");
    expect(confirmSource).toContain("correctionReason");
    expect(confirmSource).toContain("partially_confirmed");
    expect(confirmSource).toContain("cleared");
  });

  it("lets capability-token recipients reach the public endpoints with explicit service-role grants", () => {
    const config = readFileSync(configPath, "utf8").replaceAll("\r\n", "\n");
    expect(config).toContain("[functions.load-split-confirmation]\nverify_jwt = false");
    expect(config).toContain("[functions.confirm-split]\nverify_jwt = false");
    expect(existsSync(hardeningMigrationPath)).toBe(true);
    const migration = readFileSync(hardeningMigrationPath, "utf8");
    expect(migration).toMatch(/grant select, insert, update, delete on public\.music_split_confirmations to service_role/i);
    expect(migration).toMatch(/grant select, insert, update, delete on public\.music_split_contributors to service_role/i);
    expect(migration).toContain("validate_music_split_allocation");
  });
});
