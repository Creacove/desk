import { Bell, ChevronRight, RefreshCw } from "lucide-react";
import { useState } from "react";
import { WorkspaceHeader } from "../../design-system/components";
import { Button, ManagerComposer as ManagerWorkComposer } from "../../design-system/desktopPrimitives";
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
import { splitAttentionItems } from "./deskAttention";

type DeskHQProps = {
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
  briefPending?: boolean;
  onRefreshBrief?: () => void;
};

type DeskSignalMetric = {
  label: string;
  value: string;
  context: string;
  sourceFamily: string;
  qualityTier: number;
};

type CompactArtistMetric = TodayBriefMetric & { groupTitle: string };
type ManagerReadSegment = { label: string; body: string };

const MANAGER_READ_LABELS = ["Artist Intelligence", "Momentum", "Today’s Move", "Key Signal"];

export function DeskHQScreen({
  profile,
  todayBrief,
  todayBriefError,
  attention,
  movement,
  onNavigate,
  onDrawer,
  onAskManager,
  activityCount,
  onOpenActivityCenter,
  briefPending = false,
  onRefreshBrief,
}: DeskHQProps) {
  const brief = todayBrief ?? buildVisibleFallbackBrief(profile);
  const { actionable } = splitAttentionItems(attention);
  const rightNowItems = actionable.slice(0, 2);
  const metrics = buildDeskMetricTiles(brief);
  const managerReadSegments = buildManagerReadSegments(brief);
  const visibleActivityCount = activityCount ?? actionable.length + movement.length;
  const updatedAt = formatBriefGeneratedAt(brief.generatedAt);

  return (
    <section className="app-workspace app-workspace-reveal home-workspace relative isolate min-w-0 pb-12">
      <WorkspaceHeader
        title="Home"
        action={(
          <ActivityButton
            count={visibleActivityCount}
            onOpen={onOpenActivityCenter ?? (() => undefined)}
          />
        )}
      />

      <HomeManagerComposer onAskManager={onAskManager} />

      <section data-testid="desk-editorial-brief" className="mt-8 sm:mt-10">
        <BriefSectionHeader
          updatedAt={updatedAt}
          pending={briefPending}
          error={todayBriefError}
          canRefresh={Boolean(onRefreshBrief)}
          onRefresh={onRefreshBrief}
        />

        <div
          data-testid="desk-brief-composition"
          className={rightNowItems.length
            ? "mt-5 grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-10"
            : "mt-5 min-w-0"}
        >
          <div className="min-w-0">
            <p
              data-testid="desk-brief-headline"
              className="max-w-[62rem] break-words font-display font-semibold leading-[1.08] tracking-[-0.035em] text-foreground [overflow-wrap:anywhere]"
              style={{ fontSize: "clamp(28px, 2.35vw, 36px)" }}
            >
              {brief.headlineRead}
            </p>
          </div>

          {rightNowItems.length ? (
            <RightNow
              items={rightNowItems}
              onNavigate={onNavigate}
              onDrawer={onDrawer}
            />
          ) : null}
        </div>
      </section>

      {metrics.length ? <SignalMetricStrip metrics={metrics} /> : null}

      <ManagerRead
        segments={managerReadSegments}
        onEvidence={() => onDrawer("evidence")}
      />
    </section>
  );
}

function ActivityButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="md"
      aria-label={count ? `Open Activity Center, ${count} unread` : "Open Activity Center"}
      onClick={onOpen}
      leadingIcon={<Bell className="h-4 w-4" aria-hidden="true" />}
      className="relative"
    >
      <span>Activity</span>
      {count ? (
        <span className="inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-brand-accent px-1.5 text-[11px] font-semibold leading-none text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Button>
  );
}

function HomeManagerComposer({ onAskManager }: { onAskManager: (body: string) => void }) {
  const [draft, setDraft] = useState("");

  function submit() {
    const body = draft.trim();
    if (!body) return;
    onAskManager(body);
    setDraft("");
  }

  return (
    <ManagerWorkComposer
      value={draft}
      onChange={setDraft}
      onSubmit={submit}
      ariaLabel="Work with Manager"
      placeholder="What do you want to work on?"
      className="max-w-[900px]"
    />
  );
}

function BriefSectionHeader({
  updatedAt,
  pending,
  error,
  canRefresh,
  onRefresh,
}: {
  updatedAt: string | null;
  pending: boolean;
  error: string | null;
  canRefresh: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-foreground/8 pt-4">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/72">Today&apos;s Brief</p>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
        {updatedAt ? <span className="text-[12px] font-medium text-muted-foreground/62">Updated {updatedAt}</span> : null}
        {canRefresh ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={pending ? "Refreshing Today's Brief" : "Refresh Today's Brief"}
            pending={pending}
            onClick={onRefresh}
            leadingIcon={!pending ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : undefined}
          >
            Refresh
          </Button>
        ) : null}
        {error ? (
          <span data-testid="desk-brief-refresh-error" className="basis-full text-right text-[12px] font-medium text-warning">
            Couldn&apos;t refresh{canRefresh && !pending ? (
              <button type="button" onClick={onRefresh} className="ml-1 font-semibold underline decoration-warning/45 underline-offset-2 hover:decoration-warning">
                Try again
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RightNow({
  items,
  onNavigate,
  onDrawer,
}: {
  items: AttentionItem[];
  onNavigate: (view: CleanProductionView) => void;
  onDrawer: (drawer: DrawerKind) => void;
}) {
  return (
    <aside
      data-testid="desk-right-now"
      className="min-w-0 border-t border-foreground/8 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
    >
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/72">Right now</p>
      <div className="mt-2 divide-y divide-foreground/8 border-b border-foreground/8">
        {items.map((item, index) => (
          <button
            key={`${item.title}-${index}`}
            type="button"
            aria-label={`Open ${item.title}`}
            onClick={() => openAttentionItem(item, onNavigate, onDrawer)}
            className="group flex w-full items-start justify-between gap-3 py-4 text-left outline-none transition-colors duration-150 hover:bg-foreground/[0.018] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/20"
          >
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold leading-snug text-foreground">{item.title}</span>
              <span className="mt-1.5 block text-[12px] font-medium leading-[1.55] text-muted-foreground">{item.body}</span>
            </span>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
          </button>
        ))}
      </div>
    </aside>
  );
}

function openAttentionItem(
  item: AttentionItem,
  onNavigate: (view: CleanProductionView) => void,
  onDrawer: (drawer: DrawerKind) => void,
) {
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

function SignalMetricStrip({ metrics }: { metrics: DeskSignalMetric[] }) {
  return (
    <section data-testid="desk-signal-metric-strip" className="mt-8 sm:mt-9">
      <div className={`grid border-y border-foreground/8 ${metricGridClass(metrics.length)}`}>
        {metrics.map((metric, index) => (
          <article
            key={`${metric.label}-${metric.value}-${index}`}
            data-testid="desk-signal-metric"
            className={`min-w-0 bg-transparent px-4 py-5 first:pl-0 lg:min-h-[98px] lg:px-6 lg:py-6 ${metricCellBorderClass(index, metrics.length)}`}
          >
            <p className="break-words text-[12px] font-medium leading-[1.35] text-muted-foreground [overflow-wrap:anywhere]">{metric.label}</p>
            <p className="mt-2 break-words text-[22px] font-semibold leading-none tracking-[-0.018em] text-foreground sm:text-[24px] [overflow-wrap:anywhere]">{metric.value}</p>
            {metric.context ? <p className="mt-1.5 break-words text-[12px] font-medium leading-snug text-muted-foreground/62 [overflow-wrap:anywhere]">{metric.context}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function metricGridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-1 sm:grid-cols-3";
  return "grid-cols-2 lg:grid-cols-4";
}

function metricCellBorderClass(index: number, count: number) {
  if (count <= 1) return "";
  if (count === 2) return index === 0 ? "border-r border-foreground/8" : "";
  if (count === 3) {
    if (index === 0) return "border-b border-foreground/8 sm:border-b-0 sm:border-r";
    if (index === 1) return "border-b border-foreground/8 sm:border-b-0 sm:border-r sm:border-foreground/8";
    return "";
  }
  if (index === 0) return "border-b border-r border-foreground/8 lg:border-b-0";
  if (index === 1) return "border-b border-foreground/8 lg:border-b-0 lg:border-r";
  if (index === 2) return "border-r border-foreground/8";
  return "";
}

function ManagerRead({
  segments,
  onEvidence,
}: {
  segments: ManagerReadSegment[];
  onEvidence: () => void;
}) {
  if (!segments.length) return null;

  return (
    <section data-testid="desk-manager-read" className="mt-9 sm:mt-11">
      <div className="flex items-end justify-between gap-4">
        <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/72">Manager&apos;s Read</p>
        <Button type="button" variant="ghost" size="sm" onClick={onEvidence}>Evidence</Button>
      </div>

      <div data-testid="desk-manager-read-grid" className="mt-3 grid border-y border-foreground/8 lg:grid-cols-2">
        {segments.map((segment, index) => (
          <article
            key={`${segment.label}-${index}`}
            data-testid="desk-manager-read-segment"
            className={`min-w-0 py-5 sm:py-6 lg:px-7 lg:py-7 lg:first:pl-0 ${managerReadCellClass(index, segments.length)}`}
          >
            <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-4">
              <span className="font-mono text-[11px] font-semibold leading-5 text-muted-foreground/48">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/68">{segment.label}</p>
                <p className="mt-2 max-w-[42rem] break-words text-[15px] font-medium leading-[1.65] text-foreground/84 [overflow-wrap:anywhere] sm:text-[16px]">{segment.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function managerReadCellClass(index: number, count: number) {
  const mobileBorder = index < count - 1 ? "border-b border-foreground/8" : "";
  if (count === 1) return mobileBorder;
  if (count === 2) return `${mobileBorder} ${index === 0 ? "lg:border-b-0 lg:border-r" : "lg:border-b-0"}`;
  if (count === 3) {
    if (index === 0) return "border-b border-foreground/8 lg:border-r";
    if (index === 1) return "border-b border-foreground/8";
    return "lg:col-span-2 lg:border-b-0";
  }
  if (index === 0) return "border-b border-foreground/8 lg:border-r";
  if (index === 1) return "border-b border-foreground/8";
  if (index === 2) return "border-b border-foreground/8 lg:border-b-0 lg:border-r";
  return "lg:border-b-0";
}

function buildDeskMetricTiles(brief: TodayBriefViewModel): DeskSignalMetric[] {
  return selectArtistIntelligenceMetrics(brief.intelligenceSnapshot).map((metric) => {
    const display = formatArtistMetricDisplay(metric);
    return {
      ...display,
      sourceFamily: metricSourceFamily(metric),
      qualityTier: getArtistMetricQualityTier(metric),
    };
  });
}

function selectArtistIntelligenceMetrics(groups: TodayBriefSnapshotGroup[]): CompactArtistMetric[] {
  const all = groups.flatMap((group) => group.metrics.map((metric) => ({ ...metric, groupTitle: group.title })));
  const unique = all.filter((metric, index, list) => {
    const key = `${metric.label.toLowerCase()}-${metric.value.toLowerCase()}`;
    return list.findIndex((candidate) => `${candidate.label.toLowerCase()}-${candidate.value.toLowerCase()}` === key) === index;
  });
  const ranked = unique.map((metric, index) => ({
    metric,
    index,
    tier: getArtistMetricQualityTier(metric),
    source: metricSourceFamily(metric),
  }));
  const selected: typeof ranked = [];

  for (const tier of [0, 1, 2, 3]) {
    if (selected.length >= 4) break;
    const candidates = ranked.filter((candidate) => candidate.tier === tier && !selected.includes(candidate));
    const usedSources = new Set(selected.map((candidate) => candidate.source).filter((source) => source !== "other"));

    for (const candidate of candidates) {
      if (selected.length >= 4) break;
      if (candidate.source !== "other" && usedSources.has(candidate.source)) continue;
      selected.push(candidate);
      if (candidate.source !== "other") usedSources.add(candidate.source);
    }

    for (const candidate of candidates) {
      if (selected.length >= 4) break;
      if (selected.includes(candidate)) continue;
      selected.push(candidate);
    }
  }

  return selected
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .slice(0, 4)
    .map(({ metric }) => metric);
}

function getArtistMetricQualityTier(metric: TodayBriefMetric) {
  const text = `${metric.label} ${metric.context ?? ""}`.toLowerCase();
  if (/monthly listeners?|followers?|views?|streams?|shazam|top market|top city|audience|saves?/.test(text)) return 0;
  if (/rank|playlist|engagement|reach|creates?|listeners?/.test(text)) return 1;
  if (/[\d#]/.test(metric.value)) return 2;
  return 3;
}

function metricSourceFamily(metric: CompactArtistMetric) {
  const text = `${metric.groupTitle} ${metric.label} ${metric.context ?? ""}`.toLowerCase();
  if (/spotify/.test(text)) return "spotify";
  if (/tiktok|tik tok/.test(text)) return "tiktok";
  if (/youtube/.test(text)) return "youtube";
  if (/instagram/.test(text)) return "instagram";
  if (/shazam/.test(text)) return "shazam";
  if (/apple music/.test(text)) return "apple-music";
  return "other";
}

function formatArtistMetricDisplay(metric: CompactArtistMetric) {
  const valueParts = metric.value.match(/^(.+?)\s+\((.+)\)$/);
  const value = valueParts?.[1]?.trim() || metric.value;
  const parentheticalContext = valueParts?.[2]?.trim();
  const source = metricSourceFamily(metric);
  const rawLabel = metric.label.replace(/\s+[—-]\s+/g, " - ").trim();
  const label = scopeMetricLabel(rawLabel, source);
  return {
    label,
    value,
    context: [metric.context, parentheticalContext].filter(Boolean).join(" / "),
  };
}

function scopeMetricLabel(label: string, source: string) {
  const lower = label.toLowerCase();
  if (source === "shazam") {
    if (/^shazam(?: count|s)?$/i.test(label)) return "Shazams";
    return /shazam/.test(lower) ? label : `Shazam ${label}`;
  }

  const sourceLabel = source === "spotify" ? "Spotify"
    : source === "tiktok" ? "TikTok"
    : source === "youtube" ? "YouTube"
    : source === "instagram" ? "Instagram"
    : source === "apple-music" ? "Apple Music"
    : null;
  if (!sourceLabel || lower.includes(sourceLabel.toLowerCase())) return label;

  const ambiguousPlatformMetric = /^(monthly listeners?|listeners?|followers?|views?|streams?|saves?|playlist reach|engagement|video creates?)$/i.test(label);
  return ambiguousPlatformMetric ? `${sourceLabel} ${label.toLowerCase()}` : label;
}

function buildManagerReadSegments(brief: TodayBriefViewModel): ManagerReadSegment[] {
  const parsed = parseManagerRead(brief.managerRead);
  const structured = (brief.managerEvidenceReads ?? [])
    .filter((read) => read.read.trim())
    .map((read) => ({ label: read.label.trim() || "Manager Read", body: sanitizeManagerRead(read.read) }))
    .filter((segment) => segment.body)
    .slice(0, 4);

  if (parsed.length > 1 || !structured.length) return parsed.slice(0, 4);
  if (structured.length > parsed.length) return structured;
  return parsed.slice(0, 4);
}

function parseManagerRead(read: string): ManagerReadSegment[] {
  const sanitized = sanitizeManagerRead(read);
  if (!sanitized) return [];
  const paragraphs = sanitized
    .split(/\n{2,}/)
    .flatMap((block) => block.split(/\n/).map((line) => line.trim()).filter(Boolean))
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return paragraphs.slice(0, 4).map((paragraph, index) => {
    const match = paragraph.match(/^([A-Z][A-Za-z\s\-’']{2,40}):\s+(.+)$/s);
    if (match) return { label: match[1].trim(), body: match[2].trim() };
    return { label: MANAGER_READ_LABELS[index] ?? "Manager Read", body: paragraph };
  });
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

function buildVisibleFallbackBrief(profile: ArtistProfileViewModel): TodayBriefViewModel {
  return {
    headlineRead: `${profile.name}'s first management read is ready to organize around a focused starting point.`,
    intelligenceSnapshot: [],
    snapshotSummary: "The first read should organize the workspace around one management focus, not a generic artist profile.",
    managerRead: `This is the first operating read for ${profile.name}. The useful move is to choose the first management focus from the saved profile and current music in view, then let the team build the next work from that center.`,
    sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
    confidence: "limited",
    state: "fallback",
  };
}

function formatBriefGeneratedAt(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
