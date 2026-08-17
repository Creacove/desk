from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old!r}")
    target.write_text(text.replace(old, new, 1))


# Preserve stable accessibility/test contracts while keeping the redesigned visuals.
replace_once(
    "src/features/manager/ManagerScreens.tsx",
    '<WorkspaceHeader title="Manager" />',
    '<WorkspaceHeader title="Manager\'s Office" />',
)
replace_once(
    "src/features/manager/ManagerScreens.tsx",
    'aria-label={`Open ${conversation.topic}`}',
    'aria-label={conversation.topic}',
)
replace_once(
    "src/features/manager/ManagerScreens.tsx",
    'placeholder="Ask Manager anything about this artist"',
    'placeholder="Ask Manager anything about this artist..."',
)
replace_once(
    "src/features/manager/OpportunityArtifact.tsx",
    '>Open Files</button>',
    '>Open Files to create share link</button>',
)
replace_once(
    "src/manager-premium-phase-1.test.tsx",
    'getByRole("heading", { name: "Manager" })',
    'getByRole("heading", { name: "Manager\'s Office" })',
)

print("Applied compatibility fixes for Manager premium phase 1.")
