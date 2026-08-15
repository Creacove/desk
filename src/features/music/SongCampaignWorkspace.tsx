import { ArrowRight, BriefcaseBusiness, FileText, MessageCircle } from "lucide-react";
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
  const primaryAction = campaign.nextMove === "build_release_kit" ? onBuildReleaseKit ?? onContinueManager : onContinueManager;
  const primaryLabel = campaign.nextMove === "build_release_kit"
    ? "Build release kit with Manager"
    : "Continue with Manager";

  return (
    <section data-testid="song-campaign-workspace" aria-label={`Campaign for ${song.title}`} className="mx-auto max-w-4xl">
      <header className="border-b border-foreground/8 pb-6 sm:pb-7">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {postRelease ? "Record campaign" : "Release campaign"}
        </p>
        <h2 className="mt-2 max-w-2xl font-display text-[28px] font-semibold leading-[1.06] tracking-tight text-foreground sm:text-[34px]">
          {postRelease ? "Keep this record moving." : "Manage the release from one place."}
        </h2>
        <p className="mt-3 max-w-2xl text-[13px] font-medium leading-6 text-muted-foreground">
          {postRelease
            ? "Manager keeps the current materials, servicing work and next campaign decision attached to this record."
            : "Manager keeps the release materials, active work and next decision together without making you manage separate tools."}
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
          eyebrow="Next move"
          title={campaign.nextMove === "build_release_kit"
            ? postRelease
              ? "Build the materials this record needs for the next servicing wave."
              : "Build the release kit before outreach starts."
            : postRelease
              ? "Continue from the work already attached to this record."
              : "Continue the campaign from the materials already prepared."}
          body={campaign.nextMove === "build_release_kit"
            ? postRelease
              ? "Manager can create the relevant EPK, bio, one-sheet, press angles and pitches without reopening pre-release gates."
              : "Manager can prepare the EPK, bio, one-sheet, press angles, channel-ready pitches and other materials this release actually needs."
            : "Manager should inspect the current campaign state first, then recommend the highest-value next action instead of making you choose a tool."}
          icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
          actionLabel={primaryAction ? primaryLabel : undefined}
          onAction={primaryAction}
        />

        <CampaignRow
          eyebrow="Release kit"
          title={hasDocuments
            ? `${campaign.documents.length} campaign ${campaign.documents.length === 1 ? "material" : "materials"} in Files`
            : "No campaign materials prepared yet"}
          body={hasDocuments
            ? "These are canonical song documents. Open Files when you want to inspect or revise the underlying material."
            : "The kit stays empty until there is real work to save. Manager can create it when the campaign needs it."}
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
          title={postRelease ? "Playlist and press servicing stays with Manager." : "Research starts when the campaign is ready for outreach."}
          body={postRelease
            ? "Manager can research, rank and prepare target-specific playlist or press opportunities without turning this song into a CRM dashboard."
            : "When it is time to pitch, Manager can research the right targets, prepare the outreach and keep the evidence attached to this song."}
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
