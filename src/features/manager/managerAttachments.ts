export const MANAGER_KNOWLEDGE_MAX_BYTES = 50 * 1024 * 1024;

export const MANAGER_KNOWLEDGE_ACCEPT = [
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".csv",
  ".xlsx",
  ".json",
].join(",");

type FileDescriptor = Pick<File, "name" | "size" | "type">;

const allowedExtensions = new Set(["pdf", "docx", "txt", "md", "csv", "xlsx", "json"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/json",
]);

export function managerKnowledgeFileError(file: FileDescriptor): string | null {
  if (file.size < 1) return "This file is empty.";
  if (file.size > MANAGER_KNOWLEDGE_MAX_BYTES) return "Files must be 50 MB or smaller.";

  const extension = file.name.trim().toLowerCase().split(".").pop() ?? "";
  const mimeType = file.type.trim().toLowerCase();
  if (!allowedExtensions.has(extension)) return "This file type is not supported yet.";
  if (mimeType && !allowedMimeTypes.has(mimeType)) return "This file type is not supported yet.";
  return null;
}

export function inferManagerKnowledgeMimeType(fileName: string) {
  const extension = fileName.trim().toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "md") return "text/markdown";
  if (extension === "csv") return "text/csv";
  if (extension === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === "json") return "application/json";
  if (extension === "txt") return "text/plain";
  return "application/octet-stream";
}
