from pathlib import Path

path = Path("src/features/manager/ManagerScreensLegacy.tsx")
text = path.read_text()

old = '''  return (
    <WorkspaceShell eyebrow="Manager" title="Manager's Office" onBack={onBack} variant="conversation" backLabel="Back to Desk HQ">
      <div data-testid="manager-office-content" className="mx-auto w-full max-w-[48rem] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-0">
        <MissionGenesisManagerPanel
          result={missionGenesisResult}
          answers={missionGenesisAnswers}
          pending={missionGenesisPending}
          error={missionGenesisError}
          onAnswerChange={onMissionGenesisAnswerChange}
          onSubmit={onSubmitMissionGenesisAnswers}
          onOpenCreatedMission={onOpenCreatedMission}
        />
        <section>
              <div>
                <h2 className="text-[14px] font-semibold text-foreground">What do you want to work on?</h2>
                <div className="relative mt-3 overflow-hidden rounded-[1.5rem] border border-foreground/12 bg-background shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                  <textarea
                    value={askText}
                    onChange={(event) => setAskText(event.target.value)}
                    placeholder="Ask the Manager for a directive or review..."
                    aria-label="Ask the Manager"
                    className="min-h-[118px] w-full resize-none bg-transparent p-4 pr-16 font-ui text-[15px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:bg-background sm:p-5"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const body = askText.trim();
                      if (!body) return;
                      onAskManager(body);
                      setAskText("");
                    }}
                    disabled={!askText.trim() || askManagerPending}
                    aria-label="Ask Manager"
                    className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/85 disabled:opacity-25 sm:bottom-4 sm:right-4"
                  >
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                {askManagerError ? <p role="alert" className="mt-3 text-[12px] font-semibold text-red-700">{askManagerError}</p> : null}
                {askManagerPending ? <p className="mt-3 text-[12px] text-muted-foreground">Manager is reading your workspace.</p> : null}
              </div>
        </section>

        {conversations.length > 0 ? <section className="mt-10">
              <h2 className="mb-2 px-2 text-[13px] font-semibold text-foreground">Conversations</h2>
              <div className="flex flex-col">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    aria-label={conversation.topic}
                    className="group flex min-h-12 items-center gap-4 rounded-xl px-2 py-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/35"
                    onClick={() => onConversation(conversation)}
                  >
                    <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">{conversation.topic}</p>
                    {conversation.lastUpdate ? <span className="shrink-0 text-[12px] text-muted-foreground/65">{formatConversationTimestamp(conversation.lastUpdate)}</span> : null}
                  </button>
                ))}
              </div>
        </section> : null}
      </div>
    </WorkspaceShell>
  );'''

new = '''  return (
    <WorkspaceShell eyebrow="Manager" title="Manager's Office" onBack={onBack} variant="conversation" backLabel="Back to Desk HQ">
      <div data-testid="manager-office-content" className="w-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-6 xl:px-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:gap-10">
          <main className="min-w-0">
            <MissionGenesisManagerPanel
              result={missionGenesisResult}
              answers={missionGenesisAnswers}
              pending={missionGenesisPending}
              error={missionGenesisError}
              onAnswerChange={onMissionGenesisAnswerChange}
              onSubmit={onSubmitMissionGenesisAnswers}
              onOpenCreatedMission={onOpenCreatedMission}
            />
            <section className="max-w-[64rem]">
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/62">Workspace</p>
                    <h2 className="mt-1 font-display text-[20px] font-semibold tracking-[-0.025em] text-foreground">What do you want to work on?</h2>
                  </div>
                  <p className="hidden max-w-[24rem] text-right text-[12px] leading-relaxed text-muted-foreground/68 md:block">Ask for a decision, review, plan, document, or next move. Manager keeps the work tied to this artist workspace.</p>
                </div>
                <div className="relative mt-4 overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background shadow-[0_12px_36px_rgba(0,0,0,0.055)] transition-shadow focus-within:border-foreground/18 focus-within:shadow-[0_16px_44px_rgba(0,0,0,0.075)]">
                  <textarea
                    value={askText}
                    onChange={(event) => setAskText(event.target.value)}
                    placeholder="Ask the Manager for a directive or review..."
                    aria-label="Ask the Manager"
                    className="min-h-[164px] w-full resize-none bg-transparent p-5 pr-16 font-ui text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50 sm:min-h-[178px] sm:p-6 sm:pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const body = askText.trim();
                      if (!body) return;
                      onAskManager(body);
                      setAskText("");
                    }}
                    disabled={!askText.trim() || askManagerPending}
                    aria-label="Ask Manager"
                    className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background transition-all hover:scale-[1.03] hover:bg-foreground/88 disabled:scale-100 disabled:opacity-25 sm:bottom-5 sm:right-5"
                  >
                    <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                </div>
                {askManagerError ? <p role="alert" className="mt-3 text-[12px] font-semibold text-red-700">{askManagerError}</p> : null}
                {askManagerPending ? <p className="mt-3 text-[12px] text-muted-foreground">Manager is reading your workspace.</p> : null}
              </div>
            </section>
          </main>

          {conversations.length > 0 ? (
            <aside className="min-w-0 border-t border-foreground/8 pt-6 xl:sticky xl:top-6 xl:self-start xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <div className="flex items-end justify-between gap-3 px-1">
                <div>
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/58">History</p>
                  <h2 className="mt-1 text-[14px] font-semibold text-foreground">Conversations</h2>
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground/55">{conversations.length}</span>
              </div>
              <div className="mt-3 flex flex-col">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    aria-label={conversation.topic}
                    className="group flex min-h-[3.4rem] items-center gap-3 rounded-[12px] px-2.5 py-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/35"
                    onClick={() => onConversation(conversation)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground/92">{conversation.topic}</p>
                      {conversation.lastUpdate ? <span className="mt-1 block text-[11px] text-muted-foreground/58">{formatConversationTimestamp(conversation.lastUpdate)}</span> : null}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground/65" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </WorkspaceShell>
  );'''

if old not in text:
    raise SystemExit("Manager Office layout anchor changed; refusing partial patch")

path.write_text(text.replace(old, new, 1))
