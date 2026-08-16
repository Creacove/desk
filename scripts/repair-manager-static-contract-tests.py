from pathlib import Path


def replace_once(path_str: str, old: str, new: str) -> None:
    path = Path(path_str)
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path_str}: expected 1 match, found {count}: {old!r}")
    path.write_text(text.replace(old, new, 1))

# The Manager screen was intentionally split: ManagerScreens.tsx is now a thin wrapper
# and the existing presentation implementation lives in ManagerScreensLegacy.tsx.
# Static source-contract tests must inspect both halves of that implementation instead
# of assuming every symbol still lives in the wrapper file.
replace_once(
    "src/production-app-shell.test.tsx",
    'const managerScreensSource = readFileSync(join(process.cwd(), "src", "features", "manager", "ManagerScreens.tsx"), "utf8");',
    'const managerScreensSource = ["ManagerScreens.tsx", "ManagerScreensLegacy.tsx"].map((file) => readFileSync(join(process.cwd(), "src", "features", "manager", file), "utf8")).join("\\n");',
)

replace_once(
    "src/manager-conversation-polish.test.ts",
    'const manager = source("features/manager/ManagerScreens.tsx");',
    'const manager = [source("features/manager/ManagerScreens.tsx"), source("features/manager/ManagerScreensLegacy.tsx")].join("\\n");',
)
replace_once(
    "src/manager-conversation-polish.test.ts",
    '    expect(composer).toContain("Send answers");',
    '    expect(composer).toContain("Continue");\n    expect(composer).toContain("Next");',
)

replace_once(
    "src/conversational-song-workspace-manager.test.ts",
    '    const screen = source("src/features/manager/ManagerScreens.tsx");',
    '    const screen = [source("src/features/manager/ManagerScreens.tsx"), source("src/features/manager/ManagerScreensLegacy.tsx")].join("\\n");',
)

replace_once(
    "src/manager-interruption-protocol.test.ts",
    '    expect(instructions).toContain("use files for audio, artwork");',
    '    expect(instructions.toLowerCase()).toContain("use files for audio, artwork");',
)

print("Repaired stale Manager static source-contract tests after the screen split.")
