from pathlib import Path

path = Path("src/features/music/MusicScreens.tsx")
source = path.read_text()


def replace_function(text: str, start_marker: str, end_marker: str, replacement: str) -> str:
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    return text[:start] + replacement.rstrip() + "\n\n" + text[end:]


song_overview_read = r'''function SongOverviewRead({
  song,
  onGenerateBrief,
  briefPending,
  briefError,
}: {
  song: MusicObjectViewModel;
  onGenerateBrief: () => void;
  briefPending: boolean;
  briefError: string | null;
}) {
  const read = song.managerRead;
  const readBusy = briefPending || isActiveManagerRead(song.managerReadStatus);
  const failed = song.managerReadStatus === "failed" || song.managerReadStatus === "refresh_failed" || Boolean(briefError);
  const checking = song.managerReadStatus === "unknown";
  const actionLabel = failed ? "Retry record review" : checking ? "Check record review" : read ? "Refresh record review" : "Review record";

  if (!read) {
    return (
      <section data-testid="song-room-overview-read" className="pt-1 sm:pt-2">
        <span className="sr-only">{managerReadStatusLabel(song.managerReadStatus)}</span>
        {readBusy ? (
          <div className="flex min-h-12 items-center gap-3 border-y border-foreground/8 py-3">
            <AppThinkingOrb surface="normal" state="composing" size={18} />
            <p className="text-[12px] font-semibold text-muted-foreground">Manager is reviewing this record…</p>
          </div>
        ) : checking ? (
          <div className="flex min-h-12 items-center justify-between gap-4 border-y border-foreground/8 py-3">
            <span className="text-[12px] font-medium text-muted-foreground">Manager review</span>
            <button type="button" onClick={onGenerateBrief} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Check review
            </button>
          </div>
        ) : (
          <div className="flex min-h-12 items-center justify-between gap-4 border-y border-foreground/8 py-3">
            <span className="min-w-0">
              <span className="block text-[12px] font-medium text-muted-foreground">Manager review</span>
              {failed ? <span className="mt-0.5 block text-[10px] font-medium text-warning">Last review did not complete.</span> : null}
            </span>
            <button
              type="button"
              aria-label={actionLabel}
              onClick={onGenerateBrief}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border border-foreground/10 bg-background px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:border-foreground/18 hover:bg-foreground/[0.035] focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
            >
              {failed ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
              {failed ? "Try again" : "Review record"}
            </button>
          </div>
        )}
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
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25 disabled:opacity-40"
        >
          {readBusy ? <AppThinkingOrb surface="normal" state="composing" size={18} /> : managerReadButtonIcon(song.managerReadStatus)}
        </button>
      </div>
      <div className="mt-4 max-w-3xl">
        {failed ? <p className="mb-3 text-[11px] font-medium text-muted-foreground">Couldn’t refresh just now. Showing the last read.</p> : null}
        <p className="whitespace-pre-line text-[14px] font-medium leading-6 text-foreground/90 sm:text-[15px] sm:leading-6">{read.body}</p>
      </div>
    </section>
  );
}'''

music_detail_top = r'''function MusicDetailTop({ object, label, onBack, onStageChange, onOpenManager }: { object: MusicObjectViewModel; label: string; onBack: () => void; onStageChange?: (stage: string) => void; onOpenManager?: () => void }) {
  const stageValue = object.lifecycleStage ?? object.lifecycle;
  const lockedReleasedStage = object.kind === "song" && isLockedReleasedStage(stageValue);
  const stageOptions = ["Idea", "Recording", "Production", "Mixing", "Mastering", "Ready", "Scheduled", "Released", "Catalog"];

  return (
    <div aria-label={`${label} header`} className="border-b border-foreground/8 pb-5 sm:pb-6">
      <div data-testid="music-detail-mobile-top" className="lg:hidden">
        <button
          type="button"
          aria-label="Back to Catalog from mobile room"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-2 rounded-[10px] pr-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Catalog
        </button>
        <div className="mt-4 grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-center gap-3.5">
          <ArtworkFrame title={object.title} imageUrl={object.coverImageUrl} spotifyUrl={object.spotifyUrl} kind={object.kind} size="mini" />
          <div className="min-w-0">
            <p className="font-ui text-[9px] font-bold uppercase tracking-[0.11em] text-muted-foreground/58">{label}</p>
            <p data-testid="music-detail-mobile-title" className="mt-1 min-w-0 break-words [overflow-wrap:anywhere] font-display text-[23px] font-semibold leading-[1.05] tracking-[-0.025em] text-foreground">{object.title}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          {object.kind === "song" && !lockedReleasedStage ? (
            <select
              aria-label="Mobile song stage"
              defaultValue={stageValue}
              onChange={(event) => onStageChange?.(event.target.value.toLowerCase())}
              className="h-9 min-w-0 rounded-[9px] border border-foreground/10 bg-background px-2.5 text-[11px] font-semibold text-foreground focus:border-foreground focus:outline-none"
            >
              {stageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          ) : <span data-testid={lockedReleasedStage ? "mobile-locked-song-stage" : undefined} className="text-[11px] font-semibold text-muted-foreground/62">{stageValue}</span>}
          {onOpenManager ? (
            <button type="button" onClick={onOpenManager} aria-label="Chat with Manager" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] bg-brand-accent px-3 text-[11px] font-bold text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-accent/35">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Manager
            </button>
          ) : null}
        </div>
      </div>

      <div data-testid="music-detail-desktop-top" className="hidden lg:block">
        <button type="button" aria-label="Back to Catalog" onClick={onBack} className="inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Catalog
        </button>

        <div className="mt-5 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 xl:gap-8">
          <ArtworkFrame title={object.title} imageUrl={object.coverImageUrl} spotifyUrl={object.spotifyUrl} kind={object.kind} size="detail" />

          <div className="min-w-0 self-center">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/58">{label}</p>
            <h2 className="mt-2 min-w-0 break-words [overflow-wrap:anywhere] font-display text-[40px] font-semibold leading-[0.95] tracking-[-0.04em] text-foreground xl:text-[48px]">{object.title}</h2>
            <div className="mt-4 flex min-h-9 items-center gap-3">
              {object.kind === "song" && !lockedReleasedStage ? (
                <select
                  aria-label="Song stage"
                  defaultValue={stageValue}
                  onChange={(event) => onStageChange?.(event.target.value.toLowerCase())}
                  className="h-9 rounded-[10px] border border-foreground/10 bg-background px-3 text-[11px] font-semibold text-foreground focus:border-foreground focus:outline-none"
                >
                  {stageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              ) : <span className="text-[11px] font-semibold text-muted-foreground/60">{stageValue}</span>}
            </div>
          </div>

          {onOpenManager ? (
            <button
              type="button"
              onClick={onOpenManager}
              aria-label="Chat with Manager"
              className="inline-flex h-11 shrink-0 items-center gap-2.5 self-center rounded-[12px] bg-brand-accent px-4.5 text-[12px] font-bold text-white shadow-[0_8px_24px_rgba(154,59,220,0.22)] transition-[opacity,transform] hover:-translate-y-px hover:opacity-92 focus:outline-none focus:ring-2 focus:ring-brand-accent/35"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Chat with Manager
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}'''

source = replace_function(source, "function SongOverviewRead({", "function MusicManagerReadContent({", song_overview_read)
source = replace_function(source, "function MusicDetailTop({", "function MusicLinkedWork({", music_detail_top)

path.write_text(source)
