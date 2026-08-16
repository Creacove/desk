import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronRight, Copy, Disc3, Download, FileAudio, FileText, Image as ImageIcon, ListMusic, Loader2, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, Share2, Sparkles, Trash2, Upload, UsersRound, X } from "lucide-react";
import { BorderBeam } from "border-beam";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AppThinkingOrb } from "../../design-system/AppThinkingOrb";
import { WorkspaceHeader, WorkspaceTabRail } from "../../design-system/components";
import { createClientRequestId } from "../../lib/requestId";
import { cn } from "../../lib/utils";
import { createActiveRunFallback } from "../../services/activeRunFallback";
import { managerReadControls } from "./managerReadPolicy";
import { ReleaseWorkAttachment } from "./SongRoomAttachments";
import { SongCampaignWorkspace } from "./SongCampaignWorkspace";
import { deriveSongCampaignState } from "./songCampaign";
import { SongDocumentEditor } from "./SongDocumentEditor";
import { SongDocumentActions } from "./SongDocumentActions";
import { MusicShareDialog as PolishedMusicShareDialog } from "./MusicShareDialog";
import { buildSplitRecord, deriveSongRightsState } from "./songRights";
import type {
  MissionViewModel,
  ManualSongWorkspaceResult,
  MusicObjectViewModel,
  MusicRepository,
  MusicUploadProgress,
  MusicShareLinkHistoryViewModel,
  SpotifyCatalogSearchResult,
  SpotifyImportResult,
  SpotifyReleaseCandidate,
  SpotifyTrackCandidate,
  SongDocumentType,
  SongMaterialViewModel,
} from "../../types/cleanProduction";

type MusicTab = "songs" | "projects";
type DetailMode = "library" | "songDetail" | "projectDetail";
type SongRoomTab = "overview" | "campaign" | "files" | "details" | "rights";
type MusicStatus = "Missing" | "Draft" | "Uploaded" | "Confirmed" | "Pending" | "Cleared" | string;
type MusicDetailField = { label: string; value: string; status: string };
type FocusedMusicOverlay = {
  object: MusicObjectViewModel;
  parentManagerRevision: string;
};
type SongWorkspaceCreation = {
  input: { title: string; itemType: string; lifecycleStage: string; requestId: string };
  status: "creating" | "failed";
  error?: string;
};
type CatalogImportSelection = { albumId: string; trackId?: string };
type CatalogImportJob = {
  id: string;
  kind: "song" | "project";
  title: string;
  selection: CatalogImportSelection;
  phase: "import" | "read" | "done" | "failed";
  backgrounded: boolean;
  result?: SpotifyImportResult;
  error?: string;
  refreshError?: string;
};
type MusicUploadJob = {
  id: string;
  songId: string;
  asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number];
  file: File;
  progress: MusicUploadProgress;
  status: "uploading" | "failed";
  error?: string;
};
type SongDocumentEditorTarget = {
  song: MusicObjectViewModel;
  document?: Extract<SongMaterialViewModel, { kind: "document" }>;
};

export function MusicWorkspace({
  music,
  missions,
  targetMusicObjectId,
  targetSongRoomTab = "overview",
  targetDocumentId,
  targetRequestKey = 0,
  musicRepository,
  onRefreshObject,
  onMusicChanged,
  onSongWorkspaceCreated,
  onOpenMission,
  onOpenManager,
  onBack: _onBack,
  onDetailModeChange,
  listRequestKey = 0,
}: {
  music: MusicObjectViewModel[];
  missions: MissionViewModel[];
  targetMusicObjectId?: string | null;
  targetSongRoomTab?: SongRoomTab;
  targetDocumentId?: string | null;
  targetRequestKey?: number;
  musicRepository: MusicRepository;
  onRefreshObject: (
    subjectId: string,
    subjectType: "music_item" | "music_project",
  ) => Promise<MusicObjectViewModel | null>;
  onMusicChanged: () => Promise<void>;
  onSongWorkspaceCreated?: (result: ManualSongWorkspaceResult) => Promise<void> | void;
  onOpenMission: (missionId: string) => void;
  onOpenManager?: (subject: MusicObjectViewModel, starterPrompt?: string) => void;
  onBack: () => void;
  onDetailModeChange?: (detailOpen: boolean) => void;
  listRequestKey?: number;
}) {
  const initialSelected = music.find((item) => item.id === targetMusicObjectId)
    ?? music.find((item) => item.kind === "song")
    ?? music[0];
  const [tab, setTab] = useState<MusicTab>("songs");
  const [mode, setMode] = useState<DetailMode>("library");
  const [selectedId, setSelectedId] = useState<string>(initialSelected?.id ?? "");
  const [selectedKind, setSelectedKind] = useState<MusicObjectViewModel["kind"]>(initialSelected?.kind ?? "song");
  const [returnTab, setReturnTab] = useState<MusicTab>("songs");
  const [songRoomTab, setSongRoomTab] = useState<SongRoomTab>("overview");
  const [createKind, setCreateKind] = useState<MusicTab | null>(null);
  const [addMenuKind, setAddMenuKind] = useState<MusicTab | null>(null);
  const [importKind, setImportKind] = useState<MusicTab | null>(null);
  const [catalogImportJob, setCatalogImportJob] = useState<CatalogImportJob | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ song: MusicObjectViewModel; asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number] } | null>(null);
  const [detailTarget, setDetailTarget] = useState<{ song: MusicObjectViewModel; groupTitle: string; field: MusicDetailField } | null>(null);
  const [shareTarget, setShareTarget] = useState<MusicObjectViewModel | null>(null);
  const [documentEditorTarget, setDocumentEditorTarget] = useState<SongDocumentEditorTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [uploadJobs, setUploadJobs] = useState<Record<string, MusicUploadJob>>({});
  const [songWorkspaceCreation, setSongWorkspaceCreation] = useState<SongWorkspaceCreation | null>(null);
  const [briefPending, setBriefPending] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [focusedMusicById, setFocusedMusicById] = useState<Record<string, FocusedMusicOverlay>>({});
  const [createdMusicById, setCreatedMusicById] = useState<Record<string, MusicObjectViewModel>>({});
  const [coverPreviewById, setCoverPreviewById] = useState<Record<string, string>>({});
  const managerReadHydrationChecks = useRef(new Set<string>());
  const handledTargetRequest = useRef("");
  const handledListRequest = useRef(listRequestKey);
  const catalogImportJobRef = useRef<CatalogImportJob | null>(null);
  const catalogImportBackgroundedRef = useRef(false);
  const modalActive = Boolean(createKind || addMenuKind || importKind || uploadTarget || detailTarget || shareTarget || documentEditorTarget);

  const currentMusic = useMemo(() => {
    const parentMusic = music.map((item) => {
      const overlay = focusedMusicById[musicObjectKey(item)];
      const focused = !overlay || overlay.parentManagerRevision !== managerReadRevision(item) ? item : mergeFocusedManagerState(item, overlay.object);
      return coverPreviewById[item.id] ? { ...focused, coverImageUrl: coverPreviewById[item.id] } : focused;
    });
    const newlyCreated = Object.values(createdMusicById).filter(
      (created) => !parentMusic.some((item) => musicObjectKey(item) === musicObjectKey(created)),
    );
    return [...newlyCreated, ...parentMusic];
  }, [coverPreviewById, createdMusicById, focusedMusicById, music]);
  const getMusicObject = (id: string, kind?: MusicObjectViewModel["kind"]) =>
    currentMusic.find((object) => object.id === id && (!kind || object.kind === kind));
  const songs = currentMusic.filter((object) => object.kind === "song" && (!object.projectIds || object.projectIds.length === 0));
  const projects = currentMusic.filter((object) => object.kind === "project");
  const selected = getMusicObject(selectedId, selectedKind) ?? songs[0] ?? projects[0] ?? null;
  const selectedManagerReadRevision = selected ? managerReadRevision(selected) : "";
  const tracklist = selected?.songIds?.map((id) => getMusicObject(id, "song")).filter(Boolean) as MusicObjectViewModel[] | undefined;
  const linkedMissions = selected ? findCatalogLinkedMissions(selected, missions, tracklist ?? []) : [];

  // Single source of truth for "active work" in the list: reuse the exact linkage
  // logic the song/project rooms use, so the catalog list can never disagree with
  // what you see after opening an item.
  const linkedMissionCountById = useMemo(() => {
    const resolve = (id: string) => currentMusic.find((object) => object.id === id && object.kind === "song");
    const map: Record<string, number> = {};
    for (const object of currentMusic) {
      const resolved = object;
      const objectTracklist =
        resolved.kind === "project"
          ? ((resolved.songIds?.map(resolve).filter(Boolean) as MusicObjectViewModel[] | undefined) ?? [])
          : [];
      map[musicObjectKey(resolved)] = findCatalogLinkedMissions(resolved, missions, objectTracklist).length;
    }
    return map;
  }, [currentMusic, missions]);

  useEffect(() => {
    if (!targetMusicObjectId) return;
    const requestKey = `${targetMusicObjectId}:${targetSongRoomTab}:${targetDocumentId ?? ""}:${targetRequestKey}`;
    if (handledTargetRequest.current === requestKey) return;
    const target = getMusicObject(targetMusicObjectId);
    if (!target) return;
    handledTargetRequest.current = requestKey;
    openObject(target, target.kind === "project" ? "projects" : "songs", targetSongRoomTab);

    if (target.kind !== "song" || targetSongRoomTab !== "files" || !targetDocumentId) return;
    const localDocument = (target.materials ?? []).find(
      (material): material is Extract<SongMaterialViewModel, { kind: "document" }> =>
        material.kind === "document" && material.id === targetDocumentId,
    );
    if (localDocument) {
      setDocumentEditorTarget({ song: target, document: localDocument });
      return;
    }

    let cancelled = false;
    void onRefreshObject(target.id, "music_item")
      .then((refreshed) => {
        if (cancelled || !refreshed) return;
        const document = (refreshed.materials ?? []).find(
          (material): material is Extract<SongMaterialViewModel, { kind: "document" }> =>
            material.kind === "document" && material.id === targetDocumentId,
        );
        if (document) setDocumentEditorTarget({ song: refreshed, document });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // The request key is the navigation contract. Object refresh is an intentional fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMusicObjectId, targetSongRoomTab, targetDocumentId, targetRequestKey, music]);

  useEffect(() => {
    onDetailModeChange?.(mode !== "library");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [mode, onDetailModeChange]);

  useEffect(() => {
    if (handledListRequest.current === listRequestKey) return;
    handledListRequest.current = listRequestKey;
    setMode("library");
  }, [listRequestKey]);

  useEffect(() => {
    setFocusedMusicById((current) => {
      let reconciled = current;
      for (const [key, overlay] of Object.entries(current)) {
        const parent = music.find((item) => musicObjectKey(item) === key);
        if (parent && managerReadRevision(parent) === overlay.parentManagerRevision) continue;
        if (reconciled === current) reconciled = { ...current };
        delete reconciled[key];
      }
      return reconciled;
    });
  }, [music]);

  useEffect(() => {
    setCreatedMusicById((current) => {
      const retained = Object.fromEntries(
        Object.entries(current).filter(([, created]) => !music.some((item) => musicObjectKey(item) === musicObjectKey(created))),
      );
      return Object.keys(retained).length === Object.keys(current).length ? current : retained;
    });
  }, [music]);

  useEffect(() => {
    if (!musicRepository.getAssetAccessUrl) return;
    let active = true;
    for (const song of music.filter((item) => item.kind === "song")) {
      if (coverPreviewById[song.id]) continue;
      const coverAsset = song.fileAssets?.find((asset) => asset.assetId && asset.assetType === "cover_art" && asset.status !== "Missing");
      if (!coverAsset?.assetId) continue;
      void musicRepository.getAssetAccessUrl(song.id, coverAsset.assetId).then((url) => {
        if (active) setCoverPreviewById((current) => current[song.id] ? current : { ...current, [song.id]: url });
      }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [coverPreviewById, music, musicRepository]);

  useEffect(() => {
    if (!selected) return;
    if (!needsManagerReadHydration(selected)) return;
    if (mode === "library") return;
    const hydrationKey = `${musicObjectKey(selected)}:${selectedManagerReadRevision}`;
    if (managerReadHydrationChecks.current.has(hydrationKey)) return;
    managerReadHydrationChecks.current.add(hydrationKey);
    void checkManagerReadStatus(
      selected.id,
      selected.kind === "project" ? "music_project" : "music_item",
    );
    // Subject and read revision gate this exact hydration; callback identity changes
    // must not turn opening a room into recurring traffic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selected?.id, selected?.kind, selectedManagerReadRevision]);

  useEffect(() => {
    if (selected?.managerReadStatus !== "running" && selected?.managerReadStatus !== "refreshing") return;
    const runId = selected.managerReadRunId;
    if (!runId) return;

    let cancelled = false;
    const subjectId = selected.id;
    const subjectType = selected.kind === "project" ? "music_project" as const : "music_item" as const;
    const fallback = createActiveRunFallback({
      delaysMs: [5_000, 10_000, 20_000, 30_000],
      deadlineMs: 6 * 60_000,
      isVisible: () => document.visibilityState !== "hidden",
      isOnline: () => navigator.onLine !== false,
      check: async () => {
        const run = await musicRepository.loadManagerRun(runId);
        if (!run) return "active";
        if (run.subjectId !== subjectId || run.subjectType !== subjectType) {
          throw new Error("Manager Read status did not match the selected music object.");
        }
        if (run.status === "queued" || run.status === "running") return "active";
        if (cancelled) return "terminal";

        const refreshed = await onRefreshObject(subjectId, subjectType);
        if (!refreshed) return "active";
        if (!cancelled) rememberFocusedUpdate(refreshed);
        return "terminal";
      },
      onTerminal: () => undefined,
      onError: () => {
        // Keep the last good read visible and retry with bounded backoff.
      },
    });
    const resume = () => fallback.resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    fallback.start();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      fallback.stop();
    };
  }, [musicRepository, onRefreshObject, selected?.id, selected?.kind, selected?.managerReadRunId, selected?.managerReadStatus]);

  function selectTab(next: MusicTab) {
    setTab(next);
    setMode("library");
  }

  function openObject(object: MusicObjectViewModel, origin: MusicTab = tab, destination: SongRoomTab = "overview") {
    setSelectedId(object.id);
    setSelectedKind(object.kind);
    setReturnTab(origin);
    if (object.kind === "song") setSongRoomTab(destination);
    setMode(object.kind === "song" ? "songDetail" : "projectDetail");
  }

  function backToLibrary() {
    setTab(returnTab);
    setMode("library");
  }

  async function runMusicAction(action: () => Promise<void>, successMessage = "Saved.") {
    try {
      setActionError(null);
      setActionNotice(null);
      setActionPending(true);
      await action();
      setActionNotice(successMessage);
      try {
        await onMusicChanged();
      } catch {
        setActionError("Saved, but this view could not refresh. Reopen the song to load the latest version.");
      }
      return true;
    } catch (error) {
      setActionError(readErrorMessage(error, "Music update failed."));
      return false;
    } finally {
      setActionPending(false);
    }
  }

  async function startManagerRead(subjectId: string, subjectType: "music_item" | "music_project") {
    try {
      setBriefError(null);
      setBriefPending(true);
      const updated = await musicRepository.startManagerRead(subjectId, subjectType);
      rememberFocusedUpdate(updated);
      return updated;
    } catch {
      setBriefError("Manager Read could not start. Try again.");
      return null;
    } finally {
      setBriefPending(false);
    }
  }

  async function createMusicRecord(input: { title: string; type: string; lifecycleStage: string }) {
    if (createKind === "songs") {
      const songWorkspaceInput = {
        title: input.title,
        itemType: input.type,
        lifecycleStage: input.lifecycleStage,
        requestId: createClientRequestId(),
      };
      setCreateKind(null);
      await createSongWorkspace(songWorkspaceInput);
      return;
    }

    await runMusicAction(async () => {
      const created = await musicRepository.createProject({ title: input.title, projectType: input.type, lifecycleStage: input.lifecycleStage });
      setSelectedId(created.id);
      setSelectedKind("project");
      setReturnTab("projects");
      setMode("projectDetail");
      setCreateKind(null);
    });
  }

  async function refreshFocusedSong(songId: string) {
    try {
      const refreshed = await onRefreshObject(songId, "music_item");
      if (refreshed) rememberFocusedUpdate(refreshed);
      return refreshed;
    } catch {
      return null;
    }
  }

  async function createSongWorkspace(input: SongWorkspaceCreation["input"]) {
    try {
      setActionError(null);
      setSongWorkspaceCreation({ input, status: "creating" });
      const workspace = await musicRepository.createSongWorkspace(input);
      await onSongWorkspaceCreated?.(workspace);
      setCreatedMusicById((current) => ({ ...current, [musicObjectKey(workspace.song)]: workspace.song }));
      setSelectedId(workspace.song.id);
      setSelectedKind("song");
      setReturnTab("songs");
      setSongRoomTab("files");
      setMode("songDetail");
      setSongWorkspaceCreation(null);
    } catch (error) {
      setSongWorkspaceCreation({
        input,
        status: "failed",
        error: readErrorMessage(error, "Song workspace setup failed."),
      });
    }
  }

  function openImportedRecord(result: SpotifyImportResult) {
    setImportKind(null);
    setSelectedId(result.subjectId);
    if (result.subjectType === "music_project") {
      setSelectedKind("project");
      setReturnTab("projects");
      setMode("projectDetail");
    } else {
      setSelectedKind("song");
      setReturnTab("songs");
      setSongRoomTab("overview");
      setMode("songDetail");
    }
  }

  function updateCatalogImportJob(next: CatalogImportJob | null) {
    catalogImportJobRef.current = next;
    setCatalogImportJob(next);
  }

  async function startCatalogImport(input: {
    kind: "song" | "project";
    title: string;
    selection: CatalogImportSelection;
  }) {
    const job: CatalogImportJob = {
      id: createClientRequestId(),
      kind: input.kind,
      title: input.title,
      selection: input.selection,
      phase: "import",
      backgrounded: false,
    };
    catalogImportBackgroundedRef.current = false;
    setActionError(null);
    updateCatalogImportJob(job);

    try {
      const result = await musicRepository.importSpotifySelection({
        kind: input.kind,
        albumId: input.selection.albumId,
        trackId: input.selection.trackId,
      });
      const current = catalogImportJobRef.current;
      if (!current || current.id !== job.id) return;
      updateCatalogImportJob({ ...current, phase: "read", result });

      const read = await startManagerRead(result.subjectId, result.subjectType);
      if (!read) throw new Error("Manager Read could not start. Try again.");

      let refreshError: string | undefined;
      try {
        await onMusicChanged();
      } catch {
        refreshError = "Imported, but the Catalog could not refresh. Try Open again to load it.";
      }

      const completed = {
        ...catalogImportJobRef.current!,
        phase: "done" as const,
        result,
        refreshError,
      } satisfies CatalogImportJob;
      updateCatalogImportJob(completed);

      if (!catalogImportBackgroundedRef.current && !refreshError) {
        openImportedRecord(result);
        updateCatalogImportJob(null);
      } else if (!catalogImportBackgroundedRef.current) {
        setImportKind(null);
      }
    } catch (error) {
      const failed = {
        ...(catalogImportJobRef.current ?? job),
        phase: "failed" as const,
        error: readErrorMessage(error, "Import failed."),
      } satisfies CatalogImportJob;
      updateCatalogImportJob(failed);
    }
  }

  function continueCatalogImportInBackground() {
    const current = catalogImportJobRef.current;
    if (!current || (current.phase !== "import" && current.phase !== "read")) return;
    catalogImportBackgroundedRef.current = true;
    updateCatalogImportJob({ ...current, backgrounded: true });
    setImportKind(null);
  }

  function retryCatalogImport() {
    const current = catalogImportJobRef.current;
    if (!current || (current.phase !== "failed" && current.phase !== "done")) return;
    setImportKind(current.kind === "song" ? "songs" : "projects");
    void startCatalogImport({ kind: current.kind, title: current.title, selection: current.selection });
  }

  async function openCatalogImport() {
    const current = catalogImportJobRef.current;
    if (!current?.result) return;
    if (current.refreshError) {
      try {
        await onMusicChanged();
        updateCatalogImportJob({ ...current, refreshError: undefined });
      } catch {
        updateCatalogImportJob({ ...current, refreshError: "The Catalog could not refresh yet. Try Open again." });
        return;
      }
    }
    openImportedRecord(current.result);
    updateCatalogImportJob(null);
  }

  function dismissCatalogImport() {
    const current = catalogImportJobRef.current;
    if (!current || (current.phase !== "failed" && current.phase !== "done")) return;
    updateCatalogImportJob(null);
  }

  async function checkManagerReadStatus(subjectId: string, subjectType: "music_item" | "music_project") {
    try {
      setBriefError(null);
      setBriefPending(true);
      const refreshed = await onRefreshObject(subjectId, subjectType);
      if (!refreshed) return;
      rememberFocusedUpdate(refreshed);
    } catch {
      setBriefError("Manager Read status could not be checked. Try again.");
    } finally {
      setBriefPending(false);
    }
  }

  function handleManagerReadAction(subject: MusicObjectViewModel) {
    const subjectType = subject.kind === "project" ? "music_project" : "music_item";
    if (subject.managerReadStatus === "unknown") {
      return checkManagerReadStatus(subject.id, subjectType);
    }
    return startManagerRead(subject.id, subjectType);
  }

  function rememberFocusedUpdate(updated: MusicObjectViewModel) {
    const parent = music.find((item) => item.id === updated.id && item.kind === updated.kind);
    if (!parent) return;
    setFocusedMusicById((current) => ({
      ...current,
      [musicObjectKey(updated)]: {
        object: updated,
        parentManagerRevision: managerReadRevision(parent),
      },
    }));
  }

  async function saveMusicDetail(value: string) {
    if (!detailTarget) return;
    await runMusicAction(async () => {
      const label = detailTarget.field.label;
      if (detailTarget.groupTitle === "Artists & credits") {
        await musicRepository.saveCredit(detailTarget.song.id, { role: label, name: value });
      } else if (isIdentifierField(label)) {
        await musicRepository.saveIdentifier(detailTarget.song.id, { identifierType: identifierTypeForLabel(label), identifierValue: value });
      } else {
        await musicRepository.saveDetail(detailTarget.song.id, { group: detailTarget.groupTitle, label, value });
      }
      await refreshFocusedSong(detailTarget.song.id);
      setDetailTarget(null);
    }, `${detailTarget.field.label} saved.`);
  }

  function uploadMusicAsset(file: File) {
    if (!uploadTarget) return;
    const resolvedAsset = resolveUploadAsset(uploadTarget.asset, file);
    const job: MusicUploadJob = {
      id: createClientRequestId(),
      songId: uploadTarget.song.id,
      asset: resolvedAsset,
      file,
      progress: { phase: "preparing", percent: 0, bytesUploaded: 0, bytesTotal: file.size },
      status: "uploading",
    };
    setActionError(null);
    setUploadTarget(null);
    setUploadJobs((current) => ({ ...current, [job.id]: job }));
    void performMusicAssetUpload(job);
  }

  async function saveSongDocument(input: { documentType: SongDocumentType; title: string; body: string }) {
    if (!documentEditorTarget) return;
    const target = documentEditorTarget;
    await runMusicAction(async () => {
      if (target.document) {
        if (!musicRepository.updateSongDocument) throw new Error("Document editing is not available yet.");
        await musicRepository.updateSongDocument(target.document.id, { title: input.title, body: input.body });
      } else {
        if (!musicRepository.createSongDocument) throw new Error("Document creation is not available yet.");
        await musicRepository.createSongDocument(target.song.id, input);
      }
      await refreshFocusedSong(target.song.id);
      setDocumentEditorTarget(null);
    }, `${input.title} saved.`);
  }

  async function approveSongDocument() {
    if (!documentEditorTarget?.document) return;
    const target = documentEditorTarget;
    const document = target.document!;
    await runMusicAction(async () => {
      if (!musicRepository.approveSongDocument) throw new Error("Document approval is not available yet.");
      await musicRepository.approveSongDocument(document.id);
      await refreshFocusedSong(target.song.id);
      setDocumentEditorTarget(null);
    }, `${document.title} approved for sharing.`);
  }

  async function performMusicAssetUpload(job: MusicUploadJob) {
    setUploadJobs((current) => ({
      ...current,
      [job.id]: { ...job, status: "uploading", error: undefined },
    }));
    try {
      await musicRepository.uploadAsset(job.songId, {
        assetType: job.asset.assetType ?? "other",
        title: job.asset.label,
        file: job.file,
        onProgress: (progress) => setUploadJobs((current) => current[job.id]
          ? { ...current, [job.id]: { ...current[job.id], progress } }
          : current),
      });
      if (job.asset.assetType === "cover_art" && job.file.type.startsWith("image/") && typeof URL.createObjectURL === "function") {
        setCoverPreviewById((current) => ({ ...current, [job.songId]: URL.createObjectURL(job.file) }));
      }
      await refreshFocusedSong(job.songId);
      try {
        await onMusicChanged();
      } catch {
        setActionError("Upload finished, but this view could not refresh. Reopen the song to load the file.");
      }
      setActionNotice(`${job.asset.label} uploaded.`);
      setUploadJobs((current) => {
        const next = { ...current };
        delete next[job.id];
        return next;
      });
    } catch (uploadError) {
      setUploadJobs((current) => current[job.id]
        ? {
            ...current,
            [job.id]: {
              ...current[job.id],
              status: "failed",
              error: customerUploadError(uploadError),
            },
          }
        : current);
    }
  }

  async function saveSplitContributor(songId: string, input: { name: string; role: string; email: string; publishingShare: number; masterShare: number }) {
    return runMusicAction(async () => {
      await musicRepository.saveSplitContributor(songId, input);
    });
  }

  async function removeSplitContributor(songId: string, contributorId: string) {
    return runMusicAction(async () => {
      await musicRepository.removeSplitContributor(songId, contributorId);
    });
  }

  async function sendSplitConfirmationLinks(songId: string) {
    return runMusicAction(async () => {
      await musicRepository.sendSplitConfirmationLinks(songId);
    });
  }

  return (
    <section className="app-workspace app-workspace-reveal">
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
                <WorkspaceTabRail
                  ariaLabel="Catalog sections"
                  className="min-w-0 flex-1 max-w-[260px] grid-cols-2"
                  active={tab}
                  onChange={selectTab}
                  items={(["songs", "projects"] as const).map((id) => ({ id, label: id === "songs" ? "Songs" : "Projects" }))}
                />
                <button
                  type="button"
                  onClick={() => setAddMenuKind(tab)}
                  aria-label={tab === "songs" ? "Add song" : "Add project"}
                  title={tab === "songs" && songWorkspaceCreation?.status === "creating" ? "Preparing song workspace" : tab === "songs" ? "Add song" : "Add project"}
                  disabled={tab === "songs" && songWorkspaceCreation?.status === "creating"}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-background text-foreground shadow-sm transition-colors hover:border-foreground/20 hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25 disabled:cursor-wait disabled:opacity-45"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="sr-only" aria-live="polite">{actionPending ? "Saving Music update" : ""}</div>
            {songWorkspaceCreation ? (
              <SongWorkspaceCreationNotice
                creation={songWorkspaceCreation}
                onRetry={() => void createSongWorkspace(songWorkspaceCreation.input)}
                onDismiss={() => setSongWorkspaceCreation(null)}
              />
            ) : null}
            {actionError ? <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{actionError}</p> : null}
            {catalogImportJob ? (
              <CatalogImportNotice
                job={catalogImportJob}
                onOpen={() => void openCatalogImport()}
                onRetry={retryCatalogImport}
                onDismiss={dismissCatalogImport}
              />
            ) : null}

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
                  <MusicSongRow key={song.id} song={song} index={index} activeMissionCount={linkedMissionCountById[musicObjectKey(song)] ?? 0} onOpen={() => openObject(song, "songs")} />
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
          onShareFiles={musicRepository.createShareLink ? () => setShareTarget(selected) : undefined}
          onWriteDocument={musicRepository.createSongDocument ? () => { setActionError(null); setDocumentEditorTarget({ song: selected }); } : undefined}
          onEditDocument={musicRepository.updateSongDocument ? (document) => { setActionError(null); setDocumentEditorTarget({ song: selected, document }); } : undefined}
          onAskManagerForDocument={() => onOpenManager?.(selected, `Draft a press release for ${selected.title}. Use the song's current files, lyrics, metadata, and release context. Save the draft to this song for my review.`)}
          onStartCampaignWork={onOpenManager ? (starterPrompt) => onOpenManager(selected, starterPrompt) : undefined}
          onRequestAssetAccess={musicRepository.getAssetAccessUrl ? (assetId) => musicRepository.getAssetAccessUrl!(selected.id, assetId) : undefined}
          uploadJobs={Object.values(uploadJobs).filter((job) => job.songId === selected.id)}
          onRetryUpload={(job) => void performMusicAssetUpload(job)}
          onEditDetail={(groupTitle, field) => { setActionError(null); setDetailTarget({ song: selected, groupTitle, field }); }}
          onStageChange={(stage) => runMusicAction(() => musicRepository.updateLifecycleStage(selected.id, stage))}
          onSaveSplitContributor={(input) => saveSplitContributor(selected.id, input)}
          onRemoveSplitContributor={(contributorId) => removeSplitContributor(selected.id, contributorId)}
          onSendSplitConfirmationLinks={() => sendSplitConfirmationLinks(selected.id)}
          onGenerateBrief={() => handleManagerReadAction(selected)}
          onContinueWithManager={() => onOpenManager?.(selected)}
          briefPending={briefPending}
          briefError={briefError}
          onBack={backToLibrary}
          onOpenMission={onOpenMission}
          error={actionError}
          notice={actionNotice}
          actionPending={actionPending}
        />
      ) : null}

      {mode === "projectDetail" && selected?.kind === "project" ? (
        <MusicProjectDetail
          project={selected}
          tracklist={tracklist ?? []}
          linkedMissions={linkedMissions}
          onBack={backToLibrary}
          onOpenSong={(song) => openObject(song, "projects")}
          onGenerateBrief={() => handleManagerReadAction(selected)}
          onContinueWithManager={() => onOpenManager?.(selected)}
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
          importJob={catalogImportJob}
          onStartImport={({ selection, title }) => void startCatalogImport({ kind: importKind === "songs" ? "song" : "project", title, selection })}
          onContinueBrowsing={continueCatalogImportInBackground}
        />
      ) : null}

      {uploadTarget ? (
        <MusicUploadDialog
          asset={uploadTarget.asset}
          onCancel={() => setUploadTarget(null)}
          onSubmit={uploadMusicAsset}
        />
      ) : null}

      {detailTarget ? (
        <MusicDetailEditDialog
          groupTitle={detailTarget.groupTitle}
          field={detailTarget.field}
          pending={actionPending}
          error={actionError}
          onCancel={() => setDetailTarget(null)}
          onSubmit={saveMusicDetail}
        />
      ) : null}

      {documentEditorTarget ? (
        <SongDocumentEditor
          document={documentEditorTarget.document}
          pending={actionPending}
          error={actionError}
          onCancel={() => setDocumentEditorTarget(null)}
          onSave={saveSongDocument}
          onApprove={documentEditorTarget.document?.origin === "manager_generated" && musicRepository.approveSongDocument ? approveSongDocument : undefined}
        />
      ) : null}

      {shareTarget && musicRepository.createShareLink ? (
        <PolishedMusicShareDialog
          song={shareTarget}
          onCancel={() => setShareTarget(null)}
          onCreate={musicRepository.createShareLink}
          onList={musicRepository.listShareLinks}
          onSend={musicRepository.sendShareLink}
          onRevoke={musicRepository.revokeShareLink}
          onRequestAssetAccess={musicRepository.getAssetAccessUrl ? (assetId) => musicRepository.getAssetAccessUrl!(shareTarget.id, assetId) : undefined}
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
    ...(mission.checkpoints ?? []).flatMap((checkpoint) => [checkpoint.title, checkpoint.question, checkpoint.recommendation, checkpoint.managerRead]),
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
  onShareFiles,
  onWriteDocument,
  onEditDocument,
  onAskManagerForDocument,
  onStartCampaignWork,
  onRequestAssetAccess,
  uploadJobs,
  onRetryUpload,
  onEditDetail,
  onStageChange,
  onSaveSplitContributor,
  onRemoveSplitContributor,
  onSendSplitConfirmationLinks,
  onGenerateBrief,
  onContinueWithManager,
  briefPending,
  briefError,
  onBack,
  onOpenMission,
  error,
  notice,
  actionPending,
}: {
  song: MusicObjectViewModel;
  linkedMissions: MissionViewModel[];
  activeTab: SongRoomTab;
  onTabChange: (tab: SongRoomTab) => void;
  onUploadAsset: (asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number]) => void;
  onShareFiles?: () => void;
  onWriteDocument?: () => void;
  onEditDocument?: (document: Extract<SongMaterialViewModel, { kind: "document" }>) => void;
  onAskManagerForDocument?: () => void;
  onStartCampaignWork?: (starterPrompt: string) => void;
  onRequestAssetAccess?: (assetId: string) => Promise<string>;
  uploadJobs: MusicUploadJob[];
  onRetryUpload: (job: MusicUploadJob) => void;
  onEditDetail: (groupTitle: string, field: MusicDetailField) => void;
  onStageChange: (stage: string) => void;
  onSaveSplitContributor: (input: { name: string; role: string; email: string; publishingShare: number; masterShare: number }) => Promise<boolean>;
  onRemoveSplitContributor: (contributorId: string) => Promise<boolean>;
  onSendSplitConfirmationLinks: () => Promise<boolean>;
  onGenerateBrief: () => void;
  onContinueWithManager?: () => void;
  briefPending: boolean;
  briefError: string | null;
  onBack: () => void;
  onOpenMission: (missionId: string) => void;
  error?: string | null;
  notice?: string | null;
  actionPending: boolean;
}) {
  const fileAssets = song.fileAssets ?? [];
  const [playback, setPlayback] = useState<{ assetId: string; url?: string; error?: string; loading?: boolean } | null>(null);
  const audioFiles = fileAssets.filter((asset) => asset.group === "Audio" && asset.status !== "Missing");
  const primaryAudio = audioFiles.find((asset) => asset.assetType === "final_master") ?? audioFiles[0];
  const secondaryAudio = audioFiles.filter((asset) => asset !== primaryAudio);
  const artworkFiles = fileAssets.filter((asset) => asset.group === "Artwork" && asset.status !== "Missing");
  const documentFiles = fileAssets.filter((asset) => asset.group === "Documents" && asset.status !== "Missing");
  const nativeDocuments = (song.materials ?? []).filter((material): material is Extract<SongMaterialViewModel, { kind: "document" }> => material.kind === "document");
  const missingAudioTarget = fileAssets.find((asset) => asset.group === "Audio" && asset.status === "Missing");
  const uploadTarget = missingAudioTarget ?? {
    group: "Audio" as const,
    label: "Audio file",
    status: "Missing",
    action: "Upload a song file",
    assetType: "rough_mix",
    canUpload: true,
  };
  const shareableAssets = fileAssets.filter(isShareableMusicAsset);
  const fallbackDetails = (song.details ?? []).map((field) => ({ label: field.label, value: field.value, status: normalizeFieldStatus(field.status) }));
  const allIdentityFields = [...(song.metadataFields ?? []), ...(song.identifiers ?? [])];
  const lyricsFields = allIdentityFields.filter((field) => field.label === "Lyrics");
  const identityFields = allIdentityFields.filter((field) => field.label !== "Lyrics");
  const detailGroups = [
    { title: "Song identity", fields: identityFields.length ? identityFields : fallbackDetails },
    { title: "Artists & credits", fields: (song.credits ?? []).map((credit) => ({ label: credit.role, value: credit.names, status: credit.status })) },
    { title: "Release information", fields: song.releaseFields ?? [] },
    { title: "Lyrics", fields: lyricsFields },
  ].filter((group) => group.fields.length > 0);
  const generateReadLabel = managerReadButtonLabel("song", song.managerReadStatus);
  const readBusy = briefPending || isActiveManagerRead(song.managerReadStatus);
  const pendingReadLabel = song.managerReadStatus === "unknown" ? "Checking status" : "Manager is reading";
  const readControls = managerReadControls({
    status: song.managerReadStatus ?? "not_generated",
    hasConversation: Boolean(song.managerConversationId),
  });
  const hasSecondaryReadAction = readControls.readActionPriority === "secondary";
  const campaign = useMemo(() => deriveSongCampaignState(song, linkedMissions), [song, linkedMissions]);
  const effectiveTab: SongRoomTab = activeTab === "campaign" && !campaign.visible ? "overview" : activeTab;
  const songTabs: SongRoomTab[] = campaign.visible
    ? ["overview", "campaign", "files", "details", "rights"]
    : ["overview", "files", "details", "rights"];
  const releaseKitPrompt = campaign.phase === "post_release"
    ? `Build the campaign kit for ${song.title}. This record is already released, so do not reopen pre-release gates or Spotify editorial pitching. Start from the current files, lyrics, metadata, rights, public context, and existing campaign work. Create only the EPK, bio, one-sheet, press angles, pitches, or other canonical materials this servicing campaign actually needs, save each document to the song, and ask me only for information you cannot verify.`
    : `Build the release kit for ${song.title}. Start from the song's current files, lyrics, metadata, rights, release context, and existing campaign work. Create the EPK, bio, one-sheet, press angles, channel-ready pitches, and other canonical materials this release actually needs, save each document to the song, and ask me only for information you cannot verify.`;

  async function playAsset(asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number]) {
    if (!asset.assetId || !onRequestAssetAccess) return;
    setPlayback({ assetId: asset.assetId, loading: true });
    try {
      const url = await onRequestAssetAccess(asset.assetId);
      setPlayback({ assetId: asset.assetId, url });
    } catch (playbackError) {
      setPlayback({
        assetId: asset.assetId,
        error: playbackError instanceof Error ? playbackError.message : "This file could not be opened.",
      });
    }
  }

  return (
    <section data-testid="music-song-detail" className="grid min-w-0 gap-5">
      <MusicDetailTop object={song} label="Song room" onBack={onBack} onStageChange={onStageChange} />
      {error ? <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p> : null}
      {notice && !error ? <p role="status" className="rounded-lg border border-success/20 bg-success/8 px-3 py-2 text-[12px] font-semibold text-success">{notice}</p> : null}
      <WorkspaceTabRail
        ariaLabel="Song sections"
        testId="song-room-mobile-tabs"
        className={campaign.visible ? "grid-cols-5" : "grid-cols-4"}
        active={effectiveTab}
        onChange={onTabChange}
        items={songTabs.map((id) => ({ id, label: titleCaseStatus(id) }))}
      />

      {effectiveTab === "overview" ? (
        <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div data-testid="song-room-mobile-overview" className="surface-elevated space-y-5 overflow-hidden rounded-[16px] p-4 shadow-sm sm:p-5 lg:space-y-6 lg:rounded-[22px] lg:p-6">
            <div>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">
                  <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground/78">
                    {managerReadStatusLabel(song.managerReadStatus)}
                  </span>
                  {song.blocker && song.blocker !== "No active blocker" && song.blocker !== "None" ? (
                    <span className="rounded-full bg-warning/10 px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-warning">
                      Blocker: {song.blocker}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={briefPending ? pendingReadLabel : generateReadLabel}
                  onClick={onGenerateBrief}
                  disabled={readBusy}
                  className={cn(
                    "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/12 font-ui text-[10px] font-semibold shadow-sm transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 disabled:pointer-events-none disabled:opacity-40 sm:text-[11px]",
                    hasSecondaryReadAction
                      ? "h-9 w-9 justify-center bg-background text-foreground"
                      : "bg-foreground px-3 py-2 text-background sm:px-4",
                  )}
                >
                  {readBusy ? <AppThinkingOrb surface={hasSecondaryReadAction ? "normal" : "inverse"} state="composing" size={20} /> : managerReadButtonIcon(song.managerReadStatus)}
                  <span className={hasSecondaryReadAction ? "sr-only" : undefined}>{briefPending ? pendingReadLabel : generateReadLabel}</span>
                </button>
              </div>
              {briefError ? (
                <p className="mb-3 rounded-[10px] border border-warning/20 bg-warning/5 px-3 py-2 text-[12px] font-semibold leading-relaxed text-warning">
                  {briefError}
                </p>
              ) : null}
            </div>
            <MusicManagerReadContent subject={song} testId="manager-read-copy" />
          </div>
          <ReleaseWorkAttachment
            missions={linkedMissions}
            campaign={campaign}
            onTalkToManager={onContinueWithManager}
            onOpenCampaign={campaign.visible ? () => onTabChange("campaign") : undefined}
            onOpenPlan={onOpenMission}
          />
        </div>
      ) : null}

      {effectiveTab === "campaign" && campaign.visible ? (
        <SongCampaignWorkspace
          song={song}
          campaign={campaign}
          onContinueManager={onContinueWithManager}
          onBuildReleaseKit={onStartCampaignWork ? () => onStartCampaignWork(releaseKitPrompt) : onContinueWithManager}
          onOpenFiles={() => onTabChange("files")}
          onOpenMission={onOpenMission}
        />
      ) : null}

      {effectiveTab === "files" ? (
        <div className="surface-elevated overflow-hidden rounded-[22px] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-foreground/8 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
            <div className="max-w-xl">
              <h4 className="font-display text-[20px] font-semibold leading-tight text-foreground">Song assets</h4>
              <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground/82">Everything your team needs for this song, in one place.</p>
            </div>
            <div className="flex items-center gap-2">
              {onShareFiles && (shareableAssets.length || nativeDocuments.length) ? (
                <button
                  type="button"
                  aria-label="Share files"
                  onClick={onShareFiles}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-foreground/10 bg-background px-3 text-[11px] font-semibold text-foreground transition-colors hover:border-foreground/20 hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Share
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-7 px-4 py-5 sm:px-5 sm:py-6">
            <section aria-labelledby="song-assets-audio">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><FileAudio className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" /><h5 id="song-assets-audio" className="font-ui text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Audio</h5></div>
                <button type="button" aria-label="Add audio" onClick={() => onUploadAsset(uploadTarget)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.045]"><Plus className="h-3.5 w-3.5" /> Add audio</button>
              </div>
              {primaryAudio ? (
                <div className="overflow-hidden rounded-[16px] border border-foreground/8 bg-foreground/[0.018]">
                  <div className="flex min-h-[72px] items-center gap-3 px-3.5 py-3 sm:px-4">
                    {primaryAudio.assetId && onRequestAssetAccess ? (
                      <button
                        type="button"
                        aria-label={`Play ${primaryAudio.label}`}
                        onClick={() => void playAsset(primaryAudio)}
                        disabled={playback?.assetId === primaryAudio.assetId && playback.loading}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 disabled:opacity-45"
                      >
                        {playback?.assetId === primaryAudio.assetId && playback.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                      </button>
                    ) : (
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] text-muted-foreground"><FileAudio className="h-4 w-4" /></span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-foreground">{primaryAudio.label}</span>
                      <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">Current audio</span>
                    </span>
                    {canActOnAsset(primaryAudio) ? (
                      <button type="button" aria-label={`Replace ${primaryAudio.label}`} onClick={() => onUploadAsset(primaryAudio)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
                        <Upload className="h-3.5 w-3.5" /> Replace
                      </button>
                    ) : null}
                  </div>
                  {playback && playback.assetId === primaryAudio.assetId && playback.url ? (
                    <div className="border-t border-foreground/7 px-3.5 py-3 sm:px-4">
                      <audio controls autoPlay preload="metadata" src={playback.url} aria-label={`${primaryAudio.label} audio player`} className="h-9 w-full" />
                    </div>
                  ) : null}
                  {playback && playback.assetId === primaryAudio.assetId && playback.error ? <p role="alert" className="border-t border-danger/15 px-4 py-2.5 text-[11px] font-semibold text-danger">{playback.error}</p> : null}
                  {secondaryAudio.length ? <div className="divide-y divide-foreground/6 border-t border-foreground/7">{secondaryAudio.map((asset) => <MusicStoredAssetRow key={asset.assetId ?? asset.label} asset={asset} onUploadAsset={onUploadAsset} />)}</div> : null}
                </div>
              ) : missingAudioTarget ? (
                <button type="button" aria-label={`Upload ${missingAudioTarget.label}`} onClick={() => onUploadAsset(missingAudioTarget)} className="flex w-full items-center justify-between gap-4 rounded-[14px] border border-dashed border-foreground/14 px-4 py-4 text-left transition-colors hover:border-foreground/25 hover:bg-foreground/[0.018] focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
                  <span><span className="block text-[13px] font-semibold text-foreground">Add your current audio</span><span className="mt-1 block text-[11px] font-medium text-muted-foreground">Upload a mix or master so the Manager can work from the song itself.</span></span>
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ) : null}
              {uploadJobs.filter((job) => job.asset.group === "Audio").length ? (
                <div className="mt-3 grid gap-2">
                  {uploadJobs.filter((job) => job.asset.group === "Audio").map((job) => <MusicInlineUpload key={job.id} job={job} onRetry={onRetryUpload} />)}
                </div>
              ) : null}
            </section>

            <MusicAssetGroup
              title="Artwork & images"
              addLabel="Add image"
              addTargets={[
                { label: "Cover artwork", target: { group: "Artwork", label: "Cover artwork", status: "Missing", action: "Upload cover artwork", assetType: "cover_art", canUpload: true } },
                { label: "Press image", target: { group: "Artwork", label: "Press image", status: "Missing", action: "Upload press image", assetType: "press_photo", canUpload: true } },
                { label: "Alternate artwork", target: { group: "Artwork", label: "Alternate artwork", status: "Missing", action: "Upload alternate artwork", assetType: "alternate_artwork", canUpload: true } },
              ]}
              icon={<ImageIcon className="h-4 w-4" />}
              assets={artworkFiles}
              emptyCopy="Add cover artwork, alternate artwork, or press images."
              onUploadAsset={onUploadAsset}
            />
            {uploadJobs.filter((job) => job.asset.group === "Artwork").map((job) => <MusicInlineUpload key={job.id} job={job} onRetry={onRetryUpload} />)}
            <section aria-labelledby="song-assets-documents">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-muted-foreground/70"><FileText className="h-4 w-4" /><h5 id="song-assets-documents" className="font-ui text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Documents</h5></div>
                <SongDocumentActions
                  onWrite={onWriteDocument}
                  onAskManager={onAskManagerForDocument}
                  onUpload={(option) => onUploadAsset({ group: "Documents", label: option.label, status: "Missing", action: `Upload ${option.label.toLowerCase()}`, assetType: option.assetType, canUpload: true })}
                />
              </div>
              {nativeDocuments.length || documentFiles.length ? (
                <div className="divide-y divide-foreground/6 overflow-hidden rounded-[14px] border border-foreground/8">
                  {nativeDocuments.map((document) => <button key={document.id} type="button" onClick={() => onEditDocument?.(document)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.025]"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-foreground">{document.title}</span>{document.reviewState === "needs_review" ? <span className="mt-0.5 block text-[10px] font-semibold text-warning">Needs review</span> : null}</span><span className="text-[11px] font-semibold text-muted-foreground">Open</span></button>)}
                  {documentFiles.map((asset) => <MusicStoredAssetRow key={asset.assetId ?? asset.label} asset={asset} onUploadAsset={onUploadAsset} />)}
                </div>
              ) : <p className="rounded-[14px] border border-dashed border-foreground/10 px-4 py-3 text-[11px] font-medium text-muted-foreground/72">Write lyrics and press materials here, ask Manager for a draft, or upload an existing file.</p>}
            </section>
            {uploadJobs.filter((job) => job.asset.group === "Documents").map((job) => <MusicInlineUpload key={job.id} job={job} onRetry={onRetryUpload} />)}
          </div>
        </div>
      ) : null}

      {effectiveTab === "details" ? (
        <div className="grid gap-4">
          <div data-testid="song-room-mobile-details" className="surface-elevated rounded-[16px] p-4 shadow-sm lg:hidden">
            <div className="flex items-start justify-between gap-3 border-b border-foreground/8 pb-3">
              <div className="min-w-0">
                <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">Details</p>
                <h4 className="mt-1 font-display text-[18px] font-semibold leading-tight text-foreground">Song identity</h4>
              </div>
            </div>

            <div className="mt-3 grid gap-3">
              {detailGroups.map((group) => (
                <section key={group.title} className="overflow-hidden rounded-[14px] border border-foreground/8 bg-background/72">
                  <div className="flex items-center justify-between gap-3 border-b border-foreground/8 bg-foreground/[0.025] px-3 py-2.5">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">{group.title}</p>
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
                          <span className={cn("mt-0.5 block truncate text-[13px] font-medium", field.status === "Missing" ? "text-muted-foreground/65" : "text-foreground")}>{field.status === "Missing" ? "Not added" : field.value}</span>
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
                <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">Details</p>
                <h4 className="mt-1 font-display text-[18px] font-semibold leading-tight text-foreground">Everything about this song</h4>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              {detailGroups.map((group) => (
                <section key={group.title} className="rounded-[16px] border border-foreground/8 bg-background/72">
                  <div className="flex items-center justify-between gap-4 border-b border-foreground/8 bg-foreground/[0.025] px-4 py-3">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">{group.title}</p>
                  </div>
                  <div className="grid divide-y divide-foreground/6 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                    {group.fields.map((field) => (
                      <div key={`${group.title}-${field.label}`} className="flex min-h-[74px] items-center justify-between gap-4 border-b border-foreground/6 px-4 py-3 last:border-b-0 lg:[&:nth-last-child(-n+2)]:border-b-0">
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/75">{field.label}</span>
                          <span className={cn("mt-1 block truncate text-[14px] font-medium", field.status === "Missing" ? "text-muted-foreground/65" : "text-foreground")}>{field.status === "Missing" ? "Not added" : field.value}</span>
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

      {effectiveTab === "rights" ? (
        <MusicRightsWorkspace
          song={song}
          onSaveContributor={onSaveSplitContributor}
          onRemoveContributor={onRemoveSplitContributor}
          onSendLinks={onSendSplitConfirmationLinks}
          onUploadExistingSplit={() => onUploadAsset({ group: "Documents", label: "Split sheet / rights document", status: "Missing", action: "Upload existing split sheet", assetType: "split_sheet", canUpload: true })}
          onOpenExternalRecord={onRequestAssetAccess ? async (assetId) => {
            const url = await onRequestAssetAccess(assetId);
            window.open(url, "_blank", "noopener,noreferrer");
          } : undefined}
          pending={actionPending}
        />
      ) : null}
    </section>
  );
}

function MusicInlineUpload({ job, onRetry }: { job: MusicUploadJob; onRetry: (job: MusicUploadJob) => void }) {
  const percent = Math.round(job.progress.percent ?? 0);
  const statusCopy = job.progress.phase === "preparing"
    ? "Preparing upload"
    : job.progress.phase === "finalizing"
      ? "Adding to this song"
      : "Uploading";
  return (
    <div className={cn("rounded-[14px] border px-3.5 py-3 sm:px-4", job.status === "failed" ? "border-danger/18 bg-danger/[0.025]" : "border-brand-accent/14 bg-brand-accent/[0.025]")}>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-foreground">{job.file.name}</span>
          <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{job.status === "failed" ? "Upload didn’t finish" : statusCopy}</span>
        </span>
        {job.status === "failed" ? (
          <button type="button" aria-label={`Retry ${job.file.name}`} onClick={() => onRetry(job)} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-foreground/10 bg-background px-2.5 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </button>
        ) : <span className="shrink-0 text-[12px] font-semibold tabular-nums text-brand-accent">{percent}%</span>}
      </div>
      {job.status === "failed" ? (
        <p role="alert" className="mt-2 text-[11px] font-semibold text-danger">{job.error}</p>
      ) : (
        <>
          <div role="progressbar" aria-label={`Uploading ${job.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/8">
            <div className="h-full rounded-full bg-brand-accent transition-[width] duration-200" style={{ width: `${percent}%` }} />
          </div>
          {job.progress.bytesTotal ? <p className="mt-2 text-[10px] font-medium text-muted-foreground/75">{formatUploadBytes(job.progress.bytesUploaded ?? 0)} of {formatUploadBytes(job.progress.bytesTotal)}</p> : null}
        </>
      )}
    </div>
  );
}

function MusicAssetGroup({
  title,
  addLabel,
  addTargets,
  icon,
  assets,
  emptyCopy,
  onUploadAsset,
}: {
  title: string;
  addLabel?: string;
  addTargets?: Array<{ label: string; target: NonNullable<MusicObjectViewModel["fileAssets"]>[number] }>;
  icon: ReactNode;
  assets: NonNullable<MusicObjectViewModel["fileAssets"]>;
  emptyCopy: string;
  onUploadAsset: (asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number]) => void;
}) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  return (
    <section className="relative" aria-labelledby={`song-assets-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground/70">{icon}<h5 id={`song-assets-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="font-ui text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{title}</h5></div>
        {addLabel && addTargets?.length ? <button type="button" aria-label={addLabel} aria-expanded={addMenuOpen} onClick={() => setAddMenuOpen((open) => !open)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.045]"><Plus className="h-3.5 w-3.5" /> {addLabel}</button> : null}
      </div>
      {addMenuOpen ? (
        <div role="menu" aria-label={addLabel} className="absolute right-0 top-10 z-20 grid w-52 overflow-hidden rounded-[12px] border border-foreground/10 bg-background p-1.5 shadow-xl">
          {addTargets?.map((option) => <button key={option.target.assetType ?? option.label} type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); onUploadAsset(option.target); }} className="rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold text-foreground hover:bg-foreground/[0.045]">{option.label}</button>)}
        </div>
      ) : null}
      {assets.length ? (
        <div className="divide-y divide-foreground/6 overflow-hidden rounded-[14px] border border-foreground/8">
          {assets.map((asset) => <MusicStoredAssetRow key={asset.assetId ?? asset.label} asset={asset} onUploadAsset={onUploadAsset} />)}
        </div>
      ) : (
        <p className="rounded-[14px] border border-dashed border-foreground/10 px-4 py-3 text-[11px] font-medium text-muted-foreground/72">{emptyCopy}</p>
      )}
    </section>
  );
}

function MusicStoredAssetRow({
  asset,
  onUploadAsset,
}: {
  asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number];
  onUploadAsset: (asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number]) => void;
}) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 px-3.5 py-2.5 sm:px-4">
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{asset.label}</span>
      {canActOnAsset(asset) ? (
        <button
          type="button"
          aria-label={`${asset.canReplace || asset.status === "Uploaded" ? "Replace" : "Upload"} ${asset.label}`}
          onClick={() => onUploadAsset(asset)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
        >
          <Upload className="h-3.5 w-3.5" />
          {asset.canReplace || asset.status === "Uploaded" ? "Replace" : "Upload"}
        </button>
      ) : null}
    </div>
  );
}

function MusicProjectDetail({
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
    <section data-testid="music-project-detail" className="grid min-w-0 max-w-full gap-5 overflow-x-clip">
      <MusicDetailTop object={project} label="Project" onBack={onBack} />
      {error ? <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p> : null}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <div className="surface-elevated overflow-hidden rounded-[22px] shadow-sm">
            <div className="border-b border-foreground/8 p-5">
              <div className="min-w-0">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Tracklist</p>
                <h4 className="mt-1 font-display text-[20px] font-bold leading-tight text-foreground">Project songs</h4>
                <p className="mt-1 text-[12px] font-semibold text-muted-foreground/78">Songs stay atomic inside projects.</p>
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
                    <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.04em] text-brand-accent">{song.lifecycleStage ?? song.lifecycle}</span>
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
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-accent md:text-right">{song.lifecycleStage ?? song.lifecycle}</span>
                  <ChevronRight className="hidden h-4 w-4 text-muted-foreground md:block" />
                </button>
              ))}
            </div>
          </div>
          <MusicProjectBrief project={project} onGenerateBrief={onGenerateBrief} onContinueWithManager={onContinueWithManager} briefPending={briefPending} briefError={briefError} />
        </div>
        <MusicLinkedWork linkedMissions={linkedMissions} onOpenMission={onOpenMission} />
      </div>
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
  const generateReadLabel = managerReadButtonLabel("project", project.managerReadStatus);
  const readBusy = briefPending || isActiveManagerRead(project.managerReadStatus);
  const pendingReadLabel = project.managerReadStatus === "unknown" ? "Checking status" : "Manager is reading";
  const readControls = managerReadControls({
    status: project.managerReadStatus ?? "not_generated",
    hasConversation: Boolean(project.managerConversationId),
  });
  const hasSecondaryReadAction = readControls.readActionPriority === "secondary";

  return (
    <div className="surface-elevated overflow-hidden rounded-[22px] p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-foreground/[0.045] px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {managerReadStatusLabel(project.managerReadStatus)}
          </span>
        </div>
        <button
          type="button"
          onClick={onGenerateBrief}
          disabled={readBusy}
          aria-label={briefPending ? pendingReadLabel : generateReadLabel}
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border border-foreground/12 font-ui text-[11px] font-semibold shadow-sm transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 disabled:pointer-events-none disabled:opacity-40",
            hasSecondaryReadAction
              ? "h-9 w-9 justify-center bg-background text-foreground"
              : "gap-2 bg-foreground px-4 py-2 text-background",
          )}
        >
          {readBusy ? <AppThinkingOrb surface={hasSecondaryReadAction ? "normal" : "inverse"} state="composing" size={20} /> : managerReadButtonIcon(project.managerReadStatus)}
          <span className={hasSecondaryReadAction ? "sr-only" : undefined}>{briefPending ? pendingReadLabel : generateReadLabel}</span>
        </button>
      </div>

      {briefError ? (
        <p className="mt-3 rounded-[10px] border border-warning/20 bg-warning/5 px-3 py-2 text-[12px] font-semibold leading-relaxed text-warning">
          {briefError}
        </p>
      ) : null}

      <div className="mt-5">
        <MusicManagerReadContent subject={project} testId="project-manager-read-copy" onContinueWithManager={onContinueWithManager} />
      </div>
    </div>
  );
}

function MusicManagerReadContent({
  subject,
  testId,
  onContinueWithManager,
}: {
  subject: MusicObjectViewModel;
  testId: string;
  onContinueWithManager?: () => void;
}) {
  const read = subject.managerRead;
  const statusMessage =
    subject.managerReadStatus === "refreshing"
      ? "Updating from latest song changes. The current read remains available."
      : subject.managerReadStatus === "refresh_failed"
        ? "Manager Read could not be refreshed. Your previous read is still available."
        : subject.managerReadStatus === "failed"
          ? "Manager Read could not be completed. Try again."
          : null;

  return (
    <section data-testid={testId} className="overflow-hidden rounded-[14px] border border-foreground/10 bg-background/70">
      <div className="border-b border-foreground/8 px-4 py-4 sm:px-5">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Manager&apos;s Read</p>
        {statusMessage ? (
          <p className="mt-3 rounded-[10px] border border-warning/20 bg-warning/5 px-3 py-2 text-[12px] font-semibold leading-relaxed text-warning">
            {statusMessage}
          </p>
        ) : null}
        {!read ? (
          <div className="mt-4">
            <p className="text-[15px] font-semibold text-foreground">No Manager Read yet</p>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">
              {subject.kind === "project"
                ? "Ask Manager for a project-level view before turning this release into work."
                : "Ask Manager for a clear view of this song before making a move."}
            </p>
          </div>
        ) : null}
      </div>

      {read ? (
        <>
          <div data-testid="manager-read-metrics" className="grid grid-cols-2 xl:grid-cols-3">
            {read.metrics.map((metric) => (
              <div key={metric.evidenceId} className="min-w-0 border-b border-foreground/8 px-4 py-4 max-xl:odd:border-r sm:px-5 xl:border-r xl:last:border-r-0">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{metric.label}</p>
                <p className="mt-1 break-words font-display text-[22px] font-semibold leading-none text-foreground">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="px-4 py-5 sm:px-5">
            <p className="whitespace-pre-line text-[14px] font-semibold leading-[1.75] text-foreground/90">{read.body}</p>
          </div>
        </>
      ) : null}

      {onContinueWithManager ? (
        <div className="border-t border-foreground/8 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onContinueWithManager}
            className="inline-flex items-center gap-1.5 font-ui text-[12px] font-semibold text-foreground transition-colors hover:text-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
          >
            Continue with Manager <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function managerReadStatusLabel(status: MusicObjectViewModel["managerReadStatus"]) {
  if (status === "fresh") return "Current read";
  if (status === "running") return "Manager is reading";
  if (status === "refreshing") return "Refreshing";
  if (status === "refresh_failed") return "Refresh failed";
  if (status === "failed") return "Read failed";
  if (status === "stale") return "Refresh required";
  if (status === "unknown") return "Status available when opened";
  return "Not generated";
}

function isActiveManagerRead(status: MusicObjectViewModel["managerReadStatus"]) {
  return status === "running" || status === "refreshing";
}

function managerReadButtonLabel(kind: MusicObjectViewModel["kind"], status: MusicObjectViewModel["managerReadStatus"]) {
  if (status === "running") return "Manager is reading";
  if (status === "refreshing") return "Refreshing Manager Read";
  if (status === "failed" || status === "refresh_failed") return "Retry Manager Read";
  if (status === "not_generated" || !status) return kind === "project" ? "Ask Manager for a project read" : "Ask Manager for a read";
  if (status === "unknown") return "Check status";
  return "Refresh Manager Read";
}

function managerReadButtonIcon(status: MusicObjectViewModel["managerReadStatus"]) {
  if (status === "not_generated" || !status) return <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === "failed" || status === "refresh_failed") return <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />;
  return <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />;
}

function isLockedReleasedStage(stage?: string) {
  const normalized = stage?.trim().toLowerCase();
  return normalized === "released" || normalized === "catalog";
}

function MusicDetailTop({ object, label, onBack, onStageChange }: { object: MusicObjectViewModel; label: string; onBack: () => void; onStageChange?: (stage: string) => void }) {
  const stageValue = object.lifecycleStage ?? object.lifecycle;
  const lockedReleasedStage = object.kind === "song" && isLockedReleasedStage(stageValue);

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
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <span className="rounded-full bg-foreground/[0.055] px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{label}</span>
            {lockedReleasedStage ? (
              <span data-testid="mobile-locked-song-stage" className="rounded-full bg-brand-accent/10 px-2.5 py-1 text-[10px] font-bold text-brand-accent">{stageValue}</span>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex min-w-0 gap-3">
          <ArtworkFrame title={object.title} imageUrl={object.coverImageUrl} spotifyUrl={object.spotifyUrl} kind={object.kind} size="mini" />
          <div className="min-w-0 flex-1">
            <p data-testid="music-detail-mobile-title" className="min-w-0 break-words [overflow-wrap:anywhere] font-display text-[20px] font-semibold leading-tight text-foreground">{object.title}</p>
          </div>
        </div>
        {object.kind === "song" && !lockedReleasedStage ? (
          <label className="mt-3 flex items-center justify-between gap-3 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/82">
            Stage
            <select
              aria-label="Mobile song stage"
              defaultValue={stageValue}
              onChange={(event) => onStageChange?.(event.target.value.toLowerCase())}
              className="h-8 min-w-0 max-w-[160px] rounded-[9px] border border-foreground/10 bg-background px-2.5 text-[11px] font-bold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none"
            >
              {["Idea", "Recording", "Production", "Mixing", "Mastering", "Ready", "Scheduled", "Released", "Catalog"].map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div data-testid="music-detail-desktop-top" className="hidden rounded-[26px] border border-foreground/8 bg-background/88 p-5 shadow-sm lg:block">
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </button>
        <div className="grid gap-5 lg:grid-cols-[96px_minmax(0,1fr)_280px] lg:items-end">
          <ArtworkFrame title={object.title} imageUrl={object.coverImageUrl} spotifyUrl={object.spotifyUrl} kind={object.kind} size="detail" />
          <div className="min-w-0">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">{label}</p>
            <h2 className="mt-2 min-w-0 break-words [overflow-wrap:anywhere] font-display text-[26px] font-semibold leading-tight text-foreground lg:text-[32px]">{object.title}</h2>
          </div>
          {object.kind === "song" && !lockedReleasedStage ? (
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
          ) : lockedReleasedStage ? (
            <span className="justify-self-start rounded-full bg-brand-accent/10 px-3 py-1.5 text-[11px] font-bold text-brand-accent lg:justify-self-end">{stageValue}</span>
          ) : null}
        </div>
      </div>
    </>
  );
}

function MusicLinkedWork({
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

  return (
    <aside data-testid="music-linked-work" className="surface-elevated self-start rounded-[22px] p-5 shadow-sm max-lg:rounded-[16px] max-lg:p-4 max-lg:shadow-none lg:sticky lg:top-8">
      <div className="flex items-start justify-between gap-3 border-b border-foreground/8 pb-4 max-lg:border-0 max-lg:pb-0">
        <div>
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">Linked work</p>
          <h4 className="mt-1 font-display text-[16px] font-semibold leading-tight text-foreground max-lg:hidden">Workspace links</h4>
        </div>
      </div>

      {hasLinkedWork ? (
      <div data-testid="music-linked-work-list" className="mt-4 grid gap-4 max-lg:hidden">
        {linkedConversation ? (
          <section data-testid="music-linked-conversation" className="rounded-[16px] border border-foreground/8 bg-background/72">
            <div className="border-b border-foreground/8 bg-foreground/[0.025] px-4 py-3">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">Conversation</p>
            </div>
            <div className="p-3">
              <button type="button" aria-label="Open conversation" onClick={onOpenConversation} className="grid w-full gap-2 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-brand-accent/[0.04]">
                <span className="block min-w-0 text-[13px] font-medium leading-snug text-foreground">{linkedConversation.topic}</span>
                <span className="line-clamp-2 text-[11px] font-semibold leading-relaxed text-muted-foreground">{linkedConversation.summary}</span>
                <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-accent">
                  Open conversation <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </button>
            </div>
          </section>
        ) : null}
        {linkedMissions.length ? (
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
        ) : null}
      </div>
      ) : (
        <p className="mt-4 text-[12px] font-semibold text-muted-foreground/72">No mission linked</p>
      )}
      {linkedConversation ? (
        <button type="button" onClick={onOpenConversation} className="mt-3 flex w-full items-center justify-between gap-3 border-t border-foreground/8 pt-3 text-left lg:hidden">
          <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">{linkedConversation.topic}</span>
          <span className="shrink-0 text-[11px] font-semibold text-brand-accent">Open conversation</span>
        </button>
      ) : null}
      {linkedMissions.length ? (
        <button type="button" onClick={() => onOpenMission(linkedMissions[0].id)} className="mt-3 flex w-full items-center justify-between gap-3 border-t border-foreground/8 pt-3 text-left lg:hidden">
          <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">{linkedMissions.length} linked mission{linkedMissions.length === 1 ? "" : "s"}</span>
          <span className="shrink-0 text-[11px] font-semibold text-brand-accent">Open</span>
        </button>
      ) : null}
    </aside>
  );
}

function MusicRightsWorkspace({
  song,
  onSaveContributor,
  onRemoveContributor,
  onSendLinks,
  onUploadExistingSplit,
  onOpenExternalRecord,
  pending,
}: {
  song: MusicObjectViewModel;
  onSaveContributor: (input: { name: string; role: string; email: string; publishingShare: number; masterShare: number }) => Promise<boolean>;
  onRemoveContributor: (contributorId: string) => Promise<boolean>;
  onSendLinks: () => Promise<boolean>;
  onUploadExistingSplit: () => void;
  onOpenExternalRecord?: (assetId: string) => Promise<void>;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Artist / writer");
  const [email, setEmail] = useState("");
  const [publishingShare, setPublishingShare] = useState("");
  const [masterShare, setMasterShare] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const contributors = song.splits?.contributors ?? [];
  const rights = deriveSongRightsState(song);
  const status = song.splits?.status ?? "Missing";
  const normalizedStatus = status.toLowerCase();
  const totalPublishing = sumContributorShares(contributors.map((contributor) => contributor.publishingShare));
  const totalMaster = sumContributorShares(contributors.map((contributor) => contributor.masterShare));
  const locked = ["pending confirmation", "pending_confirmation", "partially confirmed", "partially_confirmed", "cleared", "revoked", "superseded"].includes(normalizedStatus);
  const confirmationActive = ["pending confirmation", "pending_confirmation", "partially confirmed", "partially_confirmed", "cleared"].includes(normalizedStatus);
  const allocationComplete = totalPublishing === 100 && totalMaster === 100;
  const canSendLinks = !locked && !pending && contributors.length > 0 && contributors.every((contributor) => contributor.email?.trim()) && allocationComplete;
  const ledgerColumns = locked
    ? "grid-cols-[1.3fr_1fr_1.25fr_0.85fr_0.85fr_1.15fr]"
    : "grid-cols-[1.3fr_1fr_1.25fr_0.85fr_0.85fr_1.1fr_44px]";

  function exportRecord() {
    const blob = new Blob([buildSplitRecord(song)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${song.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "song"}-split-record.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleAddContributor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    const nextEmail = email.trim();
    const nextPublishing = Number.parseFloat(publishingShare);
    const nextMaster = Number.parseFloat(masterShare);
    if (!nextName || !nextEmail || !Number.isFinite(nextPublishing) || !Number.isFinite(nextMaster)) return;
    if (nextPublishing < 0 || nextMaster < 0 || nextPublishing > 100 - totalPublishing || nextMaster > 100 - totalMaster) return;
    const succeeded = await onSaveContributor({
      name: nextName,
      role,
      email: nextEmail,
      publishingShare: nextPublishing,
      masterShare: nextMaster,
    });
    if (!succeeded) return;
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
        <div className="flex flex-col gap-3 border-b border-foreground/8 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Song rights</p>
            <h4 className="mt-1 font-display text-[20px] font-bold leading-tight text-foreground">{rights.headline}</h4>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/84">{rights.description}</p>
          </div>
          {rights.state === "confirmed" ? (
            <button type="button" onClick={exportRecord} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-foreground/10 px-3 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.04]"><Download className="h-3.5 w-3.5" /> Export split record</button>
          ) : null}
        </div>

        {contributors.length ? (
          <div className="mt-4 grid gap-2 rounded-[14px] bg-foreground/[0.025] p-3 sm:grid-cols-3">
            <p className="text-[12px] font-semibold text-muted-foreground"><span className="block text-[10px] uppercase tracking-[0.08em]">Publishing allocated</span><strong className="mt-1 block text-[16px] text-foreground">{rights.publishingAllocated}%</strong></p>
            <p className="text-[12px] font-semibold text-muted-foreground"><span className="block text-[10px] uppercase tracking-[0.08em]">Master allocated</span><strong className="mt-1 block text-[16px] text-foreground">{rights.masterAllocated}%</strong></p>
            {confirmationActive ? <p className="text-[12px] font-semibold text-muted-foreground"><span className="block text-[10px] uppercase tracking-[0.08em]">Confirmed</span><strong className="mt-1 block text-[16px] text-foreground">{rights.confirmedCount} of {rights.contributorCount}</strong></p> : null}
          </div>
        ) : null}

        {!contributors.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {rights.state === "document_on_file" && rights.externalRecordId && onOpenExternalRecord ? (
              <button type="button" onClick={() => void onOpenExternalRecord(rights.externalRecordId!)} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-foreground px-4 py-2.5 text-[12px] font-bold text-background"><FileText className="h-4 w-4" /> Open rights document</button>
            ) : (
              <button type="button" onClick={() => setSetupOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-foreground px-4 py-2.5 text-[12px] font-bold text-background"><UsersRound className="h-4 w-4" /> Set up splits here</button>
            )}
            <button type="button" onClick={rights.state === "document_on_file" ? () => setSetupOpen(true) : onUploadExistingSplit} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-foreground/10 px-4 py-2.5 text-[12px] font-semibold text-foreground hover:bg-foreground/[0.04]">
              {rights.state === "document_on_file" ? "Set up structured splits" : "Upload existing split sheet"}
            </button>
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
              <div className={cn("grid gap-2 border-b border-foreground/8 bg-foreground/[0.025] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/82", ledgerColumns)}>
                <span>Contributor</span>
                <span>Role</span>
                <span>Email</span>
                <span>Publishing</span>
                <span>Master</span>
                <span>Confirmation</span>
                {!locked ? <span className="text-right">Remove</span> : null}
              </div>
              {contributors.map((contributor) => {
                const approval = contributor.approval.toLowerCase();
                return (
                  <div key={contributor.id ?? contributor.name} className={cn("grid items-center gap-2 border-b border-foreground/6 px-4 py-3.5 last:border-b-0", ledgerColumns)}>
                    <span className="truncate text-[14px] font-bold text-foreground">{contributor.name}</span>
                    <span className="truncate text-[12px] font-semibold text-muted-foreground/84">{contributor.role}</span>
                    <span className="truncate text-[12px] font-semibold text-muted-foreground/84">{contributor.email ?? "Missing"}</span>
                    <span className="text-[12px] font-bold text-foreground">{contributor.publishingShare}</span>
                    <span className="text-[12px] font-bold text-foreground">{contributor.masterShare}</span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {["cleared", "confirmed"].includes(approval) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          Confirmed
                        </span>
                      ) : approval === "pending" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-bold text-background">
                          Awaiting confirmation
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.055] px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                          {contributor.approval}
                        </span>
                      )}
                    </span>
                    {!locked ? (
                      <span className="pr-2 text-right">
                        {contributor.id ? (
                          <button
                            type="button"
                            onClick={() => void onRemoveContributor(contributor.id!)}
                            disabled={pending}
                            aria-label={`Remove ${contributor.name}`}
                            title={`Remove ${contributor.name}`}
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {!locked && !allocationComplete && (contributors.length > 0 || setupOpen) ? (
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
                Email (for confirmation request)
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground transition-colors focus:border-foreground focus:outline-none" />
              </label>
              <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
                Publishing / composition %
                <input type="number" min="0" max={Math.max(0, 100 - totalPublishing)} step="0.01" value={publishingShare} onChange={(event) => setPublishingShare(event.target.value)} required className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground transition-colors focus:border-foreground focus:outline-none" />
              </label>
              <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
                Master recording %
                <input type="number" min="0" max={Math.max(0, 100 - totalMaster)} step="0.01" value={masterShare} onChange={(event) => setMasterShare(event.target.value)} required className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground transition-colors focus:border-foreground focus:outline-none" />
              </label>
            </div>
            <button type="submit" disabled={pending} className="mt-4 inline-flex items-center justify-center gap-2 rounded-[10px] bg-foreground px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-background transition-opacity hover:opacity-90 disabled:opacity-40">
              <UsersRound className="h-4 w-4" />
              <span>Add collaborator</span>
            </button>
          </form>
        ) : null}

        {!locked && allocationComplete ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/8 pt-4">
            <p className="text-[12px] font-semibold text-muted-foreground">Allocation complete. Remove a collaborator to make changes.</p>
            <button
              type="button"
              disabled={!canSendLinks}
              onClick={() => void onSendLinks()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-foreground px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:bg-foreground/10 disabled:text-muted-foreground"
            >
              <span>Send split confirmation links</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : !locked && contributors.length ? (
          <p className="mt-4 border-t border-foreground/8 pt-4 text-[12px] font-semibold text-muted-foreground">Finish both allocations at 100% to send confirmation links.</p>
        ) : null}
      </div>

      {song.splits?.approvalLog?.length ? (
        <details className="surface-elevated rounded-[18px] p-5 shadow-sm">
          <summary className="cursor-pointer font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/82">Approval log</summary>
          <div className="mt-3 space-y-2">
            {song.splits.approvalLog.map((entry, index) => (
              <div key={`${entry}-${index}`} className="flex items-start gap-2.5 rounded-[12px] border border-foreground/6 bg-background/68 px-3.5 py-2.5 text-[12.5px] font-bold leading-relaxed text-foreground/85">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <span>{entry}</span>
              </div>
            ))}
          </div>
        </details>
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
          {spotifyUrl ? <span className="sr-only">Catalog artwork.</span> : null}
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
  const submitLabel = kind === "songs" ? "Create song" : "Add project";

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
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">{kind === "songs" ? "New unreleased song" : "Manual music record"}</p>
            <h3 className="mt-1 font-display text-[24px] font-bold leading-tight text-foreground">{kind === "songs" ? "Start a song workspace" : label}</h3>
            {kind === "songs" ? <p className="mt-2 max-w-md text-[12px] font-medium leading-relaxed text-muted-foreground">Create the song first. You can add the audio, credits, rights, and details once you arrive.</p> : null}
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
            <select value={lifecycleStage} aria-describedby={kind === "songs" ? "song-lifecycle-stage-help" : undefined} onChange={(event) => setLifecycleStage(event.target.value)} className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none">
              {["idea", "recording", "production", "mixing", "mastering", "ready", "scheduled", "released", "catalog"].map((stage) => (
                <option key={stage} value={stage}>{titleCaseStatus(stage)}</option>
              ))}
            </select>
          </label>
          {kind === "songs" ? <p id="song-lifecycle-stage-help" className="-mt-1 normal-case text-[11px] font-medium tracking-normal text-muted-foreground">Choose the truest current stage. You can change it later.</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-foreground/8 bg-foreground/[0.025] px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-foreground/10 px-4 py-2 text-[12px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={!title.trim() || pending} className="rounded-lg bg-foreground px-4 py-2 text-[12px] font-bold text-background disabled:opacity-40">{pending ? "Saving" : submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

function SongWorkspaceCreationNotice({
  creation,
  onRetry,
  onDismiss,
}: {
  creation: SongWorkspaceCreation;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const isCreating = creation.status === "creating";

  return (
    <div
      data-testid="song-workspace-creation-notice"
      role={isCreating ? "status" : "alert"}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-3 text-[12px]",
        isCreating ? "border-brand-accent/20 bg-brand-accent/[0.045] text-foreground" : "border-danger/20 bg-danger/10 text-danger",
      )}
    >
      {isCreating ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-accent" aria-hidden="true" /> : <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{isCreating ? `Creating ${creation.input.title}` : `Couldn’t create ${creation.input.title}`}</p>
        <p className={cn("mt-0.5 text-[11px] font-medium", isCreating ? "text-muted-foreground" : "text-danger/80")}>
          {isCreating ? "Preparing its Files space and linked work. You can keep browsing." : creation.error}
        </p>
      </div>
      {!isCreating ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={onRetry} className="rounded-lg border border-current/20 px-2.5 py-1.5 text-[11px] font-bold transition-colors hover:bg-current/10">Retry</button>
          <button type="button" onClick={onDismiss} aria-label="Dismiss song workspace error" className="rounded-lg p-1.5 transition-colors hover:bg-current/10"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}
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
            aria-label="Import from catalog"
            className="group flex flex-col gap-3 rounded-[18px] border border-foreground/10 bg-background p-4 text-left transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent/10 text-brand-accent">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="font-display text-[16px] font-bold text-foreground">Import from catalog</span>
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

function CatalogImportNotice({
  job,
  onOpen,
  onRetry,
  onDismiss,
}: {
  job: CatalogImportJob;
  onOpen: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const active = job.phase === "import" || job.phase === "read";
  const failed = job.phase === "failed";
  const title = active
    ? job.phase === "import" ? `Importing ${job.title}` : `Preparing ${job.title}`
    : failed ? `${job.title} import failed` : `Imported ${job.title}`;
  const detail = active
    ? job.phase === "import" ? "Adding it to your Catalog." : "Fetching the Manager Read."
    : failed ? job.error ?? "Import failed. Try again." : job.refreshError ?? "Ready in your Catalog.";

  return (
    <section
      data-testid="catalog-import-notice"
      role={failed ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-[16px] border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        failed ? "border-danger/20 bg-danger/10" : "border-brand-accent/20 bg-brand-accent/[0.06]",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn(
          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          failed ? "bg-danger/10 text-danger" : "bg-brand-accent/10 text-brand-accent",
        )}>
          {active ? <AppThinkingOrb state="working" size={20} /> : failed ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-foreground">{title}</p>
          <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-muted-foreground/80">{detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        {active ? (
          <span className="rounded-full border border-foreground/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">In background</span>
        ) : failed ? (
          <>
            <button type="button" onClick={onRetry} className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-bold text-background">Retry</button>
            <button type="button" onClick={onDismiss} className="rounded-full border border-foreground/10 px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground">Dismiss</button>
          </>
        ) : (
          <>
            <button type="button" onClick={onOpen} className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-bold text-background">Open</button>
            <button type="button" onClick={onDismiss} className="rounded-full border border-foreground/10 px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground">Dismiss</button>
          </>
        )}
      </div>
    </section>
  );
}

type ImportPhase = "import" | "read" | "done";

function MusicImportDialog({
  kind,
  onCancel,
  onSearch,
  importJob,
  onStartImport,
  onContinueBrowsing,
}: {
  kind: MusicTab;
  onCancel: () => void;
  onSearch: (input: { kind: "song" | "project"; albumId?: string }) => Promise<SpotifyCatalogSearchResult>;
  importJob: CatalogImportJob | null;
  onStartImport: (input: { selection: CatalogImportSelection; title: string }) => void;
  onContinueBrowsing: () => void;
}) {
  const searchKind = kind === "songs" ? "song" : "project";
  const noun = kind === "songs" ? "song" : "project";
  const [releases, setReleases] = useState<SpotifyReleaseCandidate[] | null>(null);
  const [loadingReleases, setLoadingReleases] = useState(true);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ album: { albumId: string; name: string; coverImageUrl?: string }; tracks: SpotifyTrackCandidate[] } | null>(null);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const active = useRef(true);
  const activeJob = importJob?.kind === searchKind ? importJob : null;
  const busy = activeJob?.phase === "import" || activeJob?.phase === "read";
  const jobError = activeJob?.phase === "failed" ? activeJob.error : null;

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
        if (active.current) setError(readErrorMessage(err, "Could not load the catalog."));
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

  function commit(selection: CatalogImportSelection, title: string) {
    setError(null);
    onStartImport({ selection, title });
  }

  return (
    <div className="fixed inset-0 z-[80] grid overflow-x-hidden bg-foreground/24 backdrop-blur-xl sm:place-items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Import ${noun} from catalog`}
        aria-busy={loadingReleases || loadingTracks || busy}
        className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-background shadow-[0_24px_70px_rgba(17,19,24,0.20)] sm:h-auto sm:max-h-[min(90vh,44rem)] sm:w-[min(100%,40rem)] sm:rounded-[22px] sm:border sm:border-foreground/10 sm:ring-1 sm:ring-foreground/5"
      >
        <div className="flex min-w-0 shrink-0 items-start justify-between gap-3 border-b border-foreground/8 px-4 pb-4 pt-4 sm:gap-4 sm:px-5 sm:pt-5">
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
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
            <div className="min-w-0">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Import from catalog</p>
              <h3 className="mt-1 break-words font-display text-[22px] font-bold leading-tight text-foreground sm:text-[24px]">
                {busy ? `Importing ${activeJob?.title || noun}` : drill ? drill.album.name : `Choose a ${noun}`}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={busy ? onContinueBrowsing : onCancel}
            aria-label={busy ? "Continue browsing" : "Close"}
            className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {busy ? (
          <MusicImportProgress phase={activeJob!.phase === "read" ? "read" : "import"} kind={searchKind} onContinueBrowsing={onContinueBrowsing} />
        ) : (
          <>
            {!drill ? (
              <div className="shrink-0 border-b border-foreground/8 px-4 py-3 sm:px-5">
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

            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              {error || jobError ? (
                <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error ?? jobError}
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
                    <ImportEmpty label={releases && releases.length > 0 ? "No releases match your filter." : "No releases found for this artist."} />
                  ) : null}
                </ul>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-foreground/8 bg-foreground/[0.025] px-4 py-3 sm:px-5 sm:py-4">
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

function MusicImportProgress({ phase, kind, onContinueBrowsing }: { phase: ImportPhase; kind: "song" | "project"; onContinueBrowsing: () => void }) {
  const order: ImportPhase[] = ["import", "read"];
  const currentIndex = phase === "done" ? order.length : order.indexOf(phase);
  const steps = [
    { key: "import" as const, label: "Adding to your catalog" },
    {
      key: "read" as const,
      label: kind === "song" ? "Fetching chart metrics & manager’s read" : "Fetching project metrics & manager’s read",
    },
  ];
  return (
    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-8 sm:px-6">
      <div className="mx-auto grid w-full max-w-md gap-3">
        {steps.map((step, index) => {
        const stepIndex = order.indexOf(step.key);
        const done = stepIndex < currentIndex;
        const activeStep = stepIndex === currentIndex && phase !== "done";
        return (
          <div key={step.key} className="flex min-w-0 items-center gap-3">
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
              {done ? <Check className="h-4 w-4" /> : activeStep ? <AppThinkingOrb state="working" size={20} /> : <span className="text-[12px] font-bold">{index + 1}</span>}
            </span>
            <span className={cn("min-w-0 text-[13px] font-semibold", done || activeStep ? "text-foreground" : "text-muted-foreground/70")}>{step.label}</span>
          </div>
        );
        })}
      <button type="button" onClick={onContinueBrowsing} className="mt-2 w-fit rounded-full border border-foreground/12 px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:border-foreground/25 hover:text-foreground">
        Continue browsing
      </button>
      </div>
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
        "group flex min-w-0 w-full items-center gap-3 overflow-hidden rounded-[14px] border border-foreground/8 bg-background px-3 py-2.5 text-left transition-colors",
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
        <span className="inline-flex max-w-[42%] shrink-0 items-center gap-1 rounded-full bg-foreground/6 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:max-w-none">
          <Check className="h-3 w-3 shrink-0" /> <span className="truncate">Imported</span>
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
    <div className="relative overflow-hidden rounded-[16px] border border-foreground/10 bg-background/50 p-3" aria-live="polite">
      <BorderBeam size="md" colorVariant="mono" active={true} />
      <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-muted-foreground/80">
        <AppThinkingOrb state="searching" size={20} /> {label}
      </p>
      <div className="grid gap-1.5">
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

function MusicShareDialog({
  song,
  onCancel,
  onCreate,
  onList,
  onSend,
  onRevoke,
}: {
  song: MusicObjectViewModel;
  onCancel: () => void;
  onCreate: NonNullable<MusicRepository["createShareLink"]>;
  onList?: NonNullable<MusicRepository["listShareLinks"]>;
  onSend?: NonNullable<MusicRepository["sendShareLink"]>;
  onRevoke?: NonNullable<MusicRepository["revokeShareLink"]>;
}) {
  const assets = (song.fileAssets ?? []).filter(isShareableMusicAsset);
  const documents = (song.materials ?? []).filter((material): material is Extract<SongMaterialViewModel, { kind: "document" }> => material.kind === "document" && material.reviewState !== "needs_review");
  const [selectedAssetIds, setSelectedAssetIds] = useState(() => assets.flatMap((asset) => asset.assetId ? [asset.assetId] : []));
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(() => documents.map((document) => document.id));
  const [selectedInformationKeys, setSelectedInformationKeys] = useState<string[]>(["song_title", "primary_artist", "release_date"]);
  const [previewing, setPreviewing] = useState(false);
  const [preset, setPreset] = useState<"listen" | "epk_press" | "delivery" | "custom">("delivery");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<{ id: string; url: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [shareHistory, setShareHistory] = useState<MusicShareLinkHistoryViewModel[]>([]);
  const [historyPending, setHistoryPending] = useState(Boolean(onList));

  useEffect(() => {
    let active = true;
    if (!onList) {
      setHistoryPending(false);
      return () => { active = false; };
    }
    setHistoryPending(true);
    onList({ type: "music_item", id: song.id })
      .then((links) => {
        if (!active) return;
        setShareHistory((current) => [
          ...current,
          ...links.filter((link) => !current.some((existing) => existing.id === link.id)),
        ]);
      })
      .catch(() => { if (active) setShareHistory([]); })
      .finally(() => { if (active) setHistoryPending(false); });
    return () => { active = false; };
  }, [onList, song.id]);

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) => current.includes(assetId)
      ? current.filter((id) => id !== assetId)
      : [...current, assetId]);
  }

  function toggleSelection(value: string, values: string[], setValues: (next: string[]) => void) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!selectedAssetIds.length && !selectedDocumentIds.length && !selectedInformationKeys.length) || pending) return;
    setPending(true);
    setError(null);
    setEmailSent(false);
    setRevoked(false);
    setCopied(false);
    let linkWasCreated = false;
    try {
      const shareLink = await onCreate({
        musicSubject: { type: "music_item", id: song.id },
        assetIds: selectedAssetIds,
        documentIds: selectedDocumentIds,
        informationKeys: selectedInformationKeys,
        preset,
        recipientEmail: recipientEmail.trim() || undefined,
      });
      setCreatedLink({ id: shareLink.id, url: shareLink.url });
      setShareHistory((current) => [{
        id: shareLink.id,
        label: shareLink.label,
        preset: shareLink.preset,
        state: "active",
        recipientEmail: shareLink.recipientEmail,
        createdAt: shareLink.createdAt,
        assetCount: selectedAssetIds.length,
        accessCount: 0,
      }, ...current.filter((link) => link.id !== shareLink.id)]);
      linkWasCreated = true;
      if (recipientEmail.trim() && onSend) {
        await onSend({ shareLinkId: shareLink.id, url: shareLink.url, recipientEmail: recipientEmail.trim() });
        setEmailSent(true);
      }
    } catch (submissionError) {
      setError(linkWasCreated
        ? "The secure link was created, but the email could not be sent. You can still copy the link below."
        : readErrorMessage(submissionError, "Share link could not be created. Try again."));
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!createdLink?.url) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(createdLink.url);
      setCopied(true);
    } catch {
      setError("Copy is unavailable here. Select the secure link and copy it manually.");
    }
  }

  async function revokeLink() {
    if (!createdLink || !onRevoke || pending || revoked) return;
    setPending(true);
    setError(null);
    try {
      await onRevoke(createdLink.id);
      setRevoked(true);
      setShareHistory((current) => current.map((link) => link.id === createdLink.id ? { ...link, state: "revoked" } : link));
    } catch (revokeError) {
      setError(readErrorMessage(revokeError, "Share link could not be revoked. Try again."));
    } finally {
      setPending(false);
    }
  }

  async function revokeHistoricalLink(shareLink: MusicShareLinkHistoryViewModel) {
    if (!onRevoke || pending || shareLink.state !== "active") return;
    setPending(true);
    setError(null);
    try {
      await onRevoke(shareLink.id);
      setShareHistory((current) => current.map((link) => link.id === shareLink.id ? { ...link, state: "revoked" } : link));
    } catch (revokeError) {
      setError(readErrorMessage(revokeError, "Share link could not be revoked. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/24 p-4 backdrop-blur-xl">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${song.title} files`}
        onSubmit={submit}
        className="w-[min(100%,38rem)] overflow-hidden rounded-[22px] border border-foreground/10 bg-background shadow-[0_24px_70px_rgba(17,19,24,0.20)] ring-1 ring-foreground/5"
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/8 px-5 pb-4 pt-5">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Private release package</p>
            <h3 className="mt-1 font-display text-[24px] font-bold leading-tight text-foreground">Share {song.title}</h3>
            <p className="mt-2 max-w-lg text-[12px] font-semibold leading-relaxed text-muted-foreground/80">Choose exactly what this person needs. The shared page never exposes your whole song room.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
              Package type
              <select aria-label="Sharing preset" value={preset} onChange={(event) => setPreset(event.target.value as typeof preset)} className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none">
                <option value="listen">Listen only</option>
                <option value="epk_press">EPK / press</option>
                <option value="delivery">Delivery</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">
              Send to email <span className="font-medium normal-case tracking-normal text-muted-foreground/60">optional</span>
              <input aria-label="Send to email" type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="name@company.com" className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground placeholder:text-muted-foreground/45 focus:border-foreground focus:outline-none" />
            </label>
          </div>

          <fieldset className="mt-5">
            <legend className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/82">Included files</legend>
            <div className="mt-2 overflow-hidden rounded-[14px] border border-foreground/8">
              {assets.map((asset) => (
                <label key={asset.assetId} className="flex cursor-pointer items-center gap-3 border-b border-foreground/6 px-3 py-3 last:border-b-0 hover:bg-foreground/[0.025]">
                  <input aria-label={asset.label} type="checkbox" checked={Boolean(asset.assetId && selectedAssetIds.includes(asset.assetId))} onChange={() => asset.assetId && toggleAsset(asset.assetId)} className="h-4 w-4 rounded border-foreground/20 accent-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-foreground">{asset.label}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground/75">{asset.group} · {asset.status}</span>
                  </span>
                  <MusicStatusPill value={asset.status} />
                </label>
              ))}
            </div>
          </fieldset>

          {documents.length ? (
            <fieldset className="mt-5">
              <legend className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/82">Included documents</legend>
              <div className="mt-2 overflow-hidden rounded-[14px] border border-foreground/8">
                {documents.map((document) => (
                  <label key={document.id} className="flex cursor-pointer items-center gap-3 border-b border-foreground/6 px-3 py-3 last:border-b-0 hover:bg-foreground/[0.025]">
                    <input aria-label={document.title} type="checkbox" checked={selectedDocumentIds.includes(document.id)} onChange={() => toggleSelection(document.id, selectedDocumentIds, setSelectedDocumentIds)} className="h-4 w-4 accent-foreground" />
                    <span className="text-[13px] font-semibold text-foreground">{document.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="mt-5">
            <legend className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/82">Song information</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ key: "song_title", label: "Song title" }, { key: "primary_artist", label: "Primary artist" }, { key: "release_date", label: "Release date" }, { key: "genre", label: "Genre" }, { key: "label", label: "Record label" }].map((field) => (
                <label key={field.key} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-foreground/10 px-3 py-2 text-[11px] font-semibold text-foreground">
                  <input aria-label={field.label} type="checkbox" checked={selectedInformationKeys.includes(field.key)} onChange={() => toggleSelection(field.key, selectedInformationKeys, setSelectedInformationKeys)} className="h-3.5 w-3.5 accent-foreground" />
                  {field.label}
                </label>
              ))}
            </div>
          </fieldset>

          {previewing && !createdLink ? (
            <section aria-label="Package preview" className="mt-5 rounded-[16px] border border-foreground/10 bg-foreground/[0.018] p-4">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Preview package</p>
              <h4 className="mt-2 font-display text-[20px] font-semibold text-foreground">{song.title}</h4>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{selectedAssetIds.length} file{selectedAssetIds.length === 1 ? "" : "s"}, {selectedDocumentIds.length} document{selectedDocumentIds.length === 1 ? "" : "s"}, and {selectedInformationKeys.length} song detail{selectedInformationKeys.length === 1 ? "" : "s"}.</p>
            </section>
          ) : null}

          {createdLink ? (
            <div className="mt-4 rounded-[14px] border border-success/20 bg-success/[0.055] p-3.5">
              <p className="text-[12px] font-bold text-foreground">{revoked ? "Link revoked." : <>Secure link ready{emailSent ? " — email sent" : ""}.</>}</p>
              {!revoked ? (
                <div className="mt-2 flex gap-2">
                  <input aria-label="Secure share link" readOnly value={createdLink.url} className="min-w-0 flex-1 rounded-lg border border-foreground/10 bg-background px-3 py-2 text-[11px] font-semibold text-foreground" />
                  <button type="button" onClick={() => void copyLink()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-foreground/10 bg-background px-3 py-2 text-[11px] font-bold text-foreground hover:bg-foreground/[0.04]">
                    <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
                  </button>
                  {onRevoke ? (
                    <button type="button" disabled={pending} onClick={() => void revokeLink()} className="inline-flex shrink-0 items-center rounded-lg border border-danger/20 bg-background px-3 py-2 text-[11px] font-bold text-danger hover:bg-danger/[0.05] disabled:opacity-40">
                      Revoke link
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {historyPending ? <p className="mt-4 text-[11px] font-semibold text-muted-foreground/65">Loading recent packages...</p> : null}
          {shareHistory.filter((link) => link.id !== createdLink?.id).length ? (
            <section className="mt-4 border-t border-foreground/8 pt-4" aria-label="Recent share packages">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/82">Recent packages</p>
              <div className="mt-2 overflow-hidden rounded-[12px] border border-foreground/8">
                {shareHistory.filter((link) => link.id !== createdLink?.id).map((link) => (
                  <div key={link.id} className="flex items-center gap-3 border-b border-foreground/6 px-3 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-bold text-foreground">{link.label}</p>
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-muted-foreground/70">{presetName(link.preset)} · {link.assetCount} file{link.assetCount === 1 ? "" : "s"}{link.recipientEmail ? ` · ${link.recipientEmail}` : ""}{link.accessCount ? ` · opened ${link.accessCount}×` : ""}</p>
                    </div>
                    <MusicStatusPill value={titleCaseStatus(link.state)} />
                    {onRevoke && link.state === "active" ? (
                      <button type="button" disabled={pending} onClick={() => void revokeHistoricalLink(link)} aria-label={`Revoke ${link.label}`} className="shrink-0 text-[10px] font-bold text-danger hover:underline disabled:opacity-40">Revoke</button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {error ? <p role="alert" className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-foreground/8 bg-foreground/[0.025] px-5 py-4">
          <p className="text-[11px] font-semibold text-muted-foreground/70">Links stay revocable. Downloads are signed per file.</p>
          <span className="flex shrink-0 gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-foreground/10 px-4 py-2 text-[12px] font-bold text-muted-foreground hover:text-foreground">Close</button>
            <button type="button" onClick={() => setPreviewing((value) => !value)} className="rounded-lg border border-foreground/10 px-3 py-2 text-[12px] font-bold text-foreground">{previewing ? "Back to selection" : "Preview package"}</button>
            <button type="submit" disabled={(!selectedAssetIds.length && !selectedDocumentIds.length && !selectedInformationKeys.length) || pending} className="rounded-lg bg-foreground px-4 py-2 text-[12px] font-bold text-background disabled:opacity-40">{pending ? "Preparing" : createdLink ? "Create another" : "Create secure link"}</button>
          </span>
        </div>
      </form>
    </div>
  );
}

function MusicUploadDialog({
  asset,
  onCancel,
  onSubmit,
}: {
  asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number];
  onCancel: () => void;
  onSubmit: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const objectLabel = asset.group === "Audio" ? "audio" : asset.group === "Artwork" ? "image" : "document";
  const actionLabel = `${asset.canReplace ? "Replace" : "Upload"} ${asset.label === "Audio file" ? "audio" : asset.label.toLowerCase()}`;
  const supportingCopy = asset.group === "Audio"
    ? "Add a mix, master, instrumental, or stems for this song."
    : asset.group === "Artwork"
      ? "Add artwork or an image your team can use for this song."
      : "Add a document your team can keep with this song.";
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
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Add to song</p>
            <h3 className="mt-1 font-display text-[24px] font-bold leading-tight text-foreground">{actionLabel}</h3>
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
            <span className="font-display text-[16px] font-bold text-foreground">{file ? file.name : `Choose ${objectLabel === "document" ? "a" : "an"} ${objectLabel} file`}</span>
            <span className="max-w-sm text-[12px] font-semibold normal-case leading-relaxed tracking-normal text-muted-foreground/82">
              {supportingCopy}
            </span>
          </span>
        </label>
        {file ? <p className="mt-2 text-[11px] font-semibold text-muted-foreground">{file.type || file.name.split(".").pop()?.toUpperCase() || "File"} · {formatUploadBytes(file.size)}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-foreground/8 bg-foreground/[0.025] px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-foreground/10 px-4 py-2 text-[12px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={!file} className="rounded-lg bg-foreground px-4 py-2 text-[12px] font-bold text-background disabled:opacity-40">{actionLabel}</button>
        </div>
      </form>
    </div>
  );
}

function formatUploadBytes(bytes: number) {
  if (bytes < 1_000_000) return `${Math.max(0, Math.round(bytes / 1_000))} KB`;
  const megabytes = bytes / 1_000_000;
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

function resolveUploadAsset(
  target: NonNullable<MusicObjectViewModel["fileAssets"]>[number],
  file: File,
): NonNullable<MusicObjectViewModel["fileAssets"]>[number] {
  if (target.label !== "Audio file") return target;
  const isArtwork = file.type.startsWith("image/");
  const isAudio = file.type.startsWith("audio/");
  return {
    ...target,
    group: isArtwork ? "Artwork" : isAudio ? "Audio" : "Documents",
    label: file.name,
    assetType: isArtwork ? "press_photo" : isAudio ? "rough_mix" : "other",
  };
}

function MusicDetailEditDialog({
  groupTitle,
  field,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  groupTitle: string;
  field: MusicDetailField;
  pending: boolean;
  error?: string | null;
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
          {field.label === "Lyrics" ? (
            <textarea aria-label="Value" value={value} onChange={(event) => setValue(event.target.value)} rows={8} className="resize-y rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none" />
          ) : (
            <input value={value} onChange={(event) => setValue(event.target.value)} className="rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5 text-[13px] font-semibold normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none" />
          )}
        </label>
        <p className="mt-3 text-[12px] font-semibold leading-relaxed text-muted-foreground/80">Provider-confirmed metadata stays read-only. This saves a user-supplied draft for incomplete fields.</p>
        {error ? <p role="alert" className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p> : null}
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

function isShareableMusicAsset(asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number]) {
  return Boolean(asset.assetId && ["Uploaded", "Confirmed", "Cleared"].includes(asset.status));
}

function presetName(preset: "listen" | "epk_press" | "delivery" | "custom") {
  if (preset === "listen") return "Listen only";
  if (preset === "epk_press") return "EPK / press";
  if (preset === "delivery") return "Delivery";
  return "Custom";
}

function canEditDetailField(field: MusicDetailField) {
  return field.label !== "Lifecycle";
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

function splitConfirmationCopy(contributors: NonNullable<MusicObjectViewModel["splits"]>["contributors"]) {
  const confirmed = contributors.filter((contributor) => ["cleared", "confirmed"].includes(contributor.approval.toLowerCase()));
  const pending = contributors.filter((contributor) => contributor.approval.toLowerCase() === "pending");

  if (confirmed.length === 1 && pending.length === 1) {
    const collaborator = confirmed[0];
    return `${collaborator.name} confirmed their ${collaborator.publishingShare} publishing and ${collaborator.masterShare} master share. Waiting for ${pending[0].name}.`;
  }

  if (pending.length === 0 && confirmed.length === contributors.length && contributors.length > 0) {
    return `All ${contributors.length} collaborator${contributors.length === 1 ? "" : "s"} confirmed their split shares.`;
  }

  if (confirmed.length === 0 && pending.length === 1) {
    return `Waiting for ${pending[0].name} to confirm their split share.`;
  }

  if (confirmed.length === 0) {
    return `Waiting for ${pending.length} collaborators to confirm their split shares.`;
  }

  return `${confirmed.length} of ${contributors.length} collaborators confirmed. Waiting for ${pending.length} collaborator${pending.length === 1 ? "" : "s"}.`;
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

function customerUploadError(error: unknown) {
  const technical = readErrorMessage(error, "").toLowerCase();
  if (technical.includes("too large") || technical.includes("size")) return "This file is too large to upload. Choose a smaller file and try again.";
  if (technical.includes("type") || technical.includes("format") || technical.includes("mime")) return "This file format isn’t supported here. Choose another file and try again.";
  return "This file couldn’t be uploaded. Check your connection and try again.";
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

function musicObjectKey(object: Pick<MusicObjectViewModel, "id" | "kind">) {
  return `${object.kind}:${object.id}`;
}

function managerReadRevision(object: MusicObjectViewModel) {
  return JSON.stringify([
    object.managerReadStatus,
    object.managerReadRunId,
    object.managerReadError,
    object.managerReadSummary,
    object.managerRead,
  ]);
}

function needsManagerReadHydration(object: MusicObjectViewModel) {
  if (object.managerRead) return false;
  return ["unknown", "fresh", "stale", "refreshing", "refresh_failed"].includes(object.managerReadStatus);
}

function mergeFocusedManagerState(parent: MusicObjectViewModel, focused: MusicObjectViewModel): MusicObjectViewModel {
  return {
    ...parent,
    managerRead: focused.managerRead,
    managerReadSummary: focused.managerReadSummary,
    managerReadStatus: focused.managerReadStatus,
    managerReadRunId: focused.managerReadRunId,
    managerReadError: focused.managerReadError,
  };
}
