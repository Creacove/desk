from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


# Phase 0: open the Song Room tabs to the desktop workspace and frame the overview
# around the user's record, not around the internal Manager feature name.
music_path = Path("src/features/music/MusicScreens.tsx")
music = music_path.read_text()
for old, new, label in [
    ('data-testid="song-room-mobile-overview" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-mobile-overview" className="w-full"', 'overview width'),
    ('data-testid="song-room-files" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-files" className="w-full"', 'files width'),
    ('data-testid="song-room-details" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-details" className="w-full"', 'details width'),
    ('data-testid="song-room-rights" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-rights" className="w-full"', 'rights width'),
    ('  const actionLabel = managerReadButtonLabel("song", song.managerReadStatus);', '  const actionLabel = failed ? "Retry record review" : checking ? "Check record review" : read ? "Refresh record review" : "Review this record";', 'overview action label'),
    ('>Manager&apos;s read</p>', '>What matters now</p>', 'overview eyebrow'),
    ('aria-label={briefPending ? "Manager is reading" : actionLabel}', 'aria-label={briefPending ? (read ? "Refreshing record review" : "Reviewing this record") : actionLabel}', 'overview refresh aria'),
    ('title={briefPending ? "Manager is reading" : actionLabel}', 'title={briefPending ? (read ? "Refreshing record review" : "Reviewing this record") : actionLabel}', 'overview refresh title'),
    ('>Manager is reading this record…</p>', '>Reviewing this record…</p>', 'overview loading copy'),
    ('>Checking Manager’s read…</p>', '>Checking this review…</p>', 'overview checking copy'),
    ('{failed ? "Manager couldn’t complete the read." : "Get Manager’s take on this record."}', '{failed ? "Couldn’t complete the review." : "See what needs attention."}', 'overview empty heading'),
    ('{failed ? "Try again when you’re ready." : "A concise read of what matters now, grounded in the song and its current workspace."}', '{failed ? "Try again when you’re ready." : "A quick assessment of the song, files, rights and release setup."}', 'overview empty description'),
    ('{failed ? "Try again" : "Get Manager’s read"}', '{failed ? "Try again" : "Review this record"}', 'overview primary CTA'),
]:
    music = replace_once(music, old, new, label)
music_path.write_text(music)


overview_test_path = Path("src/song-room-red-antler-overview.test.ts")
overview_test = overview_test_path.read_text()
overview_test = replace_once(
    overview_test,
    'it("makes Manager the primary song action and Manager Read the overview", () => {',
    'it("keeps Manager conversational in the header while Overview leads with record value", () => {',
    'overview test name',
)
overview_test = replace_once(
    overview_test,
    "    expect(music).toContain('Manager&apos;s read');",
    "    expect(music).toContain('What matters now');\n    expect(music).toContain('Review this record');\n    expect(music).toContain('See what needs attention.');",
    'overview wording expectation',
)
overview_test_path.write_text(overview_test)


tab_test_path = Path("src/song-room-tab-design.test.ts")
tab_test = tab_test_path.read_text()
tab_test = replace_once(
    tab_test,
    'it("uses one bounded editorial shell for Files, Details, and Rights", () => {',
    'it("lets every Song Room tab use the full desktop workspace width", () => {',
    'tab width test name',
)
tab_test = replace_once(
    tab_test,
    "    expect(music).toContain('data-testid=\"song-room-files\" className=\"mx-auto w-full max-w-4xl\"');\n    expect(music).toContain('data-testid=\"song-room-details\" className=\"mx-auto w-full max-w-4xl\"');\n    expect(music).toContain('data-testid=\"song-room-rights\" className=\"mx-auto w-full max-w-4xl\"');",
    "    expect(music).toContain('data-testid=\"song-room-mobile-overview\" className=\"w-full\"');\n    expect(music).toContain('data-testid=\"song-room-files\" className=\"w-full\"');\n    expect(music).toContain('data-testid=\"song-room-details\" className=\"w-full\"');\n    expect(music).toContain('data-testid=\"song-room-rights\" className=\"w-full\"');",
    'tab width expectations',
)
tab_test_path.write_text(tab_test)


# Keep the integration suite aligned with the new song-specific product language.
# Project Manager Read language is intentionally untouched in this phase.
production_test_path = Path("src/production-app-shell.test.tsx")
production_test = production_test_path.read_text()
for old, new, label in [
    ('getByRole("button", { name: "Refresh Manager Read" })).toHaveClass("h-9", "w-9");', 'getByRole("button", { name: "Refresh record review" })).toHaveClass("h-9", "w-9");', 'reopened song refresh label'),
    ('["song", "not_generated", "Not generated", "Ask Manager for a read", false],\n    ["song", "stale", "Refresh required", "Refresh Manager Read", false],\n    ["song", "running", "Manager is reading", "Manager is reading", true],\n    ["song", "refreshing", "Refreshing", "Refreshing Manager Read", true],\n    ["song", "fresh", "Current read", "Refresh Manager Read", false],\n    ["song", "failed", "Read failed", "Retry Manager Read", false],\n    ["song", "refresh_failed", "Refresh failed", "Retry Manager Read", false],', '["song", "not_generated", "Not generated", "Review this record", false],\n    ["song", "stale", "Refresh required", "Refresh record review", false],\n    ["song", "running", "Reviewing this record", "Reviewing this record", true],\n    ["song", "refreshing", "Refreshing", "Refreshing record review", true],\n    ["song", "fresh", "Current read", "Refresh record review", false],\n    ["song", "failed", "Review failed", "Retry record review", false],\n    ["song", "refresh_failed", "Refresh failed", "Retry record review", false],', 'song status matrix'),
    ('expect(readSurface).toHaveTextContent("Manager is reading this record");', 'expect(readSurface).toHaveTextContent("Reviewing this record");', 'running song copy'),
    ('expect(readSurface).toHaveTextContent("Get Manager’s take on this record");\n        expect(within(readSurface).getByRole("button", { name: "Get Manager’s read" })).toBeEnabled();', 'expect(readSurface).toHaveTextContent("See what needs attention");\n        expect(within(readSurface).getByRole("button", { name: "Review this record" })).toBeEnabled();', 'empty song copy'),
    ('expect(readSurface).toHaveTextContent("Manager couldn’t complete the read");', 'expect(readSurface).toHaveTextContent("Couldn’t complete the review");', 'failed song copy'),
    ('else expect(within(room).getByRole("button", { name: "Refreshing Manager Read" })).toBeDisabled();', 'else expect(within(room).getByRole("button", { name: "Refreshing record review" })).toBeDisabled();', 'refreshing song button'),
    ('expect(screen.getByTestId("music-song-detail")).toHaveTextContent("Get Manager’s take on this record.");', 'expect(screen.getByTestId("music-song-detail")).toHaveTextContent("See what needs attention.");', 'focused start reset copy'),
]:
    production_test = replace_once(production_test, old, new, label)
production_test_path.write_text(production_test)


width_test = Path("src/desktop-workspace-width.test.ts")
width_test.write_text('''import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");

describe("Song Room desktop workspace width", () => {
  it("does not center Song Room tabs inside a narrow reading column", () => {
    for (const testId of ["song-room-mobile-overview", "song-room-files", "song-room-details", "song-room-rights"]) {
      expect(music).toContain(`data-testid="${testId}" className="w-full"`);
    }
  });

  it("keeps the record-review copy focused on the record rather than the Manager feature", () => {
    expect(music).toContain("What matters now");
    expect(music).toContain("See what needs attention.");
    expect(music).toContain("Review this record");
    expect(music).not.toContain("Get Manager’s take on this record.");
  });
});
''')
