from pathlib import Path

path = Path("src/production-app-shell.test.tsx")
text = path.read_text()

HOME_READY = '    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();'


def bounds(title: str):
    marker = f'  it("{title}", async () => {{'
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f"missing test: {title}")
    end = text.find('\n  it("', start + len(marker))
    if end < 0:
        end = text.find('\n});', start)
    if end < 0:
        raise SystemExit(f"missing test end: {title}")
    return start, end


def replace_tail(title: str, assertions: str):
    global text
    start, end = bounds(title)
    block = text[start:end]
    assertion_start = block.find(HOME_READY)
    close = block.rfind('  }, 20000);')
    if assertion_start < 0 or close < 0:
        raise SystemExit(f"missing Home assertion boundary: {title}")
    text = text[:start] + block[:assertion_start] + assertions.rstrip() + '\n  }, 20000);' + text[end:]


replace_tail(
    "opens Desk HQ from real repositories without Sable Day or Night Bus fallback copy",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).toBeInTheDocument();
    expect(screen.getByTestId("desk-editorial-brief")).toBeInTheDocument();
    expect(screen.getAllByRole("form", { name: "Ask your manager" })).toHaveLength(1);
    expect(screen.queryByRole("form", { name: "Ask your manager on mobile" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask Manager about anything in this workspace")).toBeInTheDocument();
    const metrics = screen.getAllByTestId("desk-signal-metric");
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.length).toBeLessThanOrEqual(4);
    expect(screen.getByTestId("desk-manager-read")).toBeInTheDocument();
    expect(screen.queryByText("Today's Attention")).not.toBeInTheDocument();
    expect(screen.queryByText("Activity log")).not.toBeInTheDocument();
    expect(screen.queryByText("Private analytics missing")).not.toBeInTheDocument();
    expect(screen.queryByTestId("desk-agent-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Sable Day")).not.toBeInTheDocument();
    expect(screen.queryByText("Night Bus")).not.toBeInTheDocument();

    const activityButtons = screen.getAllByRole("button", { name: /Open Activity Center/i });
    expect(activityButtons.length).toBeGreaterThan(0);
    fireEvent.click(activityButtons[activityButtons.length - 1]);
    const activityCenter = await screen.findByRole("dialog", { name: "Activity" });
    expect(activityCenter).toHaveTextContent("Spotify public catalog connected");
    expect(activityCenter).not.toHaveTextContent("Needs you");
    expect(activityCenter).not.toHaveTextContent("Background activity");

    fireEvent.click(within(activityCenter).getByRole("button", { name: "Close Activity Center" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings." })).toBeInTheDocument();
    expect(screen.getByAltText("Nova Vale artist image")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Account" }));
    expect(screen.getByLabelText("Email address")).toHaveValue("artist@example.com");
    expect(screen.getByLabelText("Email address")).toHaveAttribute("readonly");''',
)

replace_tail(
    "renders a generated Manager-language Today's Brief and refreshes it from saved sources",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    expect(screen.getByText(initialBrief.headlineRead)).toBeInTheDocument();
    expect(screen.getByTestId("desk-signal-metric-strip")).toBeInTheDocument();
    expect(screen.getAllByTestId("desk-signal-metric")).toHaveLength(2);
    expect(screen.getByText("1.21M")).toBeInTheDocument();
    expect(screen.getByText("London")).toBeInTheDocument();
    expect(screen.getByText("UK rank")).toBeInTheDocument();
    expect(screen.queryByText(initialBrief.snapshotSummary)).not.toBeInTheDocument();
    expect(screen.getByTestId("desk-manager-read")).toHaveTextContent("The UK is not a growth experiment");
    expect(screen.queryByText("Evidence read")).not.toBeInTheDocument();
    expect(screen.queryByText("Artist Score is a broad strength input for the Manager read, not a separate visible section.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View evidence" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("form", { name: "Ask your manager" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Generate setup map" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh public context" })).not.toBeInTheDocument();
    expect(screen.queryByText(initialBrief.sourceLine)).not.toBeInTheDocument();
    expect(screen.queryByText(/Generated by AI Manager/i)).not.toBeInTheDocument();
    expect(screen.getByText("Today's Brief")).toBeInTheDocument();
    expect(screen.queryByText("What I'm seeing")).not.toBeInTheDocument();
    expect(screen.queryByText("Today's Directive")).not.toBeInTheDocument();
    expect(screen.queryByText("Still missing")).not.toBeInTheDocument();

    expect(generationModes).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Refresh Today's Brief" }));
    await waitFor(() => expect(generationModes).toEqual(["operating"]));
    expect(await screen.findByText(refreshedBrief.headlineRead)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Ask Manager about anything in this workspace"), {
      target: { value: "What should I do with the UK signal today?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send manager question" }));
    expect(await screen.findByRole("heading", { name: "What should I do with the UK signal today?", exact: true })).toBeInTheDocument();
    expect(generationModes).toEqual(["operating"]);''',
)

replace_tail(
    "keeps Today's Attention in the active visual mode instead of inverting the primary card",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    expect(screen.queryByTestId("desk-desktop-attention-rail")).not.toBeInTheDocument();
    const rightNow = screen.getByTestId("desk-right-now");
    expect(rightNow).toHaveTextContent("Right now");
    expect(rightNow).toHaveTextContent("Catalog import running");
    expect(rightNow).not.toHaveTextContent("No action needed");
    const action = within(rightNow).getByRole("button", { name: "Open Catalog import running" });
    expect(action.className).not.toContain("bg-foreground text-background");''',
)

replace_tail(
    "turns Desk HQ command brief clicks into Manager and mission destinations without exposing the old command strip",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Music Focus.*Jam.*Open record read/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mission Path.*1 active.*Turn read into work/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Team Agents.*5 specialist desks.*Open operating team/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("form", { name: "Ask your manager" })).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText("Ask Manager about anything in this workspace"), {
      target: { value: "Turn this into a manager conversation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send manager question" }));
    expect(await screen.findByRole("heading", { name: "Turn this into a manager conversation", exact: true })).toBeInTheDocument();''',
)

replace_tail(
    "keeps Desk HQ artist-facing sections compact and low-overload",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    const managerRead = screen.getByTestId("desk-manager-read");
    expect(managerRead.className).not.toContain("manager-read-card");
    expect(managerRead.className).not.toContain("border-l-brand-accent");
    expect(screen.queryByTestId("desk-agent-card")).not.toBeInTheDocument();
    expect(screen.queryByText("A compact operating team for decisions, rollout, rights, deals, and live work.")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("desk-focus-mission-card")).toHaveLength(0);
    expect(screen.queryByText(/This long mission description/)).not.toBeInTheDocument();
    expect(screen.queryByText("Open mission")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("desk-signal-metric").length).toBeLessThanOrEqual(4);
    expect(screen.getAllByRole("form", { name: "Ask your manager" })).toHaveLength(1);''',
)

replace_tail(
    "puts mobile Desk HQ attention and movement behind a notification sheet",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    expect(screen.queryByTestId("desk-mobile-home")).not.toBeInTheDocument();
    expect(screen.queryByTestId("desk-mobile-generate-brief")).not.toBeInTheDocument();
    expect(screen.getAllByRole("form", { name: "Ask your manager" })).toHaveLength(1);
    expect(screen.queryByRole("form", { name: "Ask your manager on mobile" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask Manager about anything in this workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("desk-mobile-command-row")).not.toBeInTheDocument();
    expect(screen.queryByTestId("desk-desktop-attention-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-app-topbar")).toHaveClass("backdrop-blur-xl");
    expect(screen.getByTestId("mobile-tabbar")).toHaveClass("inset-x-0", "border-t");
    expect(screen.getByTestId("mobile-tab-label-Home")).toHaveTextContent("Home");
    expect(screen.queryByTestId("mobile-tab-label-Settings")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mobile-notification-trigger"));
    const notificationSheet = await screen.findByRole("dialog", { name: "Activity" });
    expect(notificationSheet).toHaveTextContent("Spotify public catalog connected");
    expect(notificationSheet).not.toHaveTextContent("Needs you");
    expect(notificationSheet).not.toHaveTextContent("Background activity");
    expect(notificationSheet).not.toHaveTextContent("Private analytics missing");''',
)

replace_tail(
    "keeps Desk HQ movement compact and moves older activity into history",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    const rightNow = screen.getByTestId("desk-right-now");
    expect(rightNow).toHaveTextContent("Right now");
    expect(rightNow).toHaveTextContent("Commission Data Lead power check");
    expect(screen.queryByText(longMovement)).not.toBeInTheDocument();
    expect(screen.queryByText("Started Chartmetric enrichment for GBESUNMO.")).not.toBeInTheDocument();

    const activityButtons = screen.getAllByRole("button", { name: /Open Activity Center/i });
    fireEvent.click(activityButtons[activityButtons.length - 1]);
    const activityCenter = await screen.findByRole("dialog", { name: "Activity" });
    expect(activityCenter).not.toHaveTextContent("Needs you");
    expect(activityCenter).not.toHaveTextContent("Background activity");
    expect(activityCenter).toHaveTextContent(longMovement);
    expect(activityCenter).toHaveTextContent("Started Chartmetric enrichment for GBESUNMO.");''',
)

replace_tail(
    "keeps mobile Desk HQ useful with titled expandable manager read, paragraphs, full metrics, and team agents",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    expect(screen.getAllByRole("form", { name: "Ask your manager" })).toHaveLength(1);
    expect(screen.queryByRole("form", { name: "Ask your manager on mobile" })).not.toBeInTheDocument();
    expect(screen.queryByText(richBrief.snapshotSummary)).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();

    const read = screen.getByTestId("desk-manager-read");
    expect(read.className).not.toContain("manager-read-card");
    expect(read.className).not.toContain("border-l-brand-accent");
    expect(read).toHaveTextContent("Manager's Read");
    expect(read).toHaveTextContent(managerReadEnding);
    expect(read).not.toHaveTextContent("EV-204");
    expect(read).not.toHaveTextContent("evidence-1");
    expect(screen.getAllByTestId("desk-manager-read-segment")).toHaveLength(4);
    expect(within(read).getByText("01")).toBeInTheDocument();
    expect(within(read).getByText("04")).toBeInTheDocument();

    const metrics = screen.getByTestId("desk-signal-metric-strip");
    expect(within(metrics).getAllByTestId("desk-signal-metric")).toHaveLength(4);
    expect(metrics).toHaveTextContent("1.21M");
    expect(metrics).toHaveTextContent("#4");
    expect(metrics).toHaveTextContent("$3K");
    expect(metrics).toHaveTextContent("18");
    expect(within(metrics).queryByText("Skip rate")).not.toBeInTheDocument();
    expect(screen.queryByTestId("desk-agent-card")).not.toBeInTheDocument();''',
)

replace_tail(
    "renders saved Today's Brief copy instead of dropping it for style-policy terms",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    expect(screen.getByText(savedBrief.headlineRead)).toBeInTheDocument();
    expect(screen.getByTestId("desk-manager-read")).toHaveTextContent("London");
    expect(screen.getAllByRole("form", { name: "Ask your manager" })).toHaveLength(1);
    expect(screen.queryByText(/generation failed/i)).not.toBeInTheDocument();''',
)

replace_tail(
    "expands a long Manager's Read at paragraph boundaries without losing the full read",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    expect(screen.getByText(longBrief.headlineRead)).toBeInTheDocument();
    expect(screen.queryByText(longBrief.snapshotSummary)).not.toBeInTheDocument();
    expect(screen.queryByText(finalParagraph)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "See full Manager's Read" })).not.toBeInTheDocument();
    const read = screen.getByTestId("desk-manager-read");
    expect(screen.getAllByTestId("desk-manager-read-segment")).toHaveLength(4);
    expect(read).toHaveTextContent("Lagos is the first operating center");
    expect(read).toHaveTextContent("M$NEY has enough playlist surface");
    expect(read).not.toHaveTextContent(finalParagraph);''',
)

replace_tail(
    "keeps Artist Intelligence metric labels and values readable instead of truncating them",
    '''    expect(await screen.findAllByRole("heading", { name: "Home" }).then(([heading]) => heading)).toBeInTheDocument();
    const intelligenceStrip = screen.getByTestId("desk-signal-metric-strip");
    expect(intelligenceStrip).toHaveTextContent("Track score - Make Them Run");
    expect(intelligenceStrip).toHaveTextContent("Top TikTok video - Make Them Run");
    expect(intelligenceStrip).toHaveTextContent("1.3M views");
    expect(within(intelligenceStrip).getByText("Track score - Make Them Run")).toHaveClass("break-words");
    expect(within(intelligenceStrip).getByText("97.886")).toHaveClass("break-words");
    expect(screen.getByTestId("desk-manager-read")).not.toHaveTextContent("Treat this as track-level exposure context");
    expect(screen.queryByText("Evidence read")).not.toBeInTheDocument();''',
)

legacy_positive = [
    'getByTestId("desk-mobile-home")',
    'getByTestId("desk-mobile-manager-read',
    'getByTestId("desk-desktop-manager-read',
    'getByTestId("desk-todays-focus',
    'getByTestId("desk-manager-read-card',
    'getAllByTestId("desk-signal-metric-card',
]
for pattern in legacy_positive:
    if pattern in text:
        raise SystemExit(f"legacy positive Home assertion remains: {pattern}")

text = text.replace(
    'it("keeps mobile Desk HQ useful with titled expandable manager read, paragraphs, full metrics, and team agents",',
    'it("keeps the unified Home read complete without desktop/mobile duplication",',
    1,
)
text = text.replace(
    'it("puts mobile Desk HQ attention and movement behind a notification sheet",',
    'it("keeps mobile Activity access in global chrome without duplicating Home",',
    1,
)

path.write_text(text)
