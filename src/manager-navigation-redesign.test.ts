import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const components = readFileSync("src/design-system/components.tsx", "utf8");
const app = readFileSync("src/app/ProductionApp.tsx", "utf8");

describe("Manager-first navigation", () => {
  it("replaces Team Agents in product navigation with one direct Manager destination", () => {
    expect(components).toContain('{ label: "Manager", active: "manager", view: "managerOffice"');
    expect(components).not.toContain('{ label: "Team Agents"');
    expect(components).toContain('item.label === "Manager" ? "Open Manager"');
  });

  it("keeps old staff screens internal while Manager owns the visible navigation section", () => {
    expect(app).toContain('import { LockedAgentWorkspace, StaffWorkspace }');
    expect(app).toContain('<StaffWorkspace');
    expect(app).toContain('<LockedAgentWorkspace');
    expect(components).toContain('view === "staffWorkspace"');
    expect(components).toContain('return "manager"');
  });

  it("surfaces only three recent Manager conversations in the desktop rail", () => {
    expect(components).toContain('data-testid="desktop-manager-recents"');
    expect(components).toContain('recentManagerConversations.slice(0, 3)');
    expect(app).toContain('recentManagerConversations={conversations.slice(0, 3)');
  });

  it("uses a flat mobile dock and theme-safe mission counts", () => {
    expect(components).toContain('fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t');
    expect(components).not.toContain('fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-[18px]');
    expect(components).toContain('data-testid="mobile-mission-count"');
    expect(components).toContain('bg-brand-accent px-1 text-[9px] font-bold text-background');
  });
});
