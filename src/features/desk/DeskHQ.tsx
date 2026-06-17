import { Calendar, ChevronRight, ClipboardCheck, RefreshCw, Settings, Upload } from "lucide-react";
import { ProductButton, WorkspaceHeader } from "../../design-system/components";
import type {
  AgentViewModel,
  ArtistProfileViewModel,
  AttentionItem,
  CleanProductionView,
  DrawerKind,
  MissionViewModel,
  MovementItem,
  PriorityItem,
  TodayBriefViewModel,
} from "../../types/cleanProduction";

export function DeskHQScreen({
  profile,
  todayBrief,
  todayBriefPending,
  todayBriefError,
  priority,
  attention,
  movement,
  agents,
  missions,
  onNavigate,
  onManager,
  onGenerateTodaysBrief,
  onLockedAgent,
  onDrawer,
}: {
  profile: ArtistProfileViewModel;
  todayBrief: TodayBriefViewModel | null;
  todayBriefPending: boolean;
  todayBriefError: string | null;
  priority: PriorityItem[];
  attention: AttentionItem[];
  movement: MovementItem[];
  agents: AgentViewModel[];
  missions: MissionViewModel[];
  onNavigate: (view: CleanProductionView) => void;
  onManager: () => void;
  onGenerateTodaysBrief: () => void;
  onLockedAgent: (agent: AgentViewModel) => void;
  onDrawer: (drawer: DrawerKind) => void;
}) {
  return (
    <section>
      <WorkspaceHeader
        eyebrow="Desk Read"
        title="Desk HQ"
        action={
          <ProductButton variant="secondary" onClick={() => onNavigate("artistProfileWorkspace")}>
            <Settings className="h-4 w-4" aria-hidden="true" />
            Workspace
          </ProductButton>
        }
      />

      <div className="rounded-xl border border-foreground/10 bg-background shadow-sm mb-6">
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-foreground/10 bg-background md:grid-cols-4">
          {priority.map((item) => (
            <button
              key={item.label}
              type="button"
              className="group flex min-w-0 items-center justify-between gap-3 border-b border-r border-foreground/8 px-3 py-3 text-left transition-colors hover:bg-foreground/[0.025] even:border-r-0 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 lg:px-4 lg:py-3.5 text-left"
              aria-label={item.actionLabel}
              onClick={() => onNavigate(item.target)}
            >
              <span>
                <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{item.label}</span>
                <span className="mt-1 block text-base font-semibold">{item.value}</span>
                <span className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 block">{item.meta}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
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
            onManager={onManager}
            onDrawer={onDrawer}
          />

          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Team Agents</p>
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{agents.length} active AI units</p>
            </div>
            <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mb-4">Specialized AI agents that help the artist and their team prepare work, spot gaps, and move missions forward.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {agents.map((agent) => {
                const Icon = agent.icon;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4 text-center"
                    onClick={() => (agent.id === "manager" ? onManager() : onLockedAgent(agent))}
                  >
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="mt-3 block text-sm font-semibold">{agent.name.replace("AI ", "")}</span>
                    <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mt-2 block">{agent.status === "available" ? "Available now" : "Can prepare limited brief"}</span>
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

function TodayBrief({
  profile,
  brief,
  pending,
  error,
  onGenerate,
  onManager,
  onDrawer,
}: {
  profile: ArtistProfileViewModel;
  brief: TodayBriefViewModel;
  pending: boolean;
  error: string | null;
  onGenerate: () => void;
  onManager: () => void;
  onDrawer: (drawer: DrawerKind) => void;
}) {
  return (
    <section className="rounded-xl border border-foreground/10 bg-background shadow-sm overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
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
        <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-tight">{brief.headlineRead}</h2>
        <p className="mt-4 max-w-3xl text-[14px] font-semibold leading-relaxed text-muted-foreground/86">{brief.artistSnapshot}</p>
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <div>
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-success">What I'm seeing</p>
            <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] mt-3 p-4">
              <div className="space-y-4">
                {brief.signals.slice(0, 4).map((signal) => (
                  <div key={`${signal.claim}-${signal.evidenceIds.join("-")}`}>
                    <p className="text-[13px] font-semibold leading-relaxed text-foreground/90">{signal.claim}</p>
                    <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted-foreground/82">{signal.whyItMatters}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Manager Read</p>
            <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] mt-3 p-4">
              <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 whitespace-pre-line">{brief.managerRead}</p>
            </div>
          </div>
        </div>
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82">{brief.teamRead}</p>
          <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] mt-5 p-4">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Today's Directive</p>
            <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 mt-3">{brief.todayDirective}</p>
          </div>
          {brief.missingProof.length ? (
            <div className="mt-5">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Still missing</p>
              <ul className="mt-3 grid gap-2">
                {brief.missingProof.slice(0, 3).map((item) => (
                  <li key={item} className="text-[12px] font-medium leading-relaxed text-muted-foreground/82">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
              <button type="button" className="text-sm font-semibold text-muted-foreground" onClick={onManager}>
                Ask Manager
              </button>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] font-semibold leading-relaxed text-muted-foreground/82">{brief.sourceLine}</p>
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                Generated by AI Manager {formatBriefGeneratedAt(brief.generatedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildVisibleFallbackBrief(profile: ArtistProfileViewModel): TodayBriefViewModel {
  return {
    headlineRead: `I'm seeing ${profile.name} with enough saved setup context for a limited first operating read.`,
    artistSnapshot: "Your saved artist profile and imported catalog give the Manager a starting picture, but the first brief still needs stronger private proof before hard decisions.",
    signals: [
      {
        claim: "Your strongest current proof is that the artist identity and catalog setup are saved.",
        whyItMatters: "That gives the team a real operating starting point instead of an empty workspace.",
        evidenceIds: ["artist-profile", "catalog-setup"],
      },
    ],
    managerRead:
      "I'm seeing enough context to start the first read, but I would treat it as limited until stronger private proof is connected. I can see public setup context, but I cannot yet see whether people are saving, returning, spending, or converting.",
    teamRead: "The team should use this as the first operating read, not a final campaign or spend verdict.",
    todayDirective: "Pick the first music focus and connect stronger private proof before approving spend, revenue claims, or external commitments.",
    missingProof: ["Private saves, source-of-stream, revenue, conversion, and rights certainty are still missing."],
    sourceLine: "Based on your saved artist profile, imported catalog, public audience signals, and current source limits.",
    confidence: "limited",
    state: "fallback",
  };
}

function formatBriefGeneratedAt(value?: string) {
  if (!value) return "when sources were last prepared";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "when sources were last prepared";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
