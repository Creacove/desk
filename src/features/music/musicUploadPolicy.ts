type SongAssetGroup = "Audio" | "Artwork" | "Documents";
type FileDescriptor = { name: string; type: string; size: number };

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const groupPolicy: Record<SongAssetGroup, { accept: string; extensions: Set<string>; mimePrefixes: string[]; mimeTypes: Set<string>; maxBytes: number }> = {
  Audio: {
    accept: ".mp3,.wav,.aiff,.flac",
    extensions: new Set(["mp3", "wav", "aiff", "aif", "flac"]),
    mimePrefixes: ["audio/"],
    mimeTypes: new Set(),
    maxBytes: 5 * 1024 * 1024 * 1024,
  },
  Artwork: {
    accept: "image/jpeg,image/png,image/webp",
    extensions: new Set(["jpg", "jpeg", "png", "webp"]),
    mimePrefixes: ["image/"],
    mimeTypes: new Set(["image/jpeg", "image/png", "image/webp"]),
    maxBytes: 50 * 1024 * 1024,
  },
  Documents: {
    accept: ".pdf,.docx,.txt,.csv,.json",
    extensions: new Set(["pdf", "docx", "txt", "csv", "json"]),
    mimePrefixes: ["text/"],
    mimeTypes: new Set(["application/pdf", DOCX, "application/json"]),
    maxBytes: 50 * 1024 * 1024,
  },
};

export function musicUploadAccept(group: SongAssetGroup) {
  return groupPolicy[group].accept;
}

export function musicUploadFileError(asset: { group: SongAssetGroup }, file: FileDescriptor): string | null {
  const policy = groupPolicy[asset.group];
  if (file.size < 1) return "This file is empty.";
  if (file.size > policy.maxBytes) return `${asset.group} files must be ${asset.group === "Audio" ? "5 GB" : "50 MB"} or smaller.`;
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const mime = file.type.toLowerCase();
  const mimeAllowed = !mime || policy.mimeTypes.has(mime) || policy.mimePrefixes.some((prefix) => mime.startsWith(prefix));
  if (!policy.extensions.has(extension) || !mimeAllowed) {
    return asset.group === "Audio" ? "Choose a supported audio file." : asset.group === "Artwork" ? "Choose a supported artwork image." : "This document type is not supported yet.";
  }
  return null;
}
