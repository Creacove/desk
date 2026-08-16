from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

# Song Room: use the desktop workspace instead of centering every tab in a reading column.
music_path = Path("src/features/music/MusicScreens.tsx")
music = music_path.read_text()
for old, new, label in [
    ('data-testid="song-room-mobile-overview" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-mobile-overview" className="w-full"', 'overview width'),
    ('data-testid="song-room-files" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-files" className="w-full"', 'files width'),
    ('data-testid="song-room-details" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-details" className="w-full"', 'details width'),
    ('data-testid="song-room-rights" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-rights" className="w-full"', 'rights width'),
    ('  const actionLabel = managerReadButtonLabel("song", song.managerReadStatus);', '  const actionLabel = failed ? "Retry record review" : checking ? "Check record review" : read ? "Refresh record review" : "Review this record";', 'overview action label'),
    ('>Manager&apos;s read</p>', '>What matters now</p>', 'overview eyebrow'),
    ('aria-label={briefPending ? "Manager is reading" : actionLabel}', 'aria-label={briefPending ? "Reviewing this record" : actionLabel}', 'overview refresh aria'),
    ('title={briefPending ? "Manager is reading" : actionLabel}', 'title={briefPending ? "Reviewing this record" : actionLabel}', 'overview refresh title'),
    ('>Manager is reading this record…</p>', '>Reviewing this record…</p>', 'overview loading copy'),
    ('>Checking Manager’s read…</p>', '>Checking this review…</p>', 'overview checking copy'),
    ('{failed ? "Manager couldn’t complete the read." : "Get Manager’s take on this record."}', '{failed ? "Couldn’t complete the review." : "See what needs attention."}', 'overview empty heading'),
    ('{failed ? "Try again when you’re ready." : "A concise read of what matters now, grounded in the song and its current workspace."}', '{failed ? "Try again when you’re ready." : "A quick assessment of the song, files, rights and release setup."}', 'overview empty description'),
    ('{failed ? "Try again" : "Get Manager’s read"}', '{failed ? "Try again" : "Review this record"}', 'overview primary CTA'),
]:
    music = replace_once(music, old, new, label)
music_path.write_text(music)

# Manager conversation: align the conversation, composer, action tray and sticky header to the workspace.
legacy_path = Path("src/features/manager/ManagerScreensLegacy.tsx")
legacy = legacy_path.read_text()
legacy = replace_once(
    legacy,
    'className="mx-auto w-full max-w-[48rem] px-1 pb-[calc(17rem+env(safe-area-inset-bottom))] pt-3 sm:px-2 sm:pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pt-5 lg:px-0"',
    'className="w-full px-1 pb-[calc(17rem+env(safe-area-inset-bottom))] pt-3 sm:px-2 sm:pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pt-5 lg:px-0"',
    'conversation width constraint',
)
legacy = legacy.replace(
    '''      {/*
        ChatGPT layout pattern:
        — A centered, width-constrained reading column gives the breathing room.
        — Manager text fills the column naturally (no bubble border).
        — User message is a right-aligned soft pill within the same column.
        — Side whitespace is the product of the column constraint, not padding hacks.
      */}
''',
    '',
    1,
)
legacy_path.write_text(legacy)

composer_path = Path("src/features/manager/ManagerComposer.tsx")
composer = composer_path.read_text()
composer = replace_once(composer, '<div className="pointer-events-auto mx-auto w-full max-w-[48rem]">', '<div className="pointer-events-auto w-full">', 'conversation composer width')
composer_path.write_text(composer)

wrapper_path = Path("src/features/manager/ManagerScreens.tsx")
wrapper = wrapper_path.read_text()
wrapper = replace_once(wrapper, '<div className="pointer-events-auto mx-auto w-full max-w-[48rem]">', '<div className="pointer-events-auto w-full">', 'workspace action tray width')
wrapper_path.write_text(wrapper)

components_path = Path("src/design-system/components.tsx")
components = components_path.read_text()
components = replace_once(components, '<div className="mx-auto flex max-w-[48rem] items-center gap-3">', '<div className="flex w-full items-center gap-3">', 'conversation sticky header width')
components_path.write_text(components)

# Update focused design contracts.
overview_test_path = Path("src/song-room-red-antler-overview.test.ts")
overview_test = overview_test_path.read_text()
overview_test = replace_once(
    overview_test,
    'it("makes Manager the primary song action and Manager Read the overview", () => {',
    'it("keeps Manager conversational in the header while Overview leads with user value", () => {',
    'overview test name',
)
overview_test = replace_once(
    overview_test,
    "    expect(music).toContain('Manager&apos;s read');",
    "    expect(music).toContain('What matters now');\n    expect(music).toContain('Review this record');",
    'overview wording expectation',
)
overview_test_path.write_text(overview_test)

tab_test_path = Path("src/song-room-tab-design.test.ts")
tab_test = tab_test_path.read_text()
tab_test = replace_once(tab_test, 'it("uses one bounded editorial shell for Files, Details, and Rights", () => {', 'it("lets every Song Room tab use the full desktop workspace width", () => {', 'tab width test name')
tab_test = replace_once(
    tab_test,
    "    expect(music).toContain('data-testid=\"song-room-files\" className=\"mx-auto w-full max-w-4xl\"');\n    expect(music).toContain('data-testid=\"song-room-details\" className=\"mx-auto w-full max-w-4xl\"');\n    expect(music).toContain('data-testid=\"song-room-rights\" className=\"mx-auto w-full max-w-4xl\"');",
    "    expect(music).toContain('data-testid=\"song-room-mobile-overview\" className=\"w-full\"');\n    expect(music).toContain('data-testid=\"song-room-files\" className=\"w-full\"');\n    expect(music).toContain('data-testid=\"song-room-details\" className=\"w-full\"');\n    expect(music).toContain('data-testid=\"song-room-rights\" className=\"w-full\"');",
    'tab width expectations',
)
tab_test_path.write_text(tab_test)

# Production interaction tests should assert the user-facing outcome language, not the internal Manager Read name.
production_test_path = Path("src/production-app-shell.test.tsx")
production_test = production_test_path.read_text()
production_replacements = [
    ('"Manager is reading this record"', '"Reviewing this record"'),
    ('"Get Manager’s take on this record"', '"See what needs attention"'),
    ('name: "Get Manager’s read"', 'name: "Review this record"'),
    ('"Manager couldn’t complete the read"', '"Couldn’t complete the review"'),
    ('"Manager couldn’t complete the read."', '"Couldn’t complete the review."'),
    ('"Checking Manager’s read"', '"Checking this review"'),
]
for old, new in production_replacements:
    production_test = production_test.replace(old, new)
production_test_path.write_text(production_test)

width_test = Path("src/desktop-workspace-width.test.ts")
width_test.write_text('''import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");
const legacy = readFileSync("src/features/manager/ManagerScreensLegacy.tsx", "utf8");
const manager = readFileSync("src/features/manager/ManagerScreens.tsx", "utf8");
const composer = readFileSync("src/features/manager/ManagerComposer.tsx", "utf8");
const components = readFileSync("src/design-system/components.tsx", "utf8");

describe("desktop workspace width", () => {
  it("does not center Song Room tabs inside a narrow reading column", () => {
    for (const testId of ["song-room-mobile-overview", "song-room-files", "song-room-details", "song-room-rights"]) {
      expect(music).toContain(`data-testid="${testId}" className="w-full"`);
    }
  });

  it("lets the Manager conversation, composer, actions, and header use the desktop workspace", () => {
    const conversationStart = legacy.indexOf('data-testid="manager-conversation-column"');
    expect(conversationStart).toBeGreaterThan(-1);
    expect(legacy.slice(conversationStart, conversationStart + 260)).not.toContain('max-w-[48rem]');
    expect(composer).toContain('className="pointer-events-auto w-full"');
    expect(manager).toContain('className="pointer-events-auto w-full"');
    expect(components).toContain('className="flex w-full items-center gap-3"');
  });
});
''')
