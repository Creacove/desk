import { ArrowRight, BriefcaseBusiness, MessageCircle, Play } from "lucide-react";
import { Button, IconButton } from "../../design-system/desktopPrimitives";
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
      ? "The servicing work, materials and next move for this record live here."
      : "The release story, materials and active work live here."
    : postRelease
      ? "Start with Manager when you want to actively service this record."
      : "Manager can turn the current song state into a focused release plan.";

  return (
    <section role="region" aria-label="Work on this song" className="overflow-hidden rounded-[16px] border border-foreground/9 bg-background lg:sticky lg:top-5">
      <div className="border-b border-foreground/8 p-4 sm:p-5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-foreground/[0.05] text-muted-foreground">
          <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
        </span>
        <h4 className="mt-3 font-display text-[17px] font-semibold leading-tight tracking-[-0.015em] text-foreground">{title}</h4>
        <p className="mt-1.5 text-[12px] font-medium leading-[1.55] text-muted-foreground">{copy}</p>

        {activeCampaign && onOpenCampaign ? (
          <Button type="button" aria-label="Open campaign" onClick={onOpenCampaign} size="md" className="mt-4 w-full" trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}>
            Open campaign
          </Button>
        ) : null}
        {onTalkToManager ? (
          <Button
            type="button"
            aria-label="Work with Manager"
            onClick={onTalkToManager}
            variant={activeCampaign ? "secondary" : "primary"}
            size="md"
            className={`${activeCampaign ? "mt-2" : "mt-4"} w-full`}
            leadingIcon={<MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Work with Manager
          </Button>
        ) : null}
      </div>
      {missions.length ? (
        <div className="divide-y divide-foreground/7">
          {missions.map((mission) => (
            <button key={mission.id} type="button" aria-label={`Open mission ${mission.title}`} onClick={() => onOpenPlan?.(mission.id)} disabled={!onOpenPlan} className="group flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none transition-colors duration-150 hover:bg-foreground/[0.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/20 disabled:cursor-default sm:px-5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">{mission.title}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
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
        {stage ? <span className="mt-0.5 block text-[12px] font-medium text-muted-foreground">{stage}</span> : null}
      </span>
      {canPlay && onPlay ? (
        <IconButton type="button" label={`Play ${title}`} onClick={onPlay} variant="secondary" size="sm" className="rounded-full">
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden="true" />
        </IconButton>
      ) : null}
      <Button type="button" aria-label={`Open song ${title}`} onClick={onOpenSong} variant="ghost" size="sm">
        Open song
      </Button>
    </section>
  );
}
