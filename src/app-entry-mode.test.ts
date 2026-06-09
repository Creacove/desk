import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");
const readmeSource = readFileSync(join(process.cwd(), "README.md"), "utf8");

describe("app entry mode", () => {
  it("defaults local runs to the Supabase-backed production app", () => {
    const prototypeModeIndex = mainSource.indexOf('VITE_APP_MODE === "prototype"');
    const defaultBranchIndex = mainSource.indexOf(") : (", prototypeModeIndex);
    const productionAppIndex = mainSource.indexOf("<ProductionApp");

    expect(mainSource).toContain('VITE_APP_MODE === "prototype"');
    expect(mainSource).not.toContain('VITE_APP_MODE === "production"');
    expect(productionAppIndex).toBeGreaterThan(defaultBranchIndex);
  });

  it("documents production as the default run mode and prototype as explicit opt-in", () => {
    expect(readmeSource).toContain("Production app is the default local run mode");
    expect(readmeSource).toContain("VITE_APP_MODE=prototype");
  });
});
