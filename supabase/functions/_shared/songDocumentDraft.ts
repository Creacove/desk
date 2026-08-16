import {
  assessStructuredSongDocument,
  isPremiumSongDocumentType,
  normalizeStructuredSongDocument,
  renderStructuredSongDocument,
  type PremiumSongDocumentType,
  type SongDocumentQuality,
  type StructuredSongDocument,
} from "./songDocumentStandards.ts";

export const releaseSuccessDocumentTypes = [
  "epk",
  "spotify_editorial_pitch",
  "playlist_pitch",
  "press_target_brief",
  "press_pitch",
  "content_plan",
  "release_calendar",
] as const;

export type ReleaseSuccessDocumentType = typeof releaseSuccessDocumentTypes[number];
export type LegacySongDocumentType = "lyrics" | "press_release" | "press_angle" | "artist_biography" | "one_sheet" | "credits" | "distributor_notes";
export type CanonicalSongDocumentType = "release_narrative" | ReleaseSuccessDocumentType | LegacySongDocumentType;

export type FocusedSongDraftInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  body: string;
  musicSubject?: { type: "music_item" | "music_project"; id: string };
  documentType?: string;
  title?: string;
  missionId?: string;
  managerOutputId?: string;
};

export type PersistedFocusedSongDocument = {
  documentId: string;
  versionId: string;
  musicItemId: string;
  missionId?: string;
  documentType: CanonicalSongDocumentType;
  title: string;
  status: "draft";
  created: boolean;
  quality?: SongDocumentQuality;
  schemaVersion?: "song_document_v2";
  missingInputs?: string[];
};

export type PreparedFocusedSongDocument = {
  documentType: PremiumSongDocumentType;
  artifactType: PremiumSongDocumentType;
  title: string;
  structure: StructuredSongDocument;
  quality: SongDocumentQuality;
  renderedBody: string;
};

export function prepareFocusedSongDocumentDraft(
  inputDocumentType: string | undefined,
  inputTitle: string | undefined,
  responseBody: string,
  requestBody = "",
): PreparedFocusedSongDocument | null {
  const request = requestBody.toLowerCase();
  const documentType = normalizeDocumentType(inputDocumentType) ?? requestedDocumentType(request);
  if (!documentType || !isPremiumSongDocumentType(documentType)) return null;
  const title = cleanLongText(inputTitle, 240) || documentTitle(documentType);
  const artifactType: PremiumSongDocumentType = isReleaseNarrativeTransport(documentType, title)
    ? "release_narrative"
    : documentType;
  const structure = parseStructuredToolBody(responseBody);
  if (!structure) {
    throw new Error("Document quality gate failed: body must be the structured JSON artifact, not markdown or conversational prose.");
  }
  const quality = assessStructuredSongDocument(artifactType, structure);
  if (quality.blockers.length) {
    throw new Error(`Document quality gate failed (${quality.score}/100): ${quality.blockers.join(" ")}`);
  }
  return {
    documentType,
    artifactType,
    title,
    structure,
    quality,
    renderedBody: renderStructuredSongDocument(artifactType, title, structure),
  };
}

const allCanonicalDocumentTypes = new Set<string>([
  "release_narrative",
  ...releaseSuccessDocumentTypes,
  "lyrics",
  "press_release",
  "press_angle",
  "artist_biography",
  "one_sheet",
  "credits",
  "distributor_notes",
]);

export async function persistFocusedSongDocumentDraft(
  db: any,
  input: FocusedSongDraftInput,
  runId: string,
  responseBody: string,
  hasContextQuestions: boolean,
): Promise<PersistedFocusedSongDocument | undefined> {
  if (hasContextQuestions || input.musicSubject?.type !== "music_item") return;

  // Manager documents must be created through an explicit document tool call. The
  // conversational response is not a document and must never overwrite a quality-gated artifact.
  if (!input.documentType) return;

  const prepared = prepareFocusedSongDocumentDraft(input.documentType, input.title, responseBody, input.body);
  if (!prepared) return;
  const { documentType, artifactType, title, structure, quality, renderedBody } = prepared;
  const musicItemId = input.musicSubject.id;

  if (typeof db.rpc === "function") {
    const { data, error } = await db.rpc("persist_focused_song_document_v2", {
      p_account_id: input.accountId,
      p_artist_workspace_id: input.artistWorkspaceId,
      p_artist_id: input.artistId,
      p_music_item_id: musicItemId,
      p_document_type: documentType,
      p_title: title,
      p_body: cleanLongText(renderedBody, 60_000),
      p_structure_json: structure,
      p_quality_json: quality,
      p_run_id: runId,
      p_manager_output_id: input.managerOutputId ?? null,
    });
    if (error) throw error;
    if (!data || typeof data !== "object" || !("documentId" in data) || !("versionId" in data)) {
      throw new Error("Manager document transaction returned an invalid receipt.");
    }
    return {
      ...(data as PersistedFocusedSongDocument),
      documentType: artifactType,
      title,
      quality,
      schemaVersion: "song_document_v2",
      missingInputs: structure.missingInputs,
    };
  }

  if (artifactType === "release_narrative") {
    throw new Error("Structured release narrative persistence requires the v2 document transaction.");
  }

  const scope = [
    ["account_id", input.accountId],
    ["artist_workspace_id", input.artistWorkspaceId],
    ["artist_id", input.artistId],
  ] as const;
  let documentId: string | undefined;
  let versionId: string | undefined;
  let createdDocument = false;
  let updatedDocument = false;
  let priorDocument: Record<string, unknown> | undefined;
  const createdLinkIds: string[] = [];

  try {
    const { data: links, error: linksError } = await scopedSelect(db, "artifact_links", scope)
      .eq("source_type", "document")
      .eq("target_type", "music_item")
      .eq("target_id", musicItemId)
      .eq("relationship", "references");
    if (linksError) throw linksError;

    const linkedIds = (links ?? []).map((link: any) => link.source_id).filter(Boolean);
    const { data: existingRows, error: existingError } = linkedIds.length
      ? await scopedSelect(db, "documents", scope)
        .eq("origin", "manager_generated")
        .eq("document_type", documentType)
        .in("id", linkedIds)
        .order("updated_at", { ascending: false })
        .limit(1)
      : { data: [], error: null };
    if (existingError) throw existingError;

    let document = existingRows?.[0] as Record<string, any> | undefined;
    if (!document) {
      const { data, error } = await db.from("documents")
        .insert({
          account_id: input.accountId,
          artist_workspace_id: input.artistWorkspaceId,
          artist_id: input.artistId,
          title,
          document_type: documentType,
          origin: "manager_generated",
          status: "draft",
          summary: `Manager draft for ${title}.`,
          created_by_type: "agent",
          created_from_run_id: runId,
        })
        .select("id,title,current_version_id,status")
        .single();
      if (error) throw error;
      document = data;
      if (!document?.id) throw new Error("Manager document was not created.");
      documentId = document.id;
      createdDocument = true;
    } else {
      documentId = document.id;
      priorDocument = {
        current_version_id: document.current_version_id ?? null,
        status: document.status ?? "draft",
        created_from_run_id: document.created_from_run_id ?? null,
        title: document.title,
      };
    }
    if (!documentId) throw new Error("Manager document identity is missing.");
    const canonicalDocumentId = documentId;

    const songLinkId = await ensureArtifactLink(db, scope, {
      source_type: "document",
      source_id: canonicalDocumentId,
      target_type: "music_item",
      target_id: musicItemId,
      relationship: "references",
    });
    if (songLinkId) createdLinkIds.push(songLinkId);

    const missionId = input.missionId ?? await loadAttachedMissionId(db, scope, musicItemId);
    if (missionId) {
      const missionLinkId = await ensureArtifactLink(db, scope, {
        source_type: "document",
        source_id: canonicalDocumentId,
        target_type: "mission",
        target_id: missionId,
        relationship: "references",
      });
      if (missionLinkId) createdLinkIds.push(missionLinkId);
    }

    if (input.managerOutputId) {
      const managerOutputSongLinkId = await ensureArtifactLink(db, scope, {
        source_type: "manager_output",
        source_id: input.managerOutputId,
        target_type: "music_item",
        target_id: musicItemId,
        relationship: "references",
      });
      if (managerOutputSongLinkId) createdLinkIds.push(managerOutputSongLinkId);
      if (missionId) {
        const managerOutputMissionLinkId = await ensureArtifactLink(db, scope, {
          source_type: "manager_output",
          source_id: input.managerOutputId,
          target_type: "mission",
          target_id: missionId,
          relationship: "references",
        });
        if (managerOutputMissionLinkId) createdLinkIds.push(managerOutputMissionLinkId);
      }
    }

    const { count, error: countError } = await scopedSelect(db, "document_versions", scope, "id", { count: "exact", head: true })
      .eq("document_id", documentId);
    if (countError) throw countError;
    const { data: version, error: versionError } = await db.from("document_versions")
      .insert({
        account_id: input.accountId,
        artist_workspace_id: input.artistWorkspaceId,
        artist_id: input.artistId,
        document_id: documentId,
        version_number: (count ?? 0) + 1,
        manager_output_id: input.managerOutputId ?? null,
        file_type: "text/markdown",
        extraction_status: "not_required",
        metadata: {
          body: cleanLongText(renderedBody, 60_000),
          structure,
          quality,
          schemaVersion: "song_document_v2",
        },
        created_from_run_id: runId,
      })
      .select("id,document_id")
      .single();
    if (versionError) throw versionError;
    if (!version?.id) throw new Error("Manager document version was not created.");
    versionId = version.id;
    const canonicalVersionId = version.id;

    const { error: updateError } = await scopedUpdate(db, "documents", scope, { current_version_id: canonicalVersionId, status: "draft", created_from_run_id: runId, title })
      .eq("id", canonicalDocumentId);
    if (updateError) throw updateError;
    updatedDocument = true;

    const { error: eventError } = await db.from("operating_events").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      event_type: "song_document_created",
      actor_type: "manager",
      target_type: "music_item",
      target_id: musicItemId,
      source_type: "document",
      source_id: canonicalDocumentId,
      mission_id: missionId ?? null,
      display_mode: "activity",
      refresh_scope: ["music-list", "activity"],
      summary: `${title} is ready to review in Files.`,
      payload: {
        document_id: canonicalDocumentId,
        document_type: documentType,
        version_id: canonicalVersionId,
        mission_id: missionId ?? null,
        quality,
        schema_version: "song_document_v2",
      },
    });
    if (eventError) throw eventError;

    return {
      documentId: canonicalDocumentId,
      versionId: canonicalVersionId,
      musicItemId,
      ...(missionId ? { missionId } : {}),
      documentType,
      title,
      status: "draft",
      created: createdDocument,
      quality,
      schemaVersion: "song_document_v2",
      missingInputs: structure.missingInputs,
    };
  } catch (error) {
    await compensateDocumentPersistence(db, scope, {
      documentId,
      versionId,
      createdDocument,
      updatedDocument,
      priorDocument,
      createdLinkIds,
    });
    throw error;
  }
}

export async function loadFocusedSongDocuments(db: any, input: Omit<FocusedSongDraftInput, "body">, musicItemId: string) {
  const scope = [
    ["account_id", input.accountId],
    ["artist_workspace_id", input.artistWorkspaceId],
    ["artist_id", input.artistId],
  ] as const;
  const { data: links, error: linksError } = await scopedSelect(db, "artifact_links", scope)
    .eq("source_type", "document")
    .eq("target_type", "music_item")
    .eq("target_id", musicItemId)
    .eq("relationship", "references")
    .limit(40);
  if (linksError) throw linksError;
  const ids = (links ?? []).map((link: any) => link.source_id).filter(Boolean);
  if (!ids.length) return [];
  const { data: documents, error: documentError } = await scopedSelect(db, "documents", scope)
    .in("id", ids)
    .limit(40);
  if (documentError) throw documentError;
  const { data: versions, error: versionError } = await scopedSelect(db, "document_versions", scope)
    .in("document_id", ids)
    .order("version_number", { ascending: false })
    .limit(100);
  if (versionError) throw versionError;
  return (documents ?? []).map((document: any) => {
    const version = (versions ?? []).find((item: any) => item.id === document.current_version_id)
      ?? (versions ?? []).find((item: any) => item.document_id === document.id);
    const metadata = version?.metadata && typeof version.metadata === "object" ? version.metadata : {};
    return {
      id: document.id,
      title: document.title,
      documentType: document.document_type,
      status: document.status,
      origin: document.origin,
      content: cleanLongText(metadata.body, 60_000),
      ...(metadata.structure && typeof metadata.structure === "object" ? { structure: metadata.structure } : {}),
      ...(metadata.quality && typeof metadata.quality === "object" ? { quality: metadata.quality } : {}),
      ...(typeof metadata.schemaVersion === "string" ? { schemaVersion: metadata.schemaVersion } : {}),
    };
  });
}

async function loadAttachedMissionId(db: any, scope: readonly (readonly [string, string])[], musicItemId: string) {
  const { data, error } = await scopedSelect(db, "artifact_links", scope, "source_id")
    .eq("source_type", "mission")
    .eq("target_type", "music_item")
    .eq("target_id", musicItemId)
    .eq("relationship", "references")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.source_id === "string" ? data.source_id : undefined;
}

async function ensureArtifactLink(db: any, scope: readonly (readonly [string, string])[], link: Record<string, string>) {
  let query = scopedSelect(db, "artifact_links", scope, "id");
  for (const [column, value] of Object.entries(link)) query = query.eq(column, value);
  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return undefined;
  const { data, error } = await db.from("artifact_links").insert({ ...Object.fromEntries(scope), ...link })
    .select("id")
    .single();
  if (error) throw error;
  if (!data?.id) throw new Error("Document link was not created.");
  return data.id as string;
}

async function compensateDocumentPersistence(
  db: any,
  scope: readonly (readonly [string, string])[],
  state: {
    documentId?: string;
    versionId?: string;
    createdDocument: boolean;
    updatedDocument: boolean;
    priorDocument?: Record<string, unknown>;
    createdLinkIds: string[];
  },
) {
  try {
    if (state.versionId) {
      await scopedDelete(db, "document_versions", scope).eq("id", state.versionId);
    }
    if (state.documentId && state.updatedDocument && !state.createdDocument && state.priorDocument) {
      await scopedUpdate(db, "documents", scope, state.priorDocument).eq("id", state.documentId);
    }
    for (const linkId of state.createdLinkIds) {
      await scopedDelete(db, "artifact_links", scope).eq("id", linkId);
    }
    if (state.documentId && state.createdDocument) {
      await scopedDelete(db, "documents", scope).eq("id", state.documentId);
    }
  } catch {
    // Preserve the original persistence error. The normal error telemetry records the failed stage.
  }
}

function applyScope(query: any, scope: readonly (readonly [string, string])[]) {
  for (const [column, value] of scope) query = query.eq(column, value);
  return query;
}

function scopedSelect(db: any, table: string, scope: readonly (readonly [string, string])[], columns = "*", options?: Record<string, unknown>) {
  return applyScope(db.from(table).select(columns, options), scope);
}

function scopedUpdate(db: any, table: string, scope: readonly (readonly [string, string])[], values: Record<string, unknown>) {
  return applyScope(db.from(table).update(values), scope);
}

function scopedDelete(db: any, table: string, scope: readonly (readonly [string, string])[]) {
  return applyScope(db.from(table).delete(), scope);
}

function requestedDocumentType(value: string): CanonicalSongDocumentType | null {
  if (value.includes("release narrative") || value.includes("campaign narrative") || value.includes("campaign spine")) return "release_narrative";
  if (value.includes("spotify") && value.includes("pitch")) return "spotify_editorial_pitch";
  if (value.includes("playlist") && value.includes("pitch")) return "playlist_pitch";
  if (value.includes("press target") || value.includes("target brief")) return "press_target_brief";
  if (value.includes("press pitch")) return "press_pitch";
  if (value.includes("content plan")) return "content_plan";
  if (value.includes("release calendar")) return "release_calendar";
  if (value.includes("epk") || value.includes("press kit")) return "epk";
  if (value.includes("press release")) return "press_release";
  if (value.includes("press angle")) return "press_angle";
  if (value.includes("bio")) return "artist_biography";
  if (value.includes("one-sheet") || value.includes("one sheet")) return "one_sheet";
  if (value.includes("lyrics")) return "lyrics";
  if (value.includes("credits")) return "credits";
  if (value.includes("distributor")) return "distributor_notes";
  return null;
}

function normalizeDocumentType(value?: string | null): CanonicalSongDocumentType | null {
  const normalized = value?.trim().toLowerCase().replace(/[-\s]+/g, "_");
  return normalized && allCanonicalDocumentTypes.has(normalized) ? normalized as CanonicalSongDocumentType : null;
}

function documentTitle(type: CanonicalSongDocumentType) {
  return ({
    release_narrative: "Release narrative",
    epk: "EPK",
    spotify_editorial_pitch: "Spotify editorial pitch",
    playlist_pitch: "Playlist pitch",
    press_target_brief: "Press target brief",
    press_pitch: "Personalized press pitch",
    content_plan: "Release content plan",
    release_calendar: "Release calendar",
    press_release: "Press release",
    press_angle: "Press angle",
    artist_biography: "Artist biography",
    one_sheet: "One-sheet",
    lyrics: "Lyrics",
    credits: "Credits",
    distributor_notes: "Distributor notes",
  } as Record<CanonicalSongDocumentType, string>)[type];
}

function isReleaseNarrativeTransport(documentType: CanonicalSongDocumentType, title: string) {
  return documentType === "press_angle" && title.trim().toLowerCase() === "release narrative";
}

function parseStructuredToolBody(value: string): StructuredSongDocument | null {
  try {
    const parsed = JSON.parse(value);
    return normalizeStructuredSongDocument(parsed);
  } catch {
    return null;
  }
}

function cleanLongText(value: unknown, maxChars: number) {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}
