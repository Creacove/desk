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
export type CanonicalSongDocumentType = ReleaseSuccessDocumentType | LegacySongDocumentType;

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
};

const allCanonicalDocumentTypes = new Set<string>([
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
  const request = input.body.toLowerCase();
  const documentType = normalizeDocumentType(input.documentType) ?? requestedDocumentType(request);
  if (!documentType || (!input.documentType && !/\b(draft|write|prepare|create)\b/.test(request))) return;

  const musicItemId = input.musicSubject.id;
  const title = cleanLongText(input.title, 240) || documentTitle(documentType);
  if (typeof db.rpc === "function") {
    const { data, error } = await db.rpc("persist_focused_song_document_v1", {
      p_account_id: input.accountId,
      p_artist_workspace_id: input.artistWorkspaceId,
      p_artist_id: input.artistId,
      p_music_item_id: musicItemId,
      p_document_type: documentType,
      p_title: title,
      p_body: cleanLongText(responseBody, 60_000),
      p_run_id: runId,
      p_manager_output_id: input.managerOutputId ?? null,
    });
    if (error) throw error;
    if (!data || typeof data !== "object" || !("documentId" in data) || !("versionId" in data)) {
      throw new Error("Manager document transaction returned an invalid receipt.");
    }
    return data as PersistedFocusedSongDocument;
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
    const { data: links, error: linksError } = await scopedQuery(db, "artifact_links", scope)
      .eq("source_type", "document")
      .eq("target_type", "music_item")
      .eq("target_id", musicItemId)
      .eq("relationship", "references");
    if (linksError) throw linksError;

    const linkedIds = (links ?? []).map((link: any) => link.source_id).filter(Boolean);
    const { data: existingRows, error: existingError } = linkedIds.length
      ? await scopedQuery(db, "documents", scope)
        .eq("origin", "manager_generated")
        .eq("document_type", documentType)
        .in("id", linkedIds)
        .order("updated_at", { ascending: false })
        .limit(1)
      : { data: [], error: null };
    if (existingError) throw existingError;

    let document = existingRows?.[0] as Record<string, any> | undefined;
    if (!document) {
      const { data, error } = await scopedQuery(db, "documents", scope)
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

    const { count, error: countError } = await scopedQuery(db, "document_versions", scope)
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId);
    if (countError) throw countError;
    const { data: version, error: versionError } = await scopedQuery(db, "document_versions", scope)
      .insert({
        account_id: input.accountId,
        artist_workspace_id: input.artistWorkspaceId,
        artist_id: input.artistId,
        document_id: documentId,
        version_number: (count ?? 0) + 1,
        manager_output_id: input.managerOutputId ?? null,
        file_type: "text/markdown",
        extraction_status: "not_required",
        metadata: { body: cleanLongText(responseBody, 60_000) },
        created_from_run_id: runId,
      })
      .select("id,document_id")
      .single();
    if (versionError) throw versionError;
    if (!version?.id) throw new Error("Manager document version was not created.");
    versionId = version.id;
    const canonicalVersionId = version.id;

    const { error: updateError } = await scopedQuery(db, "documents", scope)
      .update({ current_version_id: canonicalVersionId, status: "draft", created_from_run_id: runId, title })
      .eq("id", canonicalDocumentId);
    if (updateError) throw updateError;
    updatedDocument = true;

    const { error: eventError } = await scopedQuery(db, "operating_events", scope)
      .insert({
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
  const { data: links, error: linksError } = await scopedQuery(db, "artifact_links", scope)
    .eq("source_type", "document")
    .eq("target_type", "music_item")
    .eq("target_id", musicItemId)
    .eq("relationship", "references")
    .limit(24);
  if (linksError) throw linksError;
  const ids = (links ?? []).map((link: any) => link.source_id).filter(Boolean);
  if (!ids.length) return [];
  const { data: documents, error: documentError } = await scopedQuery(db, "documents", scope)
    .in("id", ids)
    .limit(24);
  if (documentError) throw documentError;
  const { data: versions, error: versionError } = await scopedQuery(db, "document_versions", scope)
    .in("document_id", ids)
    .limit(60);
  if (versionError) throw versionError;
  return (documents ?? []).map((document: any) => {
    const version = (versions ?? []).find((item: any) => item.id === document.current_version_id)
      ?? (versions ?? []).find((item: any) => item.document_id === document.id);
    return { id: document.id, title: document.title, documentType: document.document_type, status: document.status, origin: document.origin, content: cleanLongText(version?.metadata?.body, 60_000) };
  });
}

async function loadAttachedMissionId(db: any, scope: readonly (readonly [string, string])[], musicItemId: string) {
  const { data, error } = await scopedQuery(db, "artifact_links", scope)
    .select("source_id")
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
  let query = scopedQuery(db, "artifact_links", scope);
  for (const [column, value] of Object.entries(link)) query = query.eq(column, value);
  const { data: existing, error: existingError } = await query.select("id").maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return undefined;
  const { data, error } = await scopedQuery(db, "artifact_links", scope)
    .insert({ ...Object.fromEntries(scope), ...link })
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
      await scopedQuery(db, "document_versions", scope).delete().eq("id", state.versionId);
    }
    if (state.documentId && state.updatedDocument && !state.createdDocument && state.priorDocument) {
      await scopedQuery(db, "documents", scope).update(state.priorDocument).eq("id", state.documentId);
    }
    for (const linkId of state.createdLinkIds) {
      await scopedQuery(db, "artifact_links", scope).delete().eq("id", linkId);
    }
    if (state.documentId && state.createdDocument) {
      await scopedQuery(db, "documents", scope).delete().eq("id", state.documentId);
    }
  } catch {
    // Preserve the original persistence error. The normal error telemetry records the failed stage.
  }
}

function scopedQuery(db: any, table: string, scope: readonly (readonly [string, string])[]) {
  let query = db.from(table);
  for (const [column, value] of scope) query = query.eq(column, value);
  return query;
}

function requestedDocumentType(value: string): CanonicalSongDocumentType | null {
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

function cleanLongText(value: unknown, maxChars: number) {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}
