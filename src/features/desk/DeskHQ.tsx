import { ArrowUpRight, BriefcaseBusiness, ChevronRight, ClipboardCheck, Library, ListChecks, RefreshCw, Upload, UsersRound } from "lucide-react";
import { ProductButton, WorkspaceHeader } from "../../design-system/components";
import type {
  AgentViewModel,
  ArtistProfileViewModel,
  AttentionItem,
  CleanProductionView,
  DrawerKind,
  MissionViewModel,
  MovementItem,
  MusicObjectViewModel,
  TodayBriefViewModel,
} from "../../types/cleanProduction";

type DeskCommandItem = {
  label: string;
  value: string;
  meta: string;
  icon: typeof BriefcaseBusiness;
  onClick: () => void;
};

export function DeskHQScreen({
  profile,
  todayBrief,
  todayBriefPending,
  todayBriefError,
  attention,
  movement,
  agents,
  missions,
  music,
  onNavigate,
  onManager,
  onGenerateTodaysBrief,
  onLockedAgent,
  onDrawer,
  onOpenMusicFocus,
}: {
  profile: ArtistProfileViewModel;
  todayBrief: TodayBriefViewModel | null;
  todayBriefPending: boolean;
  todayBriefError: string | null;
  attention: AttentionItem[];
  movement: MovementItem[];
  agents: AgentViewModel[];
  missions: MissionViewModel[];
  music: MusicObjectViewModel[];
  onNavigate: (view: CleanProductionView) => void;
  onManager: () => void;
  onGenerateTodaysBrief: () => void;
  onLockedAgent: (agent: AgentViewModel) => void;
  onDrawer: (drawer: DrawerKind) => void;
  onOpenMusicFocus: (musicObjectId?: string) => void;
}) {
  const commandItems = buildDeskCommandItems({
    agents,
    music,
    missions,
    onManager,
    onNavigate,
    onOpenMusicFocus,
  });

  return (
    <section>
      <WorkspaceHeader
        eyebrow="Desk Read"
        title="Desk HQ"
      />

      <div className="mb-6 rounded-xl border border-foreground/10 bg-white shadow-[0_2px_12px_rgba(17,19,24,0.06)]">
        <div className="grid grid-cols-1 overflow-hidden rounded-xl sm:grid-cols-2 xl:grid-cols-4">
          {commandItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className="group flex min-w-0 items-center justify-between gap-3 border-b border-foreground/8 px-4 py-3.5 text-left transition-all duration-200 hover:bg-foreground/[0.025] focus:outline-none focus:ring-2 focus:ring-brand-accent/20 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
                aria-label={`${item.label} ${item.value} ${item.meta}`}
                onClick={item.onClick}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-foreground/8 bg-foreground/[0.035] text-foreground transition-colors group-hover:border-foreground/20 group-hover:bg-foreground group-hover:text-background">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{item.label}</span>
                    <span className="mt-1 block truncate text-[15px] font-bold leading-tight text-foreground">{item.value}</span>
                    <span className="mt-1 block truncate text-[12px] font-semibold leading-tight text-muted-foreground/78">{item.meta}</span>
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/58 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-accent" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <TodayBrief
            profile={profile}
            brief={todayBrief ?? buildVisibleFallbackBrief(profile)}
            pending={todayBriefPending}
            error={todayBriefError}
            onGenerate={onGenerateTodaysBrief}
            onDrawer={onDrawer}
          />

          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Team Agents</p>
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{agents.length} specialist desks</p>
            </div>
            <p className="mb-4 max-w-2xl text-[13px] font-semibold leading-relaxed text-muted-foreground/82">A compact operating team for decisions, rollout, rights, deals, and live work.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {agents.map((agent) => {
                const Icon = agent.icon;
                const statusLabel = agent.status === "available" ? "Open now" : "Preview desk";
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className="group rounded-xl border border-foreground/10 bg-white p-4 text-left shadow-[0_1px_6px_rgba(17,19,24,0.055)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-accent/20 hover:bg-foreground/[0.015] hover:shadow-[0_10px_28px_rgba(17,19,24,0.08)] focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
                    onClick={() => (agent.id === "manager" ? onManager() : onLockedAgent(agent))}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-all group-hover:ring-2 group-hover:ring-foreground/10">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="rounded-full bg-foreground/[0.045] px-2 py-1 font-ui text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        {statusLabel}
                      </span>
                    </span>
                    <span className="mt-4 block text-sm font-bold leading-tight text-foreground">{agent.name.replace("AI ", "")}</span>
                    <span className="mt-2 block min-h-9 text-[12px] font-semibold leading-snug text-muted-foreground/82">{getAgentCardRead(agent)}</span>
                    <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-muted-foreground transition-colors group-hover:text-brand-accent">
                      Open desk
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Active Missions</p>
              <button type="button" className="text-sm font-semibold text-muted-foreground" onClick={() => onNavigate("missionsWorkspace")}>
                View all
              </button>
            </div>
            <div className="grid gap-3">
              {missions.map((mission) => (
                <button key={mission.id} type="button" className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4 text-left" onClick={() => onNavigate("missionsWorkspace")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-brand-accent" />
                    <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Active Mission</span>
                    <span className="text-xs font-semibold text-[#c2410c]">Blocker</span>
                  </div>
                  <p className="font-display text-[18px] font-bold tracking-tight text-foreground mt-3">{mission.title}</p>
                  <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">{mission.summary}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82">Progress {mission.progress}%</span>
                    <span className="text-sm font-semibold text-muted-foreground">Open mission</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="grid min-w-0 content-start gap-6 self-start pt-1 lg:sticky lg:top-8">
          <section>
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/88 mb-4">Needs Attention</p>
            <div className="grid gap-3">
              {attention.length ? attention.slice(0, 3).map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className="group rounded-xl border border-foreground/10 bg-background p-4 text-left shadow-sm transition-colors hover:border-brand-accent/20 hover:bg-foreground/[0.015]"
                  onClick={() => (item.tone === "accent" ? onDrawer("evidence") : onNavigate("missionsWorkspace"))}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={item.tone === "warning" ? "flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10 text-warning" : "flex h-7 w-7 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"}>
                      {item.tone === "warning" ? (
                        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Upload className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <p className="text-[13px] font-semibold leading-tight text-foreground">{item.title}</p>
                  </div>
                  <p className="mt-3 text-[12px] font-medium leading-relaxed text-muted-foreground/80">{item.body}</p>
                </button>
              )) : (
                <div className="rounded-xl border border-foreground/10 bg-background p-4 text-[12px] font-medium leading-relaxed text-muted-foreground/80 shadow-sm">
                  No urgent items right now.
                </div>
              )}
            </div>
          </section>
          <section>
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/88 mb-4">Recent Movement</p>
            <div className="space-y-6 pl-1">
              {movement.length ? movement.slice(0, 5).map((item) => (
                <div key={`${item.title}-${item.time}`} className="relative flex flex-col gap-2 pl-6 before:absolute before:left-0 before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-foreground/5">
                  <p className="text-[12px] font-semibold leading-tight text-foreground">{item.title}</p>
                  <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/88">
                    {item.label} / {item.time}
                  </p>
                </div>
              )) : (
                <div className="relative flex flex-col gap-2 pl-6 before:absolute before:left-0 before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-foreground/5">
                  <p className="text-[12px] font-semibold leading-tight text-foreground">No new movement yet</p>
                  <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/88">System / Waiting</p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function buildDeskCommandItems({
  agents,
  music,
  missions,
  onManager,
  onNavigate,
  onOpenMusicFocus,
}: {
  agents: AgentViewModel[];
  music: MusicObjectViewModel[];
  missions: MissionViewModel[];
  onManager: () => void;
  onNavigate: (view: CleanProductionView) => void;
  onOpenMusicFocus: (musicObjectId?: string) => void;
}): DeskCommandItem[] {
  const focus = selectMusicFocus(music);
  const activeMissionCount = missions.filter((mission) => mission.status === "active" || mission.status === "blocked" || mission.status === "review").length;

  return [
    {
      label: "Ask Manager",
      value: "Get a decision",
      meta: "Use today's read",
      icon: BriefcaseBusiness,
      onClick: onManager,
    },
    {
      label: "Music Focus",
      value: focus?.title ?? "Open music reads",
      meta: focus ? "Open record read" : "Records in view",
      icon: Library,
      onClick: () => onOpenMusicFocus(focus?.id),
    },
    {
      label: "Mission Path",
      value: activeMissionCount ? `${activeMissionCount} active` : "Create first mission",
      meta: "Turn read into work",
      icon: ListChecks,
      onClick: () => (activeMissionCount ? onNavigate("missionsWorkspace") : onManager()),
    },
    {
      label: "Team Agents",
      value: `${agents.length} specialist desks`,
      meta: "Open operating team",
      icon: UsersRound,
      onClick: () => onNavigate("staffWorkspace"),
    },
  ];
}

function selectMusicFocus(music: MusicObjectViewModel[]) {
  return (
    music.find((item) => item.kind === "song" && /active|focus|priority/i.test(`${item.status ?? ""} ${item.lifecycleStage ?? ""}`)) ??
    music.find((item) => item.kind === "song") ??
    music.find((item) => item.kind === "project") ??
    null
  );
}

function getAgentCardRead(agent: AgentViewModel) {
  switch (agent.id) {
    case "manager":
      return "Turns briefs into decisions.";
    case "marketing":
      return "Shapes rollout and audience moves.";
    case "syncDeals":
      return "Finds pitchable opportunities.";
    case "touring":
      return "Reads live demand and routing.";
    case "finance":
      return "Checks money, splits, and risk.";
    default:
      return agent.purpose.length > 68 ? `${agent.purpose.slice(0, 65).trimEnd()}...` : agent.purpose;
  }
}

function TodayBrief({
  profile,
  brief,
  pending,
  error,
  onGenerate,
  onDrawer,
}: {
  profile: ArtistProfileViewModel;
  brief: TodayBriefViewModel;
  pending: boolean;
  error: string | null;
  onGenerate: () => void;
  onDrawer: (drawer: DrawerKind) => void;
}) {
  const compactIntelligenceMetrics = selectArtistIntelligenceMetrics(brief.intelligenceSnapshot);

  return (
    <section className="rounded-xl border border-foreground/10 bg-white shadow-[0_2px_12px_rgba(17,19,24,0.07)] overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {profile.imageUrl ? (
            <img
              className="h-11 w-11 shrink-0 rounded-[12px] object-cover"
              src={profile.imageUrl}
              alt={`${profile.name} artist image`}
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-foreground/10 bg-foreground/[0.035] text-[13px] font-bold text-muted-foreground">
              {profile.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Today's Brief</p>
            <p className="text-sm font-semibold">{profile.name} - Artist operating read</p>
          </div>
        </div>
        <ProductButton onClick={onGenerate} disabled={pending}>
          <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          {pending ? "Generating Brief" : "Generate Today's Brief"}
        </ProductButton>
      </div>
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-foreground/[0.045] px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {brief.confidence === "limited" ? "Limited confidence" : `${brief.confidence} confidence`}
          </span>
          <span className="rounded-full bg-foreground/[0.045] px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {brief.state === "fresh" ? "Fresh" : brief.state === "fallback" ? "First read" : "Limited"}
          </span>
        </div>
        <h2 className="mt-4 max-w-3xl font-display text-2xl font-bold tracking-tight text-foreground leading-tight">{brief.headlineRead}</h2>

        <ArtistIntelligenceCard summary={brief.snapshotSummary} metrics={compactIntelligenceMetrics} />

        <div className="mt-6 border-t border-border pt-5">
          <div className="rounded-[12px] border-l-4 border-y border-r border-brand-accent/18 border-l-brand-accent bg-brand-accent/[0.035] p-5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.015)]">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Manager's Read</p>
            <p className="mt-4 text-[14px] font-semibold leading-relaxed text-foreground/90 whitespace-pre-line">{brief.managerRead}</p>
          </div>
          {error ? (
            <div className="mt-5 rounded-[12px] border border-warning/20 bg-warning/5 p-3 text-[12px] font-semibold leading-relaxed text-warning">
              {error}
            </div>
          ) : null}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-4">
              <button type="button" className="text-sm font-semibold text-muted-foreground" onClick={() => onDrawer("evidence")}>
                View supporting evidence
              </button>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                Manager brief · {formatBriefGeneratedAt(brief.generatedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type CompactArtistMetric = TodayBriefMetric & {
  groupTitle: string;
};

function ArtistIntelligenceCard({ summary, metrics }: { summary: string; metrics: CompactArtistMetric[] }) {
  return (
    <section data-testid="artist-intelligence-card" className="mt-6 overflow-hidden rounded-[12px] border border-foreground/10 bg-white shadow-sm">
      <div className="grid gap-4 border-b border-foreground/8 bg-foreground/[0.028] px-4 py-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:px-5">
        <div className="min-w-0 border-l-2 border-brand-accent pl-3">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Artist Intelligence</p>
          <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{metrics.length} key signals</p>
        </div>
        <p className="min-w-0 text-[13px] font-semibold leading-relaxed text-foreground/72 sm:max-w-3xl">{summary}</p>
      </div>
      <div className="grid grid-cols-2 bg-white sm:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div key={`${metric.groupTitle}-${metric.label}-${metric.value}`} className="min-w-0 border-t border-foreground/8 px-3 py-3 sm:px-4">
            <p className="truncate text-[10px] font-semibold leading-tight text-muted-foreground/82">{metric.label}</p>
            <p className="mt-1 truncate text-[20px] font-semibold leading-none text-foreground">{metric.value}</p>
            {metric.context ? <p className="mt-1 truncate text-[10px] font-semibold leading-tight text-muted-foreground/70">{metric.context}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function selectArtistIntelligenceMetrics(groups: TodayBriefSnapshotGroup[]): CompactArtistMetric[] {
  const allMetrics = groups.flatMap((group) => group.metrics.map((metric) => ({ ...metric, groupTitle: group.title })));
  const figureMetrics = allMetrics.filter((metric) => /[\d#]/.test(metric.value));
  const sourceMetrics = figureMetrics.length ? figureMetrics : allMetrics;
  const uniqueMetrics = sourceMetrics.filter((metric, index, list) => {
    const key = `${metric.label.toLowerCase()}-${metric.value.toLowerCase()}`;
    return list.findIndex((candidate) => `${candidate.label.toLowerCase()}-${candidate.value.toLowerCase()}` === key) === index;
  });

  return uniqueMetrics
    .map((metric, index) => ({ metric, index, priority: getArtistMetricPriority(metric) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .slice(0, 10)
    .map(({ metric }) => metric);
}

function getArtistMetricPriority(metric: TodayBriefMetric) {
  const text = `${metric.label} ${metric.context ?? ""}`.toLowerCase();
  const priorities = [
    /monthly listeners?/,
    /followers.*all|saved platforms|platform followers/,
    /artist score|\bscore\b/,
    /country rank|uk rank|rank/,
    /london/,
    /lagos/,
    /playlist/,
    /shazam/,
    /instagram/,
    /tiktok followers?/,
  ];
  const priority = priorities.findIndex((pattern) => pattern.test(text));
  return priority === -1 ? priorities.length : priority;
}

function buildVisibleFallbackBrief(profile: ArtistProfileViewModel): TodayBriefViewModel {
  return {
    headlineRead: `${profile.name}'s first management read is ready to organize around a focused starting point.`,
    intelligenceSnapshot: [
      {
        title: "Current Music In View",
        insight: "The workspace has enough saved setup context to choose the first management focus.",
        metrics: [
          { label: "Artist profile", value: "Saved", context: "setup context", evidenceIds: ["artist-profile"] },
          { label: "Working catalog", value: "In view", context: "current management focus", evidenceIds: ["catalog-setup"] },
        ],
      },
    ],
    snapshotSummary: "The first read should organize the workspace around one management focus, not a generic artist profile.",
    managerRead:
      `This is the first operating read for ${profile.name}. The useful move is not to spread attention across every possible lane; it is to choose the first management focus from the saved profile and current music in view, then let the team build the next work from that center.`,
    sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
    confidence: "limited",
    state: "fallback",
  };
}

function formatBriefGeneratedAt(value?: string) {
  if (!value) return "Prepared";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Prepared";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
