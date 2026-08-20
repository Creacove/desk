import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");
const manager = readFileSync("src/features/manager/ManagerScreensLegacy.tsx", "utf8");
const components = readFileSync("src/design-system/components.tsx", "utf8");

describe("Catalog and Manager beauty system", () => {
  it("keeps Catalog copy minimal and uses one visual language for songs and projects", () => {
    expect(music).toContain('<WorkspaceHeader title="Catalog" />');
    expect(music).not.toContain("Music workspace");
    expect(music).not.toContain("Songs and projects connected to active work.");
    expect(music).toContain('projects.map((project, index)');
    expect(music).toContain('grid-cols-[32px_52px_minmax(0,1fr)_140px_110px_auto]');
  });

  it("does not ship hard-coded white mobile music surfaces", () => {
    expect(music).not.toContain('bg-white px-3 py-3 text-left shadow');
    expect(music).not.toContain('data-testid="music-detail-mobile-top" className="rounded-[18px]');
  });

  it("makes project rooms part of the Song Room visual system", () => {
    expect(music).not.toContain("Songs stay atomic inside projects.");
    expect(music).not.toContain("Project songs");
    expect(music).toContain("What matters now");
    expect(music).toContain('onOpenManager={onContinueWithManager}');
  });

  it("anchors Manager room navigation to the workspace edge while preserving the conversation reading column", () => {
    expect(components).toContain('<div className="flex w-full items-center gap-2">');
    expect(components).not.toContain('mx-auto flex max-w-[48rem] items-center gap-3');
    expect(readFileSync("src/features/manager/ManagerScreens.tsx", "utf8")).toContain('os-reading-measure');
  });

  it("removes stacked Manager labels and avoids an empty history column", () => {
    expect(manager).not.toContain(">Workspace</p>");
    expect(manager).not.toContain(">History</p>");
    expect(manager).not.toContain("Manager keeps the work tied to this artist workspace.");
    expect(manager).toContain('conversations.length > 0 ? "grid gap-8 xl:grid-cols');
    expect(manager).toContain('>Conversations</h2>');
  });
});
