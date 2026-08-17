from pathlib import Path

path = Path('src/production-app-shell.test.tsx')
text = path.read_text()
old = '''  it("keeps the nested mobile back row at the top and omits empty conversation history", () => {
    render(
      <ManagerOfficeScreen
        conversations={[]}
        missionGenesisResult={null}
        missionGenesisAnswers={{}}
        missionGenesisPending={false}
        missionGenesisError={null}
        onMissionGenesisAnswerChange={vi.fn()}
        onSubmitMissionGenesisAnswers={vi.fn()}
        onOpenCreatedMission={vi.fn()}
        onBack={vi.fn()}
        onConversation={vi.fn()}
        onAskManager={vi.fn()}
        askManagerPending={false}
        askManagerError={null}
      />,
    );

    expect(screen.getByRole("button", { name: "Back to Desk HQ" }).parentElement?.parentElement).toHaveClass("top-0");
    expect(screen.queryByText("Conversation History")).not.toBeInTheDocument();
  });'''
new = '''  it("keeps Manager Office top-level and omits obsolete nested navigation", () => {
    render(
      <ManagerOfficeScreen
        conversations={[]}
        missionGenesisResult={null}
        missionGenesisAnswers={{}}
        missionGenesisPending={false}
        missionGenesisError={null}
        onMissionGenesisAnswerChange={vi.fn()}
        onSubmitMissionGenesisAnswers={vi.fn()}
        onOpenCreatedMission={vi.fn()}
        onBack={vi.fn()}
        onConversation={vi.fn()}
        onAskManager={vi.fn()}
        askManagerPending={false}
        askManagerError={null}
      />,
    );

    expect(screen.getByRole("heading", { name: "Manager's Office" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to Desk HQ" })).not.toBeInTheDocument();
    expect(screen.queryByText("Conversation History")).not.toBeInTheDocument();
  });'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected one obsolete Manager Office mobile-back test, found {count}')
path.write_text(text.replace(old, new, 1))
print('Migrated Manager Office navigation contract.')
