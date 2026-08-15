import { ArrowRight, BriefcaseBusiness, MessageCircle, Play } from "lucide-react";

import type { MissionViewModel } from "../../types/cleanProduction";
import type { SongCampaignState } from "./songCampaign";

export function ReleaseWorkAttachment({
  missions = [],
  campaign,
  onOpenPlan,
  onTalkToManager,
  onOpenCampaign,
}: {
  missions?: MissionViewModel[];
  campaign?: SongCampaignState;
  onOpenPlan?: (missionId: string) => void;
  onTalkToManager?: () => void;
  onOpenCampaign?: () => void;
}) {
  if (!missions.length && !onTalkToManager) return null;

  const postRelease = campaign?.phase === "post_release";
  const activeCampaign = Boolean(campaign?.visible);
  const title = activeCampaign
    ? postRelease ? "Campaign" : "Release campaign"
    : postRelease ? "Grow this record" : "Work on this song";
  const copy = activeCampaign
    ? postRelease
      ? "Continue servicing this record with Manager, or open the campaign when you want the full operating view."
      : "Continue the release with Manager, or open the campaign when you want the full operating view."
    : postRelease
      ? "Manager can research opportunities and prepare the materials this record needs when you decide to work it."
      : "Continue the conversation or open a linked mission.";
  const managerLabel = activeCampaign ? "Continue with Manager" : postRelease ? "Start with Manager" : "Talk to Manager";

  return (
    <section role="region" aria-label="Work on this song" className="surface-elevated overflow-hidden rounded-[16px] shadow-sm lg:sticky lg:top-5 lg:rounded-[22px]">
      <div className="border-b border-foreground/8 p-4 sm:p-5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-foreground/[0.055] text-muted-foreground">
          <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
        </span>
        <h4 className="mt-3 font-display text-[17px] font-semibold leading-tight text-foreground">{title}</h4>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground">{copy}</p>
        {onTalkToManager ? (
          <button type="button" aria-label={managerLabel} onClick={onTalkToManager} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-accent/30">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {managerLabel}
          </button>
        ) : null}
        {activeCampaign && onOpenCampaign ? (
          <button type="button" aria-label="Open campaign" onClick={onOpenCampaign} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-foreground/10 px-3 text-[11px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.035] focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
            Open campaign
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {missions.length ? (
        <div className="divide-y divide-foreground/7">
          {missions.map((mission) => (
            <button key={mission.id} type="button" aria-label={`Open mission ${mission.title}`} onClick={() => onOpenPlan?.(mission.id)} disabled={!onOpenPlan} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-foreground/[0.025] disabled:cursor-default sm:px-5">
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">{mission.title}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
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
