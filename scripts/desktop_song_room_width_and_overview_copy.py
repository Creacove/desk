from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

# Song Room: remove desktop reading-column constraint and make Overview outcome-led.
music_path = Path("src/features/music/MusicScreens.tsx")
music = music_path.read_text()
for old, new, label in [
    ('data-testid="song-room-mobile-overview" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-mobile-overview" className="w-full"', 'overview width'),
    ('data-testid="song-room-files" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-files" className="w-full"', 'files width'),
    ('data-testid="song-room-details" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-details" className="w-full"', 'details width'),
    ('data-testid="song-room-rights" className="mx-auto w-full max-w-4xl"', 'data-testid="song-room-rights" className="w-full"', 'rights width'),
    ('  const actionLabel = managerReadButtonLabel("song", song.managerReadStatus);', '  const actionLabel = failed ? "Retry record review" : checking ? "Check record review" : read ? "Refresh record review" : "Review this record";', 'overview action label'),
    ('<p className="font-ui text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/65">Manager&apos;s read</p>', '<p className="font-ui text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/65">What matters now</p>', 'overview eyebrow'),
    ('aria-label={briefPending ? "Manager is reading" : actionLabel}', 'aria-label={briefPending ? "Reviewing this record" : actionLabel}', 'overview refresh aria'),
    ('title={briefPending ? "Manager is reading" : actionLabel}', 'title={briefPending ? "Reviewing this record" : actionLabel}', 'overview refresh title'),
    ('<p className="text-[13px] font-semibold text-muted-foreground">Manager is reading this record…</p>', '<p className="text-[13px] font-semibold text-muted-foreground">Reviewing this record…</p>', 'overview loading copy'),
    ('<p className="text-[13px] font-semibold text-muted-foreground">Checking Manager’s read…</p>', '<p className="text-[13px] font-semibold text-muted-foreground">Checking this review…</p>', 'overview checking copy'),
    ('{failed ? "Manager couldn’t complete the read." : "Get Manager’s take on this record."}', '{failed ? "Couldn’t complete the review." : "See what needs attention."}', 'overview empty heading'),
    ('{failed ? "Try again when you’re ready." : "A concise read of what matters now, grounded in the song and its current workspace."}', '{failed ? "Try again when you’re ready." : "A quick assessment of the song, files, rights and release setup."}', 'overview empty description'),
    ('{failed ? "Try again" : "Get Manager’s read"}', '{failed ? "Try again" : "Review this record"}', 'overview primary CTA'),
]:
    music = replace_once(music, old, new, label)
music_path.write_text(music)

# Manager conversation: use the full workspace width on desktop rather than a 48rem reading column.
legacy_path = Path("src/features/manager/ManagerScreensLegacy.tsx")
legacy = legacy_path.read_text()
legacy = replace_once(
    legacy,
    '''      {/*\n        ChatGPT layout pattern:\n        — A centered, width-constrained reading column gives the breathing room.\n        — Manager text fills the column naturally (no bubble border).\n        — User message is a right-aligned soft pill within the same column.\n        — Side whitespace is the product of the column constraint, not padding hacks.\n      */}\n      <div data-testid="manager-conversation-column" className="mx-auto w-full max-w-[48rem] px-1 pb-[calc(17rem+env(safe-area-inset-bottom))] pt-3 sm:px-2 sm:pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pt-5 lg:px-0">''',
    '''      <div data-testid="manager-conversation-column" className="w-full px-1 pb-[calc(17rem+env(safe-area-inset-bottom))] pt-3 sm:px-2 sm:pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pt-5 lg:px-0">''',
    'conversation width constraint',
)
legacy_path.write_text(legacy)

composer_path = Path("src/features/manager/ManagerComposer.tsx")
composer = composer_path.read_text()
composer = replace_once(
    composer,
    '<div className="pointer-events-auto mx-auto w-full max-w-[48rem]">',
    '<div className="pointer-events-auto w-full">',
    'conversation composer width',
)
composer_path.write_text(composer)

wrapper_path = Path("src/features/manager/ManagerScreens.tsx")
wrapper = wrapper_path.read_text()
wrapper = replace_once(
    wrapper,
    '<div className="pointer-events-auto mx-auto w-full max-w-[48rem]">',
    '<div className="pointer-events-auto w-full">',
    'workspace action tray width',
)
wrapper_path.write_text(wrapper)

components_path = Path("src/design-system/components.tsx")
components = components_path.read_text()
components = replace_once(
    components,
    '<div className="mx-auto flex max-w-[48rem] items-center gap-3">',
    '<div className="flex w-full items-center gap-3">',
    'conversation sticky header width',
)
components_path.write_text(components)

# Update static design contracts to protect the new desktop hierarchy.
overview_test_path = Path("src/song-room-red-antler-overview.test.ts")
overview_test = overview_test_path.read_text()
overview_test = replace_once(
    overview_test,
    '''  it("makes Manager the primary song action and Manager Read the overview", () => {\n    expect(music).toContain('Chat with Manager');\n    expect(music).toContain('data-testid="song-room-overview-read"');\n    expect(music).toContain('Manager&apos;s read');\n    const songOverview = music.slice(music.indexOf('data-testid="song-room-overview-read"'), music.indexOf('function MusicManagerReadContent'));\n    expect(songOverview).not.toContain('manager-read-metrics');\n  });''',
    '''  it("keeps Manager conversational in the header while Overview leads with user value", () => {\n    expect(music).toContain('Chat with Manager');\n    expect(music).toContain('data-testid="song-room-overview-read"');\n    expect(music).toContain('What matters now');\n    expect(music).toContain('Review this record');\n    const songOverview = music.slice(music.indexOf('data-testid="song-room-overview-read"'), music.indexOf('function MusicManagerReadContent'));\n    expect(songOverview).not.toContain('Manager&apos;s read');\n    expect(songOverview).not.toContain('Get Manager’s read');\n    expect(songOverview).not.toContain('manager-read-metrics');\n  });''',
    'overview wording contract',
)
overview_test_path.write_text(overview_test)

tab_test_path = Path("src/song-room-tab-design.test.ts")
tab_test = tab_test_path.read_text()
tab_test = replace_once(
    tab_test,
    '''  it("uses one bounded editorial shell for Files, Details, and Rights", () => {\n    expect(music).toContain('data-testid="song-room-files" className="mx-auto w-full max-w-4xl"');\n    expect(music).toContain('data-testid="song-room-details" className="mx-auto w-full max-w-4xl"');\n    expect(music).toContain('data-testid="song-room-rights" className="mx-auto w-full max-w-4xl"');\n  });''',
    '''  it("lets every Song Room tab use the full desktop workspace width", () => {\n    expect(music).toContain('data-testid="song-room-mobile-overview" className="w-full"');\n    expect(music).toContain('data-testid="song-room-files" className="w-full"');\n    expect(music).toContain('data-testid="song-room-details" className="w-full"');\n    expect(music).toContain('data-testid="song-room-rights" className="w-full"');\n    expect(music).not.toContain('data-testid="song-room-files" className="mx-auto w-full max-w-4xl"');\n  });''',
    'tab width contract',
)
tab_test_path.write_text(tab_test)

width_test = Path("src/desktop-workspace-width.test.ts")
width_test.write_text('''import { describe, expect, it } from "vitest";\nimport { readFileSync } from "node:fs";\n\nconst music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");\nconst legacy = readFileSync("src/features/manager/ManagerScreensLegacy.tsx", "utf8");\nconst manager = readFileSync("src/features/manager/ManagerScreens.tsx", "utf8");\nconst composer = readFileSync("src/features/manager/ManagerComposer.tsx", "utf8");\nconst components = readFileSync("src/design-system/components.tsx", "utf8");\n\ndescribe("desktop workspace width", () => {\n  it("does not center Song Room tabs inside a narrow reading column", () => {\n    for (const testId of ["song-room-mobile-overview", "song-room-files", "song-room-details", "song-room-rights"]) {\n      expect(music).toContain(`data-testid="${testId}" className="w-full"`);\n    }\n  });\n\n  it("lets the Manager conversation, composer, actions, and header use the desktop workspace", () => {\n    const conversationStart = legacy.indexOf('data-testid="manager-conversation-column"');\n    expect(conversationStart).toBeGreaterThan(-1);\n    expect(legacy.slice(conversationStart, conversationStart + 260)).not.toContain('max-w-[48rem]');\n    expect(composer).toContain('className="pointer-events-auto w-full"');\n    expect(manager).toContain('className="pointer-events-auto w-full"');\n    expect(components).toContain('className="flex w-full items-center gap-3"');\n  });\n});\n''')
