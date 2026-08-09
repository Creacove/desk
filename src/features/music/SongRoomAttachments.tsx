import { ArrowRight, Disc3, MessageCircle, Play } from "lucide-react";

import type { MissionViewModel } from "../../types/cleanProduction";

export function ReleaseWorkAttachment({
  mission,
  blocker,
  onOpenPlan,
  onTalkToManager,
}: {
  mission?: MissionViewModel;
  blocker?: string;
  onOpenPlan?: () => void;
  onTalkToManager?: () => void;
}) {
  if (!mission && !onTalkToManager) return null;
  const meaningfulBlocker = blocker && !["none", "no active blocker"].includes(blocker.trim().toLowerCase()) ? blocker : undefined;

  return (
    <section role="region" aria-label="Release work" className="surface-elevated overflow-hidden rounded-[16px] shadow-sm lg:rounded-[22px]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-foreground/[0.055] text-muted-foreground">
            <Disc3 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/78">Release work</p>
            <p className="mt-1 text-[14px] font-semibold leading-snug text-foreground">{mission?.title ?? "Work with your Manager"}</p>
            {mission?.nextTask ? <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted-foreground">{mission.nextTask}</p> : null}
            {meaningfulBlocker ? <p className="mt-1.5 text-[11px] font-semibold text-warning">{meaningfulBlocker}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onTalkToManager ? (
            <button type="button" aria-label="Talk to Manager" onClick={onTalkToManager} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-foreground/10 bg-background px-3 text-[11px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Talk to Manager
            </button>
          ) : null}
          {mission && onOpenPlan ? (
            <button type="button" aria-label="Open plan" onClick={onOpenPlan} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-accent/30">
              Open plan
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {mission ? (
        <div className="h-0.5 bg-foreground/[0.055]">
          <span className="block h-full bg-brand-accent transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, mission.progress))}%` }} />
        </div>
      ) : null}
    </section>
  );
}

export function SongContextAttachment({
  title,
  artworkUrl,
  stage,
  canPlay,
  onPlay,
  onOpenSong,
}: {
  title: string;
  artworkUrl?: string;
  stage?: string;
  canPlay?: boolean;
  onPlay?: () => void;
  onOpenSong: () => void;
}) {
  return (
    <section data-testid="linked-song-attachment" aria-label={`Song: ${title}`} className="flex min-w-0 items-center gap-3 rounded-[14px] border border-foreground/8 bg-background/72 p-3">
      <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-foreground/[0.06] text-[12px] font-semibold text-muted-foreground">
        {artworkUrl ? <img src={artworkUrl} alt="" className="h-full w-full object-cover" /> : title.slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-foreground">{title}</span>
        {stage ? <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{stage}</span> : null}
      </span>
      {canPlay && onPlay ? (
        <button type="button" aria-label={`Play ${title}`} onClick={onPlay} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden="true" />
        </button>
      ) : null}
      <button type="button" aria-label={`Open song ${title}`} onClick={onOpenSong} className="shrink-0 text-[11px] font-semibold text-brand-accent hover:underline focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
        Open song
      </button>
    </section>
  );
}
