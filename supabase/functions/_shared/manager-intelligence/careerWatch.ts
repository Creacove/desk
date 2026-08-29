export type CareerWatchProfile = {
  artistName: string;
  homeMarket?: string | null;
  genres?: string[] | null;
  currentGoal?: string | null;
  artistDirection?: string | null;
  socialHandles?: Record<string, string> | null;
};

export type CareerWatchFinding = {
  title?: string;
  url?: string;
  sourceDomain?: string;
  publishedAt?: string;
  opportunityType?: "playlist" | "press" | "collaboration" | "live" | "brand" | "sync" | "market" | "audience" | "cultural_moment" | "risk" | "other";
  subjectName?: string;
  claim?: string;
  whyItMatters?: string;
  fitReason?: string;
  recommendedDecision?: "act" | "watch" | "ignore";
  urgency?: "now" | "soon" | "later";
  confidence?: "high" | "medium" | "low";
  missionObjective?: string;
  nextMove?: string;
  riskOrLimitation?: string;
};

export type CareerWatchOutput = { findings?: CareerWatchFinding[] };

export function buildCareerWatchInstructions() {
  return [
    "You are Desk Career Watch. Search the outside world for developments that can materially change what the artist's Manager should do next.",
    "This is not a news feed. Return only management-relevant opportunities, changes, risks, or market signals that deserve an act, watch, or ignore decision for this specific artist.",
    "Look for current playlist/editorial opportunities, press angles, collaboration openings, live opportunities, brand/sync/partnership fit, market openings, audience/community moments, cultural/trend relevance, and public risks.",
    "Every finding must have a specific URL and a concise factual claim. Prefer primary or authoritative sources and recent evidence.",
    "Tie every finding to the supplied artist knowledge: current goal, direction, identity/meaning, active work, markets, and known constraints. A generic industry development with no artist-specific consequence should be omitted.",
    "Do not infer private analytics, revenue, conversion, rights clearance, legal certainty, deal availability, playlist acceptance, or relationship access from public web evidence.",
    "Choose recommendedDecision=act only when the evidence is specific enough that a manager should change work now. Use watch when promising but not yet actionable. Use ignore when a surfaced development is relevant enough to record but should not change work.",
    "For act findings, propose one bounded missionObjective and nextMove. Do not create tasks or contact anyone. External actions still require the normal Manager decision and permission path.",
    "Avoid hype. State uncertainty and limitations explicitly.",
  ].join("\n");
}

export function buildCareerWatchRequest(profile: CareerWatchProfile, managerKnowledge: unknown) {
  const handles = Object.entries(profile.socialHandles ?? {}).filter(([, value]) => Boolean(value?.trim())).map(([key, value]) => `${key}: ${value}`).join(", ");
  return {
    model: "gpt-5-mini",
    instructions: buildCareerWatchInstructions(),
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: [
      `Artist: ${profile.artistName}`,
      profile.homeMarket ? `Home market: ${profile.homeMarket}` : "",
      profile.genres?.length ? `Genres: ${profile.genres.join(", ")}` : "",
      profile.currentGoal ? `Current goal: ${profile.currentGoal}` : "",
      profile.artistDirection ? `Artist direction: ${profile.artistDirection}` : "",
      handles ? `Known handles: ${handles}` : "",
      `Current Manager knowledge: ${JSON.stringify(managerKnowledge ?? {}).slice(0, 14000)}`,
      "Search for developments from the recent public web that could change management work now or soon. Return JSON with a findings array. Every finding must include a URL, an artist-specific fit reason, a decision, urgency, confidence, and limitation.",
    ].filter(Boolean).join("\n"),
  };
}

export function normalizeCareerWatchOutput(input: {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  artistName: string;
  output: CareerWatchOutput;
  createdFromRunId?: string | null;
}) {
  return (input.output.findings ?? [])
    .filter((finding) => typeof finding.url === "string" && /^https?:\/\//i.test(finding.url.trim()))
    .filter((finding) => ["act", "watch", "ignore"].includes(String(finding.recommendedDecision ?? "")))
    .slice(0, 16)
    .map((finding) => {
      const url = finding.url!.trim();
      const opportunityType = slug(finding.opportunityType || "other");
      const decision = String(finding.recommendedDecision ?? "watch");
      return {
        account_id: input.accountId,
        artist_workspace_id: input.artistWorkspaceId,
        artist_id: input.artistId,
        source: "public_web",
        source_kind: "career_watch",
        evidence_type: "manager_career_watch",
        subject_type: "artist",
        subject_id: null,
        subject_label: finding.subjectName?.trim() || input.artistName,
        time_window_start: null,
        time_window_end: normalizeDate(finding.publishedAt),
        metric_name: `career_watch_${opportunityType}`,
        metric_value: null,
        metric_unit: null,
        lens: `career_watch ${opportunityType} ${decision}`,
        freshness: finding.publishedAt ? `Published ${finding.publishedAt}` : "Current public web finding",
        confidence: finding.confidence || "low",
        provenance: finding.sourceDomain || domainFromUrl(url),
        limitation: finding.riskOrLimitation?.trim() || "Public evidence only; Desk has not verified private availability, acceptance, rights, economics, conversion, or relationship access.",
        raw_ref: url,
        created_from_run_id: input.createdFromRunId ?? null,
        metadata: {
          title: finding.title ?? "",
          claim: finding.claim ?? "",
          why_it_matters: finding.whyItMatters ?? "",
          fit_reason: finding.fitReason ?? "",
          recommended_decision: decision,
          urgency: finding.urgency ?? "later",
          opportunity_type: opportunityType,
          mission_objective: decision === "act" ? finding.missionObjective ?? "" : "",
          next_move: decision === "act" ? finding.nextMove ?? "" : "",
          risk_or_limitation: finding.riskOrLimitation ?? "",
        },
      };
    });
}

function normalizeDate(value?: string) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function domainFromUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "other";
}
