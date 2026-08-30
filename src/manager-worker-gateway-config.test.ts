import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const config = readFileSync(join(process.cwd(), "supabase", "config.toml"), "utf8");

describe("Manager scheduled worker gateway configuration", () => {
  it.each([
    "manager-dispatcher",
    "manager-artist-understanding",
    "manager-career-watch-dispatcher",
  ])("lets the %s worker authenticate its cron capability inside the function", (functionName) => {
    expect(config).toMatch(new RegExp(`\\[functions\\.${functionName}\\]\\r?\\nverify_jwt = false`));
  });
});
