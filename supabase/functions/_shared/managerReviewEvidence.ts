/**
 * Deterministic evidence rules for task-result reviews.
 *
 * The model may explain a decision, but it must not turn an already persisted
 * Song Room asset, submitted document, Manager draft, or accepted result into
 * another artist chore. This module works on the small, sanitized packet sent
 * to the review model and runs before any task/event rows are written.
 */

const AUDIO_ASSET_TYPES = new Set([
  "demo",
  "rough_mix",
  "final_master",
  "working_master",
  "clean_version",
  "instrumental",
  "stems",
]);

const ASSET_TERMS = /\b(?:asset|file|upload|attach|package|document|artwork|cover|lyrics?|credit|split|metadata|pitch|epk|press|royalt(?:y|ies)|distributor|campaign\s+report|audio|master|stems?|instrumental)\b/i;
const CONFIRMATION_TERMS = /\b(?:upload|attach|confirm|verify|re-?verify|replace|file\s*id|package|one[\s-]*line|re-?submit|already\s+done)\b/i;
const CONTRADICTORY_INTENT = /\b(?:wrong|incorrect|placeholder|corrupt|missing|failed|replace|replacement|different\s+(?:file|asset|master|artwork|document)|not\s+(?:the|a|my)\s+(?:file|asset|final[\s_-]*master|working\s+(?:audio|master)|artwork|document))\b/i;

type RecordLike = Record<string, unknown>;

/** Return true only when a canonical music asset has a live uploaded file. */
export function hasCanonicalAssetEvidence(value: unknown, task?: unknown): boolean {
  const packet = record(value);
  const assets = Array.isArray(packet.assets) ? packet.assets : [];
  const taskIdentity = taskIdentityText(task);
  return assets.some((assetValue) => {
    const asset = record(assetValue);
    const assetType = normalizeAssetType(asset.asset_type);
    if (!assetTypeMatchesTask(assetType, taskIdentity)) return false;
    const assetStatus = text(asset.status).toLowerCase();
    if (assetStatus !== "uploaded" && assetStatus !== "confirmed") return false;
    const file = record(asset.uploadedFile);
    const fileStatus = text(file.status).toLowerCase();
    return fileStatus === "uploaded" || fileStatus === "processed";
  });
}

/** Identify tasks whose completion contract can be proved by canonical state. */
export function isCanonicalEvidenceTask(value: unknown): boolean {
  return ASSET_TERMS.test(taskIdentityText(value));
}

/**
 * A completed result can be accepted without another model-generated human
 * confirmation when the packet already contains matching durable evidence.
 * Explicit bad/missing/replacement reports remain revisable.
 */
export function canonicalEvidenceAlreadySatisfiesTask(value: unknown): boolean {
  const context = record(value);
  const input = record(context.input);
  if (text(input.status).toLowerCase() !== "completed") return false;
  if (CONTRADICTORY_INTENT.test(text(input.note))) return false;

  // A previous completed result is the strongest generic duplicate guard. It
  // applies even when the task title does not mention a file or asset.
  const taskId = text(record(context.task).id);
  const previousResults = Array.isArray(context.previousResults) ? context.previousResults : [];
  if (taskId && previousResults.some((row) => {
    const result = record(row);
    return text(result.task_id) === taskId && text(result.status).toLowerCase() === "completed";
  })) return true;

  if (!isCanonicalEvidenceTask(context.task)) return false;
  if (hasCanonicalAssetEvidence(context.canonicalMusicPackage, context.task)) return true;

  const submittedDocuments = Array.isArray(context.submittedDocuments) ? context.submittedDocuments : [];
  if (submittedDocuments.some((row) => {
    const document = record(row);
    const status = text(document.status).toLowerCase();
    const verdict = text(record(document.latestValidation).verdict).toLowerCase();
    return status === "accepted" || verdict === "accepted";
  }) && /\b(?:document|file|upload|attach|evidence|report|brief|sheet|export|contract|rights|credit|metadata)\b/i.test(taskIdentityText(context.task))) return true;

  return false;
}

/**
 * Remove artist-facing follow-ups that repeat the satisfied task. Manager-owned
 * work is retained for the internal action plan. The overlap check is semantic
 * enough to catch renamed variants while leaving genuinely different work (for
 * example cover artwork after an audio upload) intact.
 */
export function removeRedundantCanonicalFollowUps<T>(tasks: T[], canonicalSatisfied: boolean, currentTask?: unknown): T[] {
  if (!canonicalSatisfied) return tasks;
  return tasks.filter((taskValue) => {
    const task = record(taskValue);
    const owner = text(task.ownerRole).toLowerCase();
    if (["manager", "desk", "ai", "ai manager"].includes(owner)) return true;
    const followUpIdentity = taskIdentityText(taskValue);
    if (!CONFIRMATION_TERMS.test(followUpIdentity)) return true;
    if (currentTask && sameTaskIntent(currentTask, taskValue)) return false;
    return true;
  });
}

function sameTaskIntent(currentTask: unknown, followUp: unknown): boolean {
  const current = meaningfulTokens(taskIdentityText(currentTask));
  const next = meaningfulTokens(taskIdentityText(followUp));
  if (!current.size || !next.size) return false;
  let overlap = 0;
  for (const token of current) if (next.has(token)) overlap += 1;
  const smaller = Math.min(current.size, next.size);
  if (overlap >= 2 && overlap / smaller >= 0.45) return true;

  // Task wording often changes completely after a model rewrite ("attach the
  // audio" -> "confirm the final master"). Domain overlap catches that class
  // without collapsing adjacent work such as audio followed by artwork.
  const sharedDomain = [...taskDomains(taskIdentityText(currentTask))]
    .some((domain) => taskDomains(taskIdentityText(followUp)).has(domain));
  return sharedDomain && CONFIRMATION_TERMS.test(taskIdentityText(followUp));
}

function taskDomains(value: string): Set<string> {
  const domains = new Set<string>();
  const groups: Array<[string, RegExp]> = [
    ["audio", /\b(?:audio|master|final[\s_-]*master|working[\s_-]*master|rough[\s_-]*mix|demo|instrumental|stems?)\b/i],
    ["artwork", /\b(?:artwork|cover|art|photo|image|visual)\b/i],
    ["lyrics", /\blyrics?\b/i],
    ["metadata", /\b(?:metadata|isrc|upc|release\s+date|distributor)\b/i],
    ["rights", /\b(?:split|credit|royalt(?:y|ies)|rights|publishing)\b/i],
    ["document", /\b(?:document|report|brief|sheet|export|contract|epk|pitch)\b/i],
    ["campaign", /\b(?:campaign|performance|metric|conversion|audience)\b/i],
  ];
  for (const [domain, pattern] of groups) if (pattern.test(value)) domains.add(domain);
  return domains;
}

function assetTypeMatchesTask(assetType: string, identity: string): boolean {
  if (!assetType) return false;
  if (AUDIO_ASSET_TYPES.has(assetType)) return /\b(?:audio|master|rough[\s_-]*mix|demo|instrumental|stems?)\b/i.test(identity);
  if (assetType === "cover_art" || assetType === "alternate_artwork" || assetType === "press_photo") return /\b(?:artwork|cover|art|photo|image|visual)\b/i.test(identity);
  if (assetType === "lyrics") return /\blyrics?\b/i.test(identity);
  if (assetType === "metadata_export" || assetType === "distributor_export") return /\b(?:metadata|distributor|export|release)\b/i.test(identity);
  if (assetType === "split_sheet") return /\b(?:split|credit|royalt(?:y|ies)|rights)\b/i.test(identity);
  if (assetType === "pitch_asset" || assetType === "epk") return /\b(?:pitch|epk|press|outreach)\b/i.test(identity);
  if (assetType === "royalty_statement") return /\b(?:royalt(?:y|ies)|statement|rights|income)\b/i.test(identity);
  if (assetType === "campaign_report") return /\b(?:campaign|report|performance|metric|result)\b/i.test(identity);
  return /\b(?:asset|file|upload|attach|package|evidence)\b/i.test(identity);
}

function taskIdentityText(value: unknown): string {
  const task = record(value);
  return [
    text(task.title),
    text(task.purpose),
    text(task.completion_expectation),
    text(task.completionExpectation),
    text(task.userResponsibility),
    text(task.user_responsibility),
    ...(Array.isArray(task.evidence_needed) ? task.evidence_needed.map(text) : []),
    ...(Array.isArray(task.evidenceNeeded) ? task.evidenceNeeded.map(text) : []),
    ...(Array.isArray(task.steps) ? task.steps.map(text) : []),
  ].filter(Boolean).join(" ");
}

function meaningfulTokens(value: string): Set<string> {
  const stopWords = new Set([
    "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "is", "it", "of", "on", "or", "the", "this", "to", "with",
    "artist", "manager", "desk", "team", "current", "next", "one", "line", "result", "task", "work", "step", "already", "add", "give", "provide", "make", "post", "open", "read", "check", "review", "confirm", "verify", "attach", "upload", "replace", "submit", "re", "again",
  ]);
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 2 && !stopWords.has(token)));
}

function normalizeAssetType(value: unknown): string {
  return text(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function record(value: unknown): RecordLike {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordLike
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
