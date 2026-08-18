import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Desk front-door release contract", () => {
  it("keeps provider and infrastructure language out of the visible front door", () => {
    const screens = read("src/features/onboarding/FrontDoorScreens.tsx");
    const auth = read("src/features/onboarding/FrontDoorAuth.tsx");
    for (const phrase of [
      '"Spotify"', '"Chartmetric"', '"View artist source"', '"Open on Spotify"',
      '"Verified Catalog"', '"Verified Artist Identity"', '"Artist Authentication"',
      '"Connect artist profile"', '"Manager Basics"', '"Enter Desk HQ"', '"Preparing Desk HQ"',
    ]) expect(screens).not.toContain(phrase);
    expect(auth).not.toContain("Open the artist's operating read.");
    expect(auth).not.toContain("signals, blockers, tasks");
  });

  it("keeps the approved product narrative and mobile-safe structure", () => {
    const screens = read("src/features/onboarding/FrontDoorScreens.tsx");
    const auth = read("src/features/onboarding/FrontDoorAuth.tsx");
    for (const phrase of [
      "Find your artist.", "Found. Opening the Desk preview.", "Open {artist.name}",
      "Give your Manager the starting point.", "Build my Desk", "Start my Desk",
    ]) expect(screens).toContain(phrase);
    for (const phrase of ["Know what to do next.", "Welcome back.", "Create your Desk.", "Opening your Desk"]) expect(auth).toContain(phrase);
    expect(screens).toContain("min-h-dvh");
    expect(screens).toContain("env(safe-area-inset-bottom)");
    expect(screens).toContain("selectedArtistId");
    expect(screens).not.toContain('update("name"');
  });

  it("uses the desktop semantic forward-action system", () => {
    const screens = read("src/features/onboarding/FrontDoorScreens.tsx");
    const primitives = read("src/design-system/desktopPrimitives.tsx");
    expect(primitives).toContain("bg-brand-accent text-white");
    expect(screens).toContain('from "../../design-system/desktopPrimitives"');
    expect(screens).toContain("<Button");
    expect(screens).not.toContain("bg-foreground text-background");
  });

  it("does not move backend ownership into presentation components", () => {
    const source = read("src/features/onboarding/FrontDoorScreens.tsx") + read("src/features/onboarding/FrontDoorAuth.tsx");
    for (const mutation of [".insert(", ".update(", ".upsert(", ".delete(", "functions.invoke", "fetch("]) {
      expect(source).not.toContain(mutation);
    }
  });
});
