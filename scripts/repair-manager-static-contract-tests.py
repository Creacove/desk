from pathlib import Path


def replace_once(path_str: str, old: str, new: str) -> None:
    path = Path(path_str)
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path_str}: expected 1 match, found {count}: {old!r}")
    path.write_text(text.replace(old, new, 1))


def replace_all(path_str: str, old: str, new: str, minimum: int = 1) -> None:
    path = Path(path_str)
    text = path.read_text()
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f"{path_str}: expected at least {minimum} matches, found {count}: {old!r}")
    path.write_text(text.replace(old, new))

# ManagerScreens.tsx became a thin wrapper during the interruption-flow redesign.
# Source-contract tests must inspect the wrapper and its implementation file together.
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
    "src/conversational-song-workspace-manager.test.ts",
    '    const screen = source("src/features/manager/ManagerScreens.tsx");',
    '    const screen = [source("src/features/manager/ManagerScreens.tsx"), source("src/features/manager/ManagerScreensLegacy.tsx")].join("\\n");',
)

# The new guided interruption UI advances one question at a time. Its action labels are
# Next / Continue; there is intentionally no old batch-level "Send answers" button.
replace_once(
    "src/manager-conversation-polish.test.ts",
    '    expect(composer).toContain("Send answers");',
    '    expect(composer).toContain("Continue");\n    expect(composer).toContain("Next");',
)
replace_all(
    "src/production-app-shell.test.tsx",
    'name: "Send answers"',
    'name: "Continue"',
    minimum=3,
)
replace_once(
    "src/production-app-shell.test.tsx",
    '    fireEvent.click(screen.getByRole("button", { name: "Cover art" }));\n    fireEvent.click(screen.getByRole("button", { name: "Continue" }));',
    '    fireEvent.click(screen.getByRole("button", { name: "Cover art" }));\n    fireEvent.click(screen.getByRole("button", { name: "Next" }));',
)

# Prompt assertion was accidentally case-sensitive after the protocol text was capitalized.
replace_once(
    "src/manager-interruption-protocol.test.ts",
    '    expect(instructions).toContain("use files for audio, artwork");',
    '    expect(instructions.toLowerCase()).toContain("use files for audio, artwork");',
)

# Contact/provenance validation is an expected non-retryable rejection now, not an app
# outage. Search and real persistence failures still go through app-error telemetry.
replace_once(
    "src/release-opportunities.test.ts",
    '''    captureAppError.mockReset();
    captureAppError.mockResolvedValue("error-event-2");
    await expect(executeManagerConversationTool(
      minimalOpportunityDb(),
      managerScope,
      "save_focused_release_opportunities",
      { opportunityType: "playlist", candidates: [{ ...candidate(), fit: null }] },
    )).resolves.toMatchObject({ status: "failed", retryable: true });
    expect(captureAppError).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      refs: expect.objectContaining({ stage: "contact_verification" }),
    }));
''',
    '''    captureAppError.mockReset();
    captureAppError.mockResolvedValue("error-event-2");
    await expect(executeManagerConversationTool(
      minimalOpportunityDb(),
      managerScope,
      "save_focused_release_opportunities",
      { opportunityType: "playlist", candidates: [{ ...candidate(), fit: null }] },
    )).resolves.toMatchObject({ status: "rejected", stage: "contact_verification", retryable: false });
    expect(captureAppError).not.toHaveBeenCalled();
''',
)

print("Repaired stale Manager contracts after the interruption-flow and error-taxonomy changes.")
