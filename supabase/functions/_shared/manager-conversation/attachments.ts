export type ManagerConversationAttachment = {
  id: string;
  musicItemId: string;
  title: string;
  assetType?: string;
  status?: string;
};

type AttachmentSubject = {
  type: "music_item" | "music_project";
  id: string;
};

type AttachmentInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  attachmentIds?: unknown;
};

export async function resolveManagerConversationAttachments(
  db: any,
  input: AttachmentInput,
  subject?: AttachmentSubject,
): Promise<ManagerConversationAttachment[]> {
  const ids = normalizeAttachmentIds(input.attachmentIds);
  if (!ids.length) return [];
  if (!subject || subject.type !== "music_item") {
    throw new Error("Attachments can only be added to a song conversation.");
  }

  const { data, error } = await db
    .from("music_assets")
    .select("id,music_item_id,asset_type,title,status")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("music_item_id", subject.id)
    .in("id", ids);
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  if (rows.length !== ids.length) {
    throw new Error("One or more attached files are not available in this song workspace.");
  }

  const byId = new Map(rows.map((row: any) => [String(row.id), row]));
  return ids.map((id) => {
    const row = byId.get(id);
    return {
      id,
      musicItemId: String(row.music_item_id),
      title: String(row.title || "Attached file"),
      assetType: String(row.asset_type || "other"),
      status: String(row.status || "uploaded"),
    };
  });
}

export function attachmentMetadata(attachments: ManagerConversationAttachment[]) {
  return attachments.map((attachment) => ({
    id: attachment.id,
    musicItemId: attachment.musicItemId,
    title: attachment.title,
    assetType: attachment.assetType,
    status: attachment.status,
  }));
}

export function normalizeAttachmentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12);
}
