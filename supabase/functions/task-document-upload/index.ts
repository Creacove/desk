import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const BUCKET = "workspace-documents";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const allowedFileTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UploadInput = {
  action: "prepare" | "finalize";
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  taskId: string;
  uploadId?: string;
  title?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return failure("METHOD_NOT_ALLOWED", "Method not allowed.", 405);

  try {
    const input = await request.json() as UploadInput;
    validateWorkspaceInput(input);
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return failure("UNAUTHORIZED", "Missing Authorization header.", 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const authClient = createClient(supabaseUrl, requireEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return failure("UNAUTHORIZED", "Your session is no longer valid.", 401);
    const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", {
      target_account_id: input.accountId,
    });
    if (membershipError) throw membershipError;
    if (!membership) return failure("FORBIDDEN", "You do not have access to this workspace.", 403);

    const db = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await assertActiveWorkspaceEntitlement(db, input);
    await assertTask(db, input);

    if (input.action === "prepare") return await prepareUpload(db, input, user.id);
    if (input.action === "finalize") return await finalizeUpload(db, input, user.id);
    return failure("INVALID_ACTION", "Upload action must be prepare or finalize.", 400);
  } catch (error) {
    const code = errorCode(error);
    const status = code === "UNSUPPORTED_FILE_TYPE" || code === "FILE_TOO_LARGE" || code === "INVALID_INPUT" ? 400 : 500;
    return failure(code, publicErrorMessage(code), status);
  }
});

async function prepareUpload(db: any, input: UploadInput, userId: string) {
  const fileName = cleanFileName(input.fileName);
  const fileType = normalizeFileType(input.fileType, fileName);
  const fileSize = Number(input.fileSize ?? 0);
  if (!fileName || !fileSize || fileSize < 1) throw new Error("INVALID_INPUT");
  if (fileSize > MAX_FILE_BYTES) throw new Error("FILE_TOO_LARGE");
  if (fileName.toLowerCase().endsWith(".doc") || !allowedFileTypes.has(fileType)) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  const storageRef = [
    input.accountId,
    input.artistWorkspaceId,
    input.taskId,
    `${crypto.randomUUID()}-${slugFileName(fileName)}`,
  ].join("/");
  const { data: uploadedFile, error: intentError } = await db
    .from("uploaded_files")
    .insert({
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
      metadata: {
        task_id: input.taskId,
        title: cleanText(input.title) || fileName,
        size: fileSize,
        workflow: "task_document_v1",
      },
    })
    .select("id")
    .single();
  if (intentError) throw intentError;

  const { data: signedUpload, error: signedUploadError } = await db.storage
    .from(BUCKET)
    .createSignedUploadUrl(storageRef);
  if (signedUploadError) {
    await db.from("uploaded_files").update({
      status: "failed",
      error: "Could not prepare secure upload destination.",
    }).eq("id", uploadedFile.id);
    throw signedUploadError;
  }

  return json({
    uploadId: uploadedFile.id,
    bucket: BUCKET,
    path: storageRef,
    token: signedUpload.token,
    fileName,
    fileType,
  });
}

async function finalizeUpload(db: any, input: UploadInput, userId: string) {
  if (!input.uploadId) throw new Error("INVALID_INPUT");
  const { data: intent, error: intentError } = await db
    .from("uploaded_files")
    .select("id,file_name,file_type,storage_bucket,storage_ref,metadata,status,uploaded_by_user_id")
    .eq("id", input.uploadId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("uploaded_by_user_id", userId)
    .maybeSingle();
  if (intentError) throw intentError;
  if (!intent) throw new Error("UPLOAD_INTENT_NOT_FOUND");

  const objectExists = await storageObjectExists(db, intent.storage_bucket, intent.storage_ref);
  if (!objectExists) throw new Error("UPLOAD_OBJECT_MISSING");

  const { data: rows, error: finalizeError } = await db.rpc("finalize_task_document_upload", {
    p_account_id: input.accountId,
    p_artist_workspace_id: input.artistWorkspaceId,
    p_artist_id: input.artistId,
    p_task_id: input.taskId,
    p_uploaded_file_id: intent.id,
    p_title: cleanText(input.title) || cleanText(intent.metadata?.title) || intent.file_name,
    p_file_name: intent.file_name,
    p_file_type: intent.file_type,
    p_storage_bucket: intent.storage_bucket,
    p_storage_ref: intent.storage_ref,
    p_submitted_by_user_id: userId,
  });
  if (finalizeError) throw finalizeError;
  const finalized = Array.isArray(rows) ? rows[0] : rows;
  if (!finalized?.document_id || !finalized?.document_version_id) {
    throw new Error("FINALIZE_FAILED");
  }

  const fileSize = Number(intent.metadata?.size ?? 0);
  const extraction = fileSize > 12 * 1024 * 1024
    ? {
        status: "failed",
        text: "",
        error: "The file is safely uploaded but is too large for inline text extraction.",
      }
    : await extractDocumentText(db, intent.storage_bucket, intent.storage_ref, intent.file_type);
  const { error: extractionError } = await db
    .from("document_versions")
    .update({
      extraction_status: extraction.status,
      metadata: {
        task_id: input.taskId,
        extracted_text: extraction.text,
        extraction_error: extraction.error,
      },
    })
    .eq("id", finalized.document_version_id);
  if (extractionError) throw extractionError;

  return json({
    id: finalized.document_id,
    documentId: finalized.document_id,
    documentVersionId: finalized.document_version_id,
    title: cleanText(input.title) || cleanText(intent.metadata?.title) || intent.file_name,
    status: "uploaded",
    fileName: intent.file_name,
    validationSummary: extraction.status === "completed"
      ? "Uploaded and ready for content-aware Manager review."
      : "Uploaded. The Manager will review the file and flag anything it cannot read.",
  });
}

async function assertTask(db: any, input: UploadInput) {
  const { data, error } = await db
    .from("tasks")
    .select("id")
    .eq("id", input.taskId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("TASK_NOT_FOUND");
}

async function storageObjectExists(db: any, bucket: string, path: string) {
  const parts = path.split("/");
  const fileName = parts.pop();
  const folder = parts.join("/");
  const { data, error } = await db.storage.from(bucket).list(folder, {
    search: fileName,
    limit: 2,
  });
  if (error) throw error;
  return Boolean(data?.some((item: { name?: string }) => item.name === fileName));
}

async function extractDocumentText(db: any, bucket: string, path: string, fileType: string) {
  try {
    const { data, error } = await db.storage.from(bucket).download(path);
    if (error || !data) throw error ?? new Error("Download failed.");
    const buffer = await data.arrayBuffer();
    let text = "";
    if (fileType.startsWith("text/") || fileType === "application/json") {
      text = new TextDecoder().decode(buffer);
    } else if (fileType === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("npm:unpdf@1.6.2");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      text = String((await extractText(pdf, { mergePages: true })).text ?? "");
    } else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const mammoth = await import("npm:mammoth@1.12.0");
      text = String((await mammoth.extractRawText({ arrayBuffer: buffer })).value ?? "");
    }
    const compactText = text.replace(/\u0000/g, "").trim().slice(0, 150_000);
    return compactText
      ? { status: "completed", text: compactText, error: "" }
      : { status: "failed", text: "", error: "No readable text was extracted." };
  } catch {
    return { status: "failed", text: "", error: "Text extraction failed; the original file remains available." };
  }
}

function validateWorkspaceInput(input: UploadInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId || !input.taskId) {
    throw new Error("INVALID_INPUT");
  }
}

function cleanFileName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/[\\/]/g, "-").slice(0, 180) : "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFileType(value: unknown, fileName: string) {
  const explicit = cleanText(value).toLowerCase();
  if (explicit) return explicit;
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "md") return "text/markdown";
  if (extension === "csv") return "text/csv";
  if (extension === "json") return "application/json";
  if (extension === "txt") return "text/plain";
  return "application/octet-stream";
}

function slugFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const known = [
    "INVALID_INPUT",
    "FILE_TOO_LARGE",
    "UNSUPPORTED_FILE_TYPE",
    "TASK_NOT_FOUND",
    "UPLOAD_INTENT_NOT_FOUND",
    "UPLOAD_OBJECT_MISSING",
    "FINALIZE_FAILED",
  ];
  return known.includes(message) ? message : "UPLOAD_FAILED";
}

function publicErrorMessage(code: string) {
  if (code === "FILE_TOO_LARGE") return "This file is larger than the 50 MB document limit.";
  if (code === "UNSUPPORTED_FILE_TYPE") return "Use PDF, DOCX, TXT, Markdown, CSV, or JSON. Legacy .doc files are not supported.";
  if (code === "TASK_NOT_FOUND") return "This task is no longer available.";
  if (code === "UPLOAD_OBJECT_MISSING") return "The file did not reach secure storage. Please try the upload again.";
  if (code === "INVALID_INPUT") return "The document upload request is incomplete.";
  return "The document could not be uploaded. Nothing was submitted; you can safely try again.";
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function failure(code: string, message: string, status: number) {
  return json({ error: { code, message } }, status);
}
