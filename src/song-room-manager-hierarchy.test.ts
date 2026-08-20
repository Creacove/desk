import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/music/MusicScreens.tsx"), "utf8");

describe("Song Room manager hierarchy", () => {
  it("keeps the Manager CTA primary in the current Song Room contract", () => {
    expect(source).toContain("Continue with Manager");
    expect(source).toContain("hover:text-brand-accent");
  });

  it("uses a desktop-native record hero", () => {
    expect(source).toContain('grid-cols-[auto_minmax(0,1fr)_auto]');
    expect(source).toContain('text-[40px] font-semibold leading-[0.95]');
    expect(source).toContain('xl:text-[48px]');
  });

  it("uses the shared action primitive for Manager entry points", () => {
    expect(source).toContain('import { Button } from "../../design-system/desktopPrimitives";');
    expect(source).toMatch(/<Button[\s\S]*?aria-label="Chat with Manager"/);
    expect(source).toContain('size="md"');
    expect(source).toContain('size="lg"');
    expect(source).toContain('min-h-11 rounded-[10px] px-4');
    expect(source).not.toContain('px-4.5');
  });

  it("collapses the empty Manager review into a quiet row", () => {
    expect(source).toContain('Manager review');
    expect(source).toContain('Review record');
    expect(source).not.toContain('See what needs attention.');
    expect(source).not.toContain('A quick assessment of the song, files, rights and release setup.');
  });

  it("gives an ungenerated project review an intentional next step", () => {
    expect(source).toContain("Ask Manager for a concise view of the release package before choosing the next move.");
    expect(source).toMatch(/<Button[\s\S]*?Review this project/);
    expect(source).toMatch(/<Button[\s\S]*?variant="secondary"[\s\S]*?Review this project/);
    expect(source).not.toContain('bg-foreground px-4 text-[12px] font-semibold text-background transition-opacity');
  });

  it("uses one ledger row language in the catalog and project tracklist", () => {
    expect(source).toContain("music-ledger-frame");
    expect(source).toContain("music-ledger-row");
    expect(source.match(/music-ledger-frame/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source.match(/music-ledger-row/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("uses the shared readable type scale inside every Song Room tab", () => {
    expect(source).toContain('data-testid="song-room-mobile-overview" className="os-song-tab-panel w-full"');
    expect(source).toContain('data-testid="song-room-files" className="os-song-tab-panel w-full"');
    expect(source).toContain('data-testid="song-room-details" className="os-song-tab-panel w-full"');
    expect(source).toContain('data-testid="song-room-rights" className="os-song-tab-panel w-full"');
    expect(source).toContain("os-tab-intro");
    expect(source).toContain("os-field-label");
    expect(source).toContain("os-field-value");
    expect(source).toContain('className="os-body-copy whitespace-pre-line font-medium text-foreground/90"');
  });

  it("keeps Song Room tabs concise and uses the shared button hierarchy for Rights", () => {
    expect(source).not.toContain("Everything your team needs for this song, in one place.");
    expect(source).not.toContain("Core release information and metadata.");
    expect(source).not.toContain("Add contributors and splits before release.");
    expect(source).not.toContain(">Set up song rights</");
    expect(source).toContain(">Set up splits</Button>");
    expect(source).toContain('variant="secondary" onClick={rights.state === "document_on_file"');
    expect(source).toContain("Send split confirmation links");
  });

  it("does not repeat Song identity as a Details section label", () => {
    expect(source).toContain('group.title !== "Song identity"');
    expect(source.match(/group\.title !== "Song identity"/g)?.length).toBe(2);
  });
});
