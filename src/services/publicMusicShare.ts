export type PublicMusicShareDocument = {
  id: string;
  title: string;
  documentType: string;
  body: string;
};

export type PublicMusicSharePackage = {
  label: string;
  preset: string;
  title?: string;
  artist?: string;
  createdAt?: string;
  expiresAt?: string;
  assets: Array<{
    id: string;
    title: string;
    assetType: string;
    fileName: string;
    fileType: string;
    downloadUrl: string;
    inlineUrl?: string;
  }>;
  documents?: PublicMusicShareDocument[];
  information?: Array<{ key: string; title: string; value: string }>;
};

type PublicFunctionClient = {
  functions: {
    invoke(name: string, options: { body: { token: string } }): Promise<{ data: unknown; error: unknown }>;
  };
};

export async function loadPublicMusicShare(client: PublicFunctionClient, token: string): Promise<PublicMusicSharePackage> {
  const { data, error } = await client.functions.invoke("public-music-share", { body: { token } });
  if (error) throw new Error("Share package is unavailable.");
  const payload = record(data);
  const label = text(payload.label, 180);
  const preset = text(payload.preset, 40);
  const title = text(payload.title, 180);
  const artist = text(payload.artist, 180);
  const createdAt = text(payload.createdAt, 80);
  const expiresAt = text(payload.expiresAt, 80);
  const sourceAssets = Array.isArray(payload.assets) ? payload.assets.slice(0, 40) : [];
  const assets = sourceAssets.map(normalizeAsset).filter((asset): asset is PublicMusicSharePackage["assets"][number] => Boolean(asset));

  const sourceDocuments = Array.isArray(payload.documents) ? payload.documents.slice(0, 40) : [];
  const documents = sourceDocuments.map(normalizeDocument).filter((document): document is PublicMusicShareDocument => Boolean(document));

  // Backward compatibility: old snapshots returned documents inside information.
  const sourceInformation = Array.isArray(payload.information) ? payload.information.slice(0, 60) : [];
  const legacyDocuments = sourceInformation.map(normalizeLegacyDocument).filter((document): document is PublicMusicShareDocument => Boolean(document));
  const information = sourceInformation.map(normalizeInformation).filter((field): field is NonNullable<PublicMusicSharePackage["information"]>[number] => Boolean(field));
  const mergedDocuments = dedupeDocuments([...documents, ...legacyDocuments]);

  if (!label || !preset || (!assets.length && !information.length && !mergedDocuments.length)) throw new Error("Share package is unavailable.");
  return {
    label,
    preset,
    ...(title ? { title } : {}),
    ...(artist ? { artist } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    assets,
    ...(mergedDocuments.length ? { documents: mergedDocuments } : {}),
    ...(information.length ? { information } : {}),
  };
}

function normalizeDocument(value: unknown) {
  const source = record(value);
  const id = text(source.id, 180);
  const title = publicDocumentTitle(text(source.title, 180));
  const documentType = text(source.documentType, 80) || "document";
  const body = recipientSafeDocumentBody(typeof source.body === "string" ? source.body : "");
  if (!id || !title || !body) return null;
  return { id, title, documentType, body };
}

function normalizeLegacyDocument(value: unknown) {
  const source = record(value);
  const key = text(source.key, 180);
  const documentType = text(source.documentType, 80);
  if (!documentType && !key.startsWith("document:")) return null;
  const title = publicDocumentTitle(text(source.title, 180));
  const body = recipientSafeDocumentBody(typeof source.value === "string" ? source.value : "");
  if (!key || !title || !body) return null;
  return { id: key.replace(/^document:/, ""), title, documentType: documentType || "document", body };
}

function normalizeInformation(value: unknown) {
  const source = record(value);
  const key = text(source.key, 180);
  const documentType = text(source.documentType, 80);
  if (documentType || key.startsWith("document:")) return null;
  const title = text(source.title, 180);
  const fieldValue = typeof source.value === "string" ? source.value.trim().slice(0, 60_000) : "";
  if (!key || !title || !fieldValue) return null;
  return { key, title, value: fieldValue };
}

function normalizeAsset(value: unknown) {
  const source = record(value);
  const id = text(source.id, 120);
  const title = text(source.title, 180);
  const assetType = text(source.assetType, 80);
  const fileName = text(source.fileName, 240);
  const fileType = text(source.fileType, 120);
  const downloadUrl = text(source.downloadUrl, 2_000);
  const inlineUrl = text(source.inlineUrl, 2_000);
  if (!id || !title || !fileName || !safeHttpUrl(downloadUrl)) return null;
  return { id, title, assetType, fileName, fileType, downloadUrl, ...(safeHttpUrl(inlineUrl) ? { inlineUrl } : {}) };
}

export function recipientSafeDocumentBody(rawBody: string) {
  const lines = rawBody.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  let suppressInternalSection = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^##\s+(needs verification|internal gaps)\s*$/i.test(line)) {
      suppressInternalSection = true;
      continue;
    }
    if (suppressInternalSection && /^##\s+/.test(line)) suppressInternalSection = false;
    if (suppressInternalSection) continue;
    if (/^\*\*(purpose|audience|core narrative):\*\*/i.test(line)) continue;
    if (/^>\s*internal campaign strategy/i.test(line)) continue;
    kept.push(rawLine);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 60_000);
}

export function publicDocumentTitle(value: string) {
  return value
    .replace(/\s*[—-]\s*(?:updated\s+)?draft\s*$/i, "")
    .replace(/\s*\((?:updated\s+)?draft\)\s*$/i, "")
    .replace(/\s*\[(?:updated\s+)?draft\]\s*$/i, "")
    .trim();
}

function dedupeDocuments(documents: PublicMusicShareDocument[]) {
  const seen = new Set<string>();
  return documents.filter((document) => {
    const key = `${document.id}:${document.documentType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function safeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) : "";
}
