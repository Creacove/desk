type FocusedSongDraftInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  body: string;
  musicSubject?: { type: "music_item" | "music_project"; id: string };
};

export async function persistFocusedSongDocumentDraft(db: any, input: FocusedSongDraftInput, runId: string, responseBody: string, hasContextQuestions: boolean) {
  if (hasContextQuestions || input.musicSubject?.type !== "music_item") return;
  const request = input.body.toLowerCase();
  const documentType = requestedDocumentType(request);
  if (!documentType || !/\b(draft|write|prepare|create)\b/.test(request)) return;
  const title = documentTitle(documentType);

  const { data: links, error: linksError } = await db.from("artifact_links").select("source_id")
    .eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId)
    .eq("source_type", "document").eq("target_type", "music_item").eq("target_id", input.musicSubject.id).eq("relationship", "references");
  if (linksError) throw linksError;
  const linkedIds = (links ?? []).map((link: any) => link.source_id).filter(Boolean);
  const { data: existingRows, error: existingError } = linkedIds.length
    ? await db.from("documents").select("id,title,current_version_id").eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId).eq("origin", "manager_generated").eq("document_type", documentType).in("id", linkedIds).order("updated_at", { ascending: false }).limit(1)
    : { data: [], error: null };
  if (existingError) throw existingError;

  let document = existingRows?.[0];
  if (!document) {
    const { data, error } = await db.from("documents").insert({
      account_id: input.accountId, artist_workspace_id: input.artistWorkspaceId, artist_id: input.artistId,
      title, document_type: documentType, origin: "manager_generated", status: "draft", summary: `Manager draft for ${title}.`,
      created_by_type: "agent", created_from_run_id: runId,
    }).select("id,title,current_version_id").single();
    if (error) throw error;
    document = data;
    const { error: linkError } = await db.from("artifact_links").insert({
      account_id: input.accountId, artist_workspace_id: input.artistWorkspaceId, artist_id: input.artistId,
      source_type: "document", source_id: document.id, target_type: "music_item", target_id: input.musicSubject.id, relationship: "references",
    });
    if (linkError) throw linkError;
  }

  const { count, error: countError } = await db.from("document_versions").select("id", { count: "exact", head: true }).eq("document_id", document.id);
  if (countError) throw countError;
  const { data: version, error: versionError } = await db.from("document_versions").insert({
    account_id: input.accountId, artist_workspace_id: input.artistWorkspaceId, artist_id: input.artistId,
    document_id: document.id, version_number: (count ?? 0) + 1, manager_output_id: null,
    file_type: "text/markdown", extraction_status: "not_required", metadata: { body: responseBody }, created_from_run_id: runId,
  }).select("id").single();
  if (versionError) throw versionError;
  const { error: updateError } = await db.from("documents").update({ current_version_id: version.id, status: "draft", created_from_run_id: runId }).eq("id", document.id);
  if (updateError) throw updateError;
  const { error: eventError } = await db.from("operating_events").insert({
    account_id: input.accountId, artist_workspace_id: input.artistWorkspaceId, artist_id: input.artistId,
    event_type: "song_document_created", actor_type: "manager", target_type: "music_item", target_id: input.musicSubject.id,
    source_type: "document", source_id: document.id, display_mode: "activity", refresh_scope: ["music-list", "activity"],
    summary: `${title} is ready to review.`, payload: { document_type: documentType },
  });
  if (eventError) throw eventError;
}

export async function loadFocusedSongDocuments(db: any, input: Omit<FocusedSongDraftInput, "body">, musicItemId: string) {
  const { data: links, error: linksError } = await db.from("artifact_links").select("source_id")
    .eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId)
    .eq("source_type", "document").eq("target_type", "music_item").eq("target_id", musicItemId).eq("relationship", "references").limit(24);
  if (linksError) throw linksError;
  const ids = (links ?? []).map((link: any) => link.source_id).filter(Boolean);
  if (!ids.length) return [];
  const { data: documents, error: documentError } = await db.from("documents").select("id,title,document_type,status,origin,current_version_id")
    .eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId).in("id", ids).limit(24);
  if (documentError) throw documentError;
  const { data: versions, error: versionError } = await db.from("document_versions").select("id,document_id,metadata")
    .eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId).in("document_id", ids).limit(60);
  if (versionError) throw versionError;
  return (documents ?? []).map((document: any) => {
    const version = (versions ?? []).find((item: any) => item.id === document.current_version_id)
      ?? (versions ?? []).find((item: any) => item.document_id === document.id);
    return { id: document.id, title: document.title, documentType: document.document_type, status: document.status, origin: document.origin, content: cleanLongText(version?.metadata?.body, 60_000) };
  });
}

function requestedDocumentType(value: string) {
  if (value.includes("press release")) return "press_release";
  if (value.includes("press angle")) return "press_angle";
  if (value.includes("bio")) return "artist_biography";
  if (value.includes("one-sheet") || value.includes("one sheet")) return "one_sheet";
  if (value.includes("lyrics")) return "lyrics";
  if (value.includes("credits")) return "credits";
  if (value.includes("distributor")) return "distributor_notes";
  return null;
}

function documentTitle(type: string) {
  return ({ press_release: "Press release", press_angle: "Press angle", artist_biography: "Artist biography", one_sheet: "One-sheet", lyrics: "Lyrics", credits: "Credits", distributor_notes: "Distributor notes" } as Record<string, string>)[type] ?? "Song document";
}

function cleanLongText(value: unknown, maxChars: number) {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}
