import type {
  ReleaseOpportunityCandidate,
  ReleaseOpportunityBrief,
  ReleaseOpportunitySongContext,
} from "./types.ts";

const TRACKING_QUERY_KEYS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);
const CONFIDENCE_WEIGHT: Record<ReleaseOpportunityCandidate["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
};
const MAX_CONTACT_SOURCE_BYTES = 512_000;

export function normalizePublicUrl(value: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return null;

    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    if (url.port === "443") url.port = "";
    url.hash = "";

    const keptParams = [...url.searchParams.entries()]
      .filter(([key]) => !key.toLowerCase().startsWith("utm_") && !TRACKING_QUERY_KEYS.has(key.toLowerCase()))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
    url.search = "";
    for (const [key, item] of keptParams) url.searchParams.append(key, item);

    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizePublicEmail(value: string): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 6 || email.length > 320) return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email)) return null;
  return email;
}

export async function verifyOpportunityPublicContact(
  candidate: ReleaseOpportunityCandidate,
  fetchImpl: typeof fetch = fetch,
): Promise<ReleaseOpportunityCandidate> {
  const contact = normalizePublicContact(candidate.publicContact);
  if (!contact) return { ...candidate, publicContact: undefined };
  const sourceUrl = normalizePublicUrl(contact.sourceUrl);
  if (!sourceUrl || !isPublicHostname(new URL(sourceUrl).hostname)) {
    return unverifiedContact(candidate);
  }

  try {
    const response = await fetchImpl(sourceUrl, {
      method: "GET",
      redirect: "error",
      headers: { Accept: "text/html,text/plain;q=0.9" },
      signal: AbortSignal.timeout(8_000),
    });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (!response.ok || (contentLength > MAX_CONTACT_SOURCE_BYTES) || (contentType && !/text\/html|text\/plain/.test(contentType))) {
      return unverifiedContact(candidate);
    }
    const body = (await response.text()).slice(0, MAX_CONTACT_SOURCE_BYTES).toLowerCase().replace(/&amp;/g, "&");
    const expected = contact.kind === "email" ? contact.value.toLowerCase() : normalizePublicUrl(contact.value)?.toLowerCase();
    const sourceProvesRoute = Boolean(expected) && (body.includes(expected!) || (contact.kind !== "email" && expected === sourceUrl.toLowerCase()));
    return sourceProvesRoute ? { ...candidate, publicContact: contact } : unverifiedContact(candidate);
  } catch {
    return unverifiedContact(candidate);
  }
}

function unverifiedContact(candidate: ReleaseOpportunityCandidate): ReleaseOpportunityCandidate {
  return {
    ...candidate,
    publicContact: undefined,
    limitations: [...candidate.limitations, "The cited public page did not confirm this contact route."],
  };
}

function isPublicHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host === "::1") return false;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
  if (!ipv4) return true;
  if (ipv4.some((part) => part > 255)) return false;
  const [a, b] = ipv4;
  return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
}

export function dedupeOpportunityCandidates(candidates: ReleaseOpportunityCandidate[]): ReleaseOpportunityCandidate[] {
  const byKey = new Map<string, ReleaseOpportunityCandidate>();
  for (const candidate of candidates) {
    const sourceUrl = normalizePublicUrl(candidate.sourceUrl);
    if (!sourceUrl || !candidate.targetName.trim()) continue;
    const key = `${candidate.opportunityType}:${sourceUrl.toLowerCase()}`;
    const current = byKey.get(key);
    if (!current || opportunityRank(candidate) > opportunityRank(current)) byKey.set(key, candidate);
  }
  return [...byKey.values()];
}

export function classifyOpportunitySafety(candidate: ReleaseOpportunityCandidate): "clear" | "caution" | "excluded" {
  const searchable = [
    candidate.targetName,
    candidate.platform ?? "",
    candidate.fit.explanation,
    ...candidate.fit.targetCriteria,
    ...(candidate.requirements ?? []),
    ...(candidate.limitations ?? []),
  ].join(" ").toLowerCase();

  if (
    candidate.paidPlacementClaim === true
    || /guarantee(?:d|s)?\s+(?:placement|coverage|feature)|guaranteed\s+placement|pay[- ]?to[- ]?play|paid\s+placement/.test(searchable)
  ) return "excluded";

  return verifiedPublicContact(candidate.publicContact) && candidate.confidence !== "unknown" ? "clear" : "caution";
}

export function normalizeOpportunityBrief(
  candidate: ReleaseOpportunityCandidate,
  song: ReleaseOpportunitySongContext,
): ReleaseOpportunityBrief | null {
  const sourceUrl = normalizePublicUrl(candidate.sourceUrl);
  const targetName = cleanText(candidate.targetName, 240);
  const songCriteria = candidate.fit.songCriteria.map((item) => cleanText(item, 240)).filter(Boolean);
  const targetCriteria = candidate.fit.targetCriteria.map((item) => cleanText(item, 240)).filter(Boolean);
  const explanation = cleanText(candidate.fit.explanation, 2_000);
  if (!sourceUrl || !targetName || !explanation || !songCriteria.length || !targetCriteria.length) return null;
  if (candidate.opportunityType !== "playlist" && candidate.opportunityType !== "press") return null;
  if (!song.musicItemId || !song.title.trim()) return null;

  const publicContact = normalizePublicContact(candidate.publicContact);
  const normalizedCandidate: ReleaseOpportunityCandidate = {
    ...candidate,
    targetName,
    sourceUrl,
    ...(normalizePublicUrl(candidate.targetUrl ?? "") ? { targetUrl: normalizePublicUrl(candidate.targetUrl ?? "")! } : { targetUrl: undefined }),
    ...(publicContact ? { publicContact } : { publicContact: undefined }),
    fit: {
      ...candidate.fit,
      songCriteria,
      targetCriteria,
      explanation,
    },
    sourceEvidence: candidate.sourceEvidence
      .map((evidence) => ({
        ...evidence,
        ...(evidence.ref && normalizePublicUrl(evidence.ref) ? { ref: normalizePublicUrl(evidence.ref)! } : {}),
      }))
      .filter((evidence) => !evidence.ref || Boolean(normalizePublicUrl(evidence.ref))),
    limitations: candidate.limitations.map((item) => cleanText(item, 500)).filter(Boolean),
    ...(candidate.requirements ? { requirements: candidate.requirements.map((item) => cleanText(item, 500)).filter(Boolean) } : {}),
  };
  const safetyState = classifyOpportunitySafety(normalizedCandidate);
  const actionable = Boolean(publicContact) && safetyState !== "excluded";
  const status: ReleaseOpportunityBrief["status"] = safetyState === "excluded"
    ? "skipped"
    : actionable
      ? "shortlisted"
      : "watch";

  return {
    ...normalizedCandidate,
    dedupeKey: `${candidate.opportunityType}:${sourceUrl.toLowerCase()}`,
    safetyState,
    status,
  };
}

function normalizePublicContact(contact: ReleaseOpportunityCandidate["publicContact"]): ReleaseOpportunityCandidate["publicContact"] | undefined {
  if (!contact) return undefined;
  const sourceUrl = normalizePublicUrl(contact.sourceUrl);
  const verifiedAt = validIsoDate(contact.verifiedAt);
  if (!sourceUrl || !verifiedAt) return undefined;

  if (contact.kind === "email") {
    const value = normalizePublicEmail(contact.value);
    return value ? { kind: "email", value, sourceUrl, verifiedAt } : undefined;
  }

  const value = normalizePublicUrl(contact.value);
  return value ? { kind: contact.kind, value, sourceUrl, verifiedAt } : undefined;
}

function verifiedPublicContact(contact: ReleaseOpportunityCandidate["publicContact"]): boolean {
  return Boolean(normalizePublicContact(contact));
}

function opportunityRank(candidate: ReleaseOpportunityCandidate): number {
  const contact = verifiedPublicContact(candidate.publicContact) ? 4 : 0;
  const evidence = Math.min(candidate.sourceEvidence.length, 4);
  return contact + CONFIDENCE_WEIGHT[candidate.confidence] + evidence;
}

function validIsoDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : value;
}

function cleanText(value: string, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
