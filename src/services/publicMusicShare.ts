export type PublicMusicSharePackage = {
  label: string;
  preset: string;
  assets: Array<{
    id: string;
    title: string;
    assetType: string;
    fileName: string;
    fileType: string;
    downloadUrl: string;
  }>;
  information?: Array<{ key: string; title: string; value: string; documentType?: string }>;
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
  const sourceAssets = Array.isArray(payload.assets) ? payload.assets.slice(0, 40) : [];
  const assets = sourceAssets.map(normalizeAsset).filter((asset): asset is PublicMusicSharePackage["assets"][number] => Boolean(asset));
  const sourceInformation = Array.isArray(payload.information) ? payload.information.slice(0, 60) : [];
  const information = sourceInformation.map(normalizeInformation).filter((field): field is NonNullable<PublicMusicSharePackage["information"]>[number] => Boolean(field));
  if (!label || !preset || (!assets.length && !information.length)) throw new Error("Share package is unavailable.");
  return { label, preset, assets, ...(information.length ? { information } : {}) };
}

function normalizeInformation(value: unknown) {
  const source = record(value);
  const key = text(source.key, 180);
  const title = text(source.title, 180);
  const fieldValue = typeof source.value === "string" ? source.value.trim().slice(0, 60_000) : "";
  const documentType = text(source.documentType, 80);
  if (!key || !title || !fieldValue) return null;
  return { key, title, value: fieldValue, ...(documentType ? { documentType } : {}) };
}

function normalizeAsset(value: unknown) {
  const source = record(value);
  const id = text(source.id, 120);
  const title = text(source.title, 180);
  const assetType = text(source.assetType, 80);
  const fileName = text(source.fileName, 240);
  const fileType = text(source.fileType, 120);
  const downloadUrl = text(source.downloadUrl, 2_000);
  if (!id || !title || !fileName || !safeHttpUrl(downloadUrl)) return null;
  return { id, title, assetType, fileName, fileType, downloadUrl };
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
