import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/features/music/MusicScreens.tsx", "utf8");

function region(start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("Song Room hierarchy redesign", () => {
  it("makes Chat with Manager the dominant room CTA", () => {
    const header = region("function MusicDetailTop(", "function MusicLinkedWork({");
    expect(header).toContain('grid-cols-[128px_minmax(0,1fr)_auto]');
    expect(header).toContain('bg-brand-accent');
    expect(header).toContain('Chat with Manager');
    expect(header).toContain('aria-label="Chat with Manager"');
    expect(header).not.toContain('> Manager</button>');
  });

  it("uses a proper desktop record hero instead of a stretched mobile header", () => {
    const header = region("function MusicDetailTop(", "function MusicLinkedWork({");
    expect(header).toContain('text-[42px]');
    expect(source).toContain('detail: "h-32 w-32 rounded-[18px] xl:h-36 xl:w-36"');
    expect(header).toContain('grid-cols-[128px_minmax(0,1fr)_auto]');
  });

  it("collapses an empty Manager review to one quiet secondary row", () => {
    const overview = region("function SongOverviewRead({", "function MusicManagerReadContent({");
    expect(overview).toContain('"Manager review"');
    expect(overview).toContain('"Review record"');
    expect(overview).toContain('border-y border-foreground/8');
    expect(overview).not.toContain('See what needs attention.');
    expect(overview).not.toContain('A quick assessment of the song, files, rights and release setup.');
    expect(overview).not.toContain('bg-foreground px-3.5');
  });

  it("shows What matters now only when an actual read body exists", () => {
    const overview = region("function SongOverviewRead({", "function MusicManagerReadContent({");
    expect(overview).toContain('const hasRead = Boolean(readBody);');
    expect(overview).toContain('if (!hasRead)');
    expect(overview).toContain('What matters now');
  });
});
