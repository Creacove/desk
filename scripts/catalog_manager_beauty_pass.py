from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f"missing start anchor: {label}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f"missing end anchor: {label}")
    return text[:start_index] + replacement + text[end_index:]


# ---------------------------------------------------------------------------
# Shared room header: left-edge navigation, no centered-header illusion.
# Conversation content may stay constrained; navigation should not.
components_path = Path("src/design-system/components.tsx")
components = components_path.read_text()
components = replace_once(
    components,
    '          <div className="mx-auto flex max-w-[48rem] items-center gap-3">',
    '          <div className="flex w-full items-center gap-2">',
    "conversation header alignment",
)
components_path.write_text(components)


# ---------------------------------------------------------------------------
# Catalog: remove redundant copy, unify Songs + Projects, and make rooms feel
# like one music product rather than separate dashboard templates.
music_path = Path("src/features/music/MusicScreens.tsx")
music = music_path.read_text()

music = replace_once(
    music,
    '''          <WorkspaceHeader eyebrow="Catalog" title="Catalog" />
          <section data-testid="music-library" className="grid gap-6">
            <div className="flex flex-col gap-4 border-b border-foreground/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/58">Music workspace</p>
                <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-muted-foreground/76 sm:text-[14px]">
                  Songs and projects connected to active work.
                </p>
              </div>
              <div data-testid="music-mobile-controls" className="flex w-full flex-row items-center justify-between gap-2 sm:w-auto sm:justify-end">''',
    '''          <WorkspaceHeader title="Catalog" />
          <section data-testid="music-library" className="grid gap-5">
            <div className="flex w-full items-center justify-between gap-3 border-b border-foreground/8 pb-4">
              <div data-testid="music-mobile-controls" className="flex w-full flex-row items-center justify-between gap-2 sm:w-auto sm:justify-start">''',
    "Catalog header simplification",
)
# Close the now-single control wrapper instead of the removed text/toolbar wrapper.
music = replace_once(
    music,
    '''              </div>
            </div>

            <div className="sr-only" aria-live="polite">''',
    '''              </div>
            </div>

            <div className="sr-only" aria-live="polite">''',
    "Catalog controls close",
)

music = replace_once(
    music,
    '''            <div data-testid="music-mobile-library" className="grid gap-2 lg:hidden">
              {tab === "songs"
                ? songs.map((song, index) => (
                    <MusicMobileSongRow key={song.id} song={song} index={index} onOpen={() => openObject(song, "songs")} />
                  ))
                : projects.map((project) => (
                    <MusicMobileProjectRow key={project.id} project={project} onOpen={() => openObject(project, "projects")} getMusicObject={getMusicObject} />
                  ))}
            </div>

            {tab === "songs" ? (
              <div className="hidden overflow-hidden rounded-[16px] border border-foreground/8 bg-background lg:block">
                {songs.map((song, index) => (
                  <MusicSongRow key={song.id} song={song} index={index} activeMissionCount={linkedMissionCountById[musicObjectKey(song)] ?? 0} onOpen={() => openObject(song, "songs")} />
                ))}
              </div>
            ) : (
              <div className="hidden gap-3 lg:grid lg:grid-cols-2">
                {projects.map((project) => (
                  <MusicProjectCard key={project.id} project={project} onOpen={() => openObject(project, "projects")} getMusicObject={getMusicObject} />
                ))}
              </div>
            )}''',
    '''            <div data-testid="music-mobile-library" className="overflow-hidden rounded-[16px] border border-foreground/8 bg-background lg:hidden">
              {tab === "songs"
                ? songs.map((song, index) => (
                    <MusicMobileSongRow key={song.id} song={song} index={index} onOpen={() => openObject(song, "songs")} />
                  ))
                : projects.map((project, index) => (
                    <MusicMobileProjectRow key={project.id} project={project} index={index} onOpen={() => openObject(project, "projects")} getMusicObject={getMusicObject} />
                  ))}
            </div>

            <div className="hidden overflow-hidden rounded-[16px] border border-foreground/8 bg-background lg:block">
              {tab === "songs"
                ? songs.map((song, index) => (
                    <MusicSongRow key={song.id} song={song} index={index} activeMissionCount={linkedMissionCountById[musicObjectKey(song)] ?? 0} onOpen={() => openObject(song, "songs")} />
                  ))
                : projects.map((project, index) => (
                    <MusicProjectCard key={project.id} project={project} index={index} onOpen={() => openObject(project, "projects")} getMusicObject={getMusicObject} />
                  ))}
            </div>''',
    "unified Catalog list containers",
)

mobile_rows = '''function MusicMobileSongRow({ song, index, onOpen }: { song: MusicObjectViewModel; index: number; onOpen: () => void }) {
  const hasBlocker = song.blocker !== "No active blocker" && song.blocker !== "None";

  return (
    <button
      type="button"
      data-testid={`music-mobile-song-row-${song.title}`}
      aria-label={`Open mobile song ${song.title}`}
      onClick={onOpen}
      className="group grid w-full grid-cols-[24px_48px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-foreground/7 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-foreground/[0.025]"
    >
      <span className="font-ui text-[10px] font-semibold tabular-nums text-muted-foreground/42">{String(index + 1).padStart(2, "0")}</span>
      <ArtworkFrame title={song.title} imageUrl={song.coverImageUrl} spotifyUrl={song.spotifyUrl} kind="song" size="mini" />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">{song.title}</span>
        <span className="mt-1 flex min-w-0 items-center gap-2 text-[10px] font-medium text-muted-foreground/62">
          <span className="truncate">{song.lifecycleStage ?? song.lifecycle}</span>
          <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-foreground/18" />
          <span className={cn("truncate", hasBlocker ? "text-warning" : "text-muted-foreground/58")}>{hasBlocker ? song.blocker : "No blocker"}</span>
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/28 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

function MusicMobileProjectRow({
  project,
  index,
  onOpen,
  getMusicObject,
}: {
  project: MusicObjectViewModel;
  index: number;
  onOpen: () => void;
  getMusicObject: (id: string) => MusicObjectViewModel | undefined;
}) {
  const readiness = getProjectReadiness(project, getMusicObject);

  return (
    <button
      type="button"
      data-testid={`music-mobile-project-row-${project.title}`}
      aria-label={`Open mobile project ${project.title}`}
      onClick={onOpen}
      className="group grid w-full grid-cols-[24px_48px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-foreground/7 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-foreground/[0.025]"
    >
      <span className="font-ui text-[10px] font-semibold tabular-nums text-muted-foreground/42">{String(index + 1).padStart(2, "0")}</span>
      <ArtworkFrame title={project.title} imageUrl={project.coverImageUrl} spotifyUrl={project.spotifyUrl} kind="project" size="mini" />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">{project.title}</span>
        <span className="mt-1 flex min-w-0 items-center gap-2 text-[10px] font-medium text-muted-foreground/62">
          <span className="truncate">{project.lifecycleStage ?? project.lifecycle}</span>
          <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-foreground/18" />
          <span>{readiness.trackCount} track{readiness.trackCount === 1 ? "" : "s"}</span>
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/28 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

'''
music = replace_between(music, "function MusicMobileSongRow", "function MusicSongRow", mobile_rows, "mobile Catalog rows")

project_row = '''function MusicProjectCard({
  project,
  index,
  onOpen,
  getMusicObject,
}: {
  project: MusicObjectViewModel;
  index: number;
  onOpen: () => void;
  getMusicObject: (id: string) => MusicObjectViewModel | undefined;
}) {
  const readiness = getProjectReadiness(project, getMusicObject);
  return (
    <button
      type="button"
      aria-label={`Open project ${project.title}`}
      onClick={onOpen}
      className="group grid w-full grid-cols-[32px_52px_minmax(0,1fr)_140px_110px_auto] items-center gap-3 border-b border-foreground/7 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/30"
    >
      <span className="font-ui text-[10px] font-semibold tabular-nums text-muted-foreground/45">{String(index + 1).padStart(2, "0")}</span>
      <ArtworkFrame title={project.title} imageUrl={project.coverImageUrl} spotifyUrl={project.spotifyUrl} kind="project" size="mini" />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">{project.title}</span>
        <span className="mt-1 block truncate text-[10px] font-medium text-muted-foreground/55">{project.status ?? "Project"}</span>
      </span>
      <span className="truncate text-[11px] font-medium text-muted-foreground/66">{project.lifecycleStage ?? project.lifecycle}</span>
      <span className="text-[11px] font-medium text-muted-foreground/66">{readiness.trackCount} track{readiness.trackCount === 1 ? "" : "s"}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/28 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/55" aria-hidden="true" />
    </button>
  );
}

'''
music = replace_between(music, "function MusicProjectCard", "function mobileDetailFieldTestId", project_row, "desktop project row")

# Shared music room header: artwork and title carry the personality; remove the
# dashboard-card header and keep the back action on the true left edge.
detail_top = '''function MusicDetailTop({ object, label, onBack, onStageChange, onOpenManager }: { object: MusicObjectViewModel; label: string; onBack: () => void; onStageChange?: (stage: string) => void; onOpenManager?: () => void }) {
  const stageValue = object.lifecycleStage ?? object.lifecycle;
  const lockedReleasedStage = object.kind === "song" && isLockedReleasedStage(stageValue);

  return (
    <div aria-label={`${label} header`} className="border-b border-foreground/8 pb-5">
      <div data-testid="music-detail-mobile-top" className="lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Back to Catalog from mobile room"
            onClick={onBack}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] pr-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Catalog
          </button>
          <span className="text-[10px] font-semibold text-muted-foreground/58">{stageValue}</span>
        </div>
        <div className="mt-4 flex min-w-0 items-center gap-3.5">
          <ArtworkFrame title={object.title} imageUrl={object.coverImageUrl} spotifyUrl={object.spotifyUrl} kind={object.kind} size="mini" />
          <p data-testid="music-detail-mobile-title" className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] font-display text-[23px] font-semibold leading-[1.05] tracking-[-0.025em] text-foreground">{object.title}</p>
          {onOpenManager ? (
            <button type="button" onClick={onOpenManager} aria-label="Chat with Manager" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/30">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {object.kind === "song" && !lockedReleasedStage ? (
          <select
            aria-label="Mobile song stage"
            defaultValue={stageValue}
            onChange={(event) => onStageChange?.(event.target.value.toLowerCase())}
            className="mt-3 h-8 rounded-[9px] border border-foreground/10 bg-background px-2.5 text-[11px] font-semibold text-foreground focus:border-foreground focus:outline-none"
          >
            {["Idea", "Recording", "Production", "Mixing", "Mastering", "Ready", "Scheduled", "Released", "Catalog"].map((stage) => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
        ) : null}
      </div>

      <div data-testid="music-detail-desktop-top" className="hidden lg:block">
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Catalog
          </button>
          <div className="flex items-center gap-2">
            {object.kind === "song" && !lockedReleasedStage ? (
              <select
                aria-label="Song stage"
                defaultValue={stageValue}
                onChange={(event) => onStageChange?.(event.target.value.toLowerCase())}
                className="h-9 rounded-[10px] border border-foreground/10 bg-background px-3 text-[11px] font-semibold text-foreground focus:border-foreground focus:outline-none"
              >
                {["Idea", "Recording", "Production", "Mixing", "Mastering", "Ready", "Scheduled", "Released", "Catalog"].map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            ) : <span className="text-[11px] font-medium text-muted-foreground/58">{stageValue}</span>}
            {onOpenManager ? (
              <button type="button" onClick={onOpenManager} className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-foreground/10 px-3 text-[11px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/30">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Manager
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex min-w-0 items-end gap-4">
          <ArtworkFrame title={object.title} imageUrl={object.coverImageUrl} spotifyUrl={object.spotifyUrl} kind={object.kind} size="detail" />
          <h2 className="min-w-0 break-words [overflow-wrap:anywhere] font-display text-[34px] font-semibold leading-[0.98] tracking-[-0.035em] text-foreground xl:text-[40px]">{object.title}</h2>
        </div>
      </div>
    </div>
  );
}

'''
music = replace_between(music, "function MusicDetailTop", "function MusicLinkedWork", detail_top, "music room header")

linked_work = '''function MusicLinkedWork({
  linkedConversation,
  linkedMissions,
  onOpenConversation,
  onOpenMission,
}: {
  linkedConversation?: MusicObjectViewModel["managerConversation"];
  linkedMissions: MissionViewModel[];
  onOpenConversation?: () => void;
  onOpenMission: (missionId: string) => void;
}) {
  const hasLinkedWork = Boolean(linkedConversation || linkedMissions.length);
  if (!hasLinkedWork) return null;

  return (
    <section data-testid="music-linked-work" className="border-t border-foreground/8 pt-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-foreground">Active work</h3>
        <span className="text-[11px] tabular-nums text-muted-foreground/48">{linkedMissions.length + (linkedConversation ? 1 : 0)}</span>
      </div>
      <div data-testid="music-linked-work-list" className="mt-3 divide-y divide-foreground/7 border-y border-foreground/8">
        {linkedConversation ? (
          <button type="button" aria-label="Open conversation" onClick={onOpenConversation} className="group flex w-full items-center justify-between gap-4 py-3.5 text-left transition-colors hover:text-brand-accent">
            <span className="min-w-0 truncate text-[13px] font-semibold text-foreground group-hover:text-brand-accent">{linkedConversation.topic}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : null}
        {linkedMissions.map((mission) => (
          <button key={mission.id} type="button" onClick={() => onOpenMission(mission.id)} className="group flex w-full items-center justify-between gap-4 py-3.5 text-left">
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-foreground">{mission.title}</span>
              {mission.tasks?.length ? <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground/58">{mission.tasks.length} task{mission.tasks.length === 1 ? "" : "s"}</span> : null}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </section>
  );
}

'''
music = replace_between(music, "function MusicLinkedWork", "function MusicRightsWorkspace", linked_work, "project active work")

project_detail_and_brief = '''function MusicProjectDetail({
  project,
  tracklist,
  linkedMissions,
  onBack,
  onOpenSong,
  onGenerateBrief,
  onContinueWithManager,
  briefPending,
  briefError,
  onOpenMission,
  error,
}: {
  project: MusicObjectViewModel;
  tracklist: MusicObjectViewModel[];
  linkedMissions: MissionViewModel[];
  onBack: () => void;
  onOpenSong: (song: MusicObjectViewModel) => void;
  onGenerateBrief: () => void;
  onContinueWithManager?: () => void;
  briefPending: boolean;
  briefError: string | null;
  onOpenMission: (missionId: string) => void;
  error?: string | null;
}) {
  return (
    <section data-testid="music-project-detail" className="grid min-w-0 max-w-full gap-7 overflow-x-clip">
      <MusicDetailTop object={project} label="Project" onBack={onBack} onOpenManager={onContinueWithManager} />
      {error ? <p className="border-l-2 border-danger pl-3 text-[12px] font-semibold text-danger">{error}</p> : null}

      <section>
        <div className="flex items-center justify-between gap-4 border-b border-foreground/8 pb-3">
          <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-foreground">Tracklist</h3>
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground/52">{tracklist.length} track{tracklist.length === 1 ? "" : "s"}</span>
        </div>

        <div data-testid="project-room-mobile-tracklist" className="divide-y divide-foreground/7 lg:hidden">
          {tracklist.map((song, index) => (
            <button
              key={song.id}
              type="button"
              data-testid={`project-mobile-track-${song.title}`}
              aria-label={`Open mobile project track ${song.title}`}
              onClick={() => onOpenSong(song)}
              className="group grid w-full grid-cols-[28px_44px_minmax(0,1fr)_auto] items-center gap-2.5 py-3 text-left"
            >
              <span className="font-ui text-[10px] font-semibold tabular-nums text-muted-foreground/42">{String(index + 1).padStart(2, "0")}</span>
              <ArtworkFrame title={song.title} imageUrl={song.coverImageUrl} spotifyUrl={song.spotifyUrl} kind="song" size="mini" />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-foreground">{song.title}</span>
                <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground/58">{song.lifecycleStage ?? song.lifecycle}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/28 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          ))}
        </div>

        <div data-testid="project-room-desktop-tracklist" className="hidden divide-y divide-foreground/7 lg:block">
          {tracklist.map((song, index) => (
            <button
              key={song.id}
              type="button"
              aria-label={`Open song ${song.title}`}
              onClick={() => onOpenSong(song)}
              className="group grid w-full grid-cols-[32px_52px_minmax(0,1fr)_140px_auto] items-center gap-3 py-3 text-left"
            >
              <span className="font-ui text-[10px] font-semibold tabular-nums text-muted-foreground/42">{String(index + 1).padStart(2, "0")}</span>
              <ArtworkFrame title={song.title} imageUrl={song.coverImageUrl} spotifyUrl={song.spotifyUrl} kind="song" size="mini" />
              <span className="truncate text-[14px] font-semibold text-foreground">{song.title}</span>
              <span className="text-right text-[10px] font-medium text-muted-foreground/58">{song.lifecycleStage ?? song.lifecycle}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/28 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </section>

      <MusicProjectBrief project={project} onGenerateBrief={onGenerateBrief} onContinueWithManager={onContinueWithManager} briefPending={briefPending} briefError={briefError} />
      <MusicLinkedWork linkedMissions={linkedMissions} onOpenMission={onOpenMission} />
    </section>
  );
}

function MusicProjectBrief({
  project,
  onGenerateBrief,
  onContinueWithManager,
  briefPending,
  briefError,
}: {
  project: MusicObjectViewModel;
  onGenerateBrief: () => void;
  onContinueWithManager?: () => void;
  briefPending: boolean;
  briefError: string | null;
}) {
  const read = project.managerRead;
  const readBusy = briefPending || isActiveManagerRead(project.managerReadStatus);
  const failed = project.managerReadStatus === "failed" || project.managerReadStatus === "refresh_failed" || Boolean(briefError);
  const actionLabel = failed ? "Retry project review" : read ? "Refresh project review" : "Review this project";

  return (
    <section className="border-t border-foreground/8 pt-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-foreground">What matters now</h3>
        <button
          type="button"
          onClick={onGenerateBrief}
          disabled={readBusy}
          aria-label={briefPending ? "Reviewing this project" : actionLabel}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/30 disabled:opacity-40"
        >
          {readBusy ? <AppThinkingOrb surface="normal" state="composing" size={18} /> : managerReadButtonIcon(project.managerReadStatus)}
        </button>
      </div>
      {briefError ? <p className="mt-3 border-l-2 border-warning pl-3 text-[11px] font-medium text-warning">{briefError}</p> : null}
      {read ? (
        <div className="mt-4 max-w-4xl">
          {read.metrics.length ? (
            <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-foreground/8 py-4 sm:grid-cols-3">
              {read.metrics.slice(0, 3).map((metric) => (
                <div key={metric.evidenceId} className="min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground/58">{metric.label}</p>
                  <p className="mt-1 truncate font-display text-[19px] font-semibold tracking-[-0.02em] text-foreground">{metric.value}</p>
                </div>
              ))}
            </div>
          ) : null}
          <p className="whitespace-pre-line text-[14px] font-medium leading-6 text-foreground/90 sm:text-[15px]">{read.body}</p>
          {onContinueWithManager ? (
            <button type="button" onClick={onContinueWithManager} className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground transition-colors hover:text-brand-accent">
              Continue with Manager <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : readBusy ? (
        <div className="mt-4 flex items-center gap-3 py-2"><AppThinkingOrb surface="normal" state="composing" size={20} /><p className="text-[13px] font-semibold text-muted-foreground">Reviewing this project…</p></div>
      ) : (
        <button type="button" onClick={onGenerateBrief} className="mt-4 inline-flex h-9 items-center gap-2 rounded-[10px] bg-foreground px-3.5 text-[11px] font-semibold text-background">
          <Sparkles className="h-3.5 w-3.5" /> {failed ? "Try again" : "Review this project"}
        </button>
      )}
    </section>
  );
}

'''
music = replace_between(music, "function MusicProjectDetail", "function SongOverviewRead", project_detail_and_brief, "project room redesign")

music_path.write_text(music)


# ---------------------------------------------------------------------------
# Manager: strip stacked explanatory copy, avoid an empty ghost column when
# there is no conversation history, and make error states compact and useful.
manager_path = Path("src/features/manager/ManagerScreensLegacy.tsx")
manager = manager_path.read_text()
manager = replace_once(
    manager,
    '        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:gap-10">',
    '        <div className={conversations.length > 0 ? "grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:gap-10" : "grid gap-8"}>',
    "Manager empty-column layout",
)
manager = replace_once(
    manager,
    '''                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/62">Workspace</p>
                    <h2 className="mt-1 font-display text-[20px] font-semibold tracking-[-0.025em] text-foreground">What do you want to work on?</h2>
                  </div>
                  <p className="hidden max-w-[24rem] text-right text-[12px] leading-relaxed text-muted-foreground/68 md:block">Ask for a decision, review, plan, document, or next move. Manager keeps the work tied to this artist workspace.</p>
                </div>
                <div className="relative mt-4 overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background shadow-[0_12px_36px_rgba(0,0,0,0.055)] transition-shadow focus-within:border-foreground/18 focus-within:shadow-[0_16px_44px_rgba(0,0,0,0.075)]">''',
    '''                <div className="relative overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-foreground/[0.018] shadow-[0_18px_55px_rgba(0,0,0,0.05)] transition-all focus-within:border-brand-accent/24 focus-within:bg-background focus-within:shadow-[0_22px_65px_rgba(0,0,0,0.075)]">''',
    "Manager composer simplification",
)
manager = replace_once(
    manager,
    '                    placeholder="Ask the Manager for a directive or review..."',
    '                    placeholder="Ask Manager anything about this artist..."',
    "Manager placeholder",
)
manager = replace_once(
    manager,
    '''              <div className="flex items-end justify-between gap-3 px-1">
                <div>
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/58">History</p>
                  <h2 className="mt-1 text-[14px] font-semibold text-foreground">Conversations</h2>
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground/55">{conversations.length}</span>
              </div>''',
    '''              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em] text-foreground">Conversations</h2>
                <span className="text-[11px] tabular-nums text-muted-foreground/45">{conversations.length}</span>
              </div>''',
    "Manager conversation heading",
)

# Mission Genesis error: one useful message + one action, not a four-level stack.
manager = replace_once(
    manager,
    '''      {error ? (
        <div role="alert" className="mt-4 rounded-[12px] border border-red-500/20 bg-red-500/[0.055] p-4">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-red-700">Mission Genesis failed</p>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-red-950/80">{error}</p>
        </div>
      ) : null}''',
    '''      {error ? (
        <div role="alert" className="mt-4 flex flex-col gap-3 border-l-2 border-danger pl-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-[12px] font-semibold leading-relaxed text-danger">{error}</p>
          <button type="button" onClick={() => onSubmit(selectedCandidateMissionId)} disabled={pending} className="inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border border-foreground/10 px-3 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.04] disabled:opacity-40">Try again</button>
        </div>
      ) : null}''',
    "Manager Genesis error",
)

# Project context in a conversation should read as one compact attachment, not
# eyebrow + title + stage + action hierarchy.
manager = replace_once(
    manager,
    '''              <div className="min-w-0">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/75">
                  About this project
                </p>
                <p className="mt-1 truncate text-[13px] font-semibold text-foreground">{conversation.musicSubject.title}</p>
                {conversation.musicSubject.lifecycleStage ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{conversation.musicSubject.lifecycleStage}</p>
                ) : null}
              </div>''',
    '''              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground">{conversation.musicSubject.title}</p>
                {conversation.musicSubject.lifecycleStage ? <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/58">{conversation.musicSubject.lifecycleStage}</p> : null}
              </div>''',
    "conversation project context",
)
manager_path.write_text(manager)


# ---------------------------------------------------------------------------
# Update production-shell assertions that intentionally described the old copy.
test_path = Path("src/production-app-shell.test.tsx")
test = test_path.read_text()
test = replace_once(
    test,
    '    expect(screen.getByText("Songs and projects connected to active work.")).toBeInTheDocument();',
    '    expect(screen.queryByText("Songs and projects connected to active work.")).not.toBeInTheDocument();',
    "Catalog copy assertion",
)
test = replace_once(
    test,
    '    expect(projectRoom).toHaveTextContent("Songs stay atomic");',
    '    expect(projectRoom).not.toHaveTextContent("Songs stay atomic");',
    "project room copy assertion",
)
test_path.write_text(test)


contract_path = Path("src/catalog-manager-beauty-pass.test.ts")
contract_path.write_text('''import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");
const manager = readFileSync("src/features/manager/ManagerScreensLegacy.tsx", "utf8");
const components = readFileSync("src/design-system/components.tsx", "utf8");

describe("Catalog and Manager beauty system", () => {
  it("keeps Catalog copy minimal and uses one visual language for songs and projects", () => {
    expect(music).toContain('<WorkspaceHeader title="Catalog" />');
    expect(music).not.toContain("Music workspace");
    expect(music).not.toContain("Songs and projects connected to active work.");
    expect(music).toContain('projects.map((project, index)');
    expect(music).toContain('grid-cols-[32px_52px_minmax(0,1fr)_140px_110px_auto]');
  });

  it("does not ship hard-coded white mobile music surfaces", () => {
    expect(music).not.toContain('bg-white px-3 py-3 text-left shadow');
    expect(music).not.toContain('data-testid="music-detail-mobile-top" className="rounded-[18px]');
  });

  it("makes project rooms part of the Song Room visual system", () => {
    expect(music).not.toContain("Songs stay atomic inside projects.");
    expect(music).not.toContain("Project songs");
    expect(music).toContain("What matters now");
    expect(music).toContain('onOpenManager={onContinueWithManager}');
  });

  it("anchors Manager room navigation to the workspace edge while preserving the conversation reading column", () => {
    expect(components).toContain('<div className="flex w-full items-center gap-2">');
    expect(components).not.toContain('mx-auto flex max-w-[48rem] items-center gap-3');
    expect(readFileSync("src/features/manager/ManagerScreens.tsx", "utf8")).toContain('max-w-[48rem]');
  });

  it("removes stacked Manager labels and avoids an empty history column", () => {
    expect(manager).not.toContain(">Workspace</p>");
    expect(manager).not.toContain(">History</p>");
    expect(manager).not.toContain("Manager keeps the work tied to this artist workspace.");
    expect(manager).toContain('conversations.length > 0 ? "grid gap-8 xl:grid-cols');
    expect(manager).toContain('>Conversations</h2>');
  });
});
''')
