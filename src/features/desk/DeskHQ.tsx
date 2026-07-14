import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MessageSquareText,
  SendHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
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

type TodaysFocusLead = {
  label: "New Achievement" | "Needs You" | "Manager Update" | "All Clear";
  title: string;
  body: string;
  tone: "achievement" | "warning" | "update" | "clear";
  item?: AttentionItem;
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
  onAskManager,
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
}) {
  const [activityCenterOpen, setActivityCenterOpen] = useState(false);
  const { actionable, sourceContext } = splitAttentionItems(attention);
  const brief = todayBrief ?? buildVisibleFallbackBrief(profile);
  const focusLead = selectTodaysFocusLead({ actionable, movement });

  return (
    <section className="desk-hq-v2 relative isolate">
      <div className="hidden lg:block">
        <DeskHQHeader
          activityCount={actionable.length + movement.length}
          onOpenActivityCenter={() => setActivityCenterOpen(true)}
          onAskManager={onAskManager}
        />
      </div>

      <MobileDeskHome
        profile={profile}
        brief={brief}
        error={todayBriefError}
        missions={missions}
        agents={agents}
        onDrawer={onDrawer}
        onNavigate={onNavigate}
        onManager={onManager}
        onOpenMission={onOpenMission}
        onLockedAgent={onLockedAgent}
        onAskManager={onAskManager}
      />

      <div className="desk-hq-stage hidden min-w-0 gap-5 lg:grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
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
        </div>

        <TodayFocusPanel
          lead={focusLead}
          missions={missions}
          onOpenMission={onOpenMission}
          onNavigate={onNavigate}
          onDrawer={onDrawer}
        />
      </div>

      <ActivityCenterDialog
        open={activityCenterOpen}
        actionable={actionable}
        sourceContext={sourceContext}
        movement={movement}
        onNavigate={onNavigate}
        onDrawer={onDrawer}
        onClose={() => setActivityCenterOpen(false)}
      />
    </section>
  );
}

function DeskHQHeader({
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
    <header className="desk-hq-reveal mb-6 flex min-w-0 items-end justify-between gap-5">
      <div className="min-w-0">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Desk Read</p>
        <h1 className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.035em] text-foreground">Desk HQ</h1>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <form
          aria-label="Ask your manager"
          className="flex min-h-[44px] min-w-[320px] max-w-[560px] flex-1 items-start gap-2 rounded-[13px] border border-foreground/8 bg-background/86 px-3 py-1.5 shadow-[0_12px_36px_rgba(17,19,24,0.045)] backdrop-blur-xl"
          onSubmit={submitManagerQuestion}
        >
          <MessageSquareText className="mt-[9px] h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <textarea
            value={draft}
            rows={1}
            onChange={(event) => setDraft(event.target.value)}
            onInput={(event) => {
              const el = event.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 84)}px`;
            }}
            placeholder="Ask your manager anything..."
            className="min-w-0 flex-1 resize-none bg-transparent py-[7px] text-[13px] font-semibold leading-[1.4] text-foreground outline-none placeholder:text-muted-foreground/66"
            style={{ maxHeight: "84px", overflowY: "auto" }}
          />
          <button
            type="submit"
            aria-label="Send manager question"
            disabled={!canSend}
            className="mt-[3px] flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:bg-brand-accent/20 disabled:text-brand-accent/40"
          >
            <SendHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </form>
        <button
          type="button"
          aria-label={`Open Activity Center with ${activityCount} updates`}
          onClick={onOpenActivityCenter}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-foreground/8 bg-background/86 text-foreground shadow-[0_12px_36px_rgba(17,19,24,0.045)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-foreground/18 focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {activityCount ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold leading-none text-white">
              {activityCount > 9 ? "9+" : activityCount}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
}

function DeskCommandBrief({
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
    <section data-testid="desk-editorial-brief" className="desk-hq-brief desk-hq-reveal rounded-[24px] border border-foreground/10 bg-background/92 p-6 text-foreground shadow-[0_28px_80px_rgba(17,19,24,0.09)] backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        {profile.imageUrl ? (
          <img className="h-10 w-10 shrink-0 rounded-[12px] object-cover ring-1 ring-foreground/10" src={profile.imageUrl} alt={`${profile.name} artist image`} />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-foreground/10 bg-foreground/[0.035] text-[12px] font-bold text-muted-foreground">
            {profile.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Today&apos;s Brief</p>
          <p className="truncate text-[13px] font-semibold text-muted-foreground">{profile.name} operating read</p>
        </div>
      </div>

      <div className="pt-6">
        <p
          className="line-clamp-3 max-w-[54rem] font-display font-semibold leading-[1.06] tracking-[-0.035em]"
          style={{ fontSize: "clamp(26px, 2.7vw, 38px)" }}
        >
          {brief.headlineRead}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="button" className="text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground" onClick={() => onDrawer("evidence")}>
            View supporting evidence
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/72">Prepared {formatBriefGeneratedAt(brief.generatedAt)}</span>
        </div>
        {error ? <p className="mt-4 rounded-[12px] border border-warning/30 bg-warning/10 p-3 text-[12px] font-semibold text-warning">{error}</p> : null}
        <SignalMetricStrip metrics={compactMetrics} />
      </div>
    </section>
  );
}

type DeskSignalMetric = { label: string; value: string; context: string };

function SignalMetricStrip({ metrics }: { metrics: DeskSignalMetric[] }) {
  return (
    <div data-testid="desk-signal-metric-strip" className="desk-hq-evidence-rail desk-hq-reveal mt-6 grid overflow-hidden border-y border-foreground/8 divide-x divide-foreground/8 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => (
        <SignalMetricCard key={`${metric.label}-${metric.value}-${index}`} metric={metric} />
      ))}
    </div>
  );
}

function buildDeskMetricTiles(brief: TodayBriefViewModel, profile: ArtistProfileViewModel): DeskSignalMetric[] {
  const selected = selectArtistIntelligenceMetrics(brief.intelligenceSnapshot).slice(0, 4).map((metric) => {
    const display = formatArtistMetricDisplay(metric);
    return { label: display.label, value: display.value, context: display.context };
  });
  const fallback: DeskSignalMetric[] = [
    { label: "Primary market", value: profile.market || "In review", context: profile.genre || "artist focus" },
    { label: "Current release", value: profile.release || "Catalog", context: "music focus" },
    { label: "Budget lane", value: profile.budget || "Unset", context: "monthly plan" },
    { label: "Stage", value: profile.stage || "Setup", context: "operating mode" },
  ];
  return [...selected, ...fallback].slice(0, 4);
}

function SignalMetricCard({ metric }: { metric: DeskSignalMetric }) {
  const label = metric.label;
  const value = metric.value;
  return (
    <article
      data-testid="desk-signal-metric-card"
      className="min-h-[94px] bg-transparent px-4 py-5 first:pl-0 last:pr-0"
    >
      <p className="break-words text-[11px] font-semibold leading-tight text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-[24px] font-semibold leading-none tracking-normal text-foreground">{value}</p>
    </article>
  );
}

function TodayFocusPanel({
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
    .filter((m) => m.status === "active" || m.status === "blocked" || m.status === "review")
    .slice(0, 3);
  const LeadIcon =
    lead.tone === "achievement" ? Sparkles
    : lead.tone === "warning" ? ClipboardCheck
    : lead.tone === "clear" ? CheckCircle2
    : Clock3;

  const leadContent = (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-background/70 text-foreground shadow-sm">
        <LeadIcon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">{lead.label}</p>
        <h3 className="mt-1 text-[16px] font-semibold leading-tight text-foreground">{lead.title}</h3>
        <p className="mt-2 text-[12px] font-semibold leading-relaxed text-muted-foreground">{lead.body}</p>
      </div>
    </div>
  );

  return (
    <aside data-testid="desk-todays-focus" className="desk-hq-focus desk-hq-reveal min-w-0 self-start overflow-hidden rounded-[22px] border border-foreground/8 bg-background/78 p-4 text-foreground shadow-[0_16px_48px_rgba(17,19,24,0.045)] backdrop-blur-xl xl:sticky xl:top-8">
      <div className="flex items-center justify-between gap-3">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Today&apos;s Focus</p>
        <button type="button" className="text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground" onClick={() => onNavigate("missionsWorkspace")}>
          View all
        </button>
      </div>

      {lead.item ? (
        <button
          type="button"
          data-testid="desk-todays-focus-lead"
          aria-label={lead.title}
          onClick={() => openAttentionItem(lead.item!, onNavigate, onDrawer)}
          className={`mt-4 block w-full rounded-[18px] p-4 text-left transition-colors hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/20 ${focusLeadToneClass(lead.tone)}`}
        >
          {leadContent}
        </button>
      ) : (
        <div data-testid="desk-todays-focus-lead" className={`mt-4 rounded-[18px] p-4 ${focusLeadToneClass(lead.tone)}`}>
          {leadContent}
        </div>
      )}

      <div className="mt-5">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Top Focus</p>
        {visibleMissions.length ? (
          <div className="mt-3 grid gap-2.5">
            {visibleMissions.map((mission) => (
              <button
                key={mission.id}
                type="button"
                data-testid="desk-focus-mission-card"
                aria-label={`Open focus mission ${mission.title}`}
                className="group max-w-full overflow-hidden rounded-[14px] border border-foreground/8 bg-foreground/[0.025] px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/16 hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
                onClick={() => onOpenMission(mission.id)}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      {mission.status === "blocked" ? "Needs you" : mission.status === "review" ? "In review" : "Active"}
                    </span>
                    <span className="mt-1 block text-[13px] font-semibold leading-tight text-foreground">{mission.title}</span>
                    <span className="mt-1 block truncate text-[11px] font-medium text-muted-foreground">{mission.nextTask}</span>
                  </span>
                  <span className="w-12 shrink-0 pt-0.5 text-right">
                    <span className="block text-[11px] font-bold text-foreground">{mission.progress}%</span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-foreground/10">
                      <span className="block h-full rounded-full bg-brand-accent transition-all duration-500" style={{ width: `${mission.progress}%` }} />
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="mt-3 w-full rounded-[14px] border border-dashed border-foreground/14 bg-foreground/[0.02] p-3.5 text-left" onClick={() => onNavigate("missionsWorkspace")}>
            <span className="block text-[13px] font-semibold text-foreground">No active mission yet</span>
            <span className="mt-1 block text-[12px] font-medium text-muted-foreground">Turn today&apos;s read into the first mission.</span>
          </button>
        )}
      </div>
    </aside>
  );
}

// Theme-aware Activity Center — respects light and dark mode via CSS variables
function ActivityCenterDialog({
  open,
  actionable,
  sourceContext,
  movement,
  onNavigate,
  onDrawer,
  onClose,
}: {
  open: boolean;
  actionable: AttentionItem[];
  sourceContext: AttentionItem[];
  movement: MovementItem[];
  onNavigate: (view: CleanProductionView) => void;
  onDrawer: (drawer: DrawerKind) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-foreground/25 backdrop-blur-[3px]" role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Activity Center"
        className="h-full w-[min(100%,34rem)] overflow-y-auto border-l border-foreground/10 bg-background p-5 text-foreground shadow-[0_32px_90px_rgba(17,19,24,0.25)]"
      >
        <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-4 border-b border-foreground/10 bg-background/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Activity Center</p>
            <h2 className="mt-1 font-display text-[24px] font-semibold leading-tight text-foreground">What needs attention now</h2>
          </div>
          <button
            type="button"
            aria-label="Close Activity Center"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-foreground/10 bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/[0.1] hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-6 pt-5">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Needs You</p>
              <span className="rounded-full bg-foreground/[0.08] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{actionable.length}</span>
            </div>
            <div className="grid gap-2.5">
              {actionable.length ? (
                actionable.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="rounded-[16px] border border-foreground/10 bg-foreground/[0.04] px-3.5 py-3 text-left transition-colors hover:border-foreground/18 hover:bg-foreground/[0.07]"
                    onClick={() => { openAttentionItem(item, onNavigate, onDrawer); onClose(); }}
                  >
                    <span className="block text-[14px] font-semibold leading-tight text-foreground">{item.title}</span>
                    <span className="mt-1.5 block text-[12px] font-medium leading-relaxed text-muted-foreground">{item.body}</span>
                  </button>
                ))
              ) : (
                <div className="rounded-[16px] border border-foreground/10 bg-foreground/[0.04] px-3.5 py-3">
                  <p className="text-[13px] font-semibold text-foreground">No action needed</p>
                  <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">No decisions, approvals, or blockers are waiting on you.</p>
                </div>
              )}
            </div>
            {sourceContext.length ? (
              <div className="mt-3 rounded-[16px] border border-foreground/10 bg-foreground/[0.03] px-3.5 py-3">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">Source context</p>
                <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">{sourceContext[0].body}</p>
              </div>
            ) : null}
          </section>

          <section>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Autopilot Log</p>
            <div className="mt-3 grid gap-2.5">
              {movement.length ? (
                movement.map((item, index) => (
                  <div key={movementKey(item, index)} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3 rounded-[16px] border border-foreground/10 bg-foreground/[0.04] px-3.5 py-3">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-accent" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-tight text-foreground">{item.title}</span>
                      <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {item.label} / {item.time}
                      </span>
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-[16px] border border-foreground/10 bg-foreground/[0.04] px-3.5 py-3 text-[12px] font-medium text-muted-foreground">
                  No autopilot activity has been recorded yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function openAttentionItem(
  item: AttentionItem,
  onNavigate: (view: CleanProductionView) => void,
  onDrawer: (drawer: DrawerKind) => void,
) {
  if (item.target) { onNavigate(item.target); return; }
  if (item.tone === "accent") { onDrawer("evidence"); return; }
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
  onAskManager,
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
  onAskManager: (body: string) => void;
}) {
  const compactMetrics = buildDeskMetricTiles(brief, profile);
  // Always exactly 4 segments — no expand needed
  const managerReadSegments = buildManagerReadSegments(brief);
  const visibleMissions = missions.slice(0, 3);

  return (
    <div data-testid="desk-mobile-home" className="desk-hq-mobile grid w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] min-w-0 justify-self-start gap-3 pb-4 lg:hidden">
      <MobileManagerComposer onAskManager={onAskManager} />
      <section
        data-testid="desk-mobile-command-surface"
        className="desk-hq-brief desk-hq-reveal w-full min-w-0 max-w-full rounded-[20px] border border-foreground/10 bg-background/92 text-foreground shadow-[0_20px_56px_rgba(17,19,24,0.08)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-foreground/8 px-3.5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {profile.imageUrl ? (
              <img className="h-9 w-9 shrink-0 rounded-[11px] object-cover ring-1 ring-foreground/10" src={profile.imageUrl} alt={`${profile.name} artist image`} />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-foreground/10 bg-foreground/[0.035] text-[12px] font-bold text-muted-foreground">
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-ui text-[9px] font-bold uppercase tracking-[0.04em] text-brand-accent">Today&apos;s Brief</p>
              <p className="truncate text-[13px] font-semibold text-muted-foreground">{profile.name} operating read</p>
            </div>
          </div>
        </div>

        <div className="min-w-0 px-3.5 py-3.5">
          <p className="max-w-full break-words font-display text-[22px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground [overflow-wrap:anywhere]">{brief.headlineRead}</p>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" className="min-w-0 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground" onClick={() => onDrawer("evidence")}>
              View supporting evidence
            </button>
            <span className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/72">Prepared {formatBriefGeneratedAt(brief.generatedAt)}</span>
          </div>

          {compactMetrics.length ? (
            <div data-testid="desk-mobile-signal-rail" className="mt-3 min-w-0 max-w-full">
              <div
                data-testid="desk-mobile-metrics-grid"
                className="grid min-w-0 max-w-full grid-cols-2 overflow-hidden rounded-[14px] border border-foreground/8 bg-foreground/[0.018]"
              >
                {compactMetrics.map((metric, index) => {
                  const metricLabel = metric.label;
                  const metricValue = metric.value;
                  return (
                    <article
                      key={`${metricLabel}-${metricValue}-${index}`}
                      data-testid="desk-mobile-metric-card"
                      className={`min-h-[82px] min-w-0 max-w-full overflow-hidden bg-transparent px-3 py-3 ${index % 2 === 0 ? "border-r border-foreground/8" : ""} ${index < 2 ? "border-b border-foreground/8" : ""}`}
                    >
                      <p className="max-w-full break-words text-[10px] font-semibold leading-tight text-muted-foreground [overflow-wrap:anywhere]">{metricLabel}</p>
                      <p className="mt-1.5 max-w-full break-words text-[19px] font-semibold leading-none tracking-normal text-foreground [overflow-wrap:anywhere]">{metricValue}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Always 4 sections — no expand */}
          <div data-testid="desk-mobile-manager-read-card" className="manager-read-card desk-hq-manager-read desk-hq-reveal mt-4 w-full min-w-0 max-w-full rounded-[14px] p-3.5">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Manager&apos;s Read</p>
            </div>
            <div data-testid="desk-mobile-manager-read" className="mt-3 min-w-0 max-w-full divide-y divide-foreground/8">
              {managerReadSegments.map((segment, index) => (
                <article key={`${segment.label}-${index}`} data-testid="desk-mobile-manager-read-segment" className="grid min-w-0 max-w-full grid-cols-[2rem_minmax(0,1fr)] gap-2.5 py-3 first:pt-0 last:pb-0">
                  <span className="font-mono text-[10px] font-bold leading-5 text-muted-foreground/70">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 max-w-full">
                    <span className="block max-w-full break-words font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground [overflow-wrap:anywhere]">{segment.label}</span>
                    <p className="mt-1 max-w-full break-words text-[12px] font-semibold leading-relaxed text-foreground/80 [overflow-wrap:anywhere]">{segment.body}</p>
                  </span>
                </article>
              ))}
            </div>
          </div>

          {error ? <p className="mt-3 rounded-[12px] border border-warning/20 bg-warning/5 p-3 text-[12px] font-semibold text-warning">{error}</p> : null}
        </div>
      </section>

      <section data-testid="desk-mobile-current-work" className="w-full min-w-0 max-w-full rounded-[18px] border border-foreground/10 bg-background p-3.5 shadow-[0_1px_10px_rgba(17,19,24,0.045)]">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Current work</p>
            <p className="mt-0.5 text-[12px] font-medium text-muted-foreground/78">{visibleMissions.length ? `${visibleMissions.length} active lanes` : "No active lane"}</p>
          </div>
          <button type="button" className="text-[12px] font-semibold text-muted-foreground" onClick={() => onNavigate("missionsWorkspace")}>
            View all
          </button>
        </div>
        {visibleMissions.length ? (
          <div className="divide-y divide-foreground/8">
            {visibleMissions.map((mission) => (
              <button
                key={mission.id}
                type="button"
                className="min-w-0 max-w-full w-full py-3 text-left transition-colors first:pt-1 last:pb-1 hover:bg-foreground/[0.025]"
                aria-label={`Open mission ${mission.title} on mobile`}
                onClick={() => onOpenMission(mission.id)}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                      {mission.status === "blocked" ? "Needs you" : mission.status === "review" ? "In review" : "Active"}
                    </span>
                    <span className="mt-1 block text-[14px] font-semibold leading-tight text-foreground">{mission.title}</span>
                    <span className="mt-1 block truncate text-[11px] font-medium text-muted-foreground">{mission.nextTask}</span>
                  </span>
                  <span className="w-[58px] shrink-0 pt-0.5 text-right">
                    <span className="block text-[11px] font-bold text-foreground">{mission.progress}%</span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-foreground/8">
                      <span className="block h-full rounded-full bg-brand-accent" style={{ width: `${mission.progress}%` }} />
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

function MobileManagerComposer({ onAskManager }: { onAskManager: (body: string) => void }) {
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
      className="flex min-h-[42px] w-full min-w-0 max-w-full items-start gap-2 rounded-[14px] border border-foreground/10 bg-background px-3 py-1.5 shadow-[0_1px_10px_rgba(17,19,24,0.045)]"
      onSubmit={submitManagerQuestion}
    >
      <MessageSquareText className="mt-[9px] h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <textarea
        value={draft}
        rows={1}
        onChange={(event) => setDraft(event.target.value)}
        onInput={(event) => {
          const el = event.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 72)}px`;
        }}
        placeholder="Ask your manager..."
        className="min-w-0 flex-1 resize-none bg-transparent py-[7px] text-[13px] font-semibold leading-[1.35] text-foreground outline-none placeholder:text-muted-foreground/66"
        style={{ maxHeight: "72px", overflowY: "auto" }}
      />
      <button
        type="submit"
        aria-label="Send mobile manager question"
        disabled={!canSend}
        className="mt-[3px] flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent text-white transition-colors disabled:bg-brand-accent/20 disabled:text-brand-accent/40"
      >
        <SendHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}

function selectTodaysFocusLead({ actionable, movement }: { actionable: AttentionItem[]; movement: MovementItem[] }): TodaysFocusLead {
  const achievement = movement.find((item) => /achievement|milestone|crossed|passed|reached|hit|peaked/i.test(`${item.label} ${item.title}`));
  if (achievement) {
    return { label: "New Achievement", title: achievement.title, body: `${achievement.label} / ${achievement.time}`, tone: "achievement" };
  }
  const needsYou = actionable.find((item) => item.tone === "warning");
  if (needsYou) {
    return { label: "Needs You", title: needsYou.title, body: needsYou.body, tone: "warning", item: needsYou };
  }
  const managerUpdate = actionable[0] ?? null;
  if (managerUpdate) {
    return { label: "Manager Update", title: managerUpdate.title, body: managerUpdate.body, tone: "update", item: managerUpdate };
  }
  const latestMovement = movement[0] ?? null;
  if (latestMovement) {
    return { label: "Manager Update", title: latestMovement.title, body: `${latestMovement.label} / ${latestMovement.time}`, tone: "update" };
  }
  return { label: "All Clear", title: "No urgent movement", body: "No decisions, approvals, or blockers need your attention right now.", tone: "clear" };
}

function focusLeadToneClass(tone: TodaysFocusLead["tone"]) {
  if (tone === "achievement") return "border border-amber-500/16 bg-amber-500/[0.09] text-foreground";
  if (tone === "warning") return "border border-rose-500/16 bg-rose-500/[0.09] text-foreground";
  if (tone === "update") return "border border-violet-500/16 bg-violet-500/[0.09] text-foreground";
  return "border border-foreground/10 bg-foreground/[0.025] text-foreground";
}

// Always exactly 4 segments displayed. No expand button, no overflow.
function TodayBrief({
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
    <section className="desk-hq-manager-read desk-hq-reveal rounded-[22px] border border-foreground/8 bg-background/78 p-5 shadow-[0_16px_48px_rgba(17,19,24,0.045)] backdrop-blur-xl">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Manager&apos;s Read</p>
      <div data-testid="desk-manager-read-card" className="manager-read-card mt-4 rounded-[18px] bg-foreground/[0.018] px-5 text-foreground">
        <div data-testid="desk-desktop-manager-read" className="divide-y divide-foreground/8">
          {managerReadSegments.map((segment, index) => (
            <article
              key={`${segment.label}-${index}`}
              data-testid="desk-manager-read-segment"
              className="grid min-h-[118px] grid-cols-[2.5rem_minmax(0,1fr)] gap-4 py-5"
            >
              <span className="font-mono text-[10px] font-bold leading-5 text-muted-foreground/58">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="block font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent/80">{segment.label}</span>
                <p className="mt-2 max-w-[58rem] text-[13px] font-semibold leading-[1.75] text-foreground/80">{segment.body}</p>
              </span>
            </article>
          ))}
        </div>
        {error ? (
          <div className="mt-5 rounded-[12px] border border-warning/20 bg-warning/5 p-3 text-[12px] font-semibold leading-relaxed text-warning">{error}</div>
        ) : null}
        <div className="flex flex-col gap-3 border-t border-foreground/8 py-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="text-sm font-semibold text-muted-foreground" onClick={() => onDrawer("evidence")}>
            View supporting evidence
          </button>
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Manager brief · {formatBriefGeneratedAt(brief.generatedAt)}
          </p>
        </div>
      </div>
    </section>
  );
}

type ManagerReadSegment = { label: string; body: string };

// Fallback labels used when the AI returns an unlabeled paragraph or fewer than 4 sections.
// "Momentum Peak" at index 1 is intentional — tests assert its presence for single-paragraph reads.
const FALLBACK_LABELS = ["Market Read", "Momentum Peak", "Today\u2019s Move", "Key Signal"];

/**
 * Always returns exactly 4 segments.
 * Section 1 is always "Artist Intelligence" — provided by the AI as the first labeled section.
 * Sections 2–4 are determined dynamically by the AI and parsed from managerRead.
 * Unlabeled paragraphs receive fallback labels. Padding fills any missing slots.
 */
function buildManagerReadSegments(brief: TodayBriefViewModel): ManagerReadSegment[] {
  const sanitized = sanitizeManagerRead(brief.managerRead);

  // Split on blank lines (paragraph boundaries)
  const rawParagraphs = sanitized
    .split(/\n{2,}/)
    .flatMap((block) => block.split(/\n/).map((l) => l.trim()).filter(Boolean))
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const segments: ManagerReadSegment[] = [];
  let fallbackIdx = 0;

  for (const paragraph of rawParagraphs) {
    const match = paragraph.match(/^([A-Z][A-Za-z\s\-']{2,40}):\s+(.+)$/s);
    if (match) {
      segments.push({ label: match[1].trim(), body: match[2].trim() });
    } else {
      segments.push({ label: FALLBACK_LABELS[fallbackIdx % FALLBACK_LABELS.length], body: paragraph });
      fallbackIdx++;
    }
    if (segments.length === 4) break; // Cap at 4
  }

  // Pad to exactly 4 if the AI returned fewer sections
  while (segments.length < 4) {
    const label = FALLBACK_LABELS[segments.length % FALLBACK_LABELS.length];
    segments.push({ label, body: "Key strategy focus details are compiling for this section." });
  }

  return segments;
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

type CompactArtistMetric = TodayBriefMetric & { groupTitle: string };

function ArtistMetricCell({
  metric,
  className,
  compact = false,
  inverted = false,
}: {
  metric: CompactArtistMetric;
  className?: string;
  compact?: boolean;
  inverted?: boolean;
}) {
  const display = formatArtistMetricDisplay(metric);
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <p className={`break-words text-[10px] font-semibold leading-snug ${inverted ? "text-white/68" : "text-muted-foreground/82"}`}>{display.label}</p>
      <p className={`${compact ? "mt-1 text-[17px]" : "mt-1.5 text-[20px]"} break-words font-semibold leading-tight ${inverted ? "text-white" : "text-foreground"}`}>
        {display.value}
      </p>
      {display.context ? (
        <p className={`mt-1 break-words text-[10px] font-semibold leading-snug ${inverted ? "text-white/58" : "text-muted-foreground/70"}`}>{display.context}</p>
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
  const all = groups.flatMap((g) => g.metrics.map((m) => ({ ...m, groupTitle: g.title })));
  const withFigures = all.filter((m) => /[\d#]/.test(m.value));
  const ordered = [...withFigures, ...all.filter((m) => !withFigures.includes(m))];
  const unique = ordered.filter((m, i, list) => {
    const key = `${m.label.toLowerCase()}-${m.value.toLowerCase()}`;
    return list.findIndex((c) => `${c.label.toLowerCase()}-${c.value.toLowerCase()}` === key) === i;
  });
  return unique
    .map((m, i) => ({ m, i, p: getArtistMetricPriority(m) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .slice(0, 10)
    .map(({ m }) => m);
}

function getArtistMetricPriority(metric: TodayBriefMetric) {
  const text = `${metric.label} ${metric.context ?? ""}`.toLowerCase();
  const priorities = [
    /monthly listeners?/, /followers.*all|saved platforms|platform followers/,
    /artist score|\bscore\b/, /country rank|uk rank|rank/,
    /london/, /lagos/, /playlist/, /shazam/, /instagram/, /tiktok followers?/,
  ];
  const p = priorities.findIndex((pat) => pat.test(text));
  return p === -1 ? priorities.length : p;
}

function buildVisibleFallbackBrief(profile: ArtistProfileViewModel): TodayBriefViewModel {
  return {
    headlineRead: `${profile.name}'s first management read is ready to organize around a focused starting point.`,
    intelligenceSnapshot: [{
      title: "Current Music In View",
      insight: "The workspace has enough saved setup context to choose the first management focus.",
      metrics: [
        { label: "Artist profile", value: "Saved", context: "setup context", evidenceIds: ["artist-profile"] },
        { label: "Working catalog", value: "In view", context: "current management focus", evidenceIds: ["catalog-setup"] },
      ],
    }],
    snapshotSummary: "The first read should organize the workspace around one management focus, not a generic artist profile.",
    managerRead: `This is the first operating read for ${profile.name}. The useful move is not to spread attention across every possible lane; it is to choose the first management focus from the saved profile and current music in view, then let the team build the next work from that center.`,
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
