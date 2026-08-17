from pathlib import Path

path = Path("src/features/music/MusicScreens.tsx")
text = path.read_text()

replacements = [
(
'''          <section data-testid="music-library" className="grid gap-5">
            <div className="flex flex-col gap-4 border-b border-foreground/5 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[14px] font-semibold leading-relaxed text-muted-foreground/82">
                  Songs and projects connected to active work.
                </p>
              </div>
              <div data-testid="music-mobile-controls" className="flex w-full flex-row items-center justify-between gap-2 sm:w-auto sm:justify-end">''',
'''          <section data-testid="music-library" className="grid gap-6">
            <div className="flex flex-col gap-4 border-b border-foreground/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/58">Music workspace</p>
                <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-muted-foreground/76 sm:text-[14px]">
                  Keep the catalog organized around the songs, projects, and active work your team is actually managing.
                </p>
              </div>
              <div data-testid="music-mobile-controls" className="flex w-full flex-row items-center justify-between gap-2 sm:w-auto sm:justify-end">''',
"catalog toolbar hierarchy",
),
(
'''            {tab === "songs" ? (
              <div className="hidden gap-3 lg:grid">
                {songs.map((song, index) => (
                  <MusicSongRow key={song.id} song={song} index={index} activeMissionCount={linkedMissionCountById[musicObjectKey(song)] ?? 0} onOpen={() => openObject(song, "songs")} />
                ))}
              </div>
            ) : (
              <div className="hidden gap-4 lg:grid lg:grid-cols-2">''',
'''            {tab === "songs" ? (
              <div className="hidden overflow-hidden rounded-[16px] border border-foreground/8 bg-background lg:block">
                {songs.map((song, index) => (
                  <MusicSongRow key={song.id} song={song} index={index} activeMissionCount={linkedMissionCountById[musicObjectKey(song)] ?? 0} onOpen={() => openObject(song, "songs")} />
                ))}
              </div>
            ) : (
              <div className="hidden gap-3 lg:grid lg:grid-cols-2">''',
"desktop catalog list container",
),
(
'''      className="flex min-h-0 min-w-0 items-center gap-3 rounded-[14px] border border-foreground/10 bg-white px-3 py-3 text-left shadow-[0_1px_6px_rgba(17,19,24,0.045)]"''',
'''      className="flex min-h-0 min-w-0 items-center gap-3 rounded-[14px] border border-foreground/10 bg-background px-3 py-3 text-left shadow-[0_1px_6px_rgba(17,19,24,0.045)]"''',
"theme-safe mobile project row",
),
(
'''function MusicSongRow({ song, index, activeMissionCount, onOpen }: { song: MusicObjectViewModel; index: number; activeMissionCount: number; onOpen: () => void }) {
  const hasBlocker = song.blocker !== "No active blocker" && song.blocker !== "None";
  const inMission = activeMissionCount > 0;
  return (
    <button
      type="button"
      aria-label={`Open song ${song.title}`}
      onClick={onOpen}
      className="group grid gap-4 rounded-[20px] border border-foreground/8 bg-background/84 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/[0.03] lg:grid-cols-[44px_70px_minmax(0,1fr)_auto] lg:items-center"
    >
      <span className="font-display text-[18px] font-bold text-muted-foreground/55">{String(index + 1).padStart(2, "0")}</span>
      <ArtworkFrame title={song.title} imageUrl={song.coverImageUrl} spotifyUrl={song.spotifyUrl} kind="song" size="row" />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[22px] font-bold tracking-tight text-foreground">{song.title}</span>
          <span className="rounded-full border border-foreground/10 bg-background px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{song.lifecycleStage ?? song.lifecycle}</span>
          <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]", hasBlocker ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
            {hasBlocker ? song.blocker : "Clear"}
          </span>
        </span>
      </span>
      <span className="hidden items-center justify-end gap-3 pr-1 lg:flex">
        <span className="text-right">
          {inMission ? (
            <>
              <span className="flex items-center justify-end gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" aria-hidden="true" />
                In a mission
              </span>
              <span className="mt-1 block text-[11px] font-semibold text-muted-foreground/80">
                {activeMissionCount} active mission{activeMissionCount === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">No active work</span>
          )}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/35 transition-colors group-hover:text-brand-accent" aria-hidden="true" />
      </span>
    </button>
  );
}''',
'''function MusicSongRow({ song, index, activeMissionCount, onOpen }: { song: MusicObjectViewModel; index: number; activeMissionCount: number; onOpen: () => void }) {
  const hasBlocker = song.blocker !== "No active blocker" && song.blocker !== "None";
  const inMission = activeMissionCount > 0;
  return (
    <button
      type="button"
      aria-label={`Open song ${song.title}`}
      onClick={onOpen}
      className="group grid w-full grid-cols-[32px_52px_minmax(0,1fr)_auto] items-center gap-3 border-b border-foreground/7 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/30"
    >
      <span className="font-ui text-[10px] font-semibold tabular-nums text-muted-foreground/45">{String(index + 1).padStart(2, "0")}</span>
      <ArtworkFrame title={song.title} imageUrl={song.coverImageUrl} spotifyUrl={song.spotifyUrl} kind="song" size="mini" />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">{song.title}</span>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.055em] text-muted-foreground/58">{song.lifecycleStage ?? song.lifecycle}</span>
        </span>
        <span className="mt-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground/66">
          <span className={cn("inline-flex items-center gap-1.5", hasBlocker ? "text-warning" : "text-muted-foreground/62")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", hasBlocker ? "bg-warning" : "bg-success")} aria-hidden="true" />
            {hasBlocker ? song.blocker : "No blocker"}
          </span>
        </span>
      </span>
      <span className="flex items-center justify-end gap-4 pl-4">
        <span className="min-w-[7.5rem] text-right">
          {inMission ? (
            <>
              <span className="block text-[11px] font-semibold text-foreground/78">Active work</span>
              <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground/58">
                {activeMissionCount} mission{activeMissionCount === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span className="text-[11px] font-medium text-muted-foreground/48">No active work</span>
          )}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/28 transition-all group-hover:translate-x-0.5 group-hover:text-foreground/55" aria-hidden="true" />
      </span>
    </button>
  );
}''',
"compact desktop song rows",
),
(
'''    <button
      type="button"
      aria-label={`Open project ${project.title}`}
      onClick={onOpen}
      className="group overflow-hidden rounded-[24px] border border-foreground/8 bg-background text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/[0.03]"
    >
      <div className="grid min-h-[150px] grid-cols-[110px_minmax(0,1fr)] border-b border-foreground/5">
        <ArtworkFrame title={project.title} imageUrl={project.coverImageUrl} spotifyUrl={project.spotifyUrl} kind="project" size="project" />
        <div className="flex flex-col justify-between p-5">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">{project.status ?? "Project"}</p>
            <h3 className="mt-2 font-display text-[24px] font-bold tracking-tight text-foreground">{project.title}</h3>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-foreground/10 bg-background px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{project.lifecycleStage ?? project.lifecycle}</span>
            <span className="text-[12px] font-semibold text-muted-foreground/80">{readiness.trackCount} track{readiness.trackCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>
    </button>''',
'''    <button
      type="button"
      aria-label={`Open project ${project.title}`}
      onClick={onOpen}
      className="group grid min-h-[132px] grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-[16px] border border-foreground/8 bg-background text-left transition-colors hover:border-foreground/14 hover:bg-foreground/[0.018] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/30"
    >
      <ArtworkFrame title={project.title} imageUrl={project.coverImageUrl} spotifyUrl={project.spotifyUrl} kind="project" size="project" />
      <div className="flex min-w-0 flex-col justify-center px-5 py-4">
        <p className="font-ui text-[9px] font-bold uppercase tracking-[0.11em] text-muted-foreground/55">{project.status ?? "Project"}</p>
        <h3 className="mt-1.5 truncate text-[17px] font-semibold tracking-[-0.015em] text-foreground">{project.title}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground/68">
          <span>{project.lifecycleStage ?? project.lifecycle}</span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-foreground/20" />
          <span>{readiness.trackCount} track{readiness.trackCount === 1 ? "" : "s"}</span>
        </div>
      </div>
    </button>''',
"flatter project cards",
),
]

for old, new, label in replacements:
    if old not in text:
        raise SystemExit(f"Catalog polish anchor changed: {label}")
    text = text.replace(old, new, 1)

path.write_text(text)
