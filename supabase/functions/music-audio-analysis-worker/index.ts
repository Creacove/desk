import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AUDIO_ASSET_TYPES = new Set(["demo", "rough_mix", "final_master", "clean_version", "instrumental", "stems"]);
const MAX_CANDIDATES = 24;

Deno.serve(withAppErrorCapture("music-audio-analysis-worker", async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const workerSecret = Deno.env.get("WORKFLOW_WORKER_SECRET");
  if (!workerSecret || request.headers.get("x-workflow-worker-secret") !== workerSecret) {
    return json({ error: "Unauthorized." }, 401);
  }

  const analyzerUrl = configuredAnalyzerUrl();
  if (!analyzerUrl) return json({ status: "not_configured", inspected: 0, analyzed: 0 });

  try {
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const candidates = await loadCandidates(db);
    let analyzed = 0;
    for (const candidate of candidates) {
      if (await analyzeCandidate(db, analyzerUrl, candidate)) analyzed += 1;
    }
    return json({ status: "completed", inspected: candidates.length, analyzed });
  } catch (error) {
    console.error("Music audio-analysis worker failed", error);
    return json({ error: "Music audio-analysis worker failed." }, 500);
  }
}));

type Candidate = {
  assetId: string;
  title: string;
  assetType: string;
  subjectType: "music_item" | "music_project";
  subjectId: string;
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  file: {
    id: string;
    bucket: string;
    path: string;
    fileName: string;
    fileType: string;
    metadata: Record<string, unknown>;
  };
};

async function loadCandidates(db: any): Promise<Candidate[]> {
  const { data: assetRows, error: assetError } = await db.from("music_assets")
    .select("id,title,asset_type,music_item_id,music_project_id,uploaded_file_id,account_id,artist_workspace_id,artist_id,status")
    .in("asset_type", [...AUDIO_ASSET_TYPES])
    .in("status", ["uploaded", "confirmed"])
    .not("uploaded_file_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(MAX_CANDIDATES);
  if (assetError) throw assetError;

  const fileIds = (assetRows ?? []).map((row: any) => cleanId(row.uploaded_file_id)).filter(Boolean);
  if (!fileIds.length) return [];
  const [{ data: fileRows, error: fileError }, { data: existingEvidence, error: evidenceError }] = await Promise.all([
    db.from("uploaded_files")
      .select("id,storage_bucket,storage_ref,file_name,file_type,status,metadata")
      .in("id", fileIds)
      .in("status", ["uploaded", "processed"]),
    db.from("evidence_items")
      .select("uploaded_file_id")
      .eq("evidence_type", "audio_analysis")
      .in("uploaded_file_id", fileIds),
  ]);
  if (fileError) throw fileError;
  if (evidenceError) throw evidenceError;

  const filesById = new Map<string, any>((fileRows ?? []).map((row: any) => [cleanId(row.id), row]));
  const analyzedFileIds = new Set((existingEvidence ?? []).map((row: any) => cleanId(row.uploaded_file_id)).filter(Boolean));
  const candidates: Candidate[] = [];
  for (const asset of assetRows ?? []) {
    const fileId = cleanId(asset.uploaded_file_id);
    const file = filesById.get(fileId);
    const subjectType = asset.music_item_id ? "music_item" : asset.music_project_id ? "music_project" : null;
    const subjectId = cleanId(asset.music_item_id ?? asset.music_project_id);
    if (!file || !subjectType || !subjectId || analyzedFileIds.has(fileId)) continue;
    const metadata = record(file.metadata);
    if (!isEligibleRetry(metadata)) continue;
    const bucket = cleanBucket(file.storage_bucket);
    const path = cleanStoragePath(file.storage_ref);
    if (!bucket || !path) continue;
    candidates.push({
      assetId: cleanId(asset.id),
      title: cleanText(asset.title, 180) || "Audio file",
      assetType: cleanText(asset.asset_type, 80),
      subjectType,
      subjectId,
      accountId: cleanId(asset.account_id),
      artistWorkspaceId: cleanId(asset.artist_workspace_id),
      artistId: cleanId(asset.artist_id),
      file: {
        id: fileId,
        bucket,
        path,
        fileName: cleanText(file.file_name, 240) || "audio",
        fileType: cleanText(file.file_type, 120),
        metadata,
      },
    });
  }
  return candidates.filter((candidate) => candidate.assetId && candidate.accountId && candidate.artistWorkspaceId && candidate.artistId);
}

async function analyzeCandidate(db: any, analyzerUrl: string, candidate: Candidate) {
  try {
    const { data: signed, error: signedError } = await db.storage
      .from(candidate.file.bucket)
      .createSignedUrl(candidate.file.path, 600);
    if (signedError || !signed?.signedUrl) throw new Error("signed_url_unavailable");

    const response = await fetch(analyzerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(Deno.env.get("AUDIO_ANALYSIS_API_KEY") ? { Authorization: `Bearer ${Deno.env.get("AUDIO_ANALYSIS_API_KEY")}` } : {}),
      },
      body: JSON.stringify({
        source: "ordersounds_music_upload",
        asset: { id: candidate.assetId, type: candidate.assetType, title: candidate.title },
        file: { url: signed.signedUrl, name: candidate.file.fileName, mimeType: candidate.file.fileType },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`analyzer_http_${response.status}`);
    const result = normalizeAnalysis(await response.json());
    if (!result.bpm && !result.musicalKey && !result.durationMs) throw new Error("analyzer_result_invalid");

    const evidenceRows = analysisEvidenceRows(candidate, result);
    const { error: evidenceError } = await db.from("evidence_items").insert(evidenceRows);
    if (evidenceError) throw evidenceError;
    await markAnalysisState(db, candidate, "completed");
    await writeAnalysisEvent(db, candidate, "music_audio_analysis_completed", "Audio analysis is ready for review.", {
      fields: evidenceRows.map((row) => row.metric_name),
      confidence: result.confidence,
    });
    return true;
  } catch (error) {
    const attempts = currentAttempts(candidate.file.metadata) + 1;
    await markAnalysisState(db, candidate, "failed", attempts, failureCode(error));
    await writeAnalysisEvent(db, candidate, "music_audio_analysis_failed", "Audio analysis could not be completed; manual song details remain available.", { attempts });
    console.error("Music audio analysis failed", { assetId: candidate.assetId, reason: failureCode(error) });
    return false;
  }
}

function normalizeAnalysis(value: unknown) {
  const source = record(value);
  return {
    bpm: normalizeBpm(source.bpm ?? source.tempo_bpm ?? record(source.tempo).bpm),
    musicalKey: normalizeMusicalKey(source.key ?? source.musicalKey ?? source.musical_key),
    durationMs: normalizeDurationMs(source.durationMs ?? source.duration_ms ?? source.duration),
    confidence: normalizeConfidence(source.confidence),
  };
}

function analysisEvidenceRows(candidate: Candidate, result: ReturnType<typeof normalizeAnalysis>) {
  const base = {
    account_id: candidate.accountId,
    artist_workspace_id: candidate.artistWorkspaceId,
    artist_id: candidate.artistId,
    uploaded_file_id: candidate.file.id,
    source: "Audio analysis",
    source_kind: "uploaded_file",
    evidence_type: "audio_analysis",
    subject_type: candidate.subjectType,
    subject_id: candidate.subjectId,
    subject_label: candidate.title,
    freshness: "Current upload",
    confidence: result.confidence,
    provenance: "Server-side analysis of the selected uploaded file.",
    limitation: "Automated estimate. Verify before delivery or release.",
  };
  const rows = [
    result.bpm ? { ...base, metric_name: "tempo_bpm", metric_value: result.bpm, metric_unit: "bpm" } : null,
    result.musicalKey ? { ...base, metric_name: "musical_key", metric_value: null, metric_unit: result.musicalKey } : null,
    result.durationMs ? { ...base, metric_name: "duration_ms", metric_value: result.durationMs, metric_unit: "ms" } : null,
  ];
  return rows.filter((row): row is NonNullable<typeof row> => row !== null);
}

async function markAnalysisState(db: any, candidate: Candidate, status: "completed" | "failed", attempts = currentAttempts(candidate.file.metadata), failure = "") {
  const metadata = { ...candidate.file.metadata, audio_analysis: {
    status,
    attempts,
    assetId: candidate.assetId,
    attemptedAt: new Date().toISOString(),
    ...(failure ? { failure } : {}),
  } };
  const { error } = await db.from("uploaded_files").update({ metadata }).eq("id", candidate.file.id);
  if (error) throw error;
}

async function writeAnalysisEvent(db: any, candidate: Candidate, eventType: string, summary: string, payload: Record<string, unknown>) {
  const { error } = await db.from("operating_events").insert({
    account_id: candidate.accountId,
    artist_workspace_id: candidate.artistWorkspaceId,
    artist_id: candidate.artistId,
    event_type: eventType,
    actor_type: "system",
    target_type: candidate.subjectType,
    target_id: candidate.subjectId,
    source_type: "uploaded_file",
    source_id: candidate.file.id,
    summary,
    payload: { asset_id: candidate.assetId, ...payload },
  });
  if (error) throw error;
}

function isEligibleRetry(metadata: Record<string, unknown>) {
  const state = record(metadata.audio_analysis);
  if (state.status === "completed") return false;
  return state.status !== "failed" || currentAttempts(metadata) < 3;
}

function currentAttempts(metadata: Record<string, unknown>) {
  const attempts = Number(record(metadata.audio_analysis).attempts);
  return Number.isInteger(attempts) && attempts >= 0 && attempts <= 20 ? attempts : 0;
}

function normalizeBpm(value: unknown) {
  const bpm = typeof value === "number" ? value : Number(value);
  return Number.isFinite(bpm) && bpm >= 30 && bpm <= 300 ? Math.round(bpm * 10) / 10 : null;
}

function normalizeMusicalKey(value: unknown) {
  const raw = cleanText(value, 32).replace(/\s+/g, " ");
  const match = raw.match(/^([A-Ga-g])([#b]?)(?:\s*(major|minor|maj|min|m))?$/);
  if (!match) return null;
  const quality = match[3]?.toLowerCase();
  return `${match[1].toUpperCase()}${match[2]}${quality ? ` ${quality === "m" || quality === "min" ? "minor" : quality === "maj" ? "major" : quality}` : ""}`;
}

function normalizeDurationMs(value: unknown) {
  const duration = typeof value === "number" ? value : Number(value);
  return Number.isFinite(duration) && duration >= 1_000 && duration <= 14_400_000 ? Math.round(duration) : null;
}

function normalizeConfidence(value: unknown) {
  const confidence = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(confidence)) return "unknown";
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

function configuredAnalyzerUrl() {
  const value = Deno.env.get("AUDIO_ANALYSIS_URL")?.trim() ?? "";
  try {
    return new URL(value).protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

function cleanBucket(value: unknown) {
  const bucket = cleanText(value, 64);
  return /^[a-z0-9][a-z0-9_-]{0,62}$/.test(bucket) ? bucket : "";
}

function cleanStoragePath(value: unknown) {
  const path = cleanText(value, 600);
  return path && !path.includes("..") && !path.startsWith("/") ? path : "";
}

function cleanId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function failureCode(error: unknown) {
  const value = error instanceof Error ? error.message : "analysis_failed";
  return cleanText(value, 80).replace(/[^a-z0-9_]/gi, "_").toLowerCase() || "analysis_failed";
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
