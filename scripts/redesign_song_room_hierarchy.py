from pathlib import Path

path = Path("src/features/music/MusicScreens.tsx")
text = path.read_text()


def replace_region(source: str, start_marker: str, end_marker: str, replacement: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[:start] + replacement.rstrip() + "\n\n" + source[end:]


song_overview = r'''function SongOverviewRead({
  song,
  onGenerateBrief,
  onContinueWithManager,
  briefPending,
  briefError,
}: {
  song: MusicObjectViewModel;
  onGenerateBrief: () => void;
  onContinueWithManager?: () => void;
  briefPending: boolean;
  briefError: string | null;
}) {
  const read = song.managerRead;
  const readBody = typeof read?.body === "string" ? read.body.trim() : "";
  const hasRead = Boolean(readBody);
  const readBusy = briefPending || isActiveManagerRead(song.managerReadStatus);
  const failed = song.managerReadStatus === "failed" || song.managerReadStatus === "refresh_failed" || Boolean(briefError);
  const checking = song.managerReadStatus === "unknown";
  const actionLabel = failed ? "Retry review" : checking ? "Check review" : hasRead ? "Refresh review" : "Review record";

  if (!hasRead) {
    return (
      <section data-testid="song-room-overview-read" className="pt-1 sm:pt-2">
        <div className="flex min-h-11 items-center justify-between gap-4 border-y border-foreground/8 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {readBusy ? <AppThinkingOrb surface="normal" state="composing" size={20} /> : <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground/52" aria-hidden="true" />}
            <span className="truncate text-[12px] font-semibold text-muted-foreground/72">
              {readBusy ? "Manager is reviewing this record" : failed ? "Manager review needs another try" : checking ? "Checking Manager review" : "Manager review"}
            </span>
          </div>
          {!readBusy ? (
            <button
              type="button"
              onClick={onGenerateBrief}
              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 px-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
            >
              {failed ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> : checking ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {actionLabel}
            </button>
          ) : null}
        </div>
        {briefError ? <p role="alert" className="mt-2 text-[11px] font-medium text-warning">{briefError}</p> : null}
      </section>
    );
  }

  return (
    <section data-testid="song-room-overview-read" className="pt-1 sm:pt-2">
      <div className="flex items-center justify-between gap-4">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/65">What matters now</p>
        <button
          type="button"
          aria-label={briefPending ? "Refreshing record review" : actionLabel}
          title={briefPending ? "Refreshing record review" : actionLabel}
          onClick={onGenerateBrief}
          disabled={readBusy}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25 disabled:opacity-40"
        >
          {readBusy ? <AppThinkingOrb surface="normal" state="composing" size={20} /> : managerReadButtonIcon(song.managerReadStatus)}
        </button>
      </div>
      {failed ? <p className="mt-3 text-[11px] font-medium text-muted-foreground">Couldn’t refresh just now. Showing the last review.</p> : null}
      <div className="mt-3 max-w-3xl">
        <p className="whitespace-pre-line text-[14px] font-medium leading-6 text-foreground/90 sm:text-[15px] sm:leading-6">{readBody}</p>
        {onContinueWithManager ? (
          <button type="button" onClick={onContinueWithManager} className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground transition-colors hover:text-brand-accent">
            Continue with Manager <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </section>
  );
}'''

music_detail_top = r'''function MusicDetailTop({ object, label, onBack, onStageChange, onOpenManager }: { object: MusicObjectViewModel; label: string; onBack: () => void; onStageChange?: (stage: string) => void; onOpenManager?: () => void }) {
  const stageValue = object.lifecycleStage ?? object.lifecycle;
  const lockedReleasedStage = object.kind === "song" && isLockedReleasedStage(stageValue);
  const objectLabel = object.kind === "song" ? "Song" : "Project";

  const stageControl = object.kind === "song" && !lockedReleasedStage ? (
    <select
      aria-label="Song stage"
      defaultValue={stageValue}
      onChange={(event) => onStageChange?.(event.target.value.toLowerCase())}
      className="h-8 rounded-[9px] border border-foreground/10 bg-background px-2.5 text-[10px] font-semibold text-foreground focus:border-foreground focus:outline-none"
    >
      {["Idea", "Recording", "Production", "Mixing", "Mastering", "Ready", "Scheduled", "Released", "Catalog"].map((stage) => (
        <option key={stage} value={stage}>{stage}</option>
      ))}
    </select>
  ) : (
    <span data-testid={lockedReleasedStage ? "locked-song-stage" : undefined} className="inline-flex h-8 items-center rounded-[9px] border border-foreground/8 px-2.5 text-[10px] font-semibold text-muted-foreground/68">{stageValue}</span>
  );

  return (
    <header aria-label={`${label} header`} className="border-b border-foreground/8 pb-6">
      <div data-testid="music-detail-mobile-top" className="lg:hidden">
        <button
          type="button"
          aria-label="Back to Catalog from mobile room"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-2 pr-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Catalog
        </button>
        <div className="mt-3 grid min-w-0 grid-cols-[56px_minmax(0,1fr)] items-center gap-3.5">
          <ArtworkFrame title={object.title} imageUrl={object.coverImageUrl} spotifyUrl={object.spotifyUrl} kind={object.kind} size="mini" />
          <div className="min-w-0">
            <p className="font-ui text-[9px] font-bold uppercase tracking-[0.11em] text-muted-foreground/55">{objectLabel}</p>
            <h2 data-testid="music-detail-mobile-title" className="mt-1 min-w-0 break-words [overflow-wrap:anywhere] font-display text-[24px] font-semibold leading-[1.02] tracking-[-0.03em] text-foreground">{object.title}</h2>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          {stageControl}
          {onOpenManager ? (
            <button type="button" onClick={onOpenManager} aria-label="Chat with Manager" className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-brand-accent px-4 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-accent/30">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Chat with Manager
            </button>
          ) : null}
        </div>
      </div>

      <div data-testid="music-detail-desktop-top" className="hidden lg:block">
        <button type="button" aria-label="Back to Catalog" onClick={onBack} className="inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Catalog
        </button>

        <div className="mt-5 grid min-w-0 grid-cols-[128px_minmax(0,1fr)_auto] items-center gap-6 xl:grid-cols-[144px_minmax(0,1fr)_auto] xl:gap-8">
          <ArtworkFrame title={object.title} imageUrl={object.coverImageUrl} spotifyUrl={object.spotifyUrl} kind={object.kind} size="detail" />
          <div className="min-w-0 self-center">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/52">{objectLabel}</p>
            <h2 className="mt-2 min-w-0 break-words [overflow-wrap:anywhere] font-display text-[42px] font-semibold leading-[0.94] tracking-[-0.045em] text-foreground xl:text-[50px]">{object.title}</h2>
            <div className="mt-4">{stageControl}</div>
          </div>
          {onOpenManager ? (
            <button
              type="button"
              onClick={onOpenManager}
              aria-label="Chat with Manager"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2.5 rounded-[11px] bg-brand-accent px-5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Chat with Manager
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}'''

text = replace_region(text, "function SongOverviewRead({", "function MusicManagerReadContent({", song_overview)
text = replace_region(text, "function MusicDetailTop(", "function MusicLinkedWork({", music_detail_top)

old_artwork = '    detail: "h-24 w-24 rounded-[20px]",'
new_artwork = '    detail: "h-32 w-32 rounded-[18px] xl:h-36 xl:w-36",'
if old_artwork not in text:
    raise SystemExit("missing detail artwork size anchor")
text = text.replace(old_artwork, new_artwork, 1)

path.write_text(text)
