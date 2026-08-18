import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Desk final one-merge design contract", () => {
  it("keeps the desktop semantic action system across Settings and first run", () => {
    const primitives = read("src/design-system/desktopPrimitives.tsx");
    const settings = read("src/features/settings/SettingsScreen.tsx");
    const frontDoor = read("src/features/onboarding/FrontDoorScreens.tsx");
    expect(primitives).toContain("bg-brand-accent text-white");
    expect(settings).toContain("<Button");
    expect(settings).not.toContain("ProductButton");
    expect(frontDoor).toContain("<Button");
    expect(frontDoor).not.toContain("bg-foreground text-background");
  });

  it("does not expose provider/source plumbing in the frozen customer-facing surfaces", () => {
    const settings = read("src/features/settings/SettingsScreen.tsx");
    const setup = read("src/features/onboarding/setup-presentation/SetupPresentationV2.tsx");
    const projection = read("src/services/setupPresentationProjection.ts");
    const frontDoor = read("src/features/onboarding/FrontDoorScreens.tsx");

    expect(settings).not.toContain('label="Connected artist"');
    expect(settings).not.toContain("Managed by your connected Spotify artist");
    expect(setup).not.toContain("publicSources.map");
    expect(projection).not.toContain('"Spotify followers"');
    expect(projection).not.toContain('"Spotify playlists"');
    expect(frontDoor).not.toContain('"View artist source"');
    expect(frontDoor).not.toContain('"Open on Spotify"');
  });

  it("keeps setup presentation powerless and Music Reads non-blocking", () => {
    const service = read("src/services/setupPresentation.ts");
    const app = read("src/app/ProductionApp.tsx");
    for (const mutation of [".insert(", ".update(", ".upsert(", ".delete(", "functions.invoke"]) {
      expect(service).not.toContain(mutation);
    }
    expect(app).toContain("artistWorkspaceId={workspace?.artistWorkspaceId}");
    expect(app).toContain('enterDeskWithProgressiveTransition(() => setView("labelHQ"))');
  });

  it("keeps the desktop branch finish contract compatible with final Settings", () => {
    const desktopContract = read("src/desktop-finish-contract.test.ts");
    const settings = read("src/features/settings/SettingsScreen.tsx");
    expect(desktopContract).toContain('expect(settings).toContain("<Button")');
    expect(desktopContract).toContain('expect(settings).not.toContain("ProductButton")');
    expect(settings).not.toContain("transition-all");
  });
});
