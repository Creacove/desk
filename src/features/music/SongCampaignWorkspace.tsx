import { ArrowRight, BookOpenText, BriefcaseBusiness, FileText, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

import type { MusicObjectViewModel } from "../../types/cleanProduction";
import type { SongCampaignState } from "./songCampaign";

export function SongCampaignWorkspace({
  song,
  campaign,
  onContinueManager,
  onBuildReleaseKit,
  onOpenFiles,
  onOpenMission,
}: {
  song: MusicObjectViewModel;
  campaign: SongCampaignState;
  onContinueManager?: () => void;
  onBuildReleaseKit?: () => void;
  onOpenFiles: () => void;
  onOpenMission?: (missionId: string) => void;
}) {
  const postRelease = campaign.phase === "post_release";
  const hasDocuments = campaign.documents.length > 0;
  const hasNarrative = Boolean(campaign.narrative);
  const primaryAction = campaign.nextMove === "build_release_kit" ? onBuildReleaseKit ?? onContinueManager : onContinueManager;
  const primaryLabel = campaign.nextMove === "build_release_kit"
    ? hasNarrative ? "Complete release kit with Manager" : "Build campaign with Manager"
    : "Continue with Manager";

  return (
    <section data-testid="song-campaign-workspace" aria-label={`Campaign for ${song.title}`} className="mx-auto max-w-4xl">
      <header className="border-b border-foreground/8 pb-6 sm:pb-7">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {postRelease ? "Record campaign" : "Release campaign"}
        </p>
        <h2 className="mt-2 max-w-2xl font-display text-[28px] font-semibold leading-[1.06] tracking-tight text-foreground sm:text-[34px]">
          {postRelease ? "Keep this record moving." : "One story. One release system."}
        </h2>
        <p className="mt-3 max-w-2xl text-[13px] font-medium leading-6 text-muted-foreground">
          {postRelease
            ? "The campaign keeps one narrative, the current materials, servicing work and next decision attached to this record."
            : "The narrative comes first. Manager then turns that strategy into the specific materials and work this release actually needs."}
        </p>
        {primaryAction ? (
          <button
            type="button"
            onClick={primaryAction}
            className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] bg-foreground px-4 py-2.5 text-[12px] font-semibold text-background transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {primaryLabel}
          </button>
        ) : null}
      </header>

      <div className="divide-y divide-foreground/8">
        <CampaignRow
          eyebrow="Campaign spine"
          title={hasNarrative ? "Release narrative established" : "Start with the release narrative"}
          body={hasNarrative
            ? "This is the internal source story for positioning, audience, proof, creative world and language. The EPK, bio, one-sheet, press copy and pitches should inherit it."
            : "Before making assets, Manager should establish what this release means, who it is for, why it matters now, what proves the story and what language the campaign should avoid."}
          icon={<BookOpenText className="h-4 w-4" aria-hidden="true" />}
          actionLabel={hasNarrative ? "Open in Files" : primaryAction ? primaryLabel : undefined}
          onAction={hasNarrative ? onOpenFiles : primaryAction}
        />

        <CampaignRow
          eyebrow="Release kit"
          title={hasDocuments
            ? `${campaign.documents.length} campaign ${campaign.documents.length === 1 ? "artifact" : "artifacts"} prepared`
            : hasNarrative ? "Narrative ready. Build only the artifacts the campaign needs." : "No disconnected templates"}
          body={hasDocuments
            ? "These are canonical song artifacts, not chat answers. Open Files to read the structured copy first and edit only when you want to take manual control."
            : "Manager should not manufacture an EPK, one-sheet, bio, press release and pitches just to fill a checklist. It should create the smallest high-quality kit justified by the release and its next move."}
          icon={<FileText className="h-4 w-4" aria-hidden="true" />}
          actionLabel="Open Files"
          onAction={onOpenFiles}
        />

        {campaign.mission ? (
          <CampaignRow
            eyebrow="Active work"
            title={campaign.mission.title}
            body={campaign.mission.nextTask || campaign.mission.recommendation || campaign.mission.summary}
            icon={<BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />}
            actionLabel={onOpenMission ? "Open mission" : undefined}
            onAction={onOpenMission ? () => onOpenMission(campaign.mission!.id) : undefined}
          />
        ) : null}

        <CampaignRow
          eyebrow="Opportunities"
          title={postRelease ? "Research only when it can move the record." : "Outreach begins when the story and material are ready."}
          body={postRelease
            ? "Manager can research, rank and prepare target-specific playlist or press opportunities without turning this song into a CRM dashboard."
            : "Manager can research the right targets, prepare recipient-specific material and preserve the evidence behind each recommendation when the campaign reaches that point."}
          icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          actionLabel={onContinueManager ? "Review with Manager" : undefined}
          onAction={onContinueManager}
        />
      </div>
    </section>
  );
}

function CampaignRow({
  eyebrow,
  title,
  body,
  icon,
  actionLabel,
  onAction,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="grid gap-3 py-5 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4 sm:py-6">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-foreground/[0.05] text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-ui text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{eyebrow}</p>
        <h3 className="mt-1 text-[14px] font-semibold leading-snug text-foreground">{title}</h3>
        <p className="mt-1.5 max-w-2xl text-[12px] font-medium leading-5 text-muted-foreground">{body}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg px-2.5 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.045] focus:outline-none focus:ring-2 focus:ring-brand-accent/25 sm:justify-self-end"
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
