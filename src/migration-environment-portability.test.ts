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
});
