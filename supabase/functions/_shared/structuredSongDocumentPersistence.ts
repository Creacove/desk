import { persistFocusedSongDocumentDraft, type PersistedFocusedSongDocument } from "./songDocumentDraft.ts";
import type { PremiumSongDocumentType, SongDocumentQuality, StructuredSongDocument } from "./songDocumentStandards.ts";

export type PersistedStructuredSongDocument = PersistedFocusedSongDocument & {
  quality: SongDocumentQuality;
  schemaVersion: "song_document_v2";
};

export async function persistStructuredSongDocument(
  db: any,
  input: {
    accountId: string;
    artistWorkspaceId: string;
    artistId: string;
    musicItemId: string;
    documentType: PremiumSongDocumentType;
    title: string;
    body: string;
    structure: StructuredSongDocument;
    quality: SongDocumentQuality;
    runId: string;
    managerOutputId?: string;
  },
): Promise<PersistedStructuredSongDocument> {
  if (typeof db.rpc === "function") {
    const { data, error } = await db.rpc("persist_focused_song_document_v2", {
      p_account_id: input.accountId,
      p_artist_workspace_id: input.artistWorkspaceId,
      p_artist_id: input.artistId,
      p_music_item_id: input.musicItemId,
      p_document_type: input.documentType,
      p_title: input.title,
      p_body: input.body,
      p_structure_json: input.structure,
      p_quality_json: input.quality,
      p_run_id: input.runId,
      p_manager_output_id: input.managerOutputId ?? null,
    });
    if (error) throw error;
    if (!isRecord(data) || typeof data.documentId !== "string" || typeof data.versionId !== "string") {
      throw new Error("Structured Manager document transaction returned an invalid receipt.");
    }
    return {
      documentId: data.documentId,
      versionId: data.versionId,
      musicItemId: typeof data.musicItemId === "string" ? data.musicItemId : input.musicItemId,
      ...(typeof data.missionId === "string" ? { missionId: data.missionId } : {}),
      documentType: input.documentType,
      title: typeof data.title === "string" ? data.title : input.title,
      status: "draft",
      created: Boolean(data.created),
      quality: input.quality,
      schemaVersion: "song_document_v2",
    };
  }

  if (input.documentType === "release_narrative") {
    throw new Error("Structured release narrative persistence requires the v2 document transaction.");
  }

  const receipt = await persistFocusedSongDocumentDraft(
    db,
    {
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      body: `Create a structured ${input.documentType} titled ${input.title}.`,
      musicSubject: { type: "music_item", id: input.musicItemId },
      documentType: input.documentType,
      title: input.title,
      managerOutputId: input.managerOutputId,
    },
    input.runId,
    input.body,
    false,
  );
  if (!receipt) throw new Error("Structured Manager document was not persisted.");

  const { error } = await db.from("document_versions")
    .update({
      metadata: {
        body: input.body,
        structure: input.structure,
        quality: input.quality,
        schemaVersion: "song_document_v2",
      },
    })
    .eq("id", receipt.versionId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId);
  if (error) throw error;

  return { ...receipt, quality: input.quality, schemaVersion: "song_document_v2" };
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
