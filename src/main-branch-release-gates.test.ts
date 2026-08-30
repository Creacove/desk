import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function workflow(name: string) {
  return readFileSync(join(process.cwd(), ".github/workflows", name), "utf8");
}

describe("main branch release gates", () => {
  it.each(["ci.yml", "manager-runtime-safety.yml"])("runs %s after code reaches main", (name) => {
    const source = workflow(name);
    expect(source).toMatch(/on:\s*\r?\n\s+push:\s*\r?\n\s+branches:\s*\[main\]/);
  });
});
