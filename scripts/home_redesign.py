from pathlib import Path


def replace_between(text: str, start: str, end: str, replacement: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f"Missing start marker: {start}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f"Missing end marker: {end}")
    return text[:start_index] + replacement.rstrip() + "\n\n" + text[end_index:]


path = Path("src/features/desk/DeskHQ.tsx")
text = path.read_text()

screen = r'''export function DeskHQScreen({
  profile,
  todayBrief,
  todayBriefError,
  attention,
  movement,
  agents,
  missions,
  music,
  onNavigate,
  onManager,
  onOpenMission,
  onLockedAgent,
  onDrawer,
  onOpenMusicFocus,
  onAskManager,
  activityCount,
  onOpenActivityCenter,
}: {
  profile: ArtistProfileViewModel;
  todayBrief: TodayBriefViewModel | null;
  todayBriefError: string | null;
  attention: AttentionItem[];
  movement: MovementItem[];
  agents: AgentViewModel[];
  missions: MissionViewModel[];
  music: MusicObjectViewModel[];
  onNavigate: (view: CleanProductionView) => void;
  onManager: () => void;
  onOpenMission: (missionId: string) => void;
  onLockedAgent: (agent: AgentViewModel) => void;
  onDrawer: (drawer: DrawerKind) => void;
  onOpenMusicFocus: (musicObjectId?: string) => void;
  onAskManager: (body: string) => void;
  activityCount?: number;
  onOpenActivityCenter?: () => void;
}) {
  const { actionable } = splitAttentionItems(attention);
  const brief = todayBrief ?? buildVisibleFallbackBrief(profile);
  const focusLead = selectTodaysFocusLead({ actionable, movement });
  const visibleActivityCount = activityCount ?? actionable.length + movement.length;

  return (
    <section className="home-workspace relative isolate min-w-0">
      <div className="hidden lg:block">
        <DeskHQHeader
          activityCount={visibleActivityCount}
          onOpenActivityCenter={onOpenActivityCenter ?? (() => undefined)}
          onAskManager={onAskManager}
        />

        <div className="grid min-w-0 gap-10 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
          <main className="min-w-0">
            <DeskCommandBrief
              profile={profile}
              brief={brief}
              error={todayBriefError}
              onDrawer={onDrawer}
            />
            <TodayBrief
              profile={profile}
              brief={brief}
              error={todayBriefError}
              onDrawer={onDrawer}
            />
          </main>

          <TodayFocusPanel
            lead={focusLead}
            missions={missions}
            onOpenMission={onOpenMission}
            onNavigate={onNavigate}
            onDrawer={onDrawer}
          />
        </div>
      </div>

      <MobileDeskHome
        profile={profile}
        brief={brief}
        error={todayBriefError}
        lead={focusLead}
        missions={missions}
        onNavigate={onNavigate}
        onOpenMission={onOpenMission}
        onDrawer={onDrawer}
        onAskManager={onAskManager}
        activityCount={visibleActivityCount}
        onOpenActivityCenter={onOpenActivityCenter ?? (() => undefined)}
      />
    </section>
  );
}'''
text = replace_between(text, "export function DeskHQScreen({", "function DeskHQHeader", screen)

header = r'''function DeskHQHeader({
  activityCount,
  onOpenActivityCenter,
  onAskManager,
}: {
  activityCount: number;
  onOpenActivityCenter: () => void;
  onAskManager: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const canSend = draft.trim().length > 0;

  function submitManagerQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    onAskManager(draft);
    setDraft("");
  }

  return (
    <header className="mb-8 border-b border-foreground/8 pb-5">
      <div className="flex min-w-0 items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Artist workspace</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.035em] text-foreground">Home</h1>
        </div>
        <button
          type="button"
          aria-label={activityCount ? `Open Activity Center, ${activityCount} unread` : "Open Activity Center"}
          onClick={onOpenActivityCenter}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
        >
          <Bell className="h-[17px] w-[17px]" aria-hidden="true" />
          {activityCount ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-accent px-1 text-[9px] font-bold leading-none text-white ring-2 ring-background">
              {activityCount > 9 ? "9+" : activityCount}
            </span>
          ) : null}
        </button>
      </div>

      <form
        aria-label="Ask your manager"
        className="mt-5 flex max-w-[48rem] items-start gap-2 border-b border-foreground/12 py-2 transition-colors focus-within:border-brand-accent/45"
        onSubmit={submitManagerQuestion}
      >
        <MessageSquareText className="mt-[9px] h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
        <textarea
          value={draft}
          rows={1}
          onChange={(event) => setDraft(event.target.value)}
          onInput={(event) => {
            const el = event.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 84)}px`;
          }}
          placeholder="Ask Manager about anything in this workspace"
          className="min-w-0 flex-1 resize-none bg-transparent py-[7px] text-[13px] font-medium leading-[1.4] text-foreground outline-none placeholder:text-muted-foreground/58"
          style={{ maxHeight: "84px", overflowY: "auto" }}
        />
        <button
          type="submit"
          aria-label="Send manager question"
          disabled={!canSend}
          className="mt-[3px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/86 disabled:bg-foreground/[0.06] disabled:text-muted-foreground/35"
        >
          <SendHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </form>
    </header>
  );
}'''
text = replace_between(text, "function DeskHQHeader({", "function DeskCommandBrief", header)

brief = r'''function DeskCommandBrief({
  profile,
  brief,
  error,
  onDrawer,
}: {
  profile: ArtistProfileViewModel;
  brief: TodayBriefViewModel;
  error: string | null;
  onDrawer: (drawer: DrawerKind) => void;
}) {
  const compactMetrics = buildDeskMetricTiles(brief, profile);

  return (
    <section data-testid="desk-editorial-brief" className="border-b border-foreground/8 pb-8">
      <div className="flex min-w-0 items-center gap-3">
        {profile.imageUrl ? (
          <img className="h-11 w-11 shrink-0 rounded-[12px] object-cover ring-1 ring-foreground/10" src={profile.imageUrl} alt={`${profile.name} artist image`} />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-foreground/10 bg-foreground/[0.025] text-[12px] font-bold text-muted-foreground">
            {profile.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-accent">Today</p>
          <p className="truncate text-[13px] font-medium text-muted-foreground">{profile.name} at a glance</p>
        </div>
      </div>

      <p
        className="mt-6 max-w-[60rem] font-display font-semibold leading-[1.04] tracking-[-0.04em] text-foreground"
        style={{ fontSize: "clamp(30px, 3vw, 44px)" }}
      >
        {brief.headlineRead}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button type="button" className="text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground" onClick={() => onDrawer("evidence")}>
          View evidence
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/58">Prepared {formatBriefGeneratedAt(brief.generatedAt)}</span>
      </div>

      {error ? <p className="mt-5 border-l-2 border-warning pl-3 text-[12px] font-medium leading-relaxed text-warning">{error}</p> : null}
      <SignalMetricStrip metrics={compactMetrics} />
    </section>
  );
}'''
text = replace_between(text, "function DeskCommandBrief({", "type DeskSignalMetric", brief)

# Make the existing metric rail denser and preserve the metric context without introducing cards.
text = text.replace('className="min-h-[94px] bg-transparent px-4 py-5 first:pl-0 last:pr-0"', 'className="min-h-[88px] bg-transparent px-4 py-4 first:pl-0 last:pr-0"')
text = text.replace('<p className="mt-2 break-words text-[24px] font-semibold leading-none tracking-normal text-foreground">{value}</p>\n    </article>', '<p className="mt-2 break-words text-[21px] font-semibold leading-none tracking-[-0.015em] text-foreground">{value}</p>\n      {metric.context ? <p className="mt-1.5 break-words text-[10px] font-medium leading-snug text-muted-foreground/62">{metric.context}</p> : null}\n    </article>')

focus = r'''function TodayFocusPanel({
  lead,
  missions,
  onOpenMission,
  onNavigate,
  onDrawer,
}: {
  lead: TodaysFocusLead;
  missions: MissionViewModel[];
  onOpenMission: (missionId: string) => void;
  onNavigate: (view: CleanProductionView) => void;
  onDrawer: (drawer: DrawerKind) => void;
}) {
  const visibleMissions = missions
    .filter((mission) => mission.status === "active" || mission.status === "blocked" || mission.status === "review")
    .slice(0, 3);
  const LeadIcon =
    lead.tone === "achievement" ? Sparkles
    : lead.tone === "warning" ? ClipboardCheck
    : lead.tone === "clear" ? CheckCircle2
    : Clock3;

  const leadContent = (
    <div className="flex items-start gap-3">
      <LeadIcon className={`mt-0.5 h-4 w-4 shrink-0 ${focusLeadIconClass(lead.tone)}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/62">{lead.label}</p>
        <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-foreground">{lead.title}</h3>
        <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">{lead.body}</p>
      </div>
    </div>
  );

  return (
    <aside data-testid="desk-todays-focus" className="min-w-0 self-start border-l border-foreground/8 pl-6 xl:sticky xl:top-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Right now</p>
          <p className="mt-1 text-[12px] font-medium text-muted-foreground/62">What deserves attention first.</p>
        </div>
        <button type="button" className="text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground" onClick={() => onNavigate("missionsWorkspace")}>
          All work
        </button>
      </div>

      {lead.item ? (
        <button
          type="button"
          data-testid="desk-todays-focus-lead"
          aria-label={lead.title}
          onClick={() => openAttentionItem(lead.item!, onNavigate, onDrawer)}
          className={`mt-5 block w-full border-l-2 py-1 pl-4 text-left transition-colors hover:bg-foreground/[0.02] focus:outline-none focus:ring-2 focus:ring-brand-accent/20 ${focusLeadBorderClass(lead.tone)}`}
        >
          {leadContent}
        </button>
      ) : (
        <div data-testid="desk-todays-focus-lead" className={`mt-5 border-l-2 py-1 pl-4 ${focusLeadBorderClass(lead.tone)}`}>
          {leadContent}
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-end justify-between gap-3 border-b border-foreground/8 pb-2.5">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Missions</p>
          {visibleMissions.length ? <span className="text-[10px] font-semibold text-muted-foreground/55">{visibleMissions.length} active</span> : null}
        </div>
        {visibleMissions.length ? (
          <div className="divide-y divide-foreground/8">
            {visibleMissions.map((mission) => (
              <button
                key={mission.id}
                type="button"
                data-testid="desk-focus-mission-card"
                aria-label={`Open focus mission ${mission.title}`}
                className="group block w-full py-4 text-left transition-colors hover:bg-foreground/[0.018] focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
                onClick={() => onOpenMission(mission.id)}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-ui text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
                      {mission.status === "blocked" ? "Needs you" : mission.status === "review" ? "In review" : "Active"}
                    </span>
                    <span className="mt-1.5 block text-[13px] font-semibold leading-snug text-foreground">{mission.title}</span>
                    <span className="mt-1 block text-[11px] font-medium leading-relaxed text-muted-foreground">{mission.nextTask}</span>
                  </span>
                  <span className="w-11 shrink-0 pt-0.5 text-right">
                    <span className="block text-[10px] font-bold text-foreground">{mission.progress}%</span>
                    <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-foreground/8">
                      <span className="block h-full rounded-full bg-brand-accent" style={{ width: `${mission.progress}%` }} />
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="block w-full border-b border-foreground/8 py-4 text-left" onClick={() => onNavigate("missionsWorkspace")}>
            <span className="block text-[13px] font-semibold text-foreground">No active mission yet</span>
            <span className="mt-1 block text-[11px] font-medium text-muted-foreground">Turn today&apos;s read into the first mission.</span>
          </button>
        )}
      </div>
    </aside>
  );
}'''
text = replace_between(text, "function TodayFocusPanel({", "function openAttentionItem", focus)

mobile = r'''function MobileDeskHome({
  profile,
  brief,
  error,
  lead,
  missions,
  onNavigate,
  onOpenMission,
  onDrawer,
  onAskManager,
  activityCount,
  onOpenActivityCenter,
}: {
  profile: ArtistProfileViewModel;
  brief: TodayBriefViewModel;
  error: string | null;
  lead: TodaysFocusLead;
  missions: MissionViewModel[];
  onNavigate: (view: CleanProductionView) => void;
  onOpenMission: (missionId: string) => void;
  onDrawer: (drawer: DrawerKind) => void;
  onAskManager: (body: string) => void;
  activityCount: number;
  onOpenActivityCenter: () => void;
}) {
  const compactMetrics = buildDeskMetricTiles(brief, profile);
  const managerReadSegments = buildManagerReadSegments(brief);
  const visibleMissions = missions
    .filter((mission) => mission.status === "active" || mission.status === "blocked" || mission.status === "review")
    .slice(0, 3);
  const LeadIcon =
    lead.tone === "achievement" ? Sparkles
    : lead.tone === "warning" ? ClipboardCheck
    : lead.tone === "clear" ? CheckCircle2
    : Clock3;

  const mobileLead = (
    <div className="flex min-w-0 items-start gap-3">
      <LeadIcon className={`mt-0.5 h-4 w-4 shrink-0 ${focusLeadIconClass(lead.tone)}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-ui text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">{lead.label}</p>
        <p className="mt-1 text-[14px] font-semibold leading-snug text-foreground">{lead.title}</p>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground">{lead.body}</p>
      </div>
    </div>
  );

  return (
    <div data-testid="desk-mobile-home" className="grid w-full min-w-0 gap-0 pb-4 lg:hidden">
      <header className="flex items-center justify-between border-b border-foreground/8 pb-3">
        <div>
          <p className="font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/65">Artist workspace</p>
          <h1 className="mt-1 font-display text-[25px] font-semibold leading-none tracking-[-0.035em] text-foreground">Home</h1>
        </div>
        <button
          type="button"
          aria-label={activityCount ? `Open Activity Center, ${activityCount} unread` : "Open Activity Center"}
          onClick={onOpenActivityCenter}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {activityCount ? <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[8px] font-bold text-white ring-2 ring-background">{activityCount > 9 ? "9+" : activityCount}</span> : null}
        </button>
      </header>

      <MobileManagerComposer onAskManager={onAskManager} />

      <section data-testid="desk-mobile-command-surface" className="border-b border-foreground/8 py-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {profile.imageUrl ? (
            <img className="h-9 w-9 shrink-0 rounded-[10px] object-cover ring-1 ring-foreground/10" src={profile.imageUrl} alt={`${profile.name} artist image`} />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-foreground/10 bg-foreground/[0.025] text-[11px] font-bold text-muted-foreground">
              {profile.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-brand-accent">Today</p>
            <p className="truncate text-[12px] font-medium text-muted-foreground">{profile.name} at a glance</p>
          </div>
        </div>

        <p className="mt-4 max-w-full break-words font-display text-[24px] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground [overflow-wrap:anywhere]">{brief.headlineRead}</p>
        <button type="button" className="mt-3 text-[11px] font-semibold text-muted-foreground" onClick={() => onDrawer("evidence")}>
          View evidence
        </button>

        {compactMetrics.length ? (
          <div data-testid="desk-mobile-signal-rail" className="mt-5 min-w-0 max-w-full">
            <div data-testid="desk-mobile-metrics-grid" className="grid min-w-0 max-w-full grid-cols-2 border-y border-foreground/8">
              {compactMetrics.map((metric, index) => (
                <article
                  key={`${metric.label}-${metric.value}-${index}`}
                  data-testid="desk-mobile-metric-card"
                  className={`min-h-[78px] min-w-0 py-3 ${index % 2 === 0 ? "border-r border-foreground/8 pr-3" : "pl-3"} ${index < 2 ? "border-b border-foreground/8" : ""}`}
                >
                  <p className="break-words text-[9px] font-semibold leading-tight text-muted-foreground [overflow-wrap:anywhere]">{metric.label}</p>
                  <p className="mt-1.5 break-words text-[18px] font-semibold leading-none tracking-[-0.015em] text-foreground [overflow-wrap:anywhere]">{metric.value}</p>
                  {metric.context ? <p className="mt-1 break-words text-[9px] font-medium leading-snug text-muted-foreground/58 [overflow-wrap:anywhere]">{metric.context}</p> : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}
        {error ? <p className="mt-4 border-l-2 border-warning pl-3 text-[11px] font-medium leading-relaxed text-warning">{error}</p> : null}
      </section>

      <section data-testid="desk-mobile-right-now" className="border-b border-foreground/8 py-5">
        <p className="font-ui text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/65">Right now</p>
        {lead.item ? (
          <button type="button" aria-label={lead.title} className={`mt-3 block w-full border-l-2 py-0.5 pl-3 text-left ${focusLeadBorderClass(lead.tone)}`} onClick={() => openAttentionItem(lead.item!, onNavigate, onDrawer)}>
            {mobileLead}
          </button>
        ) : (
          <div className={`mt-3 border-l-2 py-0.5 pl-3 ${focusLeadBorderClass(lead.tone)}`}>{mobileLead}</div>
        )}
      </section>

      <section data-testid="desk-mobile-current-work" className="border-b border-foreground/8 py-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-ui text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/65">Missions</p>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground/60">{visibleMissions.length ? `${visibleMissions.length} active` : "Nothing active"}</p>
          </div>
          <button type="button" className="text-[11px] font-semibold text-muted-foreground" onClick={() => onNavigate("missionsWorkspace")}>
            View all
          </button>
        </div>
        {visibleMissions.length ? (
          <div className="mt-2 divide-y divide-foreground/8">
            {visibleMissions.map((mission) => (
              <button
                key={mission.id}
                type="button"
                className="block w-full py-3.5 text-left transition-colors hover:bg-foreground/[0.018]"
                aria-label={`Open mission ${mission.title} on mobile`}
                onClick={() => onOpenMission(mission.id)}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.06em] text-muted-foreground/60">
                      {mission.status === "blocked" ? "Needs you" : mission.status === "review" ? "In review" : "Active"}
                    </span>
                    <span className="mt-1 block text-[13px] font-semibold leading-snug text-foreground">{mission.title}</span>
                    <span className="mt-1 block text-[10px] font-medium leading-relaxed text-muted-foreground">{mission.nextTask}</span>
                  </span>
                  <span className="w-[52px] shrink-0 pt-0.5 text-right">
                    <span className="block text-[10px] font-bold text-foreground">{mission.progress}%</span>
                    <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-foreground/8"><span className="block h-full rounded-full bg-brand-accent" style={{ width: `${mission.progress}%` }} /></span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="mt-3 block w-full border-y border-foreground/8 py-3 text-left" onClick={() => onNavigate("missionsWorkspace")}>
            <span className="block text-[12px] font-semibold text-foreground">No active mission yet</span>
            <span className="mt-1 block text-[10px] font-medium text-muted-foreground">Turn today&apos;s read into the first mission.</span>
          </button>
        )}
      </section>

      <section className="py-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-ui text-[9px] font-semibold uppercase tracking-[0.1em] text-brand-accent">Manager&apos;s Read</p>
          <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/55">4 signals</span>
        </div>
        <div data-testid="desk-mobile-manager-read-card" className="mt-3 min-w-0 max-w-full">
          <div data-testid="desk-mobile-manager-read" className="min-w-0 max-w-full divide-y divide-foreground/8 border-y border-foreground/8">
            {managerReadSegments.map((segment, index) => (
              <article key={`${segment.label}-${index}`} data-testid="desk-mobile-manager-read-segment" className="grid min-w-0 max-w-full grid-cols-[1.8rem_minmax(0,1fr)] gap-2.5 py-3.5">
                <span className="font-mono text-[9px] font-bold leading-5 text-muted-foreground/52">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 max-w-full">
                  <span className="block break-words font-ui text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70 [overflow-wrap:anywhere]">{segment.label}</span>
                  <p className="mt-1.5 break-words text-[11px] font-medium leading-[1.7] text-foreground/82 [overflow-wrap:anywhere]">{segment.body}</p>
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}'''
text = replace_between(text, "function MobileDeskHome({", "function MobileManagerComposer", mobile)

mobile_composer = r'''function MobileManagerComposer({ onAskManager }: { onAskManager: (body: string) => void }) {
  const [draft, setDraft] = useState("");
  const canSend = draft.trim().length > 0;

  function submitManagerQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    onAskManager(draft);
    setDraft("");
  }

  return (
    <form
      aria-label="Ask your manager on mobile"
      className="flex min-h-[42px] w-full min-w-0 items-start gap-2 border-b border-foreground/10 py-2.5 transition-colors focus-within:border-brand-accent/45"
      onSubmit={submitManagerQuestion}
    >
      <MessageSquareText className="mt-[9px] h-4 w-4 shrink-0 text-muted-foreground/65" aria-hidden="true" />
      <textarea
        value={draft}
        rows={1}
        onChange={(event) => setDraft(event.target.value)}
        onInput={(event) => {
          const el = event.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 72)}px`;
        }}
        placeholder="Ask Manager"
        className="min-w-0 flex-1 resize-none bg-transparent py-[7px] text-[13px] font-medium leading-[1.35] text-foreground outline-none placeholder:text-muted-foreground/55"
        style={{ maxHeight: "72px", overflowY: "auto" }}
      />
      <button
        type="submit"
        aria-label="Send mobile manager question"
        disabled={!canSend}
        className="mt-[3px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors disabled:bg-foreground/[0.06] disabled:text-muted-foreground/35"
      >
        <SendHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}'''
text = replace_between(text, "function MobileManagerComposer({", "function selectTodaysFocusLead", mobile_composer)

# Replace the old tinted-surface helper with restrained border/icon semantics.
old_tone_start = 'function focusLeadToneClass(tone: TodaysFocusLead["tone"]) {'
old_tone_end = '// Always exactly 4 segments displayed. No expand button, no overflow.'
tone_helpers = r'''function focusLeadBorderClass(tone: TodaysFocusLead["tone"]) {
  if (tone === "achievement") return "border-warning";
  if (tone === "warning") return "border-danger";
  if (tone === "update") return "border-brand-accent";
  return "border-foreground/18";
}

function focusLeadIconClass(tone: TodaysFocusLead["tone"]) {
  if (tone === "achievement") return "text-warning";
  if (tone === "warning") return "text-danger";
  if (tone === "update") return "text-brand-accent";
  return "text-muted-foreground";
}'''
text = replace_between(text, old_tone_start, old_tone_end, tone_helpers)

today_read = r'''function TodayBrief({
  brief,
  error,
  onDrawer,
}: {
  profile: ArtistProfileViewModel;
  brief: TodayBriefViewModel;
  error: string | null;
  onDrawer: (drawer: DrawerKind) => void;
}) {
  const managerReadSegments = buildManagerReadSegments(brief);

  return (
    <section className="pt-9">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-accent">Manager&apos;s Read</p>
          <p className="mt-1.5 text-[12px] font-medium text-muted-foreground">The deeper read behind today&apos;s priorities.</p>
        </div>
        <button type="button" className="text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground" onClick={() => onDrawer("evidence")}>
          Evidence
        </button>
      </div>

      <div data-testid="desk-manager-read-card" className="mt-4 text-foreground">
        <div data-testid="desk-desktop-manager-read" className="divide-y divide-foreground/8 border-y border-foreground/8">
          {managerReadSegments.map((segment, index) => (
            <article
              key={`${segment.label}-${index}`}
              data-testid="desk-manager-read-segment"
              className="grid min-h-[108px] grid-cols-[2.5rem_minmax(0,1fr)] gap-4 py-5"
            >
              <span className="font-mono text-[10px] font-bold leading-5 text-muted-foreground/50">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="block font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/68">{segment.label}</span>
                <p className="mt-2 max-w-[58rem] text-[13px] font-medium leading-[1.75] text-foreground/82">{segment.body}</p>
              </span>
            </article>
          ))}
        </div>
        {error ? <p className="mt-4 border-l-2 border-warning pl-3 text-[12px] font-medium leading-relaxed text-warning">{error}</p> : null}
        <p className="mt-3 text-right font-ui text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/52">Prepared {formatBriefGeneratedAt(brief.generatedAt)}</p>
      </div>
    </section>
  );
}'''
text = replace_between(text, "function TodayBrief({", "type ManagerReadSegment", today_read)

path.write_text(text)

components_path = Path("src/design-system/components.tsx")
components = components_path.read_text()
components = components.replace("ArrowLeft, Bell, ClipboardCheck, Gauge, Library", "ArrowLeft, Bell, ClipboardCheck, House, Library")
components = components.replace('{ label: "Desk HQ", active: "labelHQ", view: "labelHQ", icon: Gauge }', '{ label: "Home", active: "labelHQ", view: "labelHQ", icon: House }')
components_path.write_text(components)

print("Applied Home redesign and renamed visible Desk HQ navigation to Home")
