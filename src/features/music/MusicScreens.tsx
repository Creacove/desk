import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronRight, Disc3, ListMusic, Loader2, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2, Upload, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { WorkspaceHeader } from "../../design-system/components";
import { cn } from "../../lib/utils";
import type {
  MissionViewModel,
  MusicObjectViewModel,
  MusicRepository,
  SpotifyCatalogSearchResult,
  SpotifyImportResult,
  SpotifyReleaseCandidate,
  SpotifyTrackCandidate,
} from "../../types/cleanProduction";

type MusicTab = "songs" | "projects";
type DetailMode = "library" | "songDetail" | "projectDetail";
type SongRoomTab = "overview" | "files" | "details" | "rights";
type MusicStatus = "Missing" | "Draft" | "Uploaded" | "Confirmed" | "Pending" | "Cleared" | string;
type MusicDetailField = { label: string; value: string; status: string };

export function MusicWorkspace({
  music,
  missions,
  targetMusicObjectId,
  musicRepository,
  onMusicChanged,
  onOpenMission,
  onBack: _onBack,
}: {
  music: MusicObjectViewModel[];
  missions: MissionViewModel[];
  targetMusicObjectId?: string | null;
  musicRepository: MusicRepository;
  onMusicChanged: () => Promise<void>;
  onOpenMission: (missionId: string) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<MusicTab>("songs");
  const [mode, setMode] = useState<DetailMode>("library");
  const [selectedId, setSelectedId] = useState<string>(targetMusicObjectId ?? music.find((item) => item.kind === "song")?.id ?? music[0]?.id ?? "");
  const [returnTab, setReturnTab] = useState<MusicTab>("songs");
  const [songRoomTab, setSongRoomTab] = useState<SongRoomTab>("overview");
  const [createKind, setCreateKind] = useState<MusicTab | null>(null);
  const [addMenuKind, setAddMenuKind] = useState<MusicTab | null>(null);
  const [importKind, setImportKind] = useState<MusicTab | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ song: MusicObjectViewModel; asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number] } | null>(null);
  const [detailTarget, setDetailTarget] = useState<{ song: MusicObjectViewModel; groupTitle: string; field: MusicDetailField } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [briefPending, setBriefPending] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [generatedReads, setGeneratedReads] = useState<Record<string, MusicObjectViewModel>>({});
  const modalActive = Boolean(createKind || addMenuKind || importKind || uploadTarget || detailTarget);

  const displayedMusic = music.map((object) => generatedReads[object.id] ?? object);
  const getMusicObject = (id: string) => generatedReads[id] ?? music.find((object) => object.id === id);
  const songs = displayedMusic.filter((object) => object.kind === "song" && (!object.projectIds || object.projectIds.length === 0));
  const projects = displayedMusic.filter((object) => object.kind === "project");
  const selected = getMusicObject(selectedId) ?? songs[0] ?? projects[0] ?? null;
  const tracklist = selected?.songIds?.map(getMusicObject).filter(Boolean) as MusicObjectViewModel[] | undefined;
  const linkedMissions = selected ? findCatalogLinkedMissions(selected, missions, tracklist ?? []) : [];

  // Single source of truth for "active work" in the list: reuse the exact linkage
  // logic the song/project rooms use, so the catalog list can never disagree with
  // what you see after opening an item.
  const linkedMissionCountById = useMemo(() => {
    const resolve = (id: string) => generatedReads[id] ?? music.find((object) => object.id === id);
    const map: Record<string, number> = {};
    for (const object of music) {
      const resolved = generatedReads[object.id] ?? object;
      const objectTracklist =
        resolved.kind === "project"
          ? ((resolved.songIds?.map(resolve).filter(Boolean) as MusicObjectViewModel[] | undefined) ?? [])
          : [];
      map[resolved.id] = findCatalogLinkedMissions(resolved, missions, objectTracklist).length;
    }
    return map;
  }, [music, generatedReads, missions]);

  useEffect(() => {
    if (!targetMusicObjectId) return;
    const target = getMusicObject(targetMusicObjectId);
    if (!target) return;
    openObject(target, target.kind === "project" ? "projects" : "songs");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMusicObjectId, music]);

  function selectTab(next: MusicTab) {
    setTab(next);
    setMode("library");
  }

  function openObject(object: MusicObjectViewModel, origin: MusicTab = tab) {
    setSelectedId(object.id);
    setReturnTab(origin);
    if (object.kind === "song") setSongRoomTab("overview");
    setMode(object.kind === "song" ? "songDetail" : "projectDetail");
  }

  function backToLibrary() {
    setTab(returnTab);
    setMode("library");
  }

  async function runMusicAction(action: () => Promise<void>) {
    try {
      setActionError(null);
      setActionPending(true);
      await action();
      await onMusicChanged();
    } catch (error) {
      setActionError(readErrorMessage(error, "Music update failed."));
    } finally {
      setActionPending(false);
    }
  }

  async function runGenerateBrief(subjectId: string, subjectType: "music_item" | "music_project") {
    const generated = await musicRepository.generateMusicSummary(subjectId, subjectType);
    setGeneratedReads((current) => ({ ...current, [generated.id]: generated }));
    await onMusicChanged();
    return generated;
  }

  async function generateBrief(subjectId: string, subjectType: "music_item" | "music_project") {
    try {
      setBriefError(null);
      setBriefPending(true);
      await runGenerateBrief(subjectId, subjectType);
    } catch (error) {
      setBriefError(readErrorMessage(error, "Brief could not be generated."));
    } finally {
      setBriefPending(false);
    }
  }

  async function createMusicRecord(input: { title: string; type: string; lifecycleStage: string }) {
    await runMusicAction(async () => {
      if (createKind === "songs") {
        const created = await musicRepository.createSong({ title: input.title, itemType: input.type, lifecycleStage: input.lifecycleStage });
        setSelectedId(created.id);
        setReturnTab("songs");
        setSongRoomTab("overview");
        setMode("songDetail");
      } else {
        const created = await musicRepository.createProject({ title: input.title, projectType: input.type, lifecycleStage: input.lifecycleStage });
        setSelectedId(created.id);
        setReturnTab("projects");
        setMode("projectDetail");
      }
      setCreateKind(null);
    });
  }

  function openImportedRecord(result: SpotifyImportResult) {
    setImportKind(null);
    setSelectedId(result.subjectId);
    if (result.subjectType === "music_project") {
      setReturnTab("projects");
      setMode("projectDetail");
    } else {
      setReturnTab("songs");
      setSongRoomTab("overview");
      setMode("songDetail");
    }
  }

  async function saveMusicDetail(value: string) {
    if (!detailTarget) return;
    await runMusicAction(async () => {
      const label = detailTarget.field.label;
      if (detailTarget.groupTitle === "Credits") {
        await musicRepository.saveCredit(detailTarget.song.id, { role: label, name: value });
      } else if (isIdentifierField(label)) {
        await musicRepository.saveIdentifier(detailTarget.song.id, { identifierType: identifierTypeForLabel(label), identifierValue: value });
      } else {
        await musicRepository.saveDetail(detailTarget.song.id, { group: detailTarget.groupTitle, label, value });
      }
      setDetailTarget(null);
    });
  }

  async function uploadMusicAsset(file: File) {
    if (!uploadTarget) return;
    await runMusicAction(async () => {
      await musicRepository.uploadAsset(uploadTarget.song.id, {
        assetType: uploadTarget.asset.assetType ?? "other",
        title: uploadTarget.asset.label,
        file,
      });
      setUploadTarget(null);
    });
  }

  async function saveSplitContributor(songId: string, input: { name: string; role: string; email: string; publishingShare: number; masterShare: number }) {
    await runMusicAction(async () => {
      await musicRepository.saveSplitContributor(songId, input);
    });
  }

  async function removeSplitContributor(songId: string, contributorId: string) {
    await runMusicAction(async () => {
      await musicRepository.removeSplitContributor(songId, contributorId);
    });
  }

  async function sendSplitConfirmationLinks(songId: string) {
    await runMusicAction(async () => {
      await musicRepository.sendSplitConfirmationLinks(songId);
    });
  }

  return (
    <section>
      <div
        data-testid="music-workspace-content"
        className={cn("transition duration-300 ease-out", modalActive ? "pointer-events-none select-none blur-[6px] brightness-95" : "blur-0")}
      >
      {mode === "library" ? (
        <>
          <WorkspaceHeader eyebrow="Catalog" title="Catalog" />
          <section data-testid="music-library" className="grid gap-5">
            <div className="flex flex-col gap-4 border-b border-foreground/5 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[14px] font-semibold leading-relaxed text-muted-foreground/82">
                  Songs and projects connected to active work.
                </p>
              </div>
              <div data-testid="music-mobile-controls" className="flex w-full flex-row items-center justify-between gap-2 sm:w-auto sm:justify-end">
                <div className="grid min-w-0 flex-1 max-w-[260px] grid-cols-2 rounded-full border border-foreground/10 bg-background/80 p-1 shadow-sm">
                  {(["songs", "projects"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={tab === item}
                      onClick={() => selectTab(item)}
                      className={cn(
                        "rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors",
                        tab === item ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {item === "songs" ? "Songs" : "Projects"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAddMenuKind(tab)}
                  aria-label={tab === "songs" ? "Add song" : "Add project"}
                  title={tab === "songs" ? "Add song" : "Add project"}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-background text-foreground shadow-sm transition-colors hover:border-foreground/20 hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="sr-only" aria-live="polite">{actionPending ? "Saving Music update" : ""}</div>
            {actionError ? <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{actionError}</p> : null}

            <div data-testid="music-mobile-library" className="grid gap-2 lg:hidden">
              {tab === "songs"
                ? songs.map((song, index) => (
                    <MusicMobileSongRow key={song.id} song={song} index={index} onOpen={() => openObject(song, "songs")} />
                  ))
                : projects.map((project) => (
                    <MusicMobileProjectRow key={project.id} project={project} onOpen={() => openObject(project, "projects")} getMusicObject={getMusicObject} />
                  ))}
            </div>

            {tab === "songs" ? (
              <div className="hidden gap-3 lg:grid">
                {songs.map((song, index) => (
                  <MusicSongRow key={song.id} song={song} index={index} activeMissionCount={linkedMissionCountById[song.id] ?? 0} onOpen={() => openObject(song, "songs")} />
                ))}
              </div>
            ) : (
              <div className="hidden gap-4 lg:grid lg:grid-cols-2">
                {projects.map((project) => (
                  <MusicProjectCard key={project.id} project={project} onOpen={() => openObject(project, "projects")} getMusicObject={getMusicObject} />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {mode === "songDetail" && selected?.kind === "song" ? (
        <MusicSongDetail
          song={selected}
          linkedMissions={linkedMissions}
          activeTab={songRoomTab}
          onTabChange={setSongRoomTab}
          onUploadAsset={(asset) => {
            setActionError(null);
            setUploadTarget({ song: selected, asset });
          }}
          onEditDetail={(groupTitle, field) => setDetailTarget({ song: selected, groupTitle, field })}
          onStageChange={(stage) => runMusicAction(() => musicRepository.updateLifecycleStage(selected.id, stage))}
          onSaveSplitContributor={(input) => saveSplitContributor(selected.id, input)}
          onRemoveSplitContributor={(contributorId) => removeSplitContributor(selected.id, contributorId)}
          onSendSplitConfirmationLinks={() => sendSplitConfirmationLinks(selected.id)}
          onGenerateBrief={() => generateBrief(selected.id, "music_item")}
          briefPending={briefPending}
          briefError={briefError}
          onBack={backToLibrary}
          onOpenMission={onOpenMission}
          error={actionError}
        />
      ) : null}

      {mode === "projectDetail" && selected?.kind === "project" ? (
        <MusicProjectDetail
          project={selected}
          tracklist={tracklist ?? []}
          linkedMissions={linkedMissions}
          onBack={backToLibrary}
          onOpenSong={(song) => openObject(song, "projects")}
          onGenerateBrief={() => generateBrief(selected.id, "music_project")}
          briefPending={briefPending}
          briefError={briefError}
          onOpenMission={onOpenMission}
          error={actionError}
        />
      ) : null}
      </div>

      {addMenuKind ? (
        <MusicAddChooser
          kind={addMenuKind}
          onCancel={() => setAddMenuKind(null)}
          onManual={() => {
            const kind = addMenuKind;
            setAddMenuKind(null);
            setCreateKind(kind);
          }}
          onImport={() => {
            const kind = addMenuKind;
            setAddMenuKind(null);
            setImportKind(kind);
          }}
        />
      ) : null}

      {createKind ? (
        <MusicCreateDialog
          kind={createKind}
          pending={actionPending}
          onCancel={() => setCreateKind(null)}
          onSubmit={createMusicRecord}
        />
      ) : null}

      {importKind ? (
        <MusicImportDialog
          kind={importKind}
          onCancel={() => setImportKind(null)}
          onSearch={(input) => musicRepository.searchSpotifyCatalog(input)}
          onImportSelection={(input) => musicRepository.importSpotifySelection(input)}
          onGenerateRead={(subjectId, subjectType) => runGenerateBrief(subjectId, subjectType)}
          onDone={openImportedRecord}
        />
      ) : null}

      {uploadTarget ? (
        <MusicUploadDialog
          asset={uploadTarget.asset}
          pending={actionPending}
          error={actionError}
          onCancel={() => setUploadTarget(null)}
          onSubmit={uploadMusicAsset}
        />
      ) : null}

      {detailTarget ? (
        <MusicDetailEditDialog
          groupTitle={detailTarget.groupTitle}
          field={detailTarget.field}
          pending={actionPending}
          onCancel={() => setDetailTarget(null)}
          onSubmit={saveMusicDetail}
        />
      ) : null}
    </section>
  );
}

function findCatalogLinkedMissions(
  object: MusicObjectViewModel,
  missions: MissionViewModel[],
  tracklist: MusicObjectViewModel[] = [],
) {
  const candidates = object.kind === "project" ? [object, ...tracklist] : [object];
  return uniqueMissions(missions.filter((mission) => candidates.some((candidate) => isMissionLinkedToCatalogObject(mission, candidate))));
}

function isMissionLinkedToCatalogObject(mission: MissionViewModel, object: MusicObjectViewModel) {
  if ((object.linkedMissionIds ?? []).includes(mission.id)) return true;

  const expectedSubjectType = object.kind === "project" ? "music_project" : "music_item";
  if (mission.subjectType === expectedSubjectType && mission.subjectId === object.id) return true;

  const objectTitle = normalizeCatalogLinkText(object.title);
  if (!objectTitle) return false;

  const missionSubject = normalizeCatalogLinkText(mission.musicSubject);
  if (missionSubject && (missionSubject === objectTitle || missionSubject.includes(objectTitle))) return true;

  return [
    mission.title,
    mission.summary,
    mission.recommendation,
    mission.nextTask,
    ...(mission.checkpoints ?? []).flatMap((checkpoint) => [checkpoint.title, checkpoint.question, checkpoint.recommendation, checkpoint.resultSummary]),
    ...(mission.tasks ?? []).flatMap((task) => [task.title, task.purpose]),
  ]
    .map(normalizeCatalogLinkText)
    .some((text) => Boolean(text && text.includes(objectTitle)));
}

function uniqueMissions(missions: MissionViewModel[]) {
  const seen = new Set<string>();
  return missions.filter((mission) => {
    if (seen.has(mission.id)) return false;
    seen.add(mission.id);
    return true;
  });
}

function normalizeCatalogLinkText(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function MusicMobileSongRow({ song, index, onOpen }: { song: MusicObjectViewModel; index: number; onOpen: () => void }) {
  const hasBlocker = song.blocker !== "No active blocker" && song.blocker !== "None";

  return (
    <button
      type="button"
      data-testid={`music-mobile-song-row-${song.title}`}
      aria-label={`Open mobile song ${song.title}`}
      onClick={onOpen}
      className="group flex min-h-0 min-w-0 items-center gap-3 rounded-[14px] border border-foreground/10 bg-white px-3 py-3 text-left shadow-[0_1px_6px_rgba(17,19,24,0.045)]"
    >
      <span className="font-display w-6 shrink-0 text-[13px] font-semibold text-muted-foreground/55">{String(index + 1).padStart(2, "0")}</span>
      <ArtworkFrame title={song.title} imageUrl={song.coverImageUrl} spotifyUrl={song.spotifyUrl} kind="song" size="mini" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-tight text-foreground">{song.title}</span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-foreground/10 bg-background px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
            {song.lifecycleStage ?? song.lifecycle}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em]", hasBlocker ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
            {hasBlocker ? song.blocker : "Clear"}
          </span>
        </span>
      </span>
    </button>
  );
}

function MusicMobileProjectRow({
  project,
  onOpen,
  getMusicObject,
}: {
  project: MusicObjectViewModel;
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
      className="flex min-h-0 min-w-0 items-center gap-3 rounded-[14px] border border-foreground/10 bg-white px-3 py-3 text-left shadow-[0_1px_6px_rgba(17,19,24,0.045)]"
    >
      <ArtworkFrame title={project.title} imageUrl={project.coverImageUrl} spotifyUrl={project.spotifyUrl} kind="project" size="mini" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-tight text-foreground">{project.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-foreground/10 bg-background px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
            {project.lifecycleStage ?? project.lifecycle}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground/80">{readiness.trackCount} track{readiness.trackCount === 1 ? "" : "s"}</span>
        </span>
      </span>
    </button>
  );
}

function MusicSongRow({ song, index, activeMissionCount, onOpen }: { song: MusicObjectViewModel; index: number; activeMissionCount: number; onOpen: () => void }) {
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
}

function MusicProjectCard({
  project,
  onOpen,
  getMusicObject,
}: {
  project: MusicObjectViewModel;
  onOpen: () => void;
  getMusicObject: (id: string) => MusicObjectViewModel | undefined;
}) {
  const readiness = getProjectReadiness(project, getMusicObject);
  return (
    <button
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
    </button>
  );
}

function mobileDetailFieldTestId(label: string) {
  const normalized = label.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `song-mobile-detail-field-${normalized}`;
}

function MusicSongDetail({
  song,
  linkedMissions,
  activeTab,
  onTabChange,
  onUploadAsset,
  onEditDetail,
  onStageChange,
  onSaveSplitContributor,
  onRemoveSplitContributor,
  onSendSplitConfirmationLinks,
  onGenerateBrief,
  briefPending,
  briefError,
  onBack,
  onOpenMission,
  error,
}: {
  song: MusicObjectViewModel;
  linkedMissions: MissionViewModel[];
  activeTab: SongRoomTab;
  onTabChange: (tab: SongRoomTab) => void;
  onUploadAsset: (asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number]) => void;
  onEditDetail: (groupTitle: string, field: MusicDetailField) => void;
  onStageChange: (stage: string) => void;
  onSaveSplitContributor: (input: { name: string; role: string; email: string; publishingShare: number; masterShare: number }) => void;
  onRemoveSplitContributor: (contributorId: string) => void;
  onSendSplitConfirmationLinks: () => void;
  onGenerateBrief: () => void;
  briefPending: boolean;
  briefError: string | null;
  onBack: () => void;
  onOpenMission: (missionId: string) => void;
  error?: string | null;
}) {
  const fileAssets = song.fileAssets ?? [];
  const audioFiles = fileAssets.filter((asset) => asset.group === "Audio");
  const masterDelivery = audioFiles.filter((asset) => ["Final master", "Clean version", "Instrumental", "Stems"].includes(asset.label));
  const sessionFiles = audioFiles.filter((asset) => !["Final master", "Clean version", "Instrumental", "Stems"].includes(asset.label));
  const fileSections = [
    { title: "Audio files", assets: sessionFiles },
    { title: "Master delivery", assets: masterDelivery },
    { title: "Artwork", assets: fileAssets.filter((asset) => asset.group === "Artwork") },
    { title: "Rights documents", assets: fileAssets.filter((asset) => asset.group === "Splits") },
  ].filter((section) => section.assets.length > 0);
  const fileReadyCount = countCompleteMusicItems(fileAssets);
  const fileMissingCount = fileAssets.filter((asset) => asset.status === "Missing").length;
  const fallbackDetails = (song.details ?? []).map((field) => ({ label: field.label, value: field.value, status: normalizeFieldStatus(field.status) }));
  const identityFields = [...(song.metadataFields ?? []), ...(song.identifiers ?? [])];
  const detailGroups = [
    { title: "Song identity", fields: identityFields.length ? identityFields : fallbackDetails },
    { title: "Credits", fields: (song.credits ?? []).map((credit) => ({ label: credit.role, value: credit.names, status: credit.status })) },
    { title: "Release details", fields: song.releaseFields ?? [] },
  ].filter((group) => group.fields.length > 0);
  const allDetailFields = detailGroups.flatMap((group) => group.fields);
  const detailConfirmedCount = allDetailFields.filter((field) => field.status === "Confirmed").length;
  const detailMissingCount = allDetailFields.filter((field) => field.status === "Missing").length;
  const detailDraftCount = allDetailFields.filter((field) => field.status === "Draft").length;
  const trackIntelligenceMetrics = selectTrackIntelligenceMetrics(song.intelligenceSnapshot ?? []);
  const trackSnapshotSummary =
    acceptedVisibleTrackReadText(song.snapshotSummary) ??
    "Record intelligence is focused on the usable numbers already in view.";
  const managerReadCopy = acceptedVisibleTrackReadText(song.managerRead);
  const generateReadLabel = songManagerReadButtonLabel(song.managerReadState, Boolean(managerReadCopy));

  return (
    <section data-testid="music-song-detail" className="grid gap-5">
      <MusicDetailTop object={song} label="Song room" onBack={onBack} onStageChange={onStageChange} />
      {error ? <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p> : null}
      <div data-testid="song-room-mobile-tabs" className="grid grid-cols-4 gap-1 rounded-[14px] border border-foreground/8 bg-foreground/[0.035] p-1 lg:flex lg:flex-wrap lg:border-0 lg:bg-transparent lg:p-0">
        {(["overview", "details", "files", "rights"] as const).map((nextTab) => (
          <button
            key={nextTab}
            type="button"
            aria-pressed={activeTab === nextTab}
            onClick={() => onTabChange(nextTab)}
            className={cn(
              "rounded-[10px] border px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.04em] transition-colors lg:rounded-full lg:px-4 lg:text-[11px]",
              activeTab === nextTab ? "border-foreground bg-foreground text-background" : "border-transparent bg-transparent text-muted-foreground hover:text-foreground lg:border-foreground/10 lg:bg-background",
            )}
          >
            {nextTab}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div data-testid="song-room-mobile-overview" className="surface-elevated space-y-5 overflow-hidden rounded-[16px] p-4 shadow-sm sm:p-5 lg:space-y-6 lg:rounded-[22px] lg:p-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-foreground/[0.045] px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {song.confidence === "limited" ? "Limited confidence" : `${song.confidence ?? "high"} confidence`}
                  </span>
                  <span className="rounded-full bg-foreground/[0.045] px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {managerReadStateLabel(song.managerReadState)}
                  </span>
                  {song.blocker && song.blocker !== "No active blocker" && song.blocker !== "None" ? (
                    <span className="rounded-full bg-warning/10 px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-warning">
                      Blocker: {song.blocker}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={briefPending ? "Generating Manager read" : generateReadLabel}
                  onClick={onGenerateBrief}
                  disabled={briefPending}
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/12 bg-foreground px-4 py-2 text-[11px] font-semibold text-background shadow-sm transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={briefPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden="true" />
                  {briefPending ? "Asking Manager..." : generateReadLabel}
                </button>
              </div>
              {briefError ? (
                <p className="mb-3 rounded-[10px] border border-warning/20 bg-warning/5 px-3 py-2 text-[12px] font-semibold leading-relaxed text-warning">
                  {briefError}
                </p>
              ) : null}
              <h3 className="font-display text-[22px] font-bold tracking-tight text-foreground leading-tight">{song.situationLine}</h3>
            </div>

            <section data-testid="track-intelligence-card" className="overflow-hidden rounded-[12px] border border-foreground/10 bg-background shadow-sm">
              <div className="grid gap-4 border-b border-foreground/8 bg-foreground/[0.012] px-4 py-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:px-5">
                <div className="min-w-0 border-l-2 border-[#e11937] pl-3">
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-[#b51224]">Record Intelligence</p>
                  <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{trackIntelligenceMetrics.length} key signals</p>
                </div>
                <p className="min-w-0 text-[13px] font-semibold leading-relaxed text-foreground/72 sm:max-w-3xl">
                  {trackSnapshotSummary}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
                {trackIntelligenceMetrics.map((metric) => (
                  <div key={`${metric.groupTitle}-${metric.label}-${metric.value}`} className="min-w-0 border-t border-foreground/8 px-3 py-3 sm:px-4">
                    <p className="text-[10px] font-semibold leading-tight text-muted-foreground/82">{metric.label}</p>
                    <p className="mt-1 break-words text-[20px] font-semibold leading-none text-foreground">{metric.value}</p>
                    {metric.context ? <p className="mt-1 text-[10px] font-semibold leading-tight text-muted-foreground/70">{metric.context}</p> : null}
                  </div>
                ))}
              </div>
            </section>

            <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.018] p-5">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Manager's Read</p>
              {managerReadCopy ? (
                <p data-testid="manager-read-copy" className="mt-4 text-[14px] font-semibold leading-relaxed text-foreground/90 whitespace-pre-line">{managerReadCopy}</p>
              ) : (
                <div data-testid="manager-read-copy" className="mt-4">
                  <p className="text-[15px] font-semibold text-foreground">No Manager read yet</p>
                  <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">Ask Manager for a plain-English view of this song before making a move.</p>
                </div>
              )}
            </div>
          </div>
          <MusicLinkedWork linkedMissions={linkedMissions} onOpenMission={onOpenMission} />
        </div>
      ) : null}

      {activeTab === "files" ? (
        <div className="surface-elevated rounded-[22px] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-foreground/8 pb-4">
            <div>
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">File manifest</p>
              <h4 className="mt-1 font-display text-[18px] font-semibold leading-tight text-foreground">Assets</h4>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-md border border-foreground/8 bg-background/74 px-2.5 py-1 text-[11px] font-semibold text-foreground/78">{fileReadyCount}/{fileAssets.length || 0} ready</span>
              {fileMissingCount ? <span className="rounded-md bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">{fileMissingCount} missing</span> : null}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[16px] border border-foreground/8 bg-background/72">
            {fileSections.map((section) => (
              <div key={section.title} className="border-b border-foreground/8 last:border-b-0">
                <div className="flex items-center justify-between gap-4 bg-foreground/[0.025] px-4 py-3">
                  <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">{section.title}</p>
                  <span className="text-[11px] font-semibold text-muted-foreground">{countCompleteMusicItems(section.assets)}/{section.assets.length} ready</span>
                </div>
                <div className="divide-y divide-foreground/6">
                  {section.assets.map((asset) => (
                    <div key={`${section.title}-${asset.label}`} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.6fr)_auto] sm:items-center">
                      <span className="min-w-0 text-[13px] font-medium text-foreground">{asset.label}</span>
                      <span className="text-[11px] font-semibold text-muted-foreground">{asset.action}</span>
                      <span className="flex flex-wrap items-center justify-end gap-2">
                        {canActOnAsset(asset) ? (
                          <button
                            type="button"
                            aria-label={`${asset.canReplace || asset.status === "Uploaded" ? "Replace" : "Upload"} ${asset.label}`}
                            title={`${asset.canReplace || asset.status === "Uploaded" ? "Replace" : "Upload"} ${asset.label}`}
                            onClick={() => onUploadAsset(asset)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-background text-foreground transition-colors hover:border-foreground/20 hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
                          >
                            <Upload className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <MusicStatusPill value={asset.status} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "details" ? (
        <div className="grid gap-4">
          <div data-testid="song-room-mobile-details" className="surface-elevated rounded-[16px] p-4 shadow-sm lg:hidden">
            <div className="flex items-start justify-between gap-3 border-b border-foreground/8 pb-3">
              <div className="min-w-0">
                <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">Details</p>
                <h4 className="mt-1 font-display text-[18px] font-semibold leading-tight text-foreground">Song identity</h4>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success">{detailConfirmedCount} confirmed</span>
                {detailMissingCount ? <span className="rounded-full bg-warning/10 px-2.5 py-1 text-[10px] font-semibold text-warning">{detailMissingCount} missing</span> : null}
              </div>
            </div>

            <div className="mt-3 grid gap-3">
              {detailGroups.map((group) => (
                <section key={group.title} className="overflow-hidden rounded-[14px] border border-foreground/8 bg-background/72">
                  <div className="flex items-center justify-between gap-3 border-b border-foreground/8 bg-foreground/[0.025] px-3 py-2.5">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">{group.title}</p>
                    <span className="text-[10px] font-semibold text-muted-foreground">{countCompleteMusicItems(group.fields)}/{group.fields.length}</span>
                  </div>
                  <div className="divide-y divide-foreground/6">
                    {group.fields.map((field) => (
                      <div
                        key={`${group.title}-mobile-${field.label}`}
                        data-testid={mobileDetailFieldTestId(field.label)}
                        className="grid min-h-[64px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/75">{field.label}</span>
                          <span className="mt-0.5 block truncate text-[13px] font-medium text-foreground">{field.value}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {canEditDetailField(field) ? (
                            <button
                              type="button"
                              aria-label={`Edit mobile ${field.label}`}
                              title={`Edit ${field.label}`}
                              onClick={() => onEditDetail(group.title, field)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/10 bg-background text-foreground transition-colors hover:border-foreground/20 hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          <MusicStatusPill value={field.status} />
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div data-testid="song-room-desktop-details" className="surface-elevated hidden rounded-[22px] p-5 shadow-sm lg:block">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-foreground/8 pb-4">
              <div>
                <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">Metadata board</p>
                <h4 className="mt-1 font-display text-[18px] font-semibold leading-tight text-foreground">Song identity</h4>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-md bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">{detailConfirmedCount} confirmed</span>
                {detailDraftCount ? <span className="rounded-md bg-foreground/[0.055] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{detailDraftCount} draft</span> : null}
                {detailMissingCount ? <span className="rounded-md bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">{detailMissingCount} missing</span> : null}
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              {detailGroups.map((group) => (
                <section key={group.title} className="rounded-[16px] border border-foreground/8 bg-background/72">
                  <div className="flex items-center justify-between gap-4 border-b border-foreground/8 bg-foreground/[0.025] px-4 py-3">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">{group.title}</p>
                    <span className="text-[11px] font-semibold text-muted-foreground">{countCompleteMusicItems(group.fields)}/{group.fields.length} confirmed</span>
                  </div>
                  <div className="grid divide-y divide-foreground/6 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                    {group.fields.map((field) => (
                      <div key={`${group.title}-${field.label}`} className="flex min-h-[74px] items-center justify-between gap-4 border-b border-foreground/6 px-4 py-3 last:border-b-0 lg:[&:nth-last-child(-n+2)]:border-b-0">
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/75">{field.label}</span>
                          <span className="mt-1 block truncate text-[14px] font-medium text-foreground">{field.value}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {canEditDetailField(field) ? (
                            <button
                              type="button"
                              aria-label={`Edit ${field.label}`}
                              title={`Edit ${field.label}`}
                              onClick={() => onEditDetail(group.title, field)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/10 bg-background text-foreground transition-colors hover:border-foreground/20 hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          <MusicStatusPill value={field.status} />
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "rights" ? (
        <MusicRightsWorkspace
          song={song}
          onSaveContributor={onSaveSplitContributor}
          onRemoveContributor={onRemoveSplitContributor}
          onSendLinks={onSendSplitConfirmationLinks}
        />
      ) : null}
    </section>
  );
}

function MusicProjectDetail({
  project,
  tracklist,
  linkedMissions,
  onBack,
  onOpenSong,
  onGenerateBrief,
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
  briefPending: boolean;
  briefError: string | null;
  onOpenMission: (missionId: string) => void;
  error?: string | null;
}) {
  const blockedTracks = tracklist.filter(isMusicBlocked);
  const readyTracks = tracklist.filter((song) => !isMusicBlocked(song)).length;
  const blockerRollup = getProjectBlockerRollup(blockedTracks);

  return (
    <section data-testid="music-project-detail" className="grid gap-5">
      <MusicDetailTop object={project} label="Project" onBack={onBack} />
      {error ? <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p> : null}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <div className="surface-elevated overflow-hidden rounded-[22px] shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-foreground/8 p-5">
              <div>
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Tracklist</p>
                <h4 className="mt-1 font-display text-[20px] font-bold leading-tight text-foreground">Project songs</h4>
                <p className="mt-1 text-[12px] font-semibold text-muted-foreground/78">Songs stay atomic inside projects.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-full border border-foreground/8 bg-background/74 px-2.5 py-1 text-[11px] font-bold text-foreground/78">{readyTracks}/{tracklist.length || 0} clear</span>
                {blockerRollup ? <span className="rounded-full bg-warning/10 px-2.5 py-1 text-[11px] font-bold text-warning">{blockerRollup}</span> : null}
              </div>
            </div>

            <div data-testid="project-room-mobile-tracklist" className="divide-y divide-foreground/6 lg:hidden">
              {tracklist.map((song, index) => (
                <button
                  key={song.id}
                  type="button"
                  data-testid={`project-mobile-track-${song.title}`}
                  aria-label={`Open mobile project track ${song.title}`}
                  onClick={() => onOpenSong(song)}
                  className="grid w-full grid-cols-[28px_44px_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-brand-accent/[0.03]"
                >
                  <span className="font-display text-[14px] font-bold text-muted-foreground/55">{String(index + 1).padStart(2, "0")}</span>
                  <ArtworkFrame title={song.title} imageUrl={song.coverImageUrl} spotifyUrl={song.spotifyUrl} kind="song" size="mini" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold leading-tight text-foreground">{song.title}</span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[10px] font-bold uppercase tracking-[0.04em] text-brand-accent">{song.lifecycleStage ?? song.lifecycle}</span>
                      {isMusicBlocked(song) ? (
                        <span className="truncate rounded-md bg-warning/10 px-1.5 py-0.5 text-[9px] font-bold text-warning">{getProjectBlockerBadge(song.blocker)}</span>
                      ) : null}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </button>
              ))}
            </div>

            <div data-testid="project-room-desktop-tracklist" className="hidden divide-y divide-foreground/6 lg:block">
              {tracklist.map((song, index) => (
                <button
                  key={song.id}
                  type="button"
                  aria-label={`Open song ${song.title}`}
                  onClick={() => onOpenSong(song)}
                  className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-brand-accent/[0.03] md:grid-cols-[42px_52px_minmax(0,1fr)_168px_auto] md:items-center"
                >
                  <span className="font-display text-[17px] font-bold text-muted-foreground/55">{String(index + 1).padStart(2, "0")}</span>
                  <ArtworkFrame title={song.title} imageUrl={song.coverImageUrl} spotifyUrl={song.spotifyUrl} kind="song" size="mini" />
                  <span>
                    <span className="block text-[15px] font-bold text-foreground">{song.title}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 md:justify-end">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-accent">{song.lifecycleStage ?? song.lifecycle}</span>
                    {isMusicBlocked(song) ? (
                      <span className="rounded-md bg-warning/10 px-2 py-1 text-[10px] font-bold text-warning">{getProjectBlockerBadge(song.blocker)}</span>
                    ) : null}
                  </span>
                  <ChevronRight className="hidden h-4 w-4 text-muted-foreground md:block" />
                </button>
              ))}
            </div>
          </div>
          <MusicProjectBrief project={project} tracklist={tracklist} onGenerateBrief={onGenerateBrief} briefPending={briefPending} briefError={briefError} />
        </div>
        <MusicLinkedWork linkedMissions={linkedMissions} onOpenMission={onOpenMission} />
      </div>
    </section>
  );
}

function MusicProjectBrief({
  project,
  tracklist,
  onGenerateBrief,
  briefPending,
  briefError,
}: {
  project: MusicObjectViewModel;
  tracklist: MusicObjectViewModel[];
  onGenerateBrief: () => void;
  briefPending: boolean;
  briefError: string | null;
}) {
  const projectIntelligenceMetrics = selectTrackIntelligenceMetrics(project.intelligenceSnapshot ?? []);
  const projectSnapshotSummary =
    acceptedVisibleTrackReadText(project.snapshotSummary) ??
    "Project intelligence is focused on the usable release and tracklist facts already in view.";
  const managerReadCopy = acceptedVisibleTrackReadText(project.managerRead);
  const generateReadLabel = projectManagerReadButtonLabel(project.managerReadState, Boolean(managerReadCopy));

  return (
    <div className="surface-elevated overflow-hidden rounded-[22px] p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-foreground/[0.045] px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {project.confidence === "limited" ? "Limited confidence" : `${project.confidence ?? "high"} confidence`}
          </span>
          <span className="rounded-full bg-foreground/[0.045] px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {managerReadStateLabel(project.managerReadState)}
          </span>
        </div>
        <button
          type="button"
          onClick={onGenerateBrief}
          disabled={briefPending}
          className="inline-flex items-center gap-2 rounded-full border border-foreground/12 bg-foreground px-4 py-2 text-[11px] font-semibold text-background shadow-sm transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={briefPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden="true" />
          {briefPending ? "Asking Manager..." : generateReadLabel}
        </button>
      </div>

      {briefError ? (
        <p className="mt-3 rounded-[10px] border border-warning/20 bg-warning/5 px-3 py-2 text-[12px] font-semibold leading-relaxed text-warning">
          {briefError}
        </p>
      ) : null}

      <h3 className="mt-4 font-display text-[22px] font-bold leading-tight tracking-tight text-foreground">{project.situationLine}</h3>

      <section data-testid="project-intelligence-card" className="mt-5 overflow-hidden rounded-[12px] border border-foreground/10 bg-background shadow-sm">
        <div className="grid gap-4 border-b border-foreground/8 bg-foreground/[0.012] px-4 py-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:px-5">
          <div className="min-w-0 border-l-2 border-[#e11937] pl-3">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-[#b51224]">Project Intelligence</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{projectIntelligenceMetrics.length} key signals</p>
          </div>
          <p className="min-w-0 text-[13px] font-semibold leading-relaxed text-foreground/72 sm:max-w-3xl">
            {projectSnapshotSummary}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
          {projectIntelligenceMetrics.map((metric) => (
            <div key={`${metric.groupTitle}-${metric.label}-${metric.value}`} className="min-w-0 border-t border-foreground/8 px-3 py-3 sm:px-4">
              <p className="text-[10px] font-semibold leading-tight text-muted-foreground/82">{metric.label}</p>
              <p className="mt-1 break-words text-[20px] font-semibold leading-none text-foreground">{metric.value}</p>
              {metric.context ? <p className="mt-1 text-[10px] font-semibold leading-tight text-muted-foreground/70">{metric.context}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 rounded-[12px] border border-foreground/8 bg-foreground/[0.018] p-5">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Manager's Read</p>
        {managerReadCopy ? (
          <p data-testid="project-manager-read-copy" className="mt-4 whitespace-pre-line text-[14px] font-semibold leading-relaxed text-foreground/90">{managerReadCopy}</p>
        ) : (
          <div data-testid="project-manager-read-copy" className="mt-4">
            <p className="text-[15px] font-semibold text-foreground">No Manager read yet</p>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">Ask Manager for a project-level view before turning this release into work.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function managerReadStateLabel(state: MusicObjectViewModel["managerReadState"]) {
  if (state === "fresh") return "Fresh";
  if (state === "limited") return "Limited";
  if (state === "loading") return "Loading";
  if (state === "failed") return "Failed";
  if (state === "stale") return "Refresh needed";
  if (state === "fallback") return "Saved-packet read";
  return "Not generated";
}

function songManagerReadButtonLabel(state: MusicObjectViewModel["managerReadState"], hasManagerRead: boolean) {
  if (!hasManagerRead || state === "loading" || !state) return "Ask Manager for a read";
  if (state === "failed") return "Retry Manager read";
  return "Refresh Manager read";
}

function projectManagerReadButtonLabel(state: MusicObjectViewModel["managerReadState"], hasManagerRead: boolean) {
  if (!hasManagerRead || state === "loading" || !state) return "Ask Manager for a project read";
  if (state === "failed") return "Retry project read";
  return "Refresh Manager read";
}

function isMusicBlocked(song: MusicObjectViewModel) {
  return song.blocker !== "No active blocker" && song.blocker !== "None";
}

function getProjectBlockerBadge(blocker?: string) {
  const normalized = blocker?.toLowerCase() ?? "";
  if (normalized.includes("split")) return "Needs split proof";
  if (normalized.includes("rights")) return "Needs rights";
  if (normalized.includes("tracklist")) return "Needs tracklist";
  return "Needs attention";
}

function getProjectBlockerRollup(blockedTracks: MusicObjectViewModel[]) {
  if (!blockedTracks.length) return null;
  const allNeedSplitProof = blockedTracks.every((track) => getProjectBlockerBadge(track.blocker) === "Needs split proof");
  const need = blockedTracks.length === 1 ? "needs" : "need";
  return `${blockedTracks.length} ${need} ${allNeedSplitProof ? "split proof" : "attention"}`;
}

function MusicDetailTop({ object, label, onBack, onStageChange }: { object: MusicObjectViewModel; label: string; onBack: () => void; onStageChange?: (stage: string) => void }) {
  const stageValue = object.lifecycleStage ?? object.lifecycle;
  const situationLine = object.situationLine ?? object.sourceLimit;

  return (
    <>
      <div data-testid="music-detail-mobile-top" className="rounded-[18px] border border-foreground/10 bg-white p-3.5 shadow-[0_1px_8px_rgba(17,19,24,0.05)] lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Back to Catalog from mobile room"
            onClick={onBack}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-background text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="rounded-full bg-foreground/[0.055] px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{label}</span>
        </div>
        <div className="mt-3 flex min-w-0 gap-3">
          <ArtworkFrame title={object.title} imageUrl={object.coverImageUrl} spotifyUrl={object.spotifyUrl} kind={object.kind} size="mini" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[20px] font-semibold leading-tight text-foreground">{object.title}</p>
            <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-muted-foreground/82">{situationLine}</p>
          </div>
        </div>
        {object.kind === "song" ? (
          <label className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[14px] border border-foreground/8 bg-foreground/[0.025] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/82">
            Stage
            <select
              aria-label="Mobile song stage"
              defaultValue={stageValue}
              onChange={(event) => onStageChange?.(event.target.value.toLowerCase())}
              className="min-w-0 rounded-[10px] border border-foreground/10 bg-background px-2.5 py-2 text-[12px] font-bold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none"
            >
              {["Idea", "Recording", "Production", "Mixing", "Mastering", "Ready", "Scheduled", "Released", "Catalog"].map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MusicMiniStat label="State" value={object.lifecycle} />
            <MusicMiniStat label="Blocker" value={object.blocker} />
          </div>
        )}
      </div>

      <div data-testid="music-detail-desktop-top" className="hidden rounded-[26px] border border-foreground/8 bg-background/88 p-5 shadow-sm lg:block">
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </button>
        <div className="grid gap-5 lg:grid-cols-[96px_minmax(0,1fr)_280px] lg:items-end">
          <ArtworkFrame title={object.title} imageUrl={object.coverImageUrl} spotifyUrl={object.spotifyUrl} kind={object.kind} size="detail" />
          <div>
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">{label}</p>
            <h2 className="mt-2 font-display text-[26px] font-semibold leading-tight text-foreground lg:text-[32px]">{object.title}</h2>
            <p data-testid="music-situation-line" className="mt-3 max-w-3xl text-[14px] font-normal leading-relaxed text-muted-foreground/84">{situationLine}</p>
          </div>
          {object.kind === "song" ? (
            <label className="grid gap-2 rounded-[16px] border border-foreground/8 bg-background/74 p-4 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/82">
              Song stage
              <select
                aria-label="Song stage"
                defaultValue={stageValue}
                onChange={(event) => onStageChange?.(event.target.value.toLowerCase())}
                className="rounded-[12px] border border-foreground/12 bg-background px-3 py-2.5 text-[13px] font-bold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none"
              >
                {["Idea", "Recording", "Production", "Mixing", "Mastering", "Ready", "Scheduled", "Released", "Catalog"].map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <MusicMiniStat label="State" value={object.lifecycle} />
              <MusicMiniStat label="Blocker" value={object.blocker} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MusicLinkedWork({ linkedMissions, onOpenMission }: { linkedMissions: MissionViewModel[]; onOpenMission: (missionId: string) => void }) {
  const hasLinkedWork = linkedMissions.length > 0;

  return (
    <aside data-testid="music-linked-work" className="surface-elevated self-start rounded-[22px] p-5 shadow-sm lg:sticky lg:top-8">
      <div className="flex items-start justify-between gap-3 border-b border-foreground/8 pb-4">
        <div>
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">Linked work</p>
          <h4 className="mt-1 font-display text-[16px] font-semibold leading-tight text-foreground">Mission path</h4>
        </div>
      </div>

      {hasLinkedWork ? (
      <div className="mt-4 grid gap-4">
        <section className="rounded-[16px] border border-foreground/8 bg-background/72">
          <div className="border-b border-foreground/8 bg-foreground/[0.025] px-4 py-3">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">Mission</p>
          </div>
          <div className="p-3">
            {linkedMissions.map((mission) => {
              const taskCount = mission.tasks?.length ?? 0;
              return (
                <button key={mission.id} type="button" onClick={() => onOpenMission(mission.id)} className="grid w-full gap-3 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-brand-accent/[0.04]">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-snug text-foreground">{mission.title}</span>
                    <span className="mt-1 block text-[11px] font-semibold leading-relaxed text-muted-foreground">{mission.review}</span>
                  </span>
                  {taskCount ? (
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-md bg-foreground/[0.055] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                        {taskCount} task{taskCount === 1 ? "" : "s"} attached
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      </div>
      ) : (
        <p className="mt-4 text-[12px] font-semibold text-muted-foreground/72">No mission linked</p>
      )}
    </aside>
  );
}

function MusicRightsWorkspace({
  song,
  onSaveContributor,
  onRemoveContributor,
  onSendLinks,
}: {
  song: MusicObjectViewModel;
  onSaveContributor: (input: { name: string; role: string; email: string; publishingShare: number; masterShare: number }) => void;
  onRemoveContributor: (contributorId: string) => void;
  onSendLinks: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Artist / writer");
  const [email, setEmail] = useState("");
  const [publishingShare, setPublishingShare] = useState("");
  const [masterShare, setMasterShare] = useState("");
  const contributors = song.splits?.contributors ?? [];
  const status = song.splits?.status ?? "Missing";
  const normalizedStatus = status.toLowerCase();
  const totalPublishing = sumContributorShares(contributors.map((contributor) => contributor.publishingShare));
  const totalMaster = sumContributorShares(contributors.map((contributor) => contributor.masterShare));
  const confirmedCount = contributors.filter((contributor) => ["cleared", "confirmed"].includes(contributor.approval.toLowerCase())).length;
  const pendingCount = contributors.filter((contributor) => contributor.approval.toLowerCase() === "pending").length;
  const locked = ["cleared", "revoked", "superseded"].includes(normalizedStatus);
  const canSendLinks = !locked && contributors.length > 0 && contributors.every((contributor) => contributor.email?.trim()) && totalPublishing === 100 && totalMaster === 100;
  const statusCopy =
    normalizedStatus === "cleared"
      ? "Every invited collaborator has confirmed these split details."
      : pendingCount
        ? `${pendingCount} collaborator${pendingCount === 1 ? "" : "s"} still need to confirm.`
        : "Balance shares and collect collaborator emails before sending confirmation links.";

  function handleAddContributor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    const nextEmail = email.trim();
    const nextPublishing = Number.parseFloat(publishingShare);
    const nextMaster = Number.parseFloat(masterShare);
    if (!nextName || !nextEmail || !Number.isFinite(nextPublishing) || !Number.isFinite(nextMaster)) return;
    onSaveContributor({
      name: nextName,
      role,
      email: nextEmail,
      publishingShare: nextPublishing,
      masterShare: nextMaster,
    });
    setName("");
    setRole("Artist / writer");
    setEmail("");
    setPublishingShare("");
    setMasterShare("");
  }

  return (
    <div className="grid gap-4">
      <span className="sr-only">split sheet document confirm split sheet publishing splits master share</span>
      <div className="surface-elevated rounded-[22px] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-foreground/8 pb-4">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Collaborator ledger</p>
            <h4 className="mt-1 font-display text-[20px] font-bold leading-tight text-foreground">Splits</h4>
            <p className="mt-2 max-w-3xl text-[13px] font-semibold leading-relaxed text-muted-foreground/84">{statusCopy}</p>
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            <MusicStatusPill value={status} />
            <span className="rounded-full border border-foreground/8 bg-background/74 px-2.5 py-1 text-[11px] font-bold text-foreground/78">
              Confirmed {confirmedCount}/{contributors.length || 0}
            </span>
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", totalPublishing === 100 ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
              Publishing / composition {totalPublishing}% / 100%
            </span>
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", totalMaster === 100 ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
              Master recording {totalMaster}% / 100%
            </span>
          </div>
        </div>

        {song.splits?.summary ? (
          <div className={cn("mt-4 rounded-[14px] border px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed", normalizedStatus === "cleared" ? "border-success/18 bg-success/[0.055] text-success" : "border-foreground/8 bg-foreground/[0.025] text-muted-foreground/90")}>
            {song.splits.summary}
          </div>
        ) : null}

        {contributors.length > 0 && (totalPublishing !== 100 || totalMaster !== 100) ? (
          <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-warning/18 bg-warning/[0.055] p-3.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-[12px] font-bold leading-snug text-foreground">Totals need balancing before links can go out.</p>
              <div className="mt-1 text-[12px] font-semibold leading-relaxed text-foreground/72">
                {totalPublishing !== 100 ? <div>Publishing / composition is currently {totalPublishing}%.</div> : null}
                {totalMaster !== 100 ? <div>Master recording is currently {totalMaster}%.</div> : null}
              </div>
            </div>
          </div>
        ) : null}

        {contributors.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-[16px] border border-foreground/8 bg-background/70">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[1.5fr_1.15fr_1.45fr_1fr_1.35fr_44px] gap-2 border-b border-foreground/8 bg-foreground/[0.025] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/82">
                <span>Contributor</span>
                <span>Role</span>
                <span>Email</span>
                <span>Splits</span>
                <span>Confirmation</span>
                <span className="text-right">Remove</span>
              </div>
              {contributors.map((contributor) => (
                <div key={contributor.id ?? contributor.name} className="grid grid-cols-[1.5fr_1.15fr_1.45fr_1fr_1.35fr_44px] items-center gap-2 border-b border-foreground/6 px-4 py-3.5 last:border-b-0">
                  <span className="truncate text-[14px] font-bold text-foreground">{contributor.name}</span>
                  <span className="truncate text-[12px] font-semibold text-muted-foreground/84">{contributor.role}</span>
                  <span className="truncate text-[12px] font-semibold text-muted-foreground/84">{contributor.email ?? "Missing"}</span>
                  <span className="text-[13px] font-bold text-foreground">{contributor.publishingShare} / {contributor.masterShare}</span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    {["Cleared", "Confirmed"].includes(contributor.approval) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        Cleared
                      </span>
                    ) : contributor.approval === "Pending" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-bold text-background">
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.055] px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                        {contributor.approval}
                      </span>
                    )}
                  </span>
                  <span className="text-right pr-2">
                    {!locked && contributor.id ? (
                      <button
                        type="button"
                        onClick={() => onRemoveContributor(contributor.id!)}
                        aria-label={`Remove ${contributor.name}`}
                        title={`Remove ${contributor.name}`}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-muted-foreground">-</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!locked ? (
          <form onSubmit={handleAddContributor} className="mt-4 rounded-[16px] border border-foreground/8 bg-foreground/[0.02] p-4">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/86">Add collaborator</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-[1.4fr_1.15fr_1.45fr_0.85fr_0.85fr] items-end">
              <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
                Name
                <input value={name} onChange={(event) => setName(event.target.value)} required className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground transition-colors focus:border-foreground focus:outline-none" />
              </label>
              <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
                Role
                <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground transition-colors focus:border-foreground focus:outline-none">
                  {["Artist / writer", "Producer / writer", "Featured artist", "Co-writer", "Label / publisher"].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
                Email (for signature request)
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground transition-colors focus:border-foreground focus:outline-none" />
              </label>
              <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
                Publishing / composition %
                <input type="number" min="0" max="100" step="0.01" value={publishingShare} onChange={(event) => setPublishingShare(event.target.value)} required className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground transition-colors focus:border-foreground focus:outline-none" />
              </label>
              <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
                Master recording %
                <input type="number" min="0" max="100" step="0.01" value={masterShare} onChange={(event) => setMasterShare(event.target.value)} required className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground transition-colors focus:border-foreground focus:outline-none" />
              </label>
            </div>
            <button type="submit" className="mt-4 inline-flex items-center justify-center gap-2 rounded-[10px] bg-foreground px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-background transition-opacity hover:opacity-90">
              <UsersRound className="h-4 w-4" />
              <span>Add collaborator</span>
            </button>
          </form>
        ) : null}

        {!locked ? (
          <div className="mt-4 flex justify-end border-t border-foreground/8 pt-4">
            <button
              type="button"
              disabled={!canSendLinks}
              onClick={onSendLinks}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-foreground px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:bg-foreground/10 disabled:text-muted-foreground"
            >
              <span>Send split confirmation links</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {song.splits?.approvalLog?.length ? (
        <div className="surface-elevated rounded-[18px] p-5 shadow-sm">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/82">Approval log</p>
          <div className="mt-3 space-y-2">
            {song.splits.approvalLog.map((entry, index) => (
              <div key={`${entry}-${index}`} className="flex items-start gap-2.5 rounded-[12px] border border-foreground/6 bg-background/68 px-3.5 py-2.5 text-[12.5px] font-bold leading-relaxed text-foreground/85">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <span>{entry}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ArtworkFrame({
  title,
  imageUrl,
  spotifyUrl,
  kind,
  size,
}: {
  title: string;
  imageUrl?: string;
  spotifyUrl?: string;
  kind: "song" | "project";
  size: "row" | "mini" | "detail" | "project";
}) {
  const classes = {
    row: "h-[64px] w-[64px] rounded-[16px]",
    mini: "h-11 w-11 rounded-[12px]",
    detail: "h-24 w-24 rounded-[20px]",
    project: "h-full min-h-[150px] w-full rounded-none",
  }[size];
  const initials = title.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden border border-foreground/8 bg-foreground/[0.07] text-muted-foreground", classes)}>
      {imageUrl ? (
        <>
          <img src={imageUrl} alt={`${title} cover artwork`} className="h-full w-full object-cover" />
          {spotifyUrl ? <span className="sr-only">Artwork sourced from Spotify public catalog.</span> : null}
        </>
      ) : (
        <span className={cn("font-display font-bold leading-none", size === "project" ? "text-[32px]" : size === "mini" ? "text-[13px]" : "text-[20px]")}>{initials}</span>
      )}
    </span>
  );
}

function MusicDetailBlock({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-[16px] border p-4", accent ? "border-brand-accent/15 bg-brand-accent/[0.035]" : "border-foreground/8 bg-foreground/[0.02]")}>
      <p className={cn("font-ui text-[10px] font-bold uppercase tracking-[0.14em]", accent ? "text-brand-accent" : "text-muted-foreground/82")}>{label}</p>
      <p className="mt-2 text-[13px] font-semibold leading-relaxed text-foreground/84">{value}</p>
    </div>
  );
}

function MusicMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 px-4 py-3">
      <span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">{label}</span>
      <span className="mt-1 block truncate text-[12px] font-bold text-foreground">{value}</span>
    </span>
  );
}

function MusicStatusPill({ value }: { value: MusicStatus }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]", musicStatusClass(value))}>{value}</span>;
}

function MusicCreateDialog({
  kind,
  pending,
  onCancel,
  onSubmit,
}: {
  kind: MusicTab;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: { title: string; type: string; lifecycleStage: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(kind === "songs" ? "song" : "ep");
  const [lifecycleStage, setLifecycleStage] = useState("idea");
  const label = kind === "songs" ? "Add song" : "Add project";

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/24 p-4 backdrop-blur-xl">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onSubmit({ title, type, lifecycleStage });
        }}
        className="w-[min(100%,34rem)] overflow-hidden rounded-[22px] border border-foreground/10 bg-background shadow-[0_24px_70px_rgba(17,19,24,0.20)] ring-1 ring-foreground/5"
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/8 px-5 pb-4 pt-5">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Manual Music record</p>
            <h3 className="mt-1 font-display text-[24px] font-bold leading-tight text-foreground">{label}</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 px-5 py-4">
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
            {kind === "songs" ? "Song title" : "Project title"}
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none" />
          </label>
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
            {kind === "songs" ? "Song type" : "Project type"}
            <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none">
              {(kind === "songs" ? ["song", "demo", "alternate_version"] : ["single", "ep", "album", "mixtape", "unreleased_body", "other"]).map((option) => (
                <option key={option} value={option}>{titleCaseStatus(option)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
            Lifecycle stage
            <select value={lifecycleStage} onChange={(event) => setLifecycleStage(event.target.value)} className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none">
              {["idea", "recording", "production", "mixing", "mastering", "ready", "scheduled", "released", "catalog"].map((stage) => (
                <option key={stage} value={stage}>{titleCaseStatus(stage)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-foreground/8 bg-foreground/[0.025] px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-foreground/10 px-4 py-2 text-[12px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={!title.trim() || pending} className="rounded-lg bg-foreground px-4 py-2 text-[12px] font-bold text-background disabled:opacity-40">{pending ? "Saving" : label}</button>
        </div>
      </form>
    </div>
  );
}

function MusicAddChooser({
  kind,
  onCancel,
  onManual,
  onImport,
}: {
  kind: MusicTab;
  onCancel: () => void;
  onManual: () => void;
  onImport: () => void;
}) {
  const noun = kind === "songs" ? "song" : "project";
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/24 p-4 backdrop-blur-xl">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${noun} to catalogue`}
        className="w-[min(100%,36rem)] overflow-hidden rounded-[22px] border border-foreground/10 bg-background shadow-[0_24px_70px_rgba(17,19,24,0.20)] ring-1 ring-foreground/5"
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/8 px-5 pb-4 pt-5">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Add to catalogue</p>
            <h3 className="mt-1 font-display text-[24px] font-bold leading-tight text-foreground">Add {noun}</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={onImport}
            aria-label="Import from Spotify"
            className="group flex flex-col gap-3 rounded-[18px] border border-foreground/10 bg-background p-4 text-left transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent/10 text-brand-accent">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="font-display text-[16px] font-bold text-foreground">Import from Spotify</span>
            <span className="text-[12px] font-semibold normal-case leading-relaxed text-muted-foreground/82">
              Pull a released {noun} from the artist&rsquo;s catalogue. We fetch the metrics and write the manager&rsquo;s read for you.
            </span>
          </button>
          <button
            type="button"
            onClick={onManual}
            aria-label="Create manually"
            className="group flex flex-col gap-3 rounded-[18px] border border-foreground/10 bg-background p-4 text-left transition-colors hover:border-foreground/25 hover:bg-foreground/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground/8 text-foreground">
              <Pencil className="h-5 w-5" />
            </span>
            <span className="font-display text-[16px] font-bold text-foreground">Create manually</span>
            <span className="text-[12px] font-semibold normal-case leading-relaxed text-muted-foreground/82">
              Start a blank record for an unreleased {noun}. Add files, credits, and details yourself.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

type ImportPhase = "import" | "read" | "done";

function MusicImportDialog({
  kind,
  onCancel,
  onSearch,
  onImportSelection,
  onGenerateRead,
  onDone,
}: {
  kind: MusicTab;
  onCancel: () => void;
  onSearch: (input: { kind: "song" | "project"; albumId?: string }) => Promise<SpotifyCatalogSearchResult>;
  onImportSelection: (input: { kind: "song" | "project"; albumId: string; trackId?: string }) => Promise<SpotifyImportResult>;
  onGenerateRead: (subjectId: string, subjectType: "music_item" | "music_project") => Promise<unknown>;
  onDone: (result: SpotifyImportResult) => void;
}) {
  const searchKind = kind === "songs" ? "song" : "project";
  const noun = kind === "songs" ? "song" : "project";
  const [releases, setReleases] = useState<SpotifyReleaseCandidate[] | null>(null);
  const [loadingReleases, setLoadingReleases] = useState(true);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ album: { albumId: string; name: string; coverImageUrl?: string }; tracks: SpotifyTrackCandidate[] } | null>(null);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [phase, setPhase] = useState<ImportPhase | null>(null);
  const [workingTitle, setWorkingTitle] = useState("");
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    setLoadingReleases(true);
    setError(null);
    onSearch({ kind: searchKind })
      .then((result) => {
        if (!active.current) return;
        if (result.mode === "releases") setReleases(result.releases);
      })
      .catch((err) => {
        if (active.current) setError(readErrorMessage(err, "Could not load the Spotify catalogue."));
      })
      .finally(() => {
        if (active.current) setLoadingReleases(false);
      });
    return () => {
      active.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredReleases = (releases ?? []).filter((release) =>
    release.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  async function openReleaseTracks(release: SpotifyReleaseCandidate) {
    setLoadingTracks(true);
    setError(null);
    try {
      const result = await onSearch({ kind: "song", albumId: release.albumId });
      if (result.mode === "tracks") setDrill({ album: result.album, tracks: result.tracks });
    } catch (err) {
      setError(readErrorMessage(err, "Could not load tracks for this release."));
    } finally {
      setLoadingTracks(false);
    }
  }

  async function commit(selection: { albumId: string; trackId?: string }, title: string) {
    setError(null);
    setWorkingTitle(title);
    try {
      setPhase("import");
      const result = await onImportSelection({ kind: searchKind, albumId: selection.albumId, trackId: selection.trackId });
      setPhase("read");
      await onGenerateRead(result.subjectId, result.subjectType);
      setPhase("done");
      onDone(result);
    } catch (err) {
      setError(readErrorMessage(err, "Import failed."));
      setPhase(null);
    }
  }

  const busy = phase !== null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/24 p-4 backdrop-blur-xl">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Import ${noun} from Spotify`}
        className="flex max-h-[min(90vh,44rem)] w-[min(100%,40rem)] flex-col overflow-hidden rounded-[22px] border border-foreground/10 bg-background shadow-[0_24px_70px_rgba(17,19,24,0.20)] ring-1 ring-foreground/5"
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/8 px-5 pb-4 pt-5">
          <div className="flex items-start gap-3">
            {drill && !busy ? (
              <button
                type="button"
                onClick={() => setDrill(null)}
                aria-label="Back to releases"
                className="mt-1 rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div>
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Import from Spotify</p>
              <h3 className="mt-1 font-display text-[24px] font-bold leading-tight text-foreground">
                {busy ? `Importing ${workingTitle || noun}` : drill ? drill.album.name : `Choose a ${noun}`}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {busy ? (
          <MusicImportProgress phase={phase} kind={searchKind} />
        ) : (
          <>
            {!drill ? (
              <div className="border-b border-foreground/8 px-5 py-3">
                <div className="flex items-center gap-2 rounded-[12px] border border-foreground/10 bg-background px-3 py-2 focus-within:border-foreground">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder={`Filter ${searchKind === "song" ? "releases" : "projects"} by name`}
                    aria-label="Filter releases"
                    className="w-full bg-transparent text-[13px] font-semibold text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                  />
                </div>
                {searchKind === "song" ? (
                  <p className="mt-2 text-[11px] font-semibold normal-case leading-relaxed text-muted-foreground/75">
                    Pick a release, then choose the track to import as a song.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {error ? (
                <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              ) : null}

              {drill ? (
                loadingTracks ? (
                  <ImportLoadingRows label="Loading tracks" />
                ) : (
                  <ul className="grid gap-1.5">
                    {drill.tracks.map((track) => (
                      <li key={track.trackId}>
                        <ImportRow
                          coverImageUrl={drill.album.coverImageUrl}
                          fallbackIcon="track"
                          title={track.name}
                          meta={[
                            track.trackNumber ? `Track ${track.trackNumber}` : null,
                            formatDuration(track.durationMs),
                          ]}
                          alreadyImported={track.alreadyImported}
                          actionLabel="Import"
                          onAction={() => commit({ albumId: drill.album.albumId, trackId: track.trackId }, track.name)}
                        />
                      </li>
                    ))}
                    {drill.tracks.length === 0 ? <ImportEmpty label="This release has no importable tracks." /> : null}
                  </ul>
                )
              ) : loadingReleases ? (
                <ImportLoadingRows label="Loading catalogue" />
              ) : (
                <ul className="grid gap-1.5">
                  {filteredReleases.map((release) => (
                    <li key={release.albumId}>
                      <ImportRow
                        coverImageUrl={release.coverImageUrl}
                        fallbackIcon="album"
                        title={release.name}
                        meta={[titleCaseStatus(release.albumType), formatReleaseYear(release.releaseDate), release.totalTracks ? `${release.totalTracks} ${release.totalTracks === 1 ? "track" : "tracks"}` : null]}
                        alreadyImported={searchKind === "project" ? release.alreadyImported : false}
                        actionLabel={searchKind === "song" ? "Choose" : "Import"}
                        actionIcon={searchKind === "song" ? "chevron" : undefined}
                        onAction={() =>
                          searchKind === "song"
                            ? openReleaseTracks(release)
                            : commit({ albumId: release.albumId }, release.name)
                        }
                      />
                    </li>
                  ))}
                  {filteredReleases.length === 0 ? (
                    <ImportEmpty label={releases && releases.length > 0 ? "No releases match your filter." : "No Spotify releases found for this artist."} />
                  ) : null}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-foreground/8 bg-foreground/[0.025] px-5 py-4">
              <button type="button" onClick={onCancel} className="rounded-lg border border-foreground/10 px-4 py-2 text-[12px] font-bold text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MusicImportProgress({ phase, kind }: { phase: ImportPhase; kind: "song" | "project" }) {
  const order: ImportPhase[] = ["import", "read"];
  const currentIndex = phase === "done" ? order.length : order.indexOf(phase);
  const steps = [
    { key: "import" as const, label: "Importing from Spotify" },
    {
      key: "read" as const,
      label: kind === "song" ? "Fetching chart metrics & manager’s read" : "Fetching project metrics & manager’s read",
    },
  ];
  return (
    <div className="grid gap-3 px-6 py-8">
      {steps.map((step, index) => {
        const stepIndex = order.indexOf(step.key);
        const done = stepIndex < currentIndex;
        const activeStep = stepIndex === currentIndex && phase !== "done";
        return (
          <div key={step.key} className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                done
                  ? "border-brand-accent/30 bg-brand-accent/10 text-brand-accent"
                  : activeStep
                    ? "border-brand-accent/30 bg-brand-accent/10 text-brand-accent"
                    : "border-foreground/10 bg-background text-muted-foreground/60",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : activeStep ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-[12px] font-bold">{index + 1}</span>}
            </span>
            <span className={cn("text-[13px] font-semibold", done || activeStep ? "text-foreground" : "text-muted-foreground/70")}>{step.label}</span>
          </div>
        );
      })}
      <p className="mt-2 text-[11px] font-semibold normal-case leading-relaxed text-muted-foreground/75">
        This runs the same pipeline as setup — hang tight, it only takes a moment.
      </p>
    </div>
  );
}

function ImportRow({
  coverImageUrl,
  fallbackIcon,
  title,
  meta,
  alreadyImported,
  actionLabel,
  actionIcon,
  onAction,
}: {
  coverImageUrl?: string;
  fallbackIcon: "album" | "track";
  title: string;
  meta: Array<string | null | undefined>;
  alreadyImported: boolean;
  actionLabel: string;
  actionIcon?: "chevron";
  onAction: () => void;
}) {
  const metaLine = meta.filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onAction}
      disabled={alreadyImported}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[14px] border border-foreground/8 bg-background px-3 py-2.5 text-left transition-colors",
        alreadyImported ? "opacity-60" : "hover:border-foreground/20 hover:bg-foreground/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-accent/25",
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-foreground/6 text-muted-foreground/70">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : fallbackIcon === "album" ? (
          <Disc3 className="h-5 w-5" />
        ) : (
          <ListMusic className="h-5 w-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[14px] font-bold text-foreground">{title}</span>
        {metaLine ? <span className="mt-0.5 block truncate text-[11px] font-semibold normal-case text-muted-foreground/78">{metaLine}</span> : null}
      </span>
      {alreadyImported ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-foreground/6 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          <Check className="h-3 w-3" /> Imported
        </span>
      ) : actionIcon === "chevron" ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
      ) : (
        <span className="inline-flex shrink-0 items-center rounded-full bg-foreground px-3 py-1.5 text-[11px] font-bold text-background transition-opacity group-hover:opacity-90">
          {actionLabel}
        </span>
      )}
    </button>
  );
}

function ImportLoadingRows({ label }: { label: string }) {
  return (
    <div className="grid gap-1.5" aria-live="polite">
      <p className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-muted-foreground/80">
        <Loader2 className="h-4 w-4 animate-spin" /> {label}
      </p>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center gap-3 rounded-[14px] border border-foreground/8 bg-background px-3 py-2.5">
          <span className="h-11 w-11 shrink-0 animate-pulse rounded-[10px] bg-foreground/8" />
          <span className="grid flex-1 gap-1.5">
            <span className="h-3 w-1/2 animate-pulse rounded bg-foreground/8" />
            <span className="h-2.5 w-1/3 animate-pulse rounded bg-foreground/6" />
          </span>
        </div>
      ))}
    </div>
  );
}

function ImportEmpty({ label }: { label: string }) {
  return <p className="rounded-[14px] border border-dashed border-foreground/12 px-4 py-6 text-center text-[12px] font-semibold text-muted-foreground/75">{label}</p>;
}

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs <= 0) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatReleaseYear(releaseDate?: string) {
  if (!releaseDate) return null;
  const year = releaseDate.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

function MusicUploadDialog({
  asset,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number];
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/24 p-4 backdrop-blur-xl">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Upload ${asset.label}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (file) onSubmit(file);
        }}
        className="w-[min(100%,32rem)] overflow-hidden rounded-[22px] border border-foreground/10 bg-background shadow-[0_24px_70px_rgba(17,19,24,0.20)] ring-1 ring-foreground/5"
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/8 px-5 pb-4 pt-5">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Private Music upload</p>
            <h3 className="mt-1 font-display text-[24px] font-bold leading-tight text-foreground">{asset.canReplace ? "Replace" : "Upload"} {asset.label}</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
        <label className="group grid min-h-[148px] cursor-pointer place-items-center rounded-[18px] border border-dashed border-foreground/18 bg-background px-5 py-6 text-center transition-colors hover:border-foreground/30 hover:bg-foreground/[0.02]">
          <input aria-label="File" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" />
          <span className="flex flex-col items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
              <Upload className="h-5 w-5" />
            </span>
            <span className="font-display text-[16px] font-bold text-foreground">{file ? file.name : "Choose a private file"}</span>
            <span className="max-w-sm text-[12px] font-semibold normal-case leading-relaxed tracking-normal text-muted-foreground/82">
              Masters and stems use the large-file path. Artwork and documents use the standard private upload path.
            </span>
          </span>
        </label>
        {error ? <p role="alert" className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-foreground/8 bg-foreground/[0.025] px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-foreground/10 px-4 py-2 text-[12px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={!file || pending} className="rounded-lg bg-foreground px-4 py-2 text-[12px] font-bold text-background disabled:opacity-40">{pending ? "Uploading" : "Upload"}</button>
        </div>
      </form>
    </div>
  );
}

function MusicDetailEditDialog({
  groupTitle,
  field,
  pending,
  onCancel,
  onSubmit,
}: {
  groupTitle: string;
  field: MusicDetailField;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(field.value === "Missing" ? "" : field.value);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/24 p-4 backdrop-blur-xl">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${field.label}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
        className="w-[min(100%,32rem)] overflow-hidden rounded-[22px] border border-foreground/10 bg-background shadow-[0_24px_70px_rgba(17,19,24,0.20)] ring-1 ring-foreground/5"
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/8 px-5 pb-4 pt-5">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">{groupTitle}</p>
            <h3 className="mt-1 font-display text-[24px] font-bold leading-tight text-foreground">Edit {field.label}</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
        <label className="grid gap-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
          Value
          <input value={value} onChange={(event) => setValue(event.target.value)} className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none" />
        </label>
        <p className="mt-3 text-[12px] font-semibold leading-relaxed text-muted-foreground/80">Provider-confirmed metadata stays read-only. This saves a user-supplied draft for incomplete fields.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-foreground/8 bg-foreground/[0.025] px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-foreground/10 px-4 py-2 text-[12px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={!value.trim() || pending} className="rounded-lg bg-foreground px-4 py-2 text-[12px] font-bold text-background disabled:opacity-40">{pending ? "Saving" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function canActOnAsset(asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number]) {
  return Boolean(asset.assetType && (asset.canUpload || asset.canReplace || asset.status === "Missing" || asset.status === "Draft"));
}

function canEditDetailField(field: MusicDetailField) {
  return ["Missing", "Draft"].includes(field.status);
}

function isIdentifierField(label: string) {
  return ["ISRC", "UPC", "Spotify track ID", "Spotify URI", "Album ID"].includes(label);
}

function identifierTypeForLabel(label: string) {
  const mapping: Record<string, string> = {
    ISRC: "isrc",
    UPC: "upc",
    "Spotify track ID": "spotify_track_id",
    "Spotify URI": "spotify_track_uri",
    "Album ID": "spotify_album_id",
  };
  return mapping[label] ?? label.toLowerCase().replace(/\s+/g, "_");
}

function musicStatusClass(status: MusicStatus) {
  return status === "Confirmed" || status === "Cleared" || status === "Uploaded"
    ? "bg-success/10 text-success"
    : status === "Missing" || status === "Pending"
      ? "bg-warning/10 text-warning"
      : "bg-brand-accent/10 text-brand-accent";
}

function countCompleteMusicItems(items?: { status: string }[]) {
  return items?.filter((item) => ["Uploaded", "Confirmed", "Cleared"].includes(item.status)).length ?? 0;
}

function sumContributorShares(values: string[]) {
  return Number(values.reduce((sum, value) => {
    const parsed = Number.parseFloat(value.replace("%", ""));
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0).toFixed(2));
}

function normalizeFieldStatus(status: string): "Missing" | "Draft" | "Confirmed" {
  if (status === "Confirmed" || status === "Uploaded" || status === "Cleared" || status === "Spotify catalog" || status === "Source-derived" || status === "Public link") return "Confirmed";
  if (status === "Missing") return "Missing";
  return "Draft";
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

function titleCaseStatus(status: string) {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getProjectReadiness(project: MusicObjectViewModel, getMusicObject: (id: string) => MusicObjectViewModel | undefined) {
  const tracks = project.songIds?.map(getMusicObject).filter(Boolean) as MusicObjectViewModel[] | undefined;
  return {
    trackCount: tracks?.length ?? project.songs?.length ?? 0,
  };
}

type CompactTrackMetric = {
  label: string;
  value: string;
  context?: string;
  evidenceIds: string[];
  groupTitle: string;
};

function selectTrackIntelligenceMetrics(groups: { title: string; metrics: { label: string; value: string; context?: string; evidenceIds: string[] }[] }[]): CompactTrackMetric[] {
  const allMetrics = groups.flatMap((group) => group.metrics.map((metric) => ({ ...metric, groupTitle: group.title })));
  const uniqueMetrics = allMetrics.filter((metric, index, list) => {
    const key = `${metric.label.toLowerCase()}-${metric.value.toLowerCase()}`;
    return list.findIndex((candidate) => `${candidate.label.toLowerCase()}-${candidate.value.toLowerCase()}` === key) === index;
  });

  const displayMetrics = uniqueMetrics.filter(isDisplayableTrackMetric).map((metric) => ({
    ...metric,
    context: compactTrackMetricContext(metric.context),
  }));

  return displayMetrics
    .map((metric, index) => ({ metric, index, priority: getTrackMetricPriority(metric) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .slice(0, 10)
    .map(({ metric }) => metric);
}

function isDisplayableTrackMetric(metric: CompactTrackMetric) {
  const visibleText = [metric.groupTitle, metric.label, metric.value, metric.context ?? ""].join(" ");
  if (hasBannedTrackVisibleTerm(visibleText)) return false;
  if (metric.label.trim().length > 30) return false;
  if (!isCompactTrackMetricValue(metric.value)) return false;

  const priority = getTrackMetricPriority(metric);
  if (priority < TRACK_METRIC_FALLBACK_PRIORITY) return true;
  if (/[\d#%]/.test(metric.value)) return true;
  return /release state|catalog status|read status/i.test(metric.label) && metric.value.trim().length <= 14;
}

function isCompactTrackMetricValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 22) return false;
  if (/[.!?]/.test(trimmed.replace(/(\d)\.(\d)/g, "$1$2"))) return false;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (!/[\d#%]/.test(trimmed) && wordCount > 2) return false;
  return true;
}

function compactTrackMetricContext(context?: string) {
  const clean = acceptedVisibleTrackReadText(context);
  if (!clean) return undefined;
  if (clean.length <= 52) return clean;
  return undefined;
}

function getTrackMetricPriority(metric: { label: string; context?: string }) {
  const text = `${metric.label} ${metric.context ?? ""}`.toLowerCase();
  const priorities = [
    /spotify streams|last 28 days|peak day|stream trend|reported streams/,
    /popularity|score/,
    /playlist reach|playlist count|editorial/,
    /tiktok creates|tiktok posts|tiktok views|tiktok/,
    /youtube views|youtube/,
    /shazam/,
    /airplay|radio/,
  ];
  const priority = priorities.findIndex((pattern) => pattern.test(text));
  return priority === -1 ? TRACK_METRIC_FALLBACK_PRIORITY : priority;
}

const TRACK_METRIC_FALLBACK_PRIORITY = 99;

const TRACK_VISIBLE_BANNED_TERMS = [
  "chatgpt",
  "ai",
  "bot",
  "backend",
  "chartmetric",
  "provider",
  "api",
  "apis",
  "database",
  "evidence row",
  "third-party",
  "spotify confirms",
  "spotify for artists",
  "private conversion data",
  "private saves",
  "private analytics",
  "private document",
  "private documents",
  "distributor proof",
  "proof of listeners",
  "listeners or saves",
  "missing saves",
  "missing listeners",
  "we do not yet have",
  "we don't yet have",
  "repeat listeners",
  "source-of-stream",
  "source limits",
  "source limit",
  "conversion proof",
  "campaign roi",
  "missing proof",
  "still missing",
  "missing data",
  "catalog-only",
  "metadata-only",
  "only catalog metadata",
  "metadata record",
  "saved track metadata",
];

function acceptedVisibleTrackReadText(value?: string) {
  const text = value?.trim();
  if (!text || hasBannedTrackVisibleTerm(text)) return undefined;
  return text;
}

function hasBannedTrackVisibleTerm(value: string) {
  return TRACK_VISIBLE_BANNED_TERMS.some((term) => new RegExp(`\\b${escapeTrackRegex(term)}\\b`, "i").test(value));
}

function escapeTrackRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
