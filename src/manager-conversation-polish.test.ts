import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { managerRunStatusLabel } from "./features/manager/managerRunStatus";

const source = (path: string) => readFileSync(`${process.cwd()}/src/${path}`, "utf8");
const manager = [source("features/manager/ManagerScreens.tsx"), source("features/manager/ManagerScreensLegacy.tsx")].join("\n");
const composer = source("features/manager/ManagerComposer.tsx");
const primitives = source("design-system/desktopPrimitives.tsx");
const theme = source("index.css");
const app = source("app/ProductionApp.tsx");
const conversationV2 = source("features/manager/ManagerConversationV2.tsx");

describe("Manager conversation premium UI contract", () => {
  it("does not globally override component heading sizes and weights", () => {
    expect(theme).not.toMatch(/\.app-theme h1\s*\{[^}]*font-size:[^}]*!important/s);
    expect(theme).not.toMatch(/\.app-theme \[class\*="font-semibold"\][^{]*\{[^}]*!important/s);
  });

  it("uses a compact Office/conversation shell and work-first language", () => {
    expect(manager).toContain('title="Manager\'s Office"');
    expect(manager).toContain('variant="conversation"');
    expect(manager).not.toContain("Ask your Manager anything");
    expect(manager).toContain("What do you want to work on?");
    expect(manager).toContain('<Timestamp value={conversation.lastUpdate} context="rail"');
  });

  it("uses one shared product timestamp formatter", () => {
    expect(primitives).toContain("formatProductTimestamp");
    expect(primitives).toContain('context === "rail"');
    expect(primitives).toContain('context === "grouped"');
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
    expect(composer).toContain("Continue");
    expect(composer).toContain("Next");
  });

  it("uses the thinking-orbs inline preset while Manager is working", () => {
    expect(manager).toContain('<AppThinkingOrb state={orbState} size={20} />');
    expect(manager).not.toContain('<AppThinkingOrb state={orbState} size={18} />');
  });

  it("imports the attachment icon used by durable conversation receipts", () => {
    expect(manager).toMatch(/import\s+\{[^}]*\bPaperclip\b[^}]*\}\s+from "lucide-react"/s);
  });

  it("selects one meaningful live Manager status with a safe fallback", () => {
    expect(managerRunStatusLabel([
      { id: "packet", label: "Reading workspace packet", status: "completed" },
      { id: "analysis", label: "Working through the economics and trade-offs", status: "running" },
      { id: "catalog", label: "Checking catalog", status: "completed" },
    ])).toBe("Working through the economics and trade-offs…");
    expect(managerRunStatusLabel([
      { id: "packet", label: "Reading workspace packet...", status: "completed" },
    ])).toBe("Reading workspace packet…");
    expect(managerRunStatusLabel([
      { id: "raw", label: "query_music_catalog", status: "running" },
    ])).toBe("Manager is working…");
    expect(managerRunStatusLabel()).toBe("Manager is working…");
  });

  it("renders the live run label as an accessible status instead of fixed loading copy", () => {
    expect(conversationV2).toContain("managerRunStatusLabel(conversation.activeRun?.steps)");
    expect(conversationV2).toContain('role="status"');
    expect(conversationV2).toContain('aria-live="polite"');
    expect(conversationV2).not.toContain(">Manager is working…</p>");
  });
});
