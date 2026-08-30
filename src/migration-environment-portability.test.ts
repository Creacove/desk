import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration environment portability", () => {
  it("never schedules Edge Functions against a hardcoded Supabase project", () => {
    const migrationsRoot = join(process.cwd(), "supabase", "migrations");
    const hardcodedFunctionUrls = readdirSync(migrationsRoot)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) => {
        const sql = readFileSync(join(migrationsRoot, file), "utf8");
        return [...sql.matchAll(/https:\/\/[a-z]{20}\.supabase\.co\/functions\/v1\//gi)]
          .map((match) => `${file}: ${match[0]}`);
      });

    expect(hardcodedFunctionUrls).toEqual([]);
  });

  it("loads scheduled Edge Function endpoints and capabilities from Vault", () => {
    const migrationsRoot = join(process.cwd(), "supabase", "migrations");
    const legacySettings = readdirSync(migrationsRoot)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) => {
        const sql = readFileSync(join(migrationsRoot, file), "utf8");
        return [...sql.matchAll(/current_setting\('app\.settings\.(?:supabase_url|workflow_worker_secret)'\)/gi)]
          .map((match) => `${file}: ${match[0]}`);
      });

    expect(legacySettings).toEqual([]);
  });
});
