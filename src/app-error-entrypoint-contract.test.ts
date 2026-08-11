import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionsRoot = join(process.cwd(), "supabase", "functions");
const entrypoints = readdirSync(functionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
  .map((entry) => ({
    name: entry.name,
    path: join(functionsRoot, entry.name, "index.ts"),
  }))
  .filter((entry) => existsSync(entry.path));

describe("central error coverage for Edge entrypoints", () => {
  it("wraps every deployable function in the shared failure boundary", () => {
    expect(entrypoints.length).toBeGreaterThan(30);
    const uncovered = entrypoints.filter((entry) => {
      const source = readFileSync(entry.path, "utf8");
      return !source.includes('from "../_shared/appFunction.ts"')
        || !source.includes(`Deno.serve(withAppErrorCapture("${entry.name}"`);
    }).map((entry) => entry.name);

    expect(uncovered).toEqual([]);
  });
});
