import type {
  SetupPresentationActivityKind,
  SetupPresentationPhase,
  SetupPresentationSnapshot,
} from "../types/setupPresentation";

type SetupStatus = "queued" | "running" | "completed" | "failed";

type SetupRunRow = {
  id: string;
  status?: string | null;
  current_stage?: string | null;
  stage_status?: unknown;
  started_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkspaceRow = {
  artistName?: string | null;
  spotifyIdentity?: unknown;
  genres?: unknown;
};

type MusicRow = {
  id: string;
  title?: string | null;
  metadata?: unknown;
};

type OperatingEventRow = {
  event_type?: string | null;
  payload?: unknown;
  created_at?: string | null;
};

type DiscoveryRunRow = {
  id: string;
  status?: string | null;
  started_at?: string | null;
  created_at?: string | null;
  context_payload?: unknown;
  steps_payload?: unknown;
};

type EvidenceRow = {
  id?: string | null;
  source?: string | null;
  source_kind?: string | null;
  metric_name?: string | null;
  metric_value?: number | null;
  metric_unit?: string | null;
  subject_label?: string | null;
  subject_id?: string | null;
  provenance?: string | null;
  raw_ref?: string | null;
  created_at?: string | null;
};

type BriefRunRow = {
  id: string;
  status?: string | null;
  started_at?: string | null;
  created_at?: string | null;
};

type ManagerOutputRow = {
  render_json?: unknown;
};

export type SetupPresentationProjectionInput = {
  observedAt?: string;
  setupRun: SetupRunRow;
  workspace: WorkspaceRow;
  musicItems?: MusicRow[];
  musicProjects?: MusicRow[];
  operatingEvents?: OperatingEventRow[];
  discoveryRun?: DiscoveryRunRow | null;
  evidence?: EvidenceRow[];
  briefRun?: BriefRunRow | null;
  managerOutput?: ManagerOutputRow | null;
};

const AUDIENCE_METRIC_PRIORITY = [
  "spotify_monthly_listeners",
  "spotify_followers",
  "spotify_playlist_total_reach",
  "spotify_playlist_count",
] as const;

const AUDIENCE_METRIC_LABEL: Record<(typeof AUDIENCE_METRIC_PRIORITY)[number], string> = {
  spotify_monthly_listeners: "Monthly listeners",
  spotify_followers: "Followers",
  spotify_playlist_total_reach: "Playlist reach",
  spotify_playlist_count: "Playlist count",
};


export function mergeConsumedDiscoveryEvidence(
  persisted: EvidenceRow[],
  actions: Array<{ status?: string | null; result_payload?: unknown }>,
): EvidenceRow[] {
  const fromActions = actions.flatMap((action) => {
    if (action.status !== "applied") return [];
    const result = readRecord(action.result_payload);
    if (!Array.isArray(result.evidence)) return [];
    return result.evidence.flatMap((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return [];
      return [row as EvidenceRow];
    });
  });

  const seen = new Set<string>();
  return [...persisted, ...fromActions].filter((row) => {
    const key = [
      cleanString(row.id) ?? "",
      cleanString(row.metric_name) ?? "",
      cleanString(row.subject_id) ?? "",
      cleanString(row.raw_ref) ?? cleanString(row.provenance) ?? "",
      cleanString(row.created_at) ?? "",
    ].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildSetupPresentationSnapshot(input: SetupPresentationProjectionInput): SetupPresentationSnapshot {
  const musicItems = input.musicItems ?? [];
  const musicProjects = input.musicProjects ?? [];
  const evidence = input.evidence ?? [];
  const operatingEvents = input.operatingEvents ?? [];
  const setupStatus = normalizeSetupStatus(input.setupRun.status);
  const phase = resolvePresentationPhase(input.setupRun.status, input.setupRun.current_stage);
  const artist = buildArtist(input.workspace);
  const catalogue = buildCatalogue(musicItems, musicProjects, operatingEvents, input.setupRun);
  const activity = resolveCurrentActivity(phase, operatingEvents, input.discoveryRun, input.briefRun, input.managerOutput);
  const intelligence = buildIntelligence(input.discoveryRun, evidence, musicItems, musicProjects);
  const manager = buildManager(phase, input.briefRun, input.managerOutput);
  const musicReads = buildMusicReadSummary(input.setupRun.stage_status);

  return compactObject({
    version: 1 as const,
    observedAt: input.observedAt ?? new Date().toISOString(),
    setup: compactObject({
      status: setupStatus,
      phase,
      startedAt: cleanString(input.setupRun.started_at) ?? cleanString(input.setupRun.created_at),
      phaseStartedAt: resolvePhaseStartedAt(phase, input.setupRun, operatingEvents, input.discoveryRun, input.briefRun),
      updatedAt: cleanString(input.setupRun.updated_at),
    }),
    artist,
    catalogue,
    activity,
    intelligence,
    manager,
    musicReads,
  }) as SetupPresentationSnapshot;
}

export function resolvePresentationPhase(status: unknown, stage: unknown): SetupPresentationPhase {
  if (status === "completed" || stage === "music_reads") return "ready";
  if (stage === "setup_brief") return "synthesis";
  if (stage === "manager_discovery") return "discovery";
  return "catalogue";
}

export function resolveCurrentActivity(
  phase: SetupPresentationPhase,
  events: OperatingEventRow[],
  discoveryRun?: DiscoveryRunRow | null,
  briefRun?: BriefRunRow | null,
  managerOutput?: ManagerOutputRow | null,
) {
  const current = readCurrentActivity(events);
  const managerRender = readRecord(managerOutput?.render_json);
  const managerReady = Boolean(cleanString(managerRender.headlineRead) ?? cleanString(managerRender.headline_read));

  if (phase === "ready") {
    return { kind: "manager" as const, state: "complete" as const, label: managerReady ? "Your Manager is ready" : "Your workspace is ready" };
  }
  if (phase === "synthesis") {
    return { kind: "manager" as const, state: "working" as const, label: "Your Manager is putting it together" };
  }
  if (phase === "discovery" && ["queued", "running"].includes(cleanString(discoveryRun?.status) ?? "")) {
    if (current && current.kind !== "catalogue" && current.state === "working") return current;
    return { kind: "synthesis" as const, state: "working" as const, label: "Connecting the next signal" };
  }
  if (phase === "catalogue" && (!current || current.state === "complete")) {
    return { kind: "catalogue" as const, state: "working" as const, label: "Bringing in your music" };
  }
  return current;
}

export function readCurrentActivity(events: OperatingEventRow[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const mapped = mapOperatingEvent(events[index]);
    if (mapped) return mapped;
  }
  return undefined;
}

export function mapOperatingEvent(event: OperatingEventRow) {
  const eventType = cleanString(event.event_type);
  if (!eventType) return undefined;
  const payload = readRecord(event.payload);
  const occurredAt = cleanString(event.created_at);

  if (eventType === "spotify_catalog_bootstrap_started") {
    return { kind: "catalogue" as const, state: "working" as const, label: "Bringing in your music", occurredAt };
  }
  if (eventType === "spotify_catalog_bootstrap_completed" || eventType === "spotify_catalog_bootstrap_completed_with_limits") {
    return { kind: "catalogue" as const, state: "complete" as const, label: "Your catalogue is connected", occurredAt };
  }
  if (eventType === "manager_discovery_started") {
    return { kind: "audience" as const, state: "working" as const, label: "Reading your audience", occurredAt };
  }
  if (eventType === "manager_discovery_completed" || eventType === "manager_discovery_completed_with_limits") {
    return { kind: "synthesis" as const, state: "complete" as const, label: "Research complete", occurredAt };
  }
  if (eventType === "setup_todays_brief_generated") {
    return { kind: "manager" as const, state: "complete" as const, label: "Your Manager is ready", occurredAt };
  }

  if (["manager_discovery_tool_started", "manager_discovery_tool_completed", "manager_discovery_tool_failed"].includes(eventType)) {
    const failed = eventType.endsWith("_failed");
    const state = eventType.endsWith("_started") ? "working" as const : "complete" as const;
    const tool = cleanString(payload.tool);
    if (tool === "chartmetric_artist_enrich") {
      return {
        kind: "audience" as const,
        state,
        label: failed ? "Continuing with available audience signals" : state === "complete" ? "Audience signals found" : "Reading your audience",
        occurredAt,
      };
    }
    if (tool === "save_public_evidence" || tool === "web_search") {
      return {
        kind: "public_context" as const,
        state,
        label: failed ? "Continuing with available public context" : state === "complete" ? "Public context found" : "Understanding your story",
        occurredAt,
      };
    }
    if (tool === "chartmetric_track_enrich") {
      return {
        kind: "focus_music" as const,
        state,
        label: failed ? "Continuing with the music already in view" : state === "complete" ? "Current music read" : "Reading your current music",
        occurredAt,
      };
    }
    if (tool === "chartmetric_project_enrich") {
      return {
        kind: "project" as const,
        state,
        label: failed ? "Continuing with available project context" : state === "complete" ? "Project context read" : "Looking at the bigger picture",
        occurredAt,
      };
    }
    if (tool === "write_strategic_memory") {
      return {
        kind: "synthesis" as const,
        state,
        label: failed ? "Connecting the available signals" : state === "complete" ? "Signals connected" : "Connecting the dots",
        occurredAt,
      };
    }
  }

  if (eventType === "todays_brief_started" || eventType === "setup_todays_brief_started") {
    return { kind: "manager" as const, state: "working" as const, label: "Your Manager is putting it together", occurredAt };
  }
  return undefined;
}

export function readPhaseStartedAt(stageStatus: unknown, currentStage: unknown): string | undefined {
  const stage = cleanString(currentStage);
  if (!stage) return undefined;
  const root = readRecord(stageStatus);
  const stageState = readRecord(root[stage]);
  return cleanString(stageState.started_at) ?? cleanString(stageState.startedAt);
}


export function resolvePhaseStartedAt(
  phase: SetupPresentationPhase,
  setupRun: SetupRunRow,
  events: OperatingEventRow[],
  discoveryRun?: DiscoveryRunRow | null,
  briefRun?: BriefRunRow | null,
): string | undefined {
  if (phase === "ready") return undefined;

  const persisted = readPhaseStartedAt(setupRun.stage_status, setupRun.current_stage);
  if (persisted) return persisted;

  if (phase === "discovery") {
    const eventStartedAt = firstEventTime(events, "manager_discovery_started");
    return eventStartedAt ?? cleanString(discoveryRun?.started_at) ?? cleanString(discoveryRun?.created_at);
  }

  if (phase === "synthesis") {
    return cleanString(briefRun?.started_at) ?? cleanString(briefRun?.created_at);
  }

  return firstEventTime(events, "spotify_catalog_bootstrap_started");
}

function firstEventTime(events: OperatingEventRow[], eventType: string) {
  for (const event of events) {
    if (cleanString(event.event_type) !== eventType) continue;
    const occurredAt = cleanString(event.created_at);
    if (occurredAt) return occurredAt;
  }
  return undefined;
}

export function buildMusicReadSummary(stageStatus: unknown) {
  const root = readRecord(stageStatus);
  const musicStage = readRecord(root.music_reads);
  const targets = Array.isArray(musicStage.targets) ? musicStage.targets.map(readRecord) : [];
  const target = readFiniteNumber(musicStage.target_count) ?? (targets.length || undefined);
  if (target === undefined && targets.length === 0) return undefined;

  let completed = 0;
  let running = 0;
  let failed = 0;
  for (const targetRow of targets) {
    const status = cleanString(targetRow.status) ?? "queued";
    if (status === "completed" || status === "completed_with_limits") completed += 1;
    else if (status === "failed" || status === "cancelled") failed += 1;
    else running += 1;
  }

  return compactObject({ target, completed, running, failed });
}

function buildArtist(workspace: WorkspaceRow) {
  const name = cleanString(workspace.artistName);
  if (!name) return undefined;
  const spotify = readRecord(workspace.spotifyIdentity);
  const imageUrl = cleanString(spotify.imageUrl) ?? cleanString(spotify.image_url);
  const genres = Array.isArray(workspace.genres)
    ? workspace.genres.flatMap((value) => cleanString(value) ? [cleanString(value)!] : []).slice(0, 2)
    : [];
  return compactObject({ name, imageUrl, genres });
}

function buildCatalogue(items: MusicRow[], projects: MusicRow[], events: OperatingEventRow[], setupRun: SetupRunRow) {
  const hasCatalogEvent = events.some((event) => cleanString(event.event_type)?.startsWith("spotify_catalog_bootstrap_"));
  const complete = isCatalogueComplete(events, setupRun);
  if (!items.length && !projects.length && !hasCatalogEvent && !complete) return undefined;

  const counts = readCatalogCounts(events);
  const coverCandidates = [
    ...projects.map((row) => ({ title: cleanString(row.title), imageUrl: readMusicCover(row.metadata) })),
    ...items.map((row) => ({ title: cleanString(row.title), imageUrl: readMusicCover(row.metadata) })),
  ]
    .filter((row): row is { title: string; imageUrl: string | undefined } => Boolean(row.title))
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.title === row.title && candidate.imageUrl === row.imageUrl) === index)
    .slice(0, 4);

  return compactObject({
    state: complete ? "complete" as const : "working" as const,
    trackCount: counts.trackCount,
    releaseCount: counts.releaseCount,
    covers: coverCandidates,
  });
}

function isCatalogueComplete(events: OperatingEventRow[], setupRun: SetupRunRow) {
  if (events.some((event) => ["spotify_catalog_bootstrap_completed", "spotify_catalog_bootstrap_completed_with_limits"].includes(cleanString(event.event_type) ?? ""))) {
    return true;
  }
  const stageStatus = readRecord(setupRun.stage_status);
  const catalogStage = readRecord(stageStatus.catalog_bootstrap);
  if (["completed", "completed_with_limits"].includes(cleanString(catalogStage.status) ?? "")) return true;
  return ["manager_discovery", "setup_brief", "music_reads"].includes(cleanString(setupRun.current_stage) ?? "");
}

function buildIntelligence(discoveryRun: DiscoveryRunRow | null | undefined, evidence: EvidenceRow[], items: MusicRow[], projects: MusicRow[]) {
  const primaryMetric = pickAudienceMetric(evidence);
  const markets = readDiscoveryMarkets(discoveryRun?.steps_payload);
  const publicSources = readPublicSources(evidence);
  const focusMusic = readFocusMusic(discoveryRun?.context_payload, items, projects);
  if (!primaryMetric && !markets.length && !publicSources.length && !focusMusic) return undefined;
  return compactObject({ primaryMetric, markets, publicSources, focusMusic });
}

function buildManager(phase: SetupPresentationPhase, briefRun: BriefRunRow | null | undefined, managerOutput: ManagerOutputRow | null | undefined) {
  const render = readRecord(managerOutput?.render_json);
  const insight = cleanString(render.headlineRead) ?? cleanString(render.headline_read);
  if (insight) return { state: "ready" as const, insight };
  const status = cleanString(briefRun?.status);
  if (phase === "synthesis" || status === "queued" || status === "running") return { state: "working" as const };
  return { state: "waiting" as const };
}

function pickAudienceMetric(evidence: EvidenceRow[]) {
  for (const metricName of AUDIENCE_METRIC_PRIORITY) {
    const candidates = evidence
      .filter((row) => row.metric_name === metricName && typeof row.metric_value === "number" && Number.isFinite(row.metric_value))
      .sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")));
    const row = candidates[0];
    if (row?.metric_value === undefined || row.metric_value === null) continue;
    return { label: AUDIENCE_METRIC_LABEL[metricName], value: formatMetricValue(row.metric_value, row.metric_unit) };
  }
  return undefined;
}

function readDiscoveryMarkets(stepsPayload: unknown): string[] {
  if (!Array.isArray(stepsPayload) || !stepsPayload.length) return [];
  const latest = readRecord(stepsPayload[stepsPayload.length - 1]);
  const discovery = readRecord(latest.discovery);
  const markets = Array.isArray(discovery.marketsDiscovered) ? discovery.marketsDiscovered : [];
  return uniqueStrings(markets).slice(0, 3);
}

function readPublicSources(evidence: EvidenceRow[]) {
  const sources = evidence
    .filter((row) => row.source_kind === "public_web" || row.source === "public_web")
    .flatMap((row) => {
      const url = cleanString(row.raw_ref) ?? cleanString(row.provenance);
      const domain = readDomain(url);
      const label = cleanString(row.subject_label)?.slice(0, 80);
      if (!domain && !label) return [];
      return [{ name: label ?? domain!, ...(domain ? { domain } : {}) }];
    });
  return sources
    .filter((row, index, rows) => rows.findIndex((candidate) => (candidate.domain ?? candidate.name) === (row.domain ?? row.name)) === index)
    .slice(0, 2);
}

function readFocusMusic(contextPayload: unknown, items: MusicRow[], projects: MusicRow[]) {
  const context = readRecord(contextPayload);
  const selectedItemIds = Array.isArray(context.selectedMusicItemIds) ? uniqueStrings(context.selectedMusicItemIds) : [];
  const selectedProjectId = cleanString(context.selectedMusicProjectId);
  const item = selectedItemIds.length ? items.find((row) => row.id === selectedItemIds[0]) : undefined;
  if (item && cleanString(item.title)) return compactObject({ title: cleanString(item.title)!, imageUrl: readMusicCover(item.metadata) });
  const project = selectedProjectId ? projects.find((row) => row.id === selectedProjectId) : undefined;
  if (project && cleanString(project.title)) return compactObject({ title: cleanString(project.title)!, imageUrl: readMusicCover(project.metadata) });
  return undefined;
}

function readCatalogCounts(events: OperatingEventRow[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!["spotify_catalog_bootstrap_completed", "spotify_catalog_bootstrap_completed_with_limits"].includes(cleanString(event.event_type) ?? "")) continue;
    const payload = readRecord(event.payload);
    return {
      trackCount: readFiniteNumber(payload.music_item_count),
      releaseCount: readFiniteNumber(payload.music_project_count),
    };
  }
  return {};
}

function readMusicCover(metadata: unknown): string | undefined {
  const root = readRecord(metadata);
  const spotify = readRecord(root.spotify);
  return cleanString(spotify.cover_image_url)
    ?? firstImageUrl(spotify.images)
    ?? firstImageUrl(spotify.album_images)
    ?? cleanString(root.cover_image_url)
    ?? firstImageUrl(root.images);
}

function firstImageUrl(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const candidate of value) {
    if (typeof candidate === "string") {
      const url = cleanString(candidate);
      if (url) return url;
    }
    const row = readRecord(candidate);
    const url = cleanString(row.url);
    if (url) return url;
  }
  return undefined;
}

function normalizeSetupStatus(value: unknown): SetupStatus {
  return value === "queued" || value === "completed" || value === "failed" ? value : "running";
}

function readDomain(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function formatMetricValue(value: number, unit: string | null | undefined) {
  const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return unit === "rank" ? `#${Math.round(value)}` : compact;
}

function uniqueStrings(value: unknown[]): string[] {
  return [...new Set(value.flatMap((entry) => cleanString(entry) ? [cleanString(entry)!] : []))];
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined)) as T;
}
