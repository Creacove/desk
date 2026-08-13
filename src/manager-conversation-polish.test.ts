import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(`${process.cwd()}/src/${path}`, "utf8");
const manager = source("features/manager/ManagerScreens.tsx");
const composer = source("features/manager/ManagerComposer.tsx");
const theme = source("index.css");
const app = source("app/ProductionApp.tsx");

describe("Manager conversation premium UI contract", () => {
  it("does not globally override component heading sizes and weights", () => {
    expect(theme).not.toMatch(/\.app-theme h1\s*\{[^}]*font-size:[^}]*!important/s);
    expect(theme).not.toMatch(/\.app-theme \[class\*="font-semibold"\][^{]*\{[^}]*!important/s);
  });

  it("uses the same compact shell for the Office and conversation", () => {
    expect(manager).toContain('title="Manager\'s Office"');
    expect(manager).toContain('variant="conversation"');
    expect(manager).not.toContain("Ask your Manager anything");
    expect(manager).toContain("formatConversationTimestamp(conversation.lastUpdate)");
  });

  it("keeps messages quiet and artifacts turn-owned", () => {
    expect(manager).not.toContain('data-testid="manager-speaker-avatar"');
    expect(manager).not.toContain("<Sparkles");
    expect(manager).toContain("releaseSuccessArtifact={");
    expect(manager).toContain("decisionPackage={");
  });

  it("asks for file meaning before opening the picker", () => {
    expect(manager).toContain("Add to {conversation.musicSubject.title}");
    expect(manager).toContain('label: "Audio"');
    expect(manager).toContain('label: "Artwork & images"');
    expect(manager).toContain('label: "Document"');
    expect(manager).toContain("selectedAssetType");
  });

  it("makes async result actions visibly pending", () => {
    expect(manager).toContain('aria-busy={pending}');
    expect(manager).toContain('pendingLabel = "Opening…"');
  });

  it("navigates to a mission shell before hydrating it", () => {
    const missionBlock = app.slice(app.indexOf('if (type === "mission" || type === "task")'));
    expect(missionBlock.indexOf('navigate("missionsWorkspace")')).toBeLessThan(missionBlock.indexOf("await reloadMissionList()"));
  });

  it("presents recommendations as choices, not a competing card", () => {
    expect(composer).not.toContain("Manager recommendation");
    expect(composer).toContain("Recommended");
    expect(composer).toContain("Send answers");
  });
});
