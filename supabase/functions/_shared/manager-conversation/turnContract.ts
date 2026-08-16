export type ManagerTurnSurface =
  | "release_success"
  | "release_opportunities"
  | "decision_package"
  | "release_share_package";

export type ManagerTurnPresentation = {
  version: 1;
  surfaces: ManagerTurnSurface[];
  visibleArtifactIds: string[];
  decisionPackageId?: string;
};

type TurnWork = {
  type?: string;
  id?: string;
  title?: string;
  artifactKind?: string;
  musicItemId?: string;
  documentType?: string;
  presentationRole?: string;
  visibility?: string;
};

const explicitDecisionPackagePattern = /\b(?:decision package|decision memo|decision brief|strategy memo|strategy brief|management memo|management brief|recommendation package|recommendation memo|recommendation brief)\b/i;

export function explicitlyRequestsDecisionPackage(input: {
  body?: string;
  contextAnswers?: Array<{ answer?: string }>;
}) {
  const text = [
    input.body ?? "",
    ...(input.contextAnswers ?? []).map((item) => item.answer ?? ""),
  ].join(" ");
  return explicitDecisionPackagePattern.test(text);
}

export function enforceExplicitDecisionPackagePolicy<T extends { actionPolicy: string }>(
  output: T,
  input: { body?: string; contextAnswers?: Array<{ answer?: string }> },
) {
  if (output.actionPolicy === "create_decision_package" && !explicitlyRequestsDecisionPackage(input)) {
    output.actionPolicy = "answer_only";
  }
  return output;
}

export function isUserVisibleManagerWork(work: TurnWork) {
  const title = String(work.title ?? "").trim().toLowerCase();
  const documentType = String(work.documentType ?? "").trim().toLowerCase();
  if (work.visibility === "internal") return false;
  if (work.presentationRole === "internal_support" || work.presentationRole === "compatibility") return false;
  if (documentType === "release_narrative" || title === "release narrative") return false;
  return true;
}

function normalizedWorkTitle(work: TurnWork) {
  return String(work.title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function workKey(work: TurnWork) {
  if (work.artifactKind === "song_document") {
    return `song_document:${work.musicItemId ?? ""}:${String(work.documentType ?? normalizedWorkTitle(work)).toLowerCase()}`;
  }
  if (work.id) return `${work.type ?? "work"}:${work.id}`;
  return `${work.type ?? "work"}:${normalizedWorkTitle(work)}`;
}

export function reconcileManagerCreatedWork<T extends TurnWork>(items: T[]) {
  const visible = items.filter(isUserVisibleManagerWork);
  const canonicalDocumentTitles = new Set(
    visible
      .filter((item) => item.artifactKind === "song_document")
      .map(normalizedWorkTitle)
      .filter(Boolean),
  );
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of visible) {
    // Older/model compatibility receipts sometimes describe the same generated
    // document as a generic music_item. Once a canonical song_document receipt
    // exists, the generic copy is noise and must not reach the artist.
    if (item.artifactKind !== "song_document" && item.type === "music_item" && canonicalDocumentTitles.has(normalizedWorkTitle(item))) {
      continue;
    }
    const key = workKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function buildManagerTurnPresentation(input: {
  createdWork?: TurnWork[];
  toolNames?: string[];
  decisionPackageId?: string | null;
}): ManagerTurnPresentation {
  const toolNames = new Set((input.toolNames ?? []).filter(Boolean));
  const surfaces: ManagerTurnSurface[] = [];

  if (toolNames.has("read_focused_release_success") || toolNames.has("propose_focused_release_date_change")) {
    surfaces.push("release_success");
  }
  if (
    toolNames.has("query_focused_release_opportunities")
    || toolNames.has("save_focused_release_opportunities")
    || toolNames.has("record_focused_release_opportunity_outcome")
  ) {
    surfaces.push("release_opportunities");
  }
  if (toolNames.has("prepare_focused_release_share_package")) {
    surfaces.push("release_share_package");
  }
  if (input.decisionPackageId) surfaces.push("decision_package");

  return {
    version: 1,
    surfaces,
    visibleArtifactIds: reconcileManagerCreatedWork(input.createdWork ?? [])
      .map((item) => String(item.id ?? "").trim())
      .filter(Boolean),
    ...(input.decisionPackageId ? { decisionPackageId: input.decisionPackageId } : {}),
  };
}

export function normalizeManagerTurnPresentation(value: unknown): ManagerTurnPresentation | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  if (source.version !== 1 || !Array.isArray(source.surfaces)) return undefined;
  const allowed = new Set<ManagerTurnSurface>([
    "release_success",
    "release_opportunities",
    "decision_package",
    "release_share_package",
  ]);
  const surfaces = [...new Set(source.surfaces.filter((item): item is ManagerTurnSurface => typeof item === "string" && allowed.has(item as ManagerTurnSurface)))];
  const visibleArtifactIds = Array.isArray(source.visibleArtifactIds)
    ? [...new Set(source.visibleArtifactIds.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))]
    : [];
  const decisionPackageId = typeof source.decisionPackageId === "string" && source.decisionPackageId.trim()
    ? source.decisionPackageId.trim()
    : undefined;
  return { version: 1, surfaces, visibleArtifactIds, ...(decisionPackageId ? { decisionPackageId } : {}) };
}
