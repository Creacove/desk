import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const BUCKET = "workspace-documents";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_EXTRACT_BYTES = 12 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 150_000;
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const allowedFileTypes = new Set([
  "application/pdf",
  DOCX,
  "text/plain",
  "text/markdown",
  "text/csv",
  XLSX,
  "application/json",
]);

type UploadInput = {
  action: "prepare" | "finalize" | "revoke";
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  uploadId?: string;
  documentId?: string;
  title?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(withAppErrorCapture("manager-knowledge-upload", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return failure("METHOD_NOT_ALLOWED", 405);

  try {
    const input = await request.json() as UploadInput;
    validateWorkspaceInput(input);
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return failure("UNAUTHORIZED", 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const authClient = createClient(supabaseUrl, requireEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return failure("UNAUTHORIZED", 401);
    const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", {
      target_account_id: input.accountId,
    });
    if (membershipError) throw membershipError;
    if (!membership) return failure("FORBIDDEN", 403);

    const db = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await assertActiveWorkspaceEntitlement(db, input);
    await assertArtistWorkspace(db, input);

    if (input.action === "prepare") return await prepareUpload(db, input, user.id);
    if (input.action === "finalize") return await finalizeUpload(db, input, user.id);
    if (input.action === "revoke") return await revokeDocument(db, input);
    return failure("INVALID_ACTION", 400);
  } catch (error) {
    const code = errorCode(error);
    const status = ["INVALID_INPUT", "UNSUPPORTED_FILE_TYPE", "FILE_TOO_LARGE"].includes(code) ? 400
      : ["UPLOAD_INTENT_NOT_FOUND", "DOCUMENT_NOT_FOUND"].includes(code) ? 404
      : 500;
    return failure(code, status);
  }
}));

async function prepareUpload(db: any, input: UploadInput, userId: string) {
  const fileName = cleanFileName(input.fileName);
  const fileType = normalizeFileType(input.fileType, fileName);
  const fileSize = Number(input.fileSize ?? 0);
  if (!fileName || fileSize < 1) throw new Error("INVALID_INPUT");
  if (fileSize > MAX_FILE_BYTES) throw new Error("FILE_TOO_LARGE");
  if (fileName.toLowerCase().endsWith(".doc") || !allowedFileTypes.has(fileType)) throw new Error("UNSUPPORTED_FILE_TYPE");

  const storageRef = [
    input.accountId,
    input.artistWorkspaceId,
    "manager-knowledge",
    `${crypto.randomUUID()}-${slugFileName(fileName)}`,
  ].join("/");
  const { data: intent, error: intentError } = await db.from("uploaded_files").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    uploaded_by_user_id: userId,
    file_name: fileName,
    file_type: fileType,
    classification: "other",
    storage_bucket: BUCKET,
    storage_ref: storageRef,
    status: "processing",
    metadata: { title: cleanText(input.title) || fileName, size: fileSize, workflow: "manager_knowledge_v1" },
  }).select("id").single();
  if (intentError) throw intentError;

  const { data: signedUpload, error: signedUploadError } = await db.storage.from(BUCKET).createSignedUploadUrl(storageRef);
  if (signedUploadError) {
    await db.from("uploaded_files").update({ status: "failed", error: "Could not prepare secure upload destination." }).eq("id", intent.id);
    throw signedUploadError;
  }
  return json({ uploadId: intent.id, bucket: BUCKET, path: storageRef, token: signedUpload.token, fileName, fileType });
}

async function finalizeUpload(db: any, input: UploadInput, userId: string) {
  if (!input.uploadId) throw new Error("INVALID_INPUT");
  const { data: intent, error: intentError } = await db.from("uploaded_files")
    .select("id,file_name,file_type,storage_bucket,storage_ref,metadata,status,uploaded_by_user_id")
    .eq("id", input.uploadId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("uploaded_by_user_id", userId)
    .maybeSingle();
  if (intentError) throw intentError;
  if (!intent) throw new Error("UPLOAD_INTENT_NOT_FOUND");
  if (intent.status === "processed" && intent.metadata?.document_id) return json(await loadDocumentReceipt(db, input, intent.metadata.document_id));
  if (!(await storageObjectExists(db, intent.storage_bucket, intent.storage_ref))) throw new Error("UPLOAD_OBJECT_MISSING");

  const title = cleanText(input.title) || cleanText(intent.metadata?.title) || intent.file_name;
  const fileSize = Number(intent.metadata?.size ?? 0);
  const extraction = fileSize > MAX_EXTRACT_BYTES
    ? { status: "failed", text: "", error: "The file is safely uploaded but is too large for inline text extraction.", sourceMap: [] }
    : await extractDocumentText(db, intent.storage_bucket, intent.storage_ref, intent.file_type);

  const { data: document, error: documentError } = await db.from("documents").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    title,
    document_type: "manager_knowledge",
    origin: "user_uploaded",
    status: "uploaded",
    metadata: { workflow: "manager_knowledge_v1", source_file_name: intent.file_name },
    created_by_type: "user",
    created_by_id: userId,
  }).select("id").single();
  if (documentError) throw documentError;

  const { data: version, error: versionError } = await db.from("document_versions").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    document_id: document.id,
    version_number: 1,
    uploaded_file_id: intent.id,
    file_name: intent.file_name,
    file_type: intent.file_type,
    storage_bucket: intent.storage_bucket,
    storage_ref: intent.storage_ref,
    extraction_status: extraction.status,
    metadata: {
      extracted_text: extraction.text,
      extraction_error: extraction.error,
      source_map: extraction.sourceMap,
      character_count: extraction.text.length,
    },
  }).select("id").single();
  if (versionError) {
    await db.from("documents").delete().eq("id", document.id);
    throw versionError;
  }

  const { error: finalizeError } = await db.from("documents").update({ current_version_id: version.id }).eq("id", document.id);
  if (finalizeError) throw finalizeError;
  await db.from("uploaded_files").update({
    status: "processed",
    error: null,
    metadata: { ...intent.metadata, document_id: document.id, document_version_id: version.id },
  }).eq("id", intent.id);

  return json({
    id: document.id,
    documentId: document.id,
    documentVersionId: version.id,
    title,
    status: extraction.status === "completed" ? "ready" : "needs_review",
    fileName: intent.file_name,
    validationSummary: extraction.status === "completed"
      ? "Uploaded, read, and ready for Manager."
      : "Uploaded safely. Manager could not fully read this file.",
  });
}

async function revokeDocument(db: any, input: UploadInput) {
  if (!input.documentId) throw new Error("INVALID_INPUT");
  const { data: document, error: documentError } = await db.from("documents")
    .select("id,current_version_id,status")
    .eq("id", input.documentId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("document_type", "manager_knowledge")
    .maybeSingle();
  if (documentError) throw documentError;
  if (!document) throw new Error("DOCUMENT_NOT_FOUND");
  const { data: version, error: versionError } = await db.from("document_versions")
    .select("id,uploaded_file_id,storage_bucket,storage_ref,metadata")
    .eq("id", document.current_version_id)
    .eq("account_id", input.accountId)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version) throw new Error("DOCUMENT_NOT_FOUND");
  if (version.storage_bucket && version.storage_ref) await db.storage.from(version.storage_bucket).remove([version.storage_ref]);
  await db.from("document_versions").update({
    extraction_status: "not_required",
    storage_ref: null,
    metadata: { revoked: true, extracted_text: "", extraction_error: "Document revoked by workspace member." },
  }).eq("id", version.id);
  if (version.uploaded_file_id) await db.from("uploaded_files").update({ status: "revoked" }).eq("id", version.uploaded_file_id);
  const { error: revokeError } = await db.from("documents").update({ status: "revoked", summary: null }).eq("id", document.id);
  if (revokeError) throw revokeError;
  return json({ documentId: document.id, status: "revoked" });
}

async function extractDocumentText(db: any, bucket: string, path: string, fileType: string) {
  try {
    const { data, error } = await db.storage.from(bucket).download(path);
    if (error || !data) throw error ?? new Error("Download failed.");
    const buffer = await data.arrayBuffer();
    let text = "";
    let sourceMap: Array<Record<string, unknown>> = [];
    if (fileType.startsWith("text/") || fileType === "application/json") {
      text = new TextDecoder().decode(buffer);
    } else if (fileType === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("npm:unpdf@1.6.2");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const pages = await extractText(pdf, { mergePages: false });
      const pageText = Array.isArray(pages.text) ? pages.text : [String(pages.text ?? "")];
      text = pageText.map((value, index) => `[Page ${index + 1}]\n${value}`).join("\n\n");
      sourceMap = pageText.map((value, index) => ({ page: index + 1, characters: String(value).length }));
    } else if (fileType === DOCX) {
      const mammoth = await import("npm:mammoth@1.12.0");
      text = String((await mammoth.extractRawText({ arrayBuffer: buffer })).value ?? "");
    } else if (fileType === XLSX) {
      const ExcelJS = await import("npm:exceljs@4.4.0");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheets: Array<{ name: string; rows: string[] }> = [];
      workbook.eachSheet((sheet: any) => {
        const rows: string[] = [];
        sheet.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
          const values = Array.isArray(row.values) ? row.values.slice(1) : [];
          rows.push(`${rowNumber}: ${values.map((value: unknown) => spreadsheetCell(value)).join(" | ")}`);
        });
        sheets.push({ name: String(sheet.name || `Sheet ${sheets.length + 1}`), rows });
      });
      text = sheets.map(({ name, rows }) => `[Sheet: ${name}]\n${rows.join("\n")}`).join("\n\n");
      sourceMap = sheets.map(({ name, rows }) => ({ sheet: name, rows: rows.length }));
    }
    const compactText = text.replace(/\u0000/g, "").trim().slice(0, MAX_EXTRACTED_CHARS);
    return compactText
      ? { status: "completed", text: compactText, error: "", sourceMap }
      : { status: "failed", text: "", error: "No readable text was extracted.", sourceMap };
  } catch {
    return { status: "failed", text: "", error: "Text extraction failed; the original file remains available.", sourceMap: [] };
  }
}

async function assertArtistWorkspace(db: any, input: UploadInput) {
  const { data, error } = await db.from("artist_workspaces").select("id,artist_id")
    .eq("id", input.artistWorkspaceId).eq("account_id", input.accountId).eq("artist_id", input.artistId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("WORKSPACE_NOT_FOUND");
}

async function storageObjectExists(db: any, bucket: string, path: string) {
  const parts = path.split("/");
  const fileName = parts.pop();
  const { data, error } = await db.storage.from(bucket).list(parts.join("/"), { search: fileName, limit: 2 });
  if (error) throw error;
  return Boolean(data?.some((item: { name?: string }) => item.name === fileName));
}

async function loadDocumentReceipt(db: any, input: UploadInput, documentId: string) {
  const { data, error } = await db.from("documents").select("id,title,current_version_id,status")
    .eq("id", documentId).eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).single();
  if (error) throw error;
  return { id: data.id, documentId: data.id, documentVersionId: data.current_version_id, title: data.title, status: "ready" };
}

function validateWorkspaceInput(input: UploadInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId) throw new Error("INVALID_INPUT");
}
function cleanFileName(value: unknown) { return typeof value === "string" ? value.trim().replace(/[\\/]/g, "-").slice(0, 180) : ""; }
function cleanText(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function normalizeFileType(value: unknown, fileName: string) {
  const explicit = cleanText(value).toLowerCase();
  if (explicit) return explicit;
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return DOCX;
  if (extension === "md") return "text/markdown";
  if (extension === "csv") return "text/csv";
  if (extension === "xlsx") return XLSX;
  if (extension === "json") return "application/json";
  if (extension === "txt") return "text/plain";
  return "application/octet-stream";
}
function slugFileName(value: string) { return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "file"; }
function spreadsheetCell(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value && "text" in value) return String((value as { text?: unknown }).text ?? "");
  if (typeof value === "object" && value && "result" in value) return String((value as { result?: unknown }).result ?? "");
  return String(value).replace(/[\r\n]+/g, " ").trim();
}
function errorCode(error: unknown) { return error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "UPLOAD_FAILED"; }
function publicMessage(code: string) {
  if (code === "FILE_TOO_LARGE") return "Files must be 50 MB or smaller.";
  if (code === "UNSUPPORTED_FILE_TYPE") return "This file type is not supported yet.";
  if (code === "FORBIDDEN") return "You do not have access to this workspace.";
  if (code === "DOCUMENT_NOT_FOUND") return "This document is no longer available.";
  return code === "UNAUTHORIZED" ? "Your session is no longer valid." : "The document upload could not be completed.";
}
function failure(code: string, status: number) { return json({ error: publicMessage(code), code }, status); }
function requireEnv(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`Missing required environment variable: ${name}`); return value; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
