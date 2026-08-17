from pathlib import Path
import subprocess

subprocess.run(["python3", "scripts/manager_navigation_redesign.py"], check=True)
subprocess.run(["git", "checkout", "HEAD", "--", "src/app/ProductionApp.tsx"], check=True)
Path("src/manager-navigation-redesign.test.ts").unlink(missing_ok=True)

path = Path("src/app/ProductionApp.tsx")
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    text = text.replace(old, new, 1)


replace_once(
    '    activeSection === "staff" ? "Team Agents" :',
    '    activeSection === "manager" ? "Manager" :',
    "mobile Manager title",
)
replace_once(
    '    view === "staffWorkspace" ||\n    view === "artistProfileWorkspace" ||',
    '    view === "staffWorkspace" ||\n    view === "managerOffice" ||\n    view === "artistProfileWorkspace" ||',
    "Manager Office mobile topbar",
)
replace_once(
    '        <DeskRail active={activeSection} activeMissionCount={missions.filter((mission) => mission.status !== "complete").length} onNavigate={navigateFromMenu} onSignOut={onSignOut} />',
    '''        <DeskRail
          active={activeSection}
          activeMissionCount={missions.filter((mission) => mission.status !== "complete").length}
          recentManagerConversations={conversations.slice(0, 3).map((conversation) => ({ id: conversation.id, topic: conversation.topic }))}
          onOpenManagerConversation={(conversationId) => {
            const conversation = conversations.find((candidate) => candidate.id === conversationId);
            if (conversation) void openConversation(conversation);
          }}
          onNavigate={navigateFromMenu}
          onSignOut={onSignOut}
        />''',
    "Manager recents wiring",
)
path.write_text(text)

# The production shell suite still enters Manager through the removed Team Agents
# navigation item. Keep the production UI clean and translate only that legacy test
# helper to the new direct Manager destination while CI runs.
shell_test_path = Path("src/production-app-shell.test.tsx")
shell_test = shell_test_path.read_text()
legacy_manager_helper = '''function openManagerFromDesk() {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Team Agents" }));
  fireEvent.click(screen.getByRole("button", { name: "AI Manager" }));
}'''
direct_manager_helper = '''function openManagerFromDesk() {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Open Manager" }));
}'''
if legacy_manager_helper not in shell_test:
    raise SystemExit("missing anchor: legacy production-shell Manager helper")
shell_test_path.write_text(shell_test.replace(legacy_manager_helper, direct_manager_helper, 1))

Path("src/manager-navigation-redesign.test.ts").write_text('''import { describe, expect, it } from "vitest";
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
''')
