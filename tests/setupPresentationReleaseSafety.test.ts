import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ui = readFileSync(join(process.cwd(), "src", "features", "onboarding", "setup-presentation", "SetupPresentationV2.tsx"), "utf8");
const shell = readFileSync(join(process.cwd(), "src", "features", "onboarding", "SetupActivityScreen.tsx"), "utf8");
const flag = readFileSync(join(process.cwd(), "src", "features", "onboarding", "setup-presentation", "useSetupPresentationFlag.ts"), "utf8");
const app = readFileSync(join(process.cwd(), "src", "app", "ProductionApp.tsx"), "utf8");
const projection = readFileSync(join(process.cwd(), "src", "services", "setupPresentationProjection.ts"), "utf8");

describe("setup presentation release safety", () => {
  it("does not ship generic AI visual clichés", () => {
    expect(ui).not.toContain("Sparkles");
    expect(ui).not.toContain("blur-3xl");
    expect(ui).not.toContain("h-[30rem] w-[30rem] rounded-full");
  });

  it("keeps mobile vertical overflow available and every artwork path defensive", () => {
    expect(ui).toContain("overflow-x-hidden");
    expect(ui).not.toContain("min-h-screen overflow-hidden");
    expect(ui).toContain("function SafeArtwork");
    expect(ui).toContain("onError={() => setFailed(true)}");
  });

  it("always preserves the Manager insight when the editorial budget is full", () => {
    expect(ui).toContain('const managerBlock = blocks.find((block) => block.key === "manager")');
    expect(ui).toContain('blocks.filter((block) => block.key !== "manager").slice(0, 5)');
  });

  it("does not mark catalogue resolved while it is still working", () => {
    expect(ui).toContain('snapshot.catalogue.state === "complete" ? <ResolvedMark /> : <WorkingMark />');
  });

  it("does not regress into a staged progress wizard", () => {
    expect(ui).not.toContain("SetupNarrativeRail");
    expect(ui).not.toContain('aria-label="Setup progress"');
  });

  it("falls back to the legacy recovery UI if the projection reports a real setup failure", () => {
    expect(shell).toContain('presentation.snapshot?.setup.status === "failed"');
  });

  it("keeps visual fixtures network-free", () => {
    expect(shell).toContain("if (fixture) return async () => fixture");
  });

  it("does not flash the legacy setup card while the first V2 snapshot is loading", () => {
    expect(shell).toContain("if (!presentation.snapshot) return <SetupPresentationPrelude />");
    expect(shell).toContain('data-testid="setup-presentation-prelude"');
  });

  it("ships V2 on by default while keeping an explicit remote kill switch", () => {
    expect(flag).toContain("useState(localOverride ?? testDefault)");
    expect(flag).toContain('import.meta.env.MODE === "test" ? false : true');
    expect(flag).toContain("getFeatureFlag(SETUP_PRESENTATION_FLAG) !== false");
    expect(flag).toContain('value === "legacy"');
  });
  it("does not require a separately deployed Edge function", () => {
    const service = readFileSync(join(process.cwd(), "src", "services", "setupPresentation.ts"), "utf8");
    expect(service).not.toContain("/functions/v1/setup-presentation");
    expect(service).not.toContain("functions.invoke");
  });

  it("keeps the final integration surgical and backend-deployment-free", () => {
    expect(app).toContain("artistWorkspaceId={workspace?.artistWorkspaceId}");
    expect(app).toContain("enterDeskWithProgressiveTransition(() => setView(\"labelHQ\"))");
    const service = readFileSync(join(process.cwd(), "src", "services", "setupPresentation.ts"), "utf8");
    expect(service).not.toContain("supabase/functions/setup-presentation");
    expect(service).not.toContain("functions.invoke");
  });

  it("keeps provider names and source lists out of the visible setup presentation", () => {
    expect(ui).not.toContain("publicSources.map");
    expect(ui).not.toContain("Public context found at");
    expect(projection).not.toContain('"Spotify followers"');
    expect(projection).not.toContain('"Spotify playlists"');
    expect(projection).toContain('spotify_followers: "Followers"');
    expect(projection).toContain('spotify_playlist_count: "Playlist count"');
  });

});
