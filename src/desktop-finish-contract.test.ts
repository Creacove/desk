import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(`src/${path}`, "utf8");

const primitives = read("design-system/desktopPrimitives.tsx");
const premiumCss = read("design-system/desktop-premium.css");
const home = read("features/desk/DeskHQ.tsx");
const manager = read("features/manager/ManagerScreens.tsx");
const managerComposer = read("features/manager/ManagerComposer.tsx");
const missions = read("features/missions/MissionScreens.tsx");
const taskSheet = read("features/missions/MissionTaskSheet.tsx");
const activity = read("features/notifications/WorkspaceActivityCenter.tsx");
const drawers = read("features/drawers/ProductionDrawers.tsx");
const settings = read("features/settings/SettingsScreen.tsx");
const staff = read("features/staff/StaffScreens.tsx");
const split = read("features/music/SplitConfirmationPortal.tsx");
const productionApp = read("app/ProductionApp.tsx");

describe("OrderSounds desktop finish contract", () => {
  it("uses one semantic forward-action system instead of page-specific black buttons", () => {
    expect(primitives).toContain('type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive"');
    expect(primitives).toContain("bg-brand-accent text-white");
    expect(taskSheet).toContain("<Button");
    expect(settings).toContain("<Button");
    expect(split).toContain("<Button");
    expect(settings).not.toContain("ProductButton");
  });

  it("positions Manager as a working partner across its entry surfaces", () => {
    expect(home).toContain('placeholder="Tell Desk what changed, or ask something"');
    expect(managerComposer).toContain('placeholder = "What do you want to work on?"');
    expect(manager).toContain('placeholder="What do you want to work on?"');
    expect(taskSheet).toContain("Work with Manager");
    expect(manager).not.toContain("Ask Manager anything");
  });

  it("keeps known Mission detail visible during refresh and Mission updates desktop-native", () => {
    expect(missions).not.toContain("MissionRoomSkeleton");
    expect(missions).toContain('aria-busy={detailPending || undefined}');
    expect(missions).toContain("os-room-rail");
    expect(missions).toContain('lg:grid-cols-[minmax(0,1fr)_auto]');
    expect(missions).toContain("<Timestamp");
    expect(missions).not.toContain('lg:text-[50px]');
    expect(productionApp).toContain("detailPending={missionDetailPending}");
    expect(missions).toContain('data-testid="mission-room-detail-skeleton"');
  });

  it("preserves real Mission update timestamps from the repository", () => {
    const types = read("types/cleanProduction.ts");
    const repository = read("services/productionSupabase.ts");
    expect(types).toContain("createdAt?: string");
    expect(repository).toContain("createdAt: e.created_at ?? undefined");
    expect(repository).toContain("createdAt: m.created_at ?? undefined");
  });

  it("never presents unresolved Activity or Evidence as empty", () => {
    expect(activity).toContain("initialLoading");
    expect(activity).toContain("ActivitySkeleton");
    expect(drawers).toContain('data-evidence-loading');
    expect(drawers).toContain('data-evidence-empty');
    expect(premiumCss).toContain('[aria-busy="true"] [data-evidence-empty]');
    expect(premiumCss).toContain('[aria-busy="true"] [data-evidence-loading]');
  });

  it("uses horizontal desktop rows for secondary metadata", () => {
    expect(manager).toContain('grid-cols-[minmax(0,1fr)_auto]');
    expect(manager).toContain('<Timestamp value={conversation.lastUpdate} context="rail"');
    expect(activity).toContain('<Timestamp value={event.createdAt} context="activity"');
    expect(activity).toContain('hidden shrink-0 items-center gap-3 sm:flex');
    expect(missions).toContain('lg:grid-cols-[minmax(0,1fr)_auto]');
    expect(staff).toContain('grid-cols-[44px_minmax(0,1fr)_auto]');
  });

  it("locks deliberate desktop widths, readable content, and adaptive gutters", () => {
    expect(premiumCss).toContain("--os-content-max: 1320px");
    expect(premiumCss).toContain("max-width: var(--os-content-max)");
    expect(premiumCss).toContain("max-width: 1120px");
    expect(premiumCss).toContain("max-width: 760px");
    expect(premiumCss).toContain("padding-inline: 32px !important");
    expect(premiumCss).toContain("padding-inline: 40px !important");
    expect(premiumCss).toContain("padding-inline: 48px !important");
  });

  it("respects reduced motion and avoids transition-all in the migrated core surfaces", () => {
    expect(premiumCss).toContain("prefers-reduced-motion: reduce");
    for (const source of [home, manager, missions, taskSheet, activity, settings, staff]) {
      expect(source).not.toContain("transition-all");
    }
  });
});
