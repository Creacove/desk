export type PublicWebContextProfile = {
  artistName: string;
  homeMarket?: string | null;
  genres?: string[] | null;
  socialHandles?: Record<string, string> | null;
};

export type PublicWebContextFinding = {
  title?: string;
  url?: string;
  sourceDomain?: string;
  publishedAt?: string;
  contextType?: string;
  claim?: string;
  managementUse?: string;
  strategyFields?: {
    publicNarrative?: string;
    artistIdentityClues?: string[];
    collaborationClues?: string[];
    marketClues?: string[];
    riskClues?: string[];
    missionImplications?: string[];
  };
};

export type PublicWebContextOutput = {
  findings?: PublicWebContextFinding[];
};

export type NormalizePublicWebContextInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  artistName: string;
  output: PublicWebContextOutput;
  createdFromRunId?: string | null;
};

export function buildPublicWebContextInstructions() {
  return [
    "Collect sourced public career context for an artist operating packet.",
    "Extract only information that changes management strategy: public narrative, project reception, artist identity, collaborators, cultural positioning, fan discourse, reputation risks, market openings, partnership opportunities, and mission implications.",
    "Return only facts that have a URL. Prefer recent press, interviews, project reviews, fan discourse, recent releases, collaborator mentions, label/imprint changes, recent performances, awards or nominations, announcements, live dates, brand/sync/deal context, notable public social/web moments, public disputes, and public risk context.",
    "Never treat public web context as private analytics, legal proof, revenue proof, ROI proof, conversion proof, rights certainty, or source-of-stream proof.",
    "Each finding must include title, URL, source domain, published date when available, context type, the public claim, how a manager may use it, and strategyFields for public narrative, artist identity clues, collaboration clues, market clues, risk clues, and mission implications.",
    "Do not feed long web summaries to mission generation. Feed distilled strategy.",
    "Do not include rumors, unsourced claims, private personal details, or claims that cannot be connected to a specific URL.",
  ].join("\n");
}

export function buildPublicWebContextRequest(profile: PublicWebContextProfile) {
  const handles = Object.entries(profile.socialHandles ?? {})
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  return {
    model: "gpt-5-mini",
    instructions: buildPublicWebContextInstructions(),
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: [
      `Artist: ${profile.artistName}`,
      profile.homeMarket ? `Home market: ${profile.homeMarket}` : "",
      profile.genres?.length ? `Genres: ${profile.genres.join(", ")}` : "",
      handles ? `Known handles: ${handles}` : "",
      "Search recent public career context: press, interviews, project reviews, fan discourse, recent releases, collaborator mentions, label/imprint changes, public reputation, recent performances, brand deals, awards or nominations, cultural positioning, market-specific context, sync, partnership, public risk, and major public web/social moments.",
      "Extract strategy, not a news summary. Return management-relevant findings plus strategy fields named artist_identity_clues, collaboration_clues, market_clues, risk_clues, and mission_implications.",
      "Do not infer private analytics, saves, follows, source-of-stream, revenue, legal certainty, ROI, or conversion.",
      "Return JSON with a findings array. Every finding must have a URL and strategyFields object.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function normalizePublicWebContextOutput(input: NormalizePublicWebContextInput) {
  return (input.output.findings ?? [])
    .filter((finding) => typeof finding.url === "string" && /^https?:\/\//i.test(finding.url.trim()))
    .slice(0, 12)
    .map((finding) => {
      const url = finding.url!.trim();
      const contextType = slug(finding.contextType || "public_context");
      return {
        account_id: input.accountId,
        artist_workspace_id: input.artistWorkspaceId,
        artist_id: input.artistId,
        source: "public_web",
        source_kind: "public_web",
        evidence_type: "public_career_context",
        subject_type: "artist",
        subject_id: null,
        subject_label: input.artistName,
        time_window_start: null,
        time_window_end: normalizeDate(finding.publishedAt),
        metric_name: `public_context_${contextType}`,
        metric_value: null,
        metric_unit: null,
        lens: `public_context ${contextType}`,
        freshness: finding.publishedAt ? `Published ${finding.publishedAt}` : "Public web result",
        confidence: "low",
        provenance: finding.sourceDomain || domainFromUrl(url),
        limitation: "Public web context only; not private analytics, legal proof, revenue proof, ROI proof, conversion proof, rights certainty, or source-of-stream proof.",
        raw_ref: url,
        created_from_run_id: input.createdFromRunId ?? null,
        metadata: {
          title: finding.title ?? "",
          claim: finding.claim ?? "",
          management_use: finding.managementUse ?? "",
          public_narrative: finding.strategyFields?.publicNarrative ?? "",
          artist_identity_clues: stringArray(finding.strategyFields?.artistIdentityClues),
          collaboration_clues: stringArray(finding.strategyFields?.collaborationClues),
          market_clues: stringArray(finding.strategyFields?.marketClues),
          risk_clues: stringArray(finding.strategyFields?.riskClues),
          mission_implications: stringArray(finding.strategyFields?.missionImplications),
        },
      };
    });
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 8) : [];
}

function normalizeDate(value?: string) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "public_context";
}
