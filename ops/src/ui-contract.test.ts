import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(join(process.cwd(), "ops/src/App.tsx"), "utf8");
const styles = readFileSync(join(process.cwd(), "ops/src/styles.css"), "utf8");
const index = readFileSync(join(process.cwd(), "ops/index.html"), "utf8");

describe("Ops Desk-style UI contract", () => {
  it("uses the real brand and concise light-shell copy", () => {
    expect(appSource).toContain('src="/logo.png"');
    expect(appSource).toContain('label="Today"');
    expect(appSource).toContain('label="Pipeline"');
    expect(appSource).toContain('label="Meetings"');
    expect(appSource).not.toContain("Internal only");
    expect(appSource).not.toContain("Keep the signal");
    expect(appSource).not.toContain("The calm place for every artist conversation");
    expect(appSource).not.toContain("Operator context");
  });

  it("keeps one case-detail back action and removes redundant chrome actions", () => {
    expect(appSource).toContain('className="back-button"');
    expect(appSource).not.toContain("Operator settings");
    expect(appSource).not.toContain("One operator identity");
  });

  it("exposes finite meeting outcomes as a selector", () => {
    for (const label of ["Ready to start", "Needs follow-up", "Not ready", "Inquiry questions", "Not a fit"]) {
      expect(appSource).toContain(label);
    }
    expect(appSource).toContain('className="outcome-select"');
  });

  it("locks Ops to the light Desk tokens and protects mobile form focus", () => {
    expect(styles).toContain("--canvas: #f8f6f1");
    expect(styles).toContain('--font-ui: "Manrope"');
    expect(styles).not.toContain("color-scheme: dark");
    expect(styles).not.toContain("Playfair Display");
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain("font-size: 16px");
    expect(index).toContain("fonts.googleapis.com/css2?family=Manrope");
  });

  it("keeps Desk handoff results distinguishable beyond artist names", () => {
    expect(appSource).toContain("account_member_emails");
    expect(appSource).toContain("contact_emails");
    expect(appSource).toContain("workspace {workspace.artist_workspace_id}");
    expect(appSource).toContain("account {workspace.account_id}");
  });
});
