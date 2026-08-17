from pathlib import Path


def r(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f"{path}: expected {count}, found {actual}: {old[:100]!r}")
    p.write_text(text.replace(old, new))

# Source fixes found during QA.
r("src/features/missions/MissionScreens.tsx", "  missionEvents,\n  missionNeedsUser,", "  getNextArtistTask,\n  missionEvents,\n  missionNeedsUser,")
r("src/features/missions/MissionScreens.tsx", '  const currentTask = mode === "todo" ? tasks.find((task) => !taskIsDone(task) && task.owner === "artist") : undefined;', '  const currentTask = mode === "todo" ? getNextArtistTask(tasks, missionCheckpoints(mission), []) : undefined;')
r("src/features/missions/MissionWorkSurface.tsx", '  return (\n    <div className="grid min-w-0 gap-2">', '  if (!checkpoints.length) {\n    return <p className="border-t border-foreground/8 py-8 text-[13px] font-medium text-muted-foreground">No work yet</p>;\n  }\n\n  return (\n    <div className="grid min-w-0 gap-2">')
r("src/features/missions/MissionTaskSheet.tsx", '              <p className="text-[13px] font-bold text-foreground">In progress</p>\n              <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">The team is working on this.</p>', '              <p className="text-[13px] font-bold text-foreground">In progress</p>')

# Task sheet tests.
p = "src/mission-task-deliverables.test.tsx"
r(p, '    expect(within(dialog).getByText("Optional context")).toBeInTheDocument();\n', '')
r(p, '    expect(within(dialog).getByText("Optional file")).toBeInTheDocument();\n', '')
r(p, 'Upload optional context for Provide 90-day thesis', 'Upload file for Provide 90-day thesis', 2)
r(p, 'expect(within(dialog).getByText("Manager is handling this.")).toBeInTheDocument();', 'expect(within(dialog).getByText("In progress")).toBeInTheDocument();')
r(p, 'expect(within(dialog).queryByRole("button", { name: "Work with Manager" })).not.toBeInTheDocument();', 'expect(within(dialog).queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();')
r(p, 'fireEvent.click(within(dialog).getByRole("button", { name: "Work with Manager" }));', 'fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));')
r(p, 'expect(within(dialog).getByText("Current Manager draft")).toBeInTheDocument();', 'expect(within(dialog).getByText("Draft")).toBeInTheDocument();')
r(p, 'expect(screen.getByText("Manager reviewing")).toBeInTheDocument();', 'expect(screen.getByText("Saving…")).toBeInTheDocument();')
r(p, 'expect(screen.getByText("Manager reviewing")).toBeInTheDocument();', 'expect(screen.queryByText("Saving…")).not.toBeInTheDocument();\n    expect(screen.getByText("Provide 90-day thesis")).toBeInTheDocument();')
r(p, 'expect(await screen.findByText("Review failed · Tap to retry")).toBeInTheDocument();', 'expect(await screen.findByText("Couldn’t save. Tap to retry.")).toBeInTheDocument();')
r(p, 'fireEvent.click(screen.getByRole("button", { name: "Continue with Manager" }));', 'fireEvent.click(screen.getByRole("button", { name: "Continue" }));')

# Mission workspace tests.
p = "src/mission-workspace-simplification.test.tsx"
r(p, '''    expect(screen.getByRole("heading", { name: "Needs you" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Define the artist's 90-day position/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Completed 1/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Finish release setup")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Completed 1/i }));
    expect(screen.getByText("Finish release setup")).toBeInTheDocument();
    expect(screen.queryByText("Active Missions")).not.toBeInTheDocument();''', '''    expect(screen.getByRole("button", { name: "To do" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Define the artist's 90-day position/i })).toBeInTheDocument();
    expect(screen.queryByText("Finish release setup")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: /Finish release setup/i })).toBeInTheDocument();
    expect(screen.queryByText("Active Missions")).not.toBeInTheDocument();''')
r(p, '    expect(screen.getByText("The path from here")).toBeInTheDocument();\n', '    expect(screen.getByRole("button", { name: /Step 1 · Positioning thesis/i })).toBeInTheDocument();\n')
r(p, '''    expect(within(futureStage).getAllByText("Starts after Positioning thesis").length).toBeGreaterThan(0);
    expect(within(futureStage).getByRole("button", { name: /Run listener interviews/i })).toBeDisabled();
    expect(within(futureStage).getByText("Not available yet")).toBeInTheDocument();''', '''    const futureTask = within(futureStage).getByRole("button", { name: /Run listener interviews/i });
    expect(futureTask).toBeEnabled();
    expect(within(futureStage).getByText("Available after Positioning thesis")).toBeInTheDocument();
    fireEvent.click(futureTask);
    const dialog = screen.getByRole("dialog", { name: "Run listener interviews" });
    expect(within(dialog).getByText("Available after Positioning thesis")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Complete" })).toBeDisabled();''')
r(p, '''    const currentStage = screen.getByTestId("task-group-checkpoint-1");
    expect(within(currentStage).getByText("Manager reviewing")).toBeInTheDocument();
    const futureStage = screen.getByTestId("task-group-checkpoint-2");
    fireEvent.click(within(futureStage).getByRole("button", { name: /Market validation/i }));
    expect(within(futureStage).getAllByText("Starts after Positioning thesis").length).toBeGreaterThan(0);
    expect(within(futureStage).getByRole("button", { name: /Run listener interviews/i })).toBeDisabled();''', '''    const futureStage = screen.getByTestId("task-group-checkpoint-2");
    fireEvent.click(within(futureStage).getByRole("button", { name: /Market validation/i }));
    const futureTask = within(futureStage).getByRole("button", { name: /Run listener interviews/i });
    expect(futureTask).toBeEnabled();
    expect(within(futureStage).getByText("Available after Positioning thesis")).toBeInTheDocument();
    fireEvent.click(futureTask);
    expect(within(screen.getByRole("dialog", { name: "Run listener interviews" })).getByRole("button", { name: "Complete" })).toBeDisabled();''')
r(p, '    expect(screen.getByRole("heading", { name: "What changed" })).toBeInTheDocument();\n', '    expect(screen.getByRole("button", { name: "Updates" })).toHaveAttribute("aria-pressed", "true");\n')
r(p, '    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();', '    expect(screen.getByText("No work yet")).toBeInTheDocument();')

# Production integration assertions.
p = "src/production-app-shell.test.tsx"
r(p, 'expect(await screen.findByText("The path from here")).toBeInTheDocument();', 'expect(await screen.findByRole("button", { name: /^Work/ })).toBeInTheDocument();', 2)
r(p, '    expect(screen.getByText("The path from here")).toBeInTheDocument();\n', '', 1)
r(p, '    expect(screen.getByRole("heading", { name: "What changed" })).toBeInTheDocument();', '    expect(screen.getByRole("button", { name: /^Updates/ })).toHaveAttribute("aria-pressed", "true");')
r(p, '    expect(screen.getByText("Nothing is in motion yet.")).toBeInTheDocument();', '    expect(screen.getByText("No missions yet")).toBeInTheDocument();')
r(p, '    expect(await screen.findByText("The path from here")).toBeInTheDocument();\n', '    expect(await screen.findByRole("button", { name: /^Work/ })).toBeInTheDocument();\n')
r(p, '    expect(screen.getByRole("heading", { name: "Needs you" })).toBeInTheDocument();', '    expect(screen.getByRole("button", { name: "To do" })).toHaveAttribute("aria-pressed", "true");')
r(p, '    expect(missionCard).toHaveTextContent(/Release lane clarity\\s*·\\s*0 of 2 done/);', '    expect(missionCard).toHaveTextContent(/0 of 2 done/);')
r(p, '    expect(screen.getByText("Private exports and Shazam heatmap snapshots are missing.")).toBeInTheDocument();\n', '')
r(p, '''    expect(tabRail).not.toHaveClass("overflow-x-auto");
    expect(screen.getByText("The path from here")).toBeInTheDocument();''', '''    expect(tabRail).toHaveClass("workspace-tab-rail");
    expect(screen.queryByText("The path from here")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-app-topbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-tabbar")).not.toBeInTheDocument();''')
r(p, '''    expect(within(secondStage).getByRole("button", { name: /Follow-up review.*0 of 1 done/i })).toHaveAttribute("aria-expanded", "false");''', '''    expect(within(secondStage).getByRole("button", { name: /Follow-up review.*0 of 1 done/i })).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Back to Missions" }));
    expect(screen.getByTestId("mobile-app-topbar")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-tabbar")).toBeInTheDocument();''')

print("Missions zero-learning contracts migrated")