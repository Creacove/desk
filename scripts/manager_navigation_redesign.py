from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f"missing start anchor: {label}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f"missing end anchor: {label}")
    return text[:start_index] + replacement + text[end_index:]


components_path = Path("src/design-system/components.tsx")
components = components_path.read_text()
components = replace_once(
    components,
    'import { ArrowLeft, Bell, ClipboardCheck, Gauge, Library, LogOut, Settings, UsersRound } from "lucide-react";',
    'import { ArrowLeft, Bell, ClipboardCheck, Gauge, Library, LogOut, MessageCircle, Settings } from "lucide-react";',
    "Manager navigation icon",
)
components = replace_between(
    components,
    'const navItems: Array<{ label: string; active: NavSection; view: CleanProductionView; icon: LucideIcon }> = [',
    'export function DeskRail({',
    '''const navItems: Array<{ label: string; active: NavSection; view: CleanProductionView; icon: LucideIcon }> = [
  { label: "Desk HQ", active: "labelHQ", view: "labelHQ", icon: Gauge },
  { label: "Catalog", active: "music", view: "musicWorkspace", icon: Library },
  { label: "Manager", active: "manager", view: "managerOffice", icon: MessageCircle },
  { label: "Missions", active: "missions", view: "missionsWorkspace", icon: ClipboardCheck },
];

type NavSection = "labelHQ" | "music" | "manager" | "missions" | "settings";
type RecentManagerConversation = { id: string; topic: string };

export function sectionForView(view: CleanProductionView): NavSection {
  if (view === "musicWorkspace") return "music";
  if (
    view === "managerOffice" ||
    view === "conversationWorkspace" ||
    view === "investigation" ||
    view === "decisionPackage" ||
    view === "staffWorkspace" ||
    view === "lockedAgentWorkspace"
  ) return "manager";
  if (view === "missionsWorkspace") return "missions";
  if (view === "artistProfileWorkspace") return "settings";
  return "labelHQ";
}

''',
    "navigation model",
)

rail_and_mobile = '''export function DeskRail({
  active,
  onNavigate,
  onSignOut,
  activeMissionCount = 0,
  recentManagerConversations = [],
  onOpenManagerConversation,
}: {
  active: NavSection;
  onNavigate: (view: CleanProductionView) => void;
  onSignOut?: () => void;
  activeMissionCount?: number;
  recentManagerConversations?: RecentManagerConversation[];
  onOpenManagerConversation?: (conversationId: string) => void;
}) {
  return (
    <nav
      aria-label="Ordersounds Desk navigation"
      className="hidden min-w-0 flex-col justify-between overflow-y-auto border-r border-foreground/8 bg-background px-3 pb-4 pt-4 lg:sticky lg:top-0 lg:flex lg:h-screen"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 px-2 pb-2 pt-1">
          <BrandMark size="sm" />
          <div className="min-w-0">
            <p className="font-display truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">Ordersounds</p>
            <p className="font-ui mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/68">Artist desk</p>
          </div>
        </div>
        <div className="h-px shrink-0 bg-foreground/7" />
        <div className="flex shrink-0 flex-col gap-1 py-0.5">
          {navItems.map((item) => item.active === "manager" ? (
            <div key={item.label} className="group">
              <NavButton item={item} active={active === item.active} onNavigate={onNavigate} activeMissionCount={activeMissionCount} />
              {recentManagerConversations.length ? (
                <div
                  data-testid="desktop-manager-recents"
                  className={cn(
                    "overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out",
                    active === "manager"
                      ? "mt-1 max-h-40 opacity-100"
                      : "max-h-0 opacity-0 group-hover:mt-1 group-hover:max-h-40 group-hover:opacity-100 group-focus-within:mt-1 group-focus-within:max-h-40 group-focus-within:opacity-100",
                  )}
                >
                  <div className="ml-7 border-l border-foreground/8 py-1 pl-2">
                    <p className="px-2 pb-1 pt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">Recent</p>
                    {recentManagerConversations.slice(0, 3).map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        aria-label={`Open Manager conversation ${conversation.topic}`}
                        onClick={() => onOpenManagerConversation?.(conversation.id)}
                        className="block w-full truncate rounded-[8px] px-2 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25"
                      >
                        {conversation.topic}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <NavButton key={item.label} item={item} active={active === item.active} onNavigate={onNavigate} activeMissionCount={activeMissionCount} />
          ))}
        </div>
      </div>
      <div className="mt-4 shrink-0">
        <div className="mb-2 h-px bg-foreground/7" />
        <button
          type="button"
          onClick={() => onNavigate("artistProfileWorkspace")}
          className={cn(
            "flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 font-ui text-[12px] font-semibold transition-colors duration-200",
            active === "settings" ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
          )}
        >
          <Settings className={cn("h-[15px] w-[15px] shrink-0", active === "settings" ? "text-brand-accent" : "text-current opacity-62")} aria-hidden="true" />
          Settings
        </button>
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="mt-0.5 flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 font-ui text-[12px] font-semibold text-muted-foreground transition-colors duration-200 hover:bg-foreground/[0.04] hover:text-foreground"
          >
            <LogOut className="h-[15px] w-[15px] shrink-0 opacity-62" aria-hidden="true" />
            Sign out
          </button>
        ) : null}
      </div>
    </nav>
  );
}

function NavButton({
  item,
  active,
  onNavigate,
  activeMissionCount,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  onNavigate: (view: CleanProductionView) => void;
  activeMissionCount: number;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-label={item.label === "Catalog" ? "Open Catalog workspace" : item.label === "Manager" ? "Open Manager" : item.label}
      onClick={() => onNavigate(item.view)}
      className={cn(
        "relative flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 font-ui text-[12px] font-semibold transition-colors duration-200",
        active ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      <Icon className={cn("h-[15px] w-[15px] shrink-0", active ? "text-brand-accent" : "text-current opacity-62")} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      {active ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" /> : null}
      {item.active === "missions" && activeMissionCount > 0 ? (
        <span data-testid="desktop-mission-count" className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.06] px-1.5 text-[10px] font-bold text-foreground">{formatNavigationCount(activeMissionCount)}</span>
      ) : null}
    </button>
  );
}

export function MobileChrome({
  active,
  title,
  onNavigate,
  notificationCount = 0,
  onOpenNotifications,
  activeMissionCount = 0,
  showTopbar = true,
  showTabbar = true,
}: {
  active: NavSection;
  title: string;
  onNavigate: (view: CleanProductionView) => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  activeMissionCount?: number;
  showTopbar?: boolean;
  showTabbar?: boolean;
}) {
  return (
    <>
      {showTopbar ? (
        <header
          data-testid="mobile-app-topbar"
          className="sticky top-0 z-40 -mx-3 mb-3 flex items-center justify-between border-b border-foreground/8 bg-background/94 px-3 py-3 backdrop-blur-xl lg:hidden"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark size="sm" className="h-8 w-8 rounded-[9px]" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">{title}</p>
              <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/62">Ordersounds</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onOpenNotifications ? (
              <button
                type="button"
                data-testid="mobile-notification-trigger"
                aria-label={notificationCount ? `Open Activity Center, ${notificationCount} unread` : "Open Activity Center"}
                onClick={onOpenNotifications}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {notificationCount ? (
                  <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[9px] font-bold leading-none text-background ring-2 ring-background">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Open settings"
              onClick={() => onNavigate("artistProfileWorkspace")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground",
                active === "settings" && "bg-foreground/[0.06] text-foreground",
              )}
            >
              <Settings className={cn("h-4 w-4", active === "settings" && "text-brand-accent")} aria-hidden="true" />
            </button>
          </div>
        </header>
      ) : null}
      {showTabbar ? (
        <nav
          data-testid="mobile-tabbar"
          aria-label="Mobile desk navigation"
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-foreground/8 bg-background/94 px-2 pt-1 backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: "calc(0.35rem + env(safe-area-inset-bottom))" }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const label = item.active === "labelHQ" ? "HQ" : item.label;
            const selected = active === item.active;
            return (
              <button
                key={item.label}
                type="button"
                data-testid={`mobile-tab-${label}`}
                aria-current={selected ? "page" : undefined}
                onClick={() => onNavigate(item.view)}
                className={cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 pb-1.5 pt-2 text-[10px] font-semibold transition-colors",
                  selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span aria-hidden="true" className={cn("absolute left-1/2 top-0 h-[2px] w-6 -translate-x-1/2 rounded-full bg-brand-accent transition-opacity", selected ? "opacity-100" : "opacity-0")} />
                <span className="relative">
                  <Icon className={cn("h-[16px] w-[16px]", selected ? "text-brand-accent" : "opacity-70")} aria-hidden="true" />
                  {item.active === "missions" && activeMissionCount > 0 ? (
                    <span data-testid="mobile-mission-count" className="absolute -right-3 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[9px] font-bold text-background ring-2 ring-background">{formatNavigationCount(activeMissionCount)}</span>
                  ) : null}
                </span>
                <span data-testid={`mobile-tab-label-${label}`} className="max-w-full truncate">{label}</span>
              </button>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}

'''
components = replace_between(
    components,
    'export function DeskRail({',
    'function formatNavigationCount(count: number)',
    rail_and_mobile,
    "desktop and mobile navigation",
)
components_path.write_text(components)


app_path = Path("src/app/ProductionApp.tsx")
app = app_path.read_text()
app = replace_once(
    app,
    'import { LockedAgentWorkspace, StaffWorkspace } from "../features/staff/StaffScreens";\n',
    '',
    "remove staff screen import",
)
app = replace_once(
    app,
    '  const [view, setView] = useState<CleanProductionView>(initialView);',
    '  const [view, setView] = useState<CleanProductionView>(() => normalizeLegacyManagerView(initialView));',
    "normalize initial view",
)
app = replace_once(
    app,
    '  const [selectedAgent, setSelectedAgent] = useState<AgentViewModel | null>(null);\n',
    '',
    "remove selected agent state",
)
app = replace_once(
    app,
    '    activeSection === "staff" ? "Team Agents" :',
    '    activeSection === "manager" ? "Manager" :',
    "mobile Manager title",
)
app = replace_once(
    app,
    '  const activeAgent = selectedAgent ?? agents[1] ?? agents[0] ?? null;\n',
    '',
    "remove active agent projection",
)
app = replace_once(
    app,
    '    view === "staffWorkspace" ||',
    '    view === "managerOffice" ||',
    "Manager mobile topbar",
)
app = replace_once(
    app,
    '''  function navigate(nextView: CleanProductionView) {
    if (workspace && !isWorkspaceReadyForDesk(workspace) && nextView !== "setup" && nextView !== "connectArtist") {
      setView("setup");
      return;
    }

    if (nextView !== "musicWorkspace") setMusicDetailOpen(false);
    if (nextView !== "missionsWorkspace") setMissionRoomOpen(false);
    setView(nextView);
    setDrawer(null);
    setActivityCenterOpen(false);
  }''',
    '''  function navigate(nextView: CleanProductionView) {
    const resolvedView = normalizeLegacyManagerView(nextView);
    if (workspace && !isWorkspaceReadyForDesk(workspace) && resolvedView !== "setup" && resolvedView !== "connectArtist") {
      setView("setup");
      return;
    }

    if (resolvedView !== "musicWorkspace") setMusicDetailOpen(false);
    if (resolvedView !== "missionsWorkspace") setMissionRoomOpen(false);
    setView(resolvedView);
    setDrawer(null);
    setActivityCenterOpen(false);
  }''',
    "legacy Team Agents redirect",
)
app = replace_once(
    app,
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
    "sidebar recent conversations",
)
app = replace_once(
    app,
    '''              onLockedAgent={(agent) => {
                setSelectedAgent(agent);
                navigate("lockedAgentWorkspace");
              }}''',
    '''              onLockedAgent={() => openManager()}''',
    "HQ legacy agent handoff",
)
app = replace_between(
    app,
    '          {view === "staffWorkspace" ? (',
    '          {view === "managerOffice" ? (',
    '',
    "remove Team Agents route surfaces",
)

# Keep legacy external/deep links safe without keeping Team Agents as a product surface.
helper_anchor = 'function CleanProductionWorkspace({\n'
helper = '''function normalizeLegacyManagerView(view: CleanProductionView): CleanProductionView {
  return view === "staffWorkspace" || view === "lockedAgentWorkspace" ? "managerOffice" : view;
}

'''
app = replace_once(app, helper_anchor, helper + helper_anchor, "legacy Manager route helper")
app_path.write_text(app)


regression_path = Path("src/manager-navigation-redesign.test.ts")
regression_path.write_text('''import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const components = readFileSync("src/design-system/components.tsx", "utf8");
const app = readFileSync("src/app/ProductionApp.tsx", "utf8");

describe("Manager-first navigation", () => {
  it("replaces Team Agents with one direct Manager destination", () => {
    expect(components).toContain('{ label: "Manager", active: "manager", view: "managerOffice"');
    expect(components).not.toContain('{ label: "Team Agents"');
    expect(app).not.toContain('<StaffWorkspace');
    expect(app).not.toContain('<LockedAgentWorkspace');
    expect(app).toContain('normalizeLegacyManagerView');
  });

  it("keeps Manager active across office and conversation surfaces", () => {
    expect(components).toContain('view === "managerOffice"');
    expect(components).toContain('view === "conversationWorkspace"');
    expect(components).toContain('return "manager"');
  });

  it("reveals only a small recent conversation set from the desktop Manager item", () => {
    expect(components).toContain('data-testid="desktop-manager-recents"');
    expect(components).toContain('recentManagerConversations.slice(0, 3)');
    expect(app).toContain('recentManagerConversations={conversations.slice(0, 3)');
  });

  it("uses a flat mobile dock and theme-safe mission counts", () => {
    expect(components).toContain('className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t');
    expect(components).not.toContain('className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-[18px]');
    expect(components).toContain('data-testid="mobile-mission-count"');
    expect(components).toContain('bg-brand-accent px-1 text-[9px] font-bold text-background');
  });
});
''')
