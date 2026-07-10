import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(join(process.cwd(), "index.html"), "utf8");
const cssSource = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

describe("mobile input zoom prevention", () => {
  it("locks the viewport scale for mobile app chrome", () => {
    expect(indexSource).toContain('name="viewport"');
    expect(indexSource).toContain("maximum-scale=1");
    expect(indexSource).toContain("user-scalable=no");
  });

  it("keeps focusable form controls at the iOS no-zoom font size on mobile", () => {
    expect(cssSource).toMatch(/@media\s*\(\s*max-width:\s*767px\s*\)[\s\S]*input[\s\S]*textarea[\s\S]*select[\s\S]*font-size:\s*16px\s*!important/);
  });

  it("places the mobile override after compact theme font rules", () => {
    const mobileOverrideIndex = cssSource.lastIndexOf("font-size: 16px !important");
    const compactThemeRuleIndex = cssSource.lastIndexOf("font-size: 13px !important");

    expect(mobileOverrideIndex).toBeGreaterThan(compactThemeRuleIndex);
    expect(cssSource).toMatch(/\.app-light\s+input[\s\S]*\.app-theme\s+input[\s\S]*font-size:\s*16px\s*!important/);
  });
});
