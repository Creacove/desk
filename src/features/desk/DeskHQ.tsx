import { ArrowUpRight, BriefcaseBusiness, ClipboardCheck, Library, ListChecks, MessageSquareText, Upload, UsersRound } from "lucide-react";
import { useState } from "react";
import { ProductButton, WorkspaceHeader } from "../../design-system/components";
import { compactMovementTitle, movementKey, splitAttentionItems } from "./deskAttention";
import type {
  AgentViewModel,
  ArtistProfileViewModel,
  AttentionItem,
  CleanProductionView,
  DrawerKind,
  MissionViewModel,
  MovementItem,
  MusicObjectViewModel,
  TodayBriefMetric,
  TodayBriefSnapshotGroup,
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
}) {
  const [activityHistoryOpen, setActivityHistoryOpen] = useState(false);
  const { actionable, sourceContext } = splitAttentionItems(attention);
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
      <div className="hidden lg:block">
        <WorkspaceHeader
          eyebrow="Desk Read"
          title="Desk HQ"
        />
      </div>

      <MobileDeskHome
        profile={profile}
        brief={todayBrief ?? buildVisibleFallbackBrief(profile)}
        error={todayBriefError}
        missions={missions}
        agents={agents}
        onDrawer={onDrawer}
        onNavigate={onNavigate}
        onManager={onManager}
        onOpenMission={onOpenMission}
        onLockedAgent={onLockedAgent}
      />

      <div className="mb-6 hidden rounded-xl border border-foreground/10 bg-white shadow-[0_2px_12px_rgba(17,19,24,0.06)] lg:block">
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

      <div className="hidden min-w-0 gap-5 lg:grid xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <TodayBrief
            profile={profile}
            brief={todayBrief ?? buildVisibleFallbackBrief(profile)}
            error={todayBriefError}
            onManager={onManager}
            onDrawer={onDrawer}
          />

          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Team Agents</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {agents.map((agent) => {
                const Icon = agent.icon;
                const statusLabel = agent.status === "available" ? "Open now" : "Preview desk";
                return (
                  <button
                    key={agent.id}
                    type="button"
                    data-testid="desk-agent-card"
                    className="group flex min-h-[104px] flex-col justify-between rounded-[14px] border border-foreground/10 bg-white p-3 text-left shadow-[0_1px_5px_rgba(17,19,24,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/18 hover:bg-foreground/[0.012] focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
                    onClick={() => (agent.id === "manager" ? onManager() : onLockedAgent(agent))}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-foreground text-background transition-colors group-hover:bg-foreground/88">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="rounded-full bg-foreground/[0.045] px-2 py-0.5 font-ui text-[9px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{statusLabel}</span>
                    </span>
                    <span className="block min-w-0">
                      <span className="block truncate text-[13px] font-bold leading-tight text-foreground">{displayAgentName(agent)}</span>
                      <span className="mt-1 block truncate text-[11px] font-semibold leading-snug text-muted-foreground/76">{getAgentCardRead(agent)}</span>
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
            <div className="grid gap-2">
              {missions.slice(0, 4).map((mission) => (
                <button
                  key={mission.id}
                  type="button"
                  data-testid="desk-active-mission-card"
                  className="group rounded-[14px] border border-foreground/10 bg-background px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/18 hover:bg-foreground/[0.014] focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
                  onClick={() => onOpenMission(mission.id)}
                >
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <span className="min-w-0">
                      <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                        {mission.status === "blocked" ? "Blocked" : "Active"}
                      </span>
                      <span className="mt-1 block truncate text-[15px] font-bold leading-tight text-foreground">{mission.title}</span>
                    </span>
                    <span className="w-[72px] shrink-0 pt-0.5 text-right">
                      <span className="block text-[11px] font-bold text-foreground">{mission.progress}%</span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-foreground/8">
                        <span className="block h-full rounded-full bg-foreground transition-all duration-500" style={{ width: `${mission.progress}%` }} />
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside data-testid="desk-desktop-attention-rail" className="hidden min-w-0 content-start gap-5 self-start pt-1 xl:sticky xl:top-8 xl:grid">
          <DeskAttentionPanel
            actionable={actionable}
            sourceContext={sourceContext}
            movement={movement}
            onNavigate={onNavigate}
            onDrawer={onDrawer}
            onOpenHistory={() => setActivityHistoryOpen(true)}
          />
        </aside>
      </div>
      <ActivityHistoryDialog open={activityHistoryOpen} movement={movement} onClose={() => setActivityHistoryOpen(false)} />
    </section>
  );
}

function DeskAttentionPanel({
  actionable,
  sourceContext,
  movement,
  onNavigate,
  onDrawer,
  onOpenHistory,
}: {
  actionable: AttentionItem[];
  sourceContext: AttentionItem[];
  movement: MovementItem[];
  onNavigate: (view: CleanProductionView) => void;
  onDrawer: (drawer: DrawerKind) => void;
  onOpenHistory: () => void;
}) {
  const primary = actionable[0];
  const secondary = actionable.slice(1, 3);

  return (
    <>
      <section className="rounded-[18px] border border-foreground/8 bg-background/92 p-4 shadow-[0_10px_34px_rgba(17,19,24,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/88">Today's Attention</p>
          <span className="rounded-full bg-foreground/[0.055] px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{actionable.length}</span>
        </div>

        {primary ? (
          <button
            type="button"
            className="mt-4 w-full rounded-[14px] border border-foreground/10 bg-background p-4 text-left text-foreground shadow-sm transition-colors hover:border-foreground/18 hover:bg-foreground/[0.025] focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
            onClick={() => openAttentionItem(primary, onNavigate, onDrawer)}
          >
            <span className="flex items-center gap-2.5">
              <span className={primary.tone === "warning" ? "flex h-8 w-8 items-center justify-center rounded-lg bg-warning/12 text-warning" : "flex h-8 w-8 items-center justify-center rounded-lg bg-brand-accent/12 text-brand-accent"}>
                {primary.tone === "warning" ? <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0 text-[14px] font-bold leading-tight">{primary.title}</span>
            </span>
            <span className="mt-3 block text-[12px] font-semibold leading-relaxed text-muted-foreground/78">{primary.body}</span>
          </button>
        ) : (
          <div className="mt-4 rounded-[14px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <p className="text-[13px] font-bold text-foreground">No action needed</p>
            <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-muted-foreground/78">The desk has no decisions, approvals, or blockers waiting on you right now.</p>
          </div>
        )}

        {secondary.length ? (
          <div className="mt-3 grid gap-2">
            {secondary.map((item) => (
              <button
                key={item.title}
                type="button"
                className="rounded-[12px] border border-foreground/8 bg-foreground/[0.02] px-3.5 py-3 text-left transition-colors hover:border-brand-accent/20 hover:bg-foreground/[0.04]"
                onClick={() => openAttentionItem(item, onNavigate, onDrawer)}
              >
                <span className="block text-[12px] font-bold leading-tight text-foreground">{item.title}</span>
                <span className="mt-1 block text-[11px] font-semibold leading-relaxed text-muted-foreground/78">{item.body}</span>
              </button>
            ))}
          </div>
        ) : null}

        {sourceContext.length ? (
          <div className="mt-4 border-t border-foreground/8 pt-3">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/68">Source context</p>
            <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-muted-foreground/72">{sourceContext[0].body}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-[18px] border border-foreground/8 bg-background/78 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/88">Activity log</p>
          <button type="button" className="text-[11px] font-bold text-muted-foreground hover:text-foreground" onClick={onOpenHistory}>
            View activity history
          </button>
        </div>
        <div className="mt-4 space-y-4 pl-1">
          {movement.length ? movement.slice(0, 3).map((item, index) => (
            <div key={movementKey(item, index)} className="relative flex flex-col gap-1.5 pl-5 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-foreground/10">
              <p className="text-[12px] font-semibold leading-snug text-foreground">{compactMovementTitle(item.title)}</p>
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/78">
                {item.label} / {item.time}
              </p>
            </div>
          )) : (
            <div className="relative flex flex-col gap-1.5 pl-5 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-foreground/10">
              <p className="text-[12px] font-semibold leading-snug text-foreground">No new activity yet</p>
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/78">System / Waiting</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function ActivityHistoryDialog({ open, movement, onClose }: { open: boolean; movement: MovementItem[]; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-foreground/25 px-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Activity history" className="max-h-[78vh] w-full max-w-xl overflow-y-auto rounded-[22px] border border-foreground/10 bg-background p-5 shadow-[0_28px_90px_rgba(17,19,24,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-foreground/8 pb-4">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Activity history</p>
            <h2 className="mt-1 font-display text-[22px] font-semibold leading-tight text-foreground">Operating movement</h2>
          </div>
          <button type="button" className="h-8 rounded-lg border border-foreground/10 px-3 text-[12px] font-bold text-muted-foreground" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="grid gap-3 pt-4">
          {movement.length ? movement.map((item, index) => (
            <article key={movementKey(item, index)} className="rounded-[14px] border border-foreground/8 bg-foreground/[0.018] p-3.5">
              <p className="text-[13px] font-semibold leading-relaxed text-foreground">{item.title}</p>
              <p className="mt-2 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                {item.label} / {item.time}
              </p>
            </article>
          )) : (
            <p className="rounded-[14px] border border-foreground/8 bg-foreground/[0.018] p-3.5 text-[12px] font-semibold text-muted-foreground">No activity has been recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function openAttentionItem(item: AttentionItem, onNavigate: (view: CleanProductionView) => void, onDrawer: (drawer: DrawerKind) => void) {
  if (item.target) {
    onNavigate(item.target);
    return;
  }
  if (item.tone === "accent") {
    onDrawer("evidence");
    return;
  }
  onNavigate("missionsWorkspace");
}

function MobileDeskHome({
  profile,
  brief,
  error,
  missions,
  agents,
  onDrawer,
  onNavigate,
  onManager,
  onOpenMission,
  onLockedAgent,
}: {
  profile: ArtistProfileViewModel;
  brief: TodayBriefViewModel;
  error: string | null;
  missions: MissionViewModel[];
  agents: AgentViewModel[];
  onDrawer: (drawer: DrawerKind) => void;
  onNavigate: (view: CleanProductionView) => void;
  onManager: () => void;
  onOpenMission: (missionId: string) => void;
  onLockedAgent: (agent: AgentViewModel) => void;
}) {
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [managerReadExpanded, setManagerReadExpanded] = useState(false);
  const compactMetrics = selectArtistIntelligenceMetrics(brief.intelligenceSnapshot);
  const visibleMetrics = metricsExpanded ? compactMetrics : compactMetrics.slice(0, 4);
  const managerReadParagraphs = formatManagerReadParagraphs(brief.managerRead);
  const managerReadDisplay = getManagerReadDisplay(managerReadParagraphs, managerReadExpanded);
  const visibleMissions = missions.slice(0, 4);
  const managerAgent = agents.find((agent) => agent.id === "manager") ?? null;

  return (
    <div data-testid="desk-mobile-home" className="grid gap-4 pb-4 lg:hidden">
      <section className="overflow-hidden rounded-[18px] border border-foreground/10 bg-white shadow-[0_1px_8px_rgba(17,19,24,0.055)]">
        <div className="flex items-center justify-between gap-3 border-b border-foreground/8 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {profile.imageUrl ? (
              <img className="h-10 w-10 shrink-0 rounded-[12px] object-cover" src={profile.imageUrl} alt={`${profile.name} artist image`} />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-foreground/10 bg-foreground/[0.035] text-[12px] font-bold text-muted-foreground">
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Today</p>
              <p className="truncate text-[13px] font-semibold text-foreground">{profile.name}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Open Manager from brief"
            onClick={onManager}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-foreground/10 bg-background px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.04]"
          >
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            Talk to Manager
          </button>
        </div>

        <div className="px-4 py-4">
          <h1 className="font-display text-[18px] font-semibold leading-[1.15] text-foreground">{brief.headlineRead}</h1>
          <p className="mt-3 text-[13px] font-medium leading-relaxed text-muted-foreground/82">{brief.snapshotSummary}</p>

          {compactMetrics.length ? (
            <div
              data-testid="desk-mobile-metrics-grid"
              className={`mt-4 grid overflow-hidden rounded-[14px] border border-foreground/8 bg-foreground/[0.02] ${
                visibleMetrics.length === 1 ? "grid-cols-1" : "grid-cols-2"
              }`}
            >
              {visibleMetrics.map((metric) => (
                <ArtistMetricCell
                  key={`${metric.groupTitle}-${metric.label}-${metric.value}`}
                  metric={metric}
                  className={`border-b border-foreground/8 px-3 py-2.5 ${
                    visibleMetrics.length > 1 ? "border-r even:border-r-0" : ""
                  }`}
                  compact
                />
              ))}
            </div>
          ) : null}
          {compactMetrics.length > 4 ? (
            <button
              type="button"
              aria-expanded={metricsExpanded}
              className="mt-2 text-[12px] font-semibold text-brand-accent"
              onClick={() => setMetricsExpanded((current) => !current)}
            >
              {metricsExpanded ? "Show fewer metrics" : `See all ${compactMetrics.length} metrics`}
            </button>
          ) : null}

          <div
            data-testid="desk-mobile-manager-read-card"
            className="manager-read-card mt-4 rounded-[14px] p-3.5"
          >
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Manager&apos;s Read</p>
            <div data-testid="desk-mobile-manager-read" className="mt-3 space-y-3 text-[13px] font-medium leading-relaxed text-foreground/86">
              {managerReadDisplay.paragraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}
            </div>
            {managerReadDisplay.canExpand ? (
              <button
                type="button"
                aria-expanded={managerReadExpanded}
                className="mt-3 text-[12px] font-semibold text-brand-accent"
                onClick={() => setManagerReadExpanded((current) => !current)}
              >
                {managerReadExpanded ? "Show less Manager's Read" : "See full Manager's Read"}
              </button>
            ) : null}
          </div>
          {error ? <p className="mt-3 rounded-[12px] border border-warning/20 bg-warning/5 p-3 text-[12px] font-semibold text-warning">{error}</p> : null}
          <div className="mt-3 flex items-center justify-between gap-3">
            <button type="button" className="text-[12px] font-semibold text-muted-foreground" onClick={() => onDrawer("evidence")}>
              Evidence
            </button>
            <p className="text-right text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              {formatBriefGeneratedAt(brief.generatedAt)}
            </p>
          </div>
        </div>
      </section>

      {managerAgent ? (
        <section data-testid="desk-mobile-team-agents" className="rounded-[18px] border border-foreground/10 bg-white p-4 shadow-[0_1px_8px_rgba(17,19,24,0.05)]">
          <button type="button" className="flex w-full min-w-0 items-center gap-3 text-left" onClick={onManager}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <managerAgent.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-foreground">{displayAgentName(managerAgent)}</span>
              <span className="mt-0.5 line-clamp-1 block text-[12px] font-medium text-muted-foreground/82">{getAgentCardRead(managerAgent)}</span>
            </span>
          </button>
        </section>
      ) : null}

      <section className="rounded-[18px] border border-foreground/10 bg-white p-4 shadow-[0_1px_8px_rgba(17,19,24,0.05)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Current work</p>
          <button type="button" className="text-[12px] font-semibold text-muted-foreground" onClick={() => onNavigate("missionsWorkspace")}>
            View all
          </button>
        </div>
        {visibleMissions.length ? (
          <div className="grid gap-2">
            {visibleMissions.map((mission) => (
              <button key={mission.id} type="button" className="w-full rounded-[14px] border border-foreground/8 bg-background px-3 py-3 text-left" aria-label="Open mission on mobile" onClick={() => onOpenMission(mission.id)}>
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{mission.status === "blocked" ? "Blocked" : "Active"}</span>
                    <span className="mt-1 block text-[15px] font-semibold leading-tight text-foreground">{mission.title}</span>
                  </span>
                  <span className="w-[64px] shrink-0 text-right">
                    <span className="block text-[11px] font-bold text-foreground">{mission.progress}%</span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-foreground/8">
                      <span className="block h-full rounded-full bg-foreground" style={{ width: `${mission.progress}%` }} />
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="w-full rounded-[14px] border border-dashed border-foreground/12 bg-foreground/[0.02] p-3 text-left" onClick={() => onNavigate("missionsWorkspace")}>
            <span className="block text-[13px] font-semibold text-foreground">No active mission yet</span>
            <span className="mt-1 block text-[12px] font-medium text-muted-foreground">Turn today&apos;s read into the first mission.</span>
          </button>
        )}
      </section>
    </div>
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

function displayAgentName(agent: AgentViewModel) {
  return agent.id === "manager" ? "Manager Agent" : agent.name.replace("AI ", "");
}

function getAgentCardRead(agent: AgentViewModel) {
  switch (agent.id) {
    case "manager":
      return "Briefs into decisions.";
    case "marketing":
      return "Rollout and audience.";
    case "syncDeals":
      return "Pitch opportunities.";
    case "touring":
      return "Live demand and routing.";
    case "finance":
      return "Money, splits, risk.";
    default:
      return agent.purpose.length > 68 ? `${agent.purpose.slice(0, 65).trimEnd()}...` : agent.purpose;
  }
}

function TodayBrief({
  profile,
  brief,
  error,
  onManager,
  onDrawer,
}: {
  profile: ArtistProfileViewModel;
  brief: TodayBriefViewModel;
  error: string | null;
  onManager: () => void;
  onDrawer: (drawer: DrawerKind) => void;
}) {
  const compactIntelligenceMetrics = selectArtistIntelligenceMetrics(brief.intelligenceSnapshot);
  const [managerReadExpanded, setManagerReadExpanded] = useState(false);
  const managerReadParagraphs = formatManagerReadParagraphs(brief.managerRead);
  const managerReadDisplay = getManagerReadDisplay(managerReadParagraphs, managerReadExpanded);

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
        <ProductButton onClick={onManager}>
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
          Talk to Manager
        </ProductButton>
      </div>
      <div className="p-6">
        <h2 className="max-w-3xl font-display text-2xl font-bold tracking-tight text-foreground leading-tight">{brief.headlineRead}</h2>

        <ArtistIntelligenceCard summary={brief.snapshotSummary} metrics={compactIntelligenceMetrics} />

        <div className="mt-6 border-t border-border pt-5">
          <div data-testid="desk-manager-read-card" className="manager-read-card rounded-[12px] p-5">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Manager&apos;s Read</p>
            <div
              data-testid="desk-desktop-manager-read"
              className="mt-4 space-y-4 text-[14px] font-semibold leading-relaxed text-foreground/90"
            >
              {managerReadDisplay.paragraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}
            </div>
            {managerReadDisplay.canExpand ? (
              <button
                type="button"
                aria-expanded={managerReadExpanded}
                className="mt-4 text-sm font-semibold text-brand-accent"
                onClick={() => setManagerReadExpanded((current) => !current)}
              >
                {managerReadExpanded ? "Show less Manager's Read" : "See full Manager's Read"}
              </button>
            ) : null}
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

function sanitizeManagerRead(read: string) {
  return read
    .replace(/\[(?:EV|ev|evidence)[\w\s:.-]*?\]/g, "")
    .replace(/\b(?:EV|ev)[-\s]?\d+\b/g, "")
    .replace(/\bevidence[-\s]?\d+\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function formatManagerReadParagraphs(read: string) {
  const sanitized = sanitizeManagerRead(read);
  const sourceParagraphs = sanitized.includes("\n")
    ? sanitized.split(/\n{2,}|\n/)
    : sanitized.split(/(?=\b(?:Power center|Hidden second lane|Cultural base|Public leverage|Current music focus|Where management should start|Today)\s*:)/gi);
  return sourceParagraphs
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function getManagerReadDisplay(paragraphs: string[], expanded: boolean) {
  const canExpand = paragraphs.length > 4;
  return {
    paragraphs: canExpand && !expanded ? paragraphs.slice(0, 4) : paragraphs,
    canExpand,
  };
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
          <ArtistMetricCell
            key={`${metric.groupTitle}-${metric.label}-${metric.value}`}
            metric={metric}
            className="border-t border-foreground/8 px-3 py-3 sm:px-4"
          />
        ))}
      </div>
    </section>
  );
}

function ArtistMetricCell({
  metric,
  className,
  compact = false,
}: {
  metric: CompactArtistMetric;
  className?: string;
  compact?: boolean;
}) {
  const display = formatArtistMetricDisplay(metric);
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <p className="text-[10px] font-semibold leading-snug text-muted-foreground/82 break-words">{display.label}</p>
      <p className={`${compact ? "mt-1 text-[17px]" : "mt-1.5 text-[20px]"} font-semibold leading-tight text-foreground break-words`}>
        {display.value}
      </p>
      {display.context ? (
        <p className="mt-1 text-[10px] font-semibold leading-snug text-muted-foreground/70 break-words">{display.context}</p>
      ) : null}
    </div>
  );
}

function formatArtistMetricDisplay(metric: CompactArtistMetric) {
  const valueParts = metric.value.match(/^(.+?)\s+\((.+)\)$/);
  const value = valueParts?.[1]?.trim() || metric.value;
  const parentheticalContext = valueParts?.[2]?.trim();
  return {
    label: metric.label.replace(/\s+[—-]\s+/g, " - ").trim(),
    value,
    context: [metric.context, parentheticalContext].filter(Boolean).join(" / "),
  };
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
