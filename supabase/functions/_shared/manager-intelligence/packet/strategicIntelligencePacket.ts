import { interpretChartmetricKpis } from "../profile/kpiInterpreter.ts";
import { routePlaybooks } from "../playbooks/playbookRouter.ts";
import { classifyEvidenceSignal } from "../signals/signalClassifier.ts";
import type { ChartmetricKpiInput, EvidenceLike, ManagerSignalType } from "../types.ts";

type ProfileInput = {
  display_name?: string | null;
  stage?: string | null;
  home_market?: string | null;
  genres?: string[] | null;
  current_goal?: string | null;
  artist_direction?: string | null;
};

type MusicInput = {
  id: string;
  title: string;
  released_at?: string | null;
  lifecycle_stage?: string | null;
};

type EvidenceRow = EvidenceLike & {
  id: string;
  metric_unit?: string | null;
};

type ClassifiedSignalRow = ReturnType<typeof signalRows>[number];

type OperatingDomainRead = {
  domain: string;
  pattern_key: string;
  pattern: string;
  signal_types: ManagerSignalType[];
  read: string;
  next_move: string;
  avoid: string;
  checkpoint_hint: string;
  permission_boundary: string;
  confidence_level: "Medium" | "Low";
  evidence_ids: string[];
};

type CareerConditionRead = {
  condition_key: string;
  label: string;
  why_it_matters: string;
  evidence_ids: string[];
  best_mission_families: string[];
  bad_mission_families: string[];
  possible_missions: string[];
};

export type BuildManagerIntelligencePacketInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  packetType: "setup" | "daily" | "manual_refresh" | "campaign";
  profile: ProfileInput;
  musicItems: MusicInput[];
  musicProjects: MusicInput[];
  evidenceRows: EvidenceRow[];
  createdFromRunId?: string | null;
};

const titleCaseSignal = (signalType: ManagerSignalType) =>
  signalType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const readNumberMetric = (rows: EvidenceRow[], names: string[]) => {
  const row = rows.find((candidate) => {
    const metricName = (candidate.metric_name ?? "").toLowerCase();
    return names.some((name) => metricName === name || metricName.includes(name));
  });
  return typeof row?.metric_value === "number" ? row.metric_value : null;
};

const extractKpis = (rows: EvidenceRow[], profile: ProfileInput): ChartmetricKpiInput => {
  const cityAffinity = rows
    .filter((row) => (row.metric_name ?? "").toLowerCase().includes("city_affinity"))
    .map((row) => ({
      city: cityFromMetric(row.metric_name) ?? row.subject_label ?? "Unknown city",
      score: typeof row.metric_value === "number" ? row.metric_value : null,
      listenerCount: null,
    }));
  const trackRows = rows.filter((row) => row.subject_type === "music_item" && row.subject_id);
  const trackIds = [...new Set(trackRows.map((row) => row.subject_id).filter((id): id is string => Boolean(id)))];
  const trackScores = trackIds.flatMap((musicItemId) => {
    const scopedRows = trackRows.filter((row) => row.subject_id === musicItemId);
    const chartmetricTrackScore = readNumberMetric(scopedRows, ["chartmetric_track_score", "track_score"]);
    const spotifyPopularity = readNumberMetric(scopedRows, ["spotify_popularity", "spotify_popularity_latest"]);
    if (chartmetricTrackScore === null && spotifyPopularity === null) return [];
    const trackName = scopedRows.find((row) => row.subject_label)?.subject_label ?? musicItemId;
    return [{
      musicItemId,
      trackName,
      chartmetricTrackScore,
      spotifyPopularity,
      evidenceIds: scopedRows
        .filter((row) => {
          const metricName = (row.metric_name ?? "").toLowerCase();
          return metricName.includes("track_score") || metricName.includes("spotify_popularity");
        })
        .map((row) => row.id),
    }];
  });

  return {
    artistScore: {
      value: readNumberMetric(rows, ["chartmetric_artist_score", "artist_score"]),
      direction: "unknown",
    },
    artistRank: {
      value: readNumberMetric(rows, ["chartmetric_artist_rank", "artist_rank"]),
      direction: "unknown",
    },
    careerStage: profile.stage ?? null,
    momentum: "unknown",
    fanBaseRank: readNumberMetric(rows, ["fan_base_rank", "fanbase_rank"]),
    engagementRank: readNumberMetric(rows, ["engagement_rank"]),
    cityAffinity,
    genreTags: profile.genres ?? [],
    trackScores,
  };
};

const cityFromMetric = (metricName?: string | null) => {
  if (!metricName) return null;
  const suffix = metricName.replace(/^city_affinity_?/i, "").replace(/_/g, " ").trim();
  if (!suffix) return null;
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
};

const signalRows = (rows: EvidenceRow[]) =>
  rows.map((row) => {
    const classified = classifyEvidenceSignal(row);
    return {
      row,
      classified,
    };
  });

const selectPrimaryAsset = (musicItems: MusicInput[], rows: EvidenceRow[]) => {
  const scores = new Map<string, number>();
  for (const row of rows) {
    if (row.subject_type !== "music_item" || !row.subject_id) continue;
    const classified = classifyEvidenceSignal(row);
    const value = classified.evidenceStrength === "High" ? 3 : classified.evidenceStrength === "Medium" ? 2 : 1;
    scores.set(row.subject_id, (scores.get(row.subject_id) ?? 0) + value);
  }

  const [assetId] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return musicItems.find((item) => item.id === assetId) ?? musicItems[0] ?? null;
};

const supportingEvidence = (rows: EvidenceRow[]) =>
  rows.map((row) => ({
    id: row.id,
    metric: row.metric_name ?? row.evidence_type ?? "evidence",
    value: row.metric_value ?? "",
    source: row.source ?? row.source_kind ?? "saved intelligence",
    raw_ref: row.raw_ref ?? "",
    interpretation: classifyEvidenceSignal(row).reason,
  }));

const primaryMarketName = (profile: ProfileInput, cityReads: Array<{ city: string }>) =>
  cityReads[0]?.city ?? profile.home_market ?? "the strongest available market";

const evidenceText = (row: EvidenceRow) =>
  [
    row.source,
    row.source_kind,
    row.evidence_type,
    row.metric_name,
    row.lens,
    row.subject_label,
    row.provenance,
    row.raw_ref,
    row.limitation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const evidenceIdsFor = (rows: ClassifiedSignalRow[], predicate: (item: ClassifiedSignalRow) => boolean) =>
  rows.filter(predicate).map(({ row }) => row.id);

const publicContextRows = (rows: EvidenceRow[]) =>
  rows
    .filter((row) => {
      const text = evidenceText(row);
      return row.source === "public_web" || row.source_kind === "public_web" || text.includes("public_context") || Boolean(row.raw_ref?.startsWith("http"));
    })
    .map((row) => {
      const url = row.raw_ref?.startsWith("http") ? row.raw_ref : "";
      return {
        evidence_id: row.id,
        title: row.subject_label ?? row.metric_name ?? "Public context",
        url,
        source_domain: row.provenance ?? domainFromUrl(url),
        context_type: row.metric_name ?? row.evidence_type ?? "public_context",
        claim: row.subject_label ?? row.metric_name ?? "Public career context is available.",
        management_use: classifyEvidenceSignal(row).reason,
        confidence: "Low",
        limitation: row.limitation ?? "Public web context; not private analytics, legal proof, revenue proof, ROI proof, or conversion proof.",
      };
    });

const domainFromUrl = (url: string) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
};

const buildDomainReads = ({
  artistName,
  strongestAssetName,
  marketName,
  classifiedSignals,
  profile,
  hasEvidence,
  firstEvidenceId,
}: {
  artistName: string;
  strongestAssetName: string;
  marketName: string;
  classifiedSignals: ClassifiedSignalRow[];
  profile: ProfileInput;
  hasEvidence: boolean;
  firstEvidenceId: string;
}): OperatingDomainRead[] => {
  const signalTypes = new Set(classifiedSignals.map(({ classified }) => classified.signalType));
  const hasText = (needles: string[]) => classifiedSignals.some(({ row }) => needles.some((needle) => evidenceText(row).includes(needle)));
  const profileDirection = [profile.current_goal, profile.artist_direction].filter(Boolean).join(" ");
  const reads: OperatingDomainRead[] = [];
  const add = (read: OperatingDomainRead) => {
    if (reads.some((existing) => existing.domain === read.domain && existing.pattern_key === read.pattern_key)) return;
    reads.push(read);
  };

  if (profileDirection || signalTypes.has("career_architecture") || hasText(["career direction", "north star", "long-term", "do-not-do"])) {
    add({
      domain: "Career Architecture",
      pattern_key: "career_north_star",
      pattern: "Career Architecture / North Star",
      signal_types: ["career_architecture"],
      read: profileDirection
        ? `${artistName} has a stated direction that should guide the next operating decisions: ${profileDirection}.`
        : `${artistName} needs a clearer career thesis before the team turns signals into work.`,
      next_move: "Turn the artist direction into a small set of do-this and do-not-do rules before creating distracting work.",
      avoid: "Do not let one platform spike replace the artist's career thesis.",
      checkpoint_hint: "The thesis must be specific enough to decide which opportunities to accept, defer, or reject.",
      permission_boundary: "Public positioning changes and sensitive strategy shifts need approval.",
      confidence_level: profileDirection || hasEvidence ? "Medium" : "Low",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "career_architecture").slice(0, 3),
    });
  }

  if (signalTypes.has("positioning") || signalTypes.has("public_context") || hasText(["positioning", "narrative", "story", "interview", "artist world"])) {
    add({
      domain: "Artist Positioning And Narrative",
      pattern_key: "artist_positioning",
      pattern: "Artist Positioning",
      signal_types: ["positioning", "public_context"],
      read: `${artistName}'s public context should shape the artist story before the team chooses outward-facing moves.`,
      next_move: "Convert the strongest public context into an approved positioning thesis and reject off-story opportunities.",
      avoid: "Do not use generic campaign language when the artist's public story is the real lever.",
      checkpoint_hint: "The story must travel without flattening the artist or contradicting public context.",
      permission_boundary: "Public copy, brand commitments, and sensitive narrative changes need approval.",
      confidence_level: "Medium",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified, row }) => classified.signalType === "positioning" || classified.signalType === "public_context" || evidenceText(row).includes("interview")).slice(0, 4),
    });
  }

  if (signalTypes.has("attention") || signalTypes.has("discovery")) {
    const evidenceIds = evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "attention" || classified.signalType === "discovery").slice(0, 4);
    add({
      domain: "Audience And Fan Development",
      pattern_key: "creator_content_validation",
      pattern: "Creator / Content Validation",
      signal_types: ["attention", "discovery"],
      read: `${strongestAssetName} has public attention or discovery pressure, but that should be validated before the team scales it.`,
      next_move: `Test whether ${strongestAssetName} attention is repeatable through creator fit, comments, Shazams, market response, or other available public proof.`,
      avoid: "Do not treat public attention as durable fandom or spend justification by itself.",
      checkpoint_hint: "The content angle must earn a continue, change, pause, or scale decision from available response signals.",
      permission_boundary: "Spend, creator outreach, public posts, and external commitments need approval.",
      confidence_level: evidenceIds.length ? "Medium" : "Low",
      evidence_ids: evidenceIds,
    });
  }

  if (signalTypes.has("market")) {
    add({
      domain: "Market Expansion",
      pattern_key: "city_live_market_validation",
      pattern: "City / Live-Market Validation",
      signal_types: ["market"],
      read: `${marketName} is the clearest available market signal for ${artistName}.`,
      next_move: `Validate ${marketName} as a real market lane before treating the signal as global demand.`,
      avoid: "Do not flatten one city or country signal into a global expansion assumption.",
      checkpoint_hint: "Market concentration must show repeatable listener, content, Shazam, comment, or live-demand proof.",
      permission_boundary: "Booking outreach, local spend, and public market commitments need approval.",
      confidence_level: "Medium",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "market").slice(0, 4),
    });
  }

  if (signalTypes.has("live")) {
    add({
      domain: "Market Expansion",
      pattern_key: "city_live_market_validation",
      pattern: "City / Live-Market Validation",
      signal_types: ["live"],
      read: `${artistName} has live-demand context that needs a low-risk validation path.`,
      next_move: "Map the live proof, cost, and owner before any booking outreach.",
      avoid: "Do not create booking commitments before live risk is understood.",
      checkpoint_hint: "Live risk must be acceptable before external booking or promoter outreach.",
      permission_boundary: "Booking outreach, deposits, local spend, and promoter commitments need approval.",
      confidence_level: "Medium",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "live").slice(0, 4),
    });
  }

  if (signalTypes.has("sync_deal") || hasText(["sync", "brand", "partnership", "license", "sponsorship"])) {
    add({
      domain: "Partnerships, Brand, Sync, And Deals",
      pattern_key: "sync_deal_readiness",
      pattern: "Sync / Deal Readiness",
      signal_types: ["sync_deal"],
      read: `${artistName} has a partnership, brand, sync, or deal-readiness signal that should be checked before outreach.`,
      next_move: `Confirm fit, clean assets, and rights for ${strongestAssetName} before any external pitch.`,
      avoid: "Do not let an attractive opportunity outrun rights, artist fit, or pitch quality.",
      checkpoint_hint: "The opportunity must be rights-safe, artist-aligned, and credible enough to send.",
      permission_boundary: "External pitches, deal negotiation, and legal or finance conclusions need approval.",
      confidence_level: "Medium",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "sync_deal").slice(0, 4),
    });
  }

  if (signalTypes.has("rights_business") || signalTypes.has("risk") || hasText(["rights", "split", "ownership", "metadata", "royalty", "finance", "blocker"])) {
    add({
      domain: "Rights, Finance, And Business Affairs",
      pattern_key: "rights_cleanup",
      pattern: "Rights Cleanup",
      signal_types: ["rights_business", "risk"],
      read: `${artistName} has rights, ownership, finance, or readiness risk that should slow external action.`,
      next_move: `Resolve the rights or business blocker before ${strongestAssetName} is pitched, released, monetized, or externally committed.`,
      avoid: "Do not make legal, finance, ownership, or revenue claims without uploaded/source-backed proof and human review.",
      checkpoint_hint: "Required documents or finance proof must be uploaded before the Manager raises confidence.",
      permission_boundary: "Legal, finance, rights, and deal conclusions require human approval.",
      confidence_level: "Medium",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "rights_business" || classified.signalType === "risk").slice(0, 4),
    });
  }

  if (signalTypes.has("team_operations")) {
    add({
      domain: "Team, Operations, And Capacity",
      pattern_key: "team_operations",
      pattern: "Team Operations",
      signal_types: ["team_operations"],
      read: `${artistName}'s next work needs clearer ownership, capacity, or approval flow.`,
      next_move: "Assign the owner and approval path before creating more active work.",
      avoid: "Do not create more tasks when no one owns the operating path.",
      checkpoint_hint: "Every active task must have an accountable owner and approval route.",
      permission_boundary: "Sensitive role changes and process changes tied to commitments need approval.",
      confidence_level: "Medium",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "team_operations").slice(0, 4),
    });
  }

  if (signalTypes.has("reputation_wellbeing")) {
    add({
      domain: "Reputation, Crisis, And Wellbeing",
      pattern_key: "reputation_wellbeing",
      pattern: "Reputation / Crisis / Wellbeing",
      signal_types: ["reputation_wellbeing"],
      read: `${artistName} has sensitive public, reputation, or wellbeing context that should protect the artist before action.`,
      next_move: "Pause risky outward moves until the facts, approvals, and human review path are clear.",
      avoid: "Do not turn sensitive context into public action without explicit approval.",
      checkpoint_hint: "The next public or sensitive step must be safe for the artist and long-term leverage.",
      permission_boundary: "Public response, legal-sensitive action, and reputation-sensitive action need approval.",
      confidence_level: "Medium",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "reputation_wellbeing").slice(0, 4),
    });
  }

  if (signalTypes.has("catalog")) {
    add({
      domain: "A&R And Creative Development",
      pattern_key: "focus_asset_selection",
      pattern: "A&R / Focus Asset Selection",
      signal_types: ["catalog"],
      read: `${artistName}'s catalog shape can guide which asset should lead the next management decision.`,
      next_move: "Compare the current assets by role, evidence, and artist direction before choosing a focus.",
      avoid: "Do not push the strongest-looking song without explaining its role in the artist system.",
      checkpoint_hint: "One focus asset must have a clear role, evidence base, and creative rationale.",
      permission_boundary: "Public release decisions, external pitching, and spend need approval.",
      confidence_level: "Medium",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "catalog").slice(0, 4),
    });
  }

  if (signalTypes.has("public_context")) {
    add({
      domain: "Public Career Context",
      pattern_key: "artist_positioning",
      pattern: "Artist Positioning",
      signal_types: ["public_context"],
      read: `${artistName}'s public web context adds career context but cannot prove private performance.`,
      next_move: "Use public context to sharpen positioning, timing, and risk questions while preserving source limits.",
      avoid: "Do not treat public articles, listings, or social web context as private analytics, legal proof, revenue proof, ROI proof, or conversion proof.",
      checkpoint_hint: "Public context must be cited and limited before it shapes visible recommendations.",
      permission_boundary: "Public-facing claims and sensitive context need approval.",
      confidence_level: "Low",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "public_context").slice(0, 4),
    });
  }

  if (!reads.length) {
    add({
      domain: "Career Architecture",
      pattern_key: "career_north_star",
      pattern: "Career Architecture / North Star",
      signal_types: [],
      read: `${artistName} needs a first operating thesis before the system creates durable work.`,
      next_move: "Clarify the artist's next leverage point from profile, catalog, market, and memory before creating missions.",
      avoid: "Do not create generic promotion work from thin evidence.",
      checkpoint_hint: "The next mission should only exist when the objective is artist-specific and reviewable.",
      permission_boundary: "Public positioning changes and sensitive strategy shifts need approval.",
      confidence_level: hasEvidence ? "Medium" : "Low",
      evidence_ids: firstEvidenceId ? [firstEvidenceId] : [],
    });
  }

  if (hasEvidence) {
    add({
      domain: "Data Sovereignty And Intelligence",
      pattern_key: "data_source_completeness",
      pattern: "Data / Source Completeness",
      signal_types: [],
      read: "Source confidence should be named only where it changes the decision.",
      next_move: "Mark the specific claim limits that affect the next decision; do not make source upload the default mission.",
      avoid: "Do not create default private-analytics upload work when another management domain is already actionable.",
      checkpoint_hint: "A source request should unlock a specific blocked claim or decision.",
      permission_boundary: "Source connections and file uploads stay user-controlled.",
      confidence_level: "Low",
      evidence_ids: firstEvidenceId ? [firstEvidenceId] : [],
    });
  }

  return reads.map((read) => ({
    ...read,
    evidence_ids: read.evidence_ids.length ? read.evidence_ids : firstEvidenceId ? [firstEvidenceId] : [],
  }));
};

const domainReadToMissionCandidate = (read: OperatingDomainRead) => ({
  domain: read.domain,
  pattern_key: read.pattern_key,
  pattern: read.pattern,
  direction: read.next_move,
  checkpoint_hint: read.checkpoint_hint,
  permission_boundary: read.permission_boundary,
  confidence_level: read.confidence_level,
  evidence_ids: read.evidence_ids,
});

const buildCareerConditionDiagnosis = ({
  artistName,
  strongestAssetName,
  classifiedSignals,
  profile,
  firstEvidenceId,
}: {
  artistName: string;
  strongestAssetName: string;
  classifiedSignals: ClassifiedSignalRow[];
  profile: ProfileInput;
  firstEvidenceId: string;
}) => {
  const signalTypes = new Set(classifiedSignals.map(({ classified }) => classified.signalType));
  const hasText = (needles: string[]) => classifiedSignals.some(({ row }) => needles.some((needle) => evidenceText(row).includes(needle)));
  const profileText = [profile.current_goal, profile.artist_direction, profile.home_market, ...(profile.genres ?? [])].filter(Boolean).join(" ").toLowerCase();
  const conditionMap = new Map<string, CareerConditionRead>();
  const idsForText = (needles: string[]) =>
    classifiedSignals
      .filter(({ row }) => needles.some((needle) => evidenceText(row).includes(needle)))
      .map(({ row }) => row.id)
      .slice(0, 4);
  const add = (condition: CareerConditionRead) => {
    if (conditionMap.has(condition.condition_key)) return;
    conditionMap.set(condition.condition_key, {
      ...condition,
      evidence_ids: condition.evidence_ids.length ? condition.evidence_ids : firstEvidenceId ? [firstEvidenceId] : [],
    });
  };

  if (hasText(["feature", "collaboration", "collaborator", "feat.", "feat ", "asake"]) || /\bfeature\b|collaboration|collaborator|asake/.test(profileText)) {
    add({
      condition_key: "feature_leverage_moment",
      label: "Feature leverage moment",
      why_it_matters: `${strongestAssetName} can raise ${artistName}'s artist-level perception if the work centers ${artistName}, but it should not become feature-led busywork.`,
      evidence_ids: idsForText(["feature", "collaboration", "collaborator", "feat.", "feat ", "asake"]),
      best_mission_families: ["Collaboration Strategy", "Artist Identity", "Catalog Song Asset", "PR Narrative"],
      bad_mission_families: ["Generic TikTok Conversion", "Smart URL Setup", "Highest-Track Push"],
      possible_missions: [
        "Turn the Asake feature into Blaqbonez-owned leverage",
        `Turn ${strongestAssetName} into ${artistName}-owned leverage`,
        `Build ${artistName}'s next collaborator map`,
        "Route feature attention into artist-level fan ownership",
      ],
    });
    add({
      condition_key: "feature_overshadowing_risk",
      label: "Feature overshadowing risk",
      why_it_matters: `The feature can grow while ${artistName}'s profile, catalog, or fan language stays flat.`,
      evidence_ids: idsForText(["feature", "collaboration", "overshadow", "asake"]),
      best_mission_families: ["Collaboration Strategy", "Artist Identity", "PR Narrative"],
      bad_mission_families: ["Generic TikTok Conversion", "Creator Pilot Without Artist Attachment"],
      possible_missions: [
        `Measure whether ${strongestAssetName} is building ${artistName}-level attachment`,
        "Reframe the feature around artist identity before scaling spend",
      ],
    });
  }

  if (signalTypes.has("public_context") || hasText(["identity", "personality", "humor", "confidence", "rap", "credibility", "mainstream crossover", "artist world"]) || /identity|personality|rap|crossover/.test(profileText)) {
    add({
      condition_key: "artist_identity_gap",
      label: "Artist identity gap",
      why_it_matters: `${artistName}'s public story must be clear before content, collaborators, or markets are allowed to define the artist by accident.`,
      evidence_ids: idsForText(["identity", "personality", "humor", "confidence", "rap", "credibility", "public_context", "mainstream crossover"]),
      best_mission_families: ["Artist Identity", "Career Direction", "PR Narrative"],
      bad_mission_families: ["Generic Creator Pilot", "Playlist-Save Busywork"],
      possible_missions: [
        `Define ${artistName}'s 90-day career position`,
        "Separate personality attention from music attachment",
        "Name the opportunities to accept, reject, delay, or pursue",
      ],
    });
  }

  if (signalTypes.has("attention") && !signalTypes.has("conversion")) {
    add({
      condition_key: "song_first_attention",
      label: "Song-first attention",
      why_it_matters: `${strongestAssetName} has visible attention, but the system must prove whether that attention is becoming artist-level attachment.`,
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "attention").slice(0, 4),
      best_mission_families: ["Fan Ownership", "Catalog Song Asset", "Marketing Validation"],
      bad_mission_families: ["Smart URL Setup", "Saves/Follows Push Without Conversion Proof"],
      possible_missions: [
        `Separate ${strongestAssetName} attention from ${artistName} attachment`,
        "Route attention into strongest catalog and owned fan language",
      ],
    });
  }

  if (signalTypes.has("market")) {
    add({
      condition_key: "market_opening",
      label: "Market opening",
      why_it_matters: `${profile.home_market ?? "The strongest market"} can be useful only if the team defines what kind of market proof matters next.`,
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "market").slice(0, 4),
      best_mission_families: ["Market Expansion", "Live Readiness", "PR Narrative"],
      bad_mission_families: ["Generic Global Push", "Country-Level Spend Without Proof"],
      possible_missions: [
        `Prepare ${profile.home_market ?? "the strongest market"} as a proof market`,
        "Build the next market relationship map",
      ],
    });
  }

  if (signalTypes.has("rights_business")) {
    add({
      condition_key: "rights_splits_risk",
      label: "Rights/splits risk",
      why_it_matters: "Rights, splits, ownership, or finance uncertainty should slow external commitments.",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "rights_business").slice(0, 4),
      best_mission_families: ["Rights/Finance", "Business Affairs"],
      bad_mission_families: ["External Pitch Before Rights Proof"],
      possible_missions: ["Clear rights and splits before external leverage"],
    });
  }

  if (signalTypes.has("team_operations")) {
    add({
      condition_key: "team_structure_gap",
      label: "Team structure gap",
      why_it_matters: "The team needs accountable ownership before more work is created.",
      evidence_ids: evidenceIdsFor(classifiedSignals, ({ classified }) => classified.signalType === "team_operations").slice(0, 4),
      best_mission_families: ["Team Ops"],
      bad_mission_families: ["More Tasks Without Owner"],
      possible_missions: ["Clarify owner, capacity, and approval flow"],
    });
  }

  const dominant = [...conditionMap.values()];
  if (!dominant.length) {
    add({
      condition_key: "career_direction_unclear",
      label: "Career direction unclear",
      why_it_matters: `${artistName} needs a first management thesis before work is created from scattered evidence.`,
      evidence_ids: firstEvidenceId ? [firstEvidenceId] : [],
      best_mission_families: ["Career Direction", "Artist Identity"],
      bad_mission_families: ["Generic Promotion", "Source Upload Busywork"],
      possible_missions: [`Define ${artistName}'s first career-management thesis`],
    });
  }

  return {
    dominant_conditions: [...conditionMap.values()].slice(0, 5),
    primary_career_condition: [...conditionMap.values()][0],
    wrong_defaults_to_avoid: [
      "generic creator pilot",
      "smart URL mission",
      "highest-track push",
      "TikTok conversion without career-condition proof",
      "playlist-save busywork",
    ],
  };
};

export const buildManagerIntelligencePacket = (input: BuildManagerIntelligencePacketInput) => {
  const artistName = input.profile.display_name ?? "the artist";
  const kpiProfile = interpretChartmetricKpis(extractKpis(input.evidenceRows, input.profile));
  const classifiedSignals = signalRows(input.evidenceRows);
  const signalTypes = [...new Set(classifiedSignals.map(({ classified }) => classified.signalType))];
  const primaryAsset = selectPrimaryAsset(input.musicItems, input.evidenceRows);
  const routing = routePlaybooks({
    careerStage: kpiProfile.careerStage.interpretedStage,
    signalTypes,
    strongestSignal: signalTypes.join(", "),
    biggestRisk: kpiProfile.fanbaseVsEngagement.read,
    marketShape: input.profile.home_market ?? "",
    catalogShape: primaryAsset ? "Song-first spike" : "artist-level read",
    hasRightsOrDealRisk: classifiedSignals.some(({ classified }) => classified.signalType === "risk" || classified.signalType === "rights_business" || classified.signalType === "sync_deal"),
  });

  const firstEvidenceId = input.evidenceRows[0]?.id ?? "";
  const strongestAssetName = primaryAsset?.title ?? artistName;
  const attentionLed = signalTypes.includes("attention");
  const discoveryLed = signalTypes.includes("discovery");
  const marketLed = signalTypes.includes("market");
  const conversionLed = signalTypes.includes("conversion");
  const marketName = primaryMarketName(input.profile, kpiProfile.cityAffinityReads);
  const domainReads = buildDomainReads({
    artistName,
    strongestAssetName,
    marketName,
    classifiedSignals,
    profile: input.profile,
    hasEvidence: input.evidenceRows.length > 0,
    firstEvidenceId,
  });
  const missionCandidates = domainReads.map(domainReadToMissionCandidate);
  const careerConditionDiagnosis = buildCareerConditionDiagnosis({
    artistName,
    strongestAssetName,
    classifiedSignals,
    profile: input.profile,
    firstEvidenceId,
  });
  const missionImplications = careerConditionDiagnosis.dominant_conditions.map((condition) => ({
    career_condition: condition.condition_key,
    why_it_matters: condition.why_it_matters,
    best_mission_families: condition.best_mission_families,
    bad_mission_families: condition.bad_mission_families,
    possible_missions: condition.possible_missions,
    evidence_ids: condition.evidence_ids,
  }));
  const primaryDomainRead = domainReads[0];
  const operatingPriority = conversionLed
    ? "conversion proof"
    : attentionLed || discoveryLed
      ? "attention validation"
      : primaryDomainRead?.pattern_key === "data_source_completeness"
        ? "source confidence"
        : primaryDomainRead?.domain ?? "career architecture";
  const publicContext = publicContextRows(input.evidenceRows);
  const includePrivateSourceGuardrails = !attentionLed || conversionLed || publicContext.length > 0 || signalTypes.some((signalType) =>
    ["rights_business", "sync_deal", "team_operations", "reputation_wellbeing", "public_context"].includes(signalType)
  );
  const confidenceReason = [
    conversionLed ? "conversion proof is available" : null,
    attentionLed ? "attention is visible but not treated as conversion" : null,
    discoveryLed ? "discovery intent is present" : null,
    marketLed ? "market signal is available" : null,
    primaryDomainRead ? `${primaryDomainRead.domain.toLowerCase()} is in view` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    packet_date: new Date().toISOString().slice(0, 10),
    packet_type: input.packetType,
    status: "completed",
    profile_projection_json: {
      artist_name: artistName,
      home_market: input.profile.home_market ?? null,
      genres: input.profile.genres ?? [],
      current_goal: input.profile.current_goal ?? input.profile.artist_direction ?? null,
      kpi_profile: kpiProfile,
    },
    signal_snapshot_json: {
      signal_count: classifiedSignals.length,
      signal_types: signalTypes,
      selected_asset_id: primaryAsset?.id ?? null,
    },
    data_freshness_json: {
      status: input.evidenceRows.length > 0 ? "Partial" : "Unknown",
      reason: input.evidenceRows.length > 0 ? "Current saved evidence is available for the read." : "No evidence rows were available.",
      missing_critical_fields: [],
    },
    executive_read_json: {
      priority: primaryDomainRead?.next_move ?? `Clarify the next management priority for ${artistName}`,
      manager_read:
        input.evidenceRows.length > 0
          ? `${artistName} has a ${kpiProfile.careerStage.interpretedStage.toLowerCase()} operating read across ${domainReads.map((read) => read.domain).slice(0, 4).join(", ") || signalTypes.join(", ")}.`
          : `${artistName} needs more source evidence before the Manager can raise confidence.`,
      confidence_level: confidenceReason ? "Medium" : "Low",
      confidence_reason: confidenceReason || "The read is limited because evidence is thin.",
    },
    strategic_diagnosis_json: {
      career_stage: kpiProfile.careerStage.interpretedStage,
      platform_shape: attentionLed ? "attention-led" : "incomplete",
      market_shape: marketLed ? input.profile.home_market ?? "market signal present" : "unknown",
      catalog_shape: primaryAsset ? "song-led" : "artist-level",
      strongest_signal: signalTypes[0] ?? "unknown",
      biggest_risk: primaryDomainRead?.avoid ?? kpiProfile.fanbaseVsEngagement.read,
      current_priority: operatingPriority,
      dominant_conditions: careerConditionDiagnosis.dominant_conditions,
      primary_career_condition: careerConditionDiagnosis.primary_career_condition,
      wrong_defaults_to_avoid: careerConditionDiagnosis.wrong_defaults_to_avoid,
    },
    kpi_read_json: kpiProfile,
    signal_map_json: classifiedSignals.map(({ row, classified }, index) => ({
      signal_id: `signal_${index + 1}`,
      signal_type: titleCaseSignal(classified.signalType),
      asset: row.subject_type ?? "artist",
      name: row.subject_label ?? row.metric_name ?? "signal",
      metric: row.metric_name ?? row.evidence_type ?? "metric",
      value: row.metric_value ?? "",
      period: "current",
      direction: "unknown",
      interpretation: classified.reason,
      evidence_strength: classified.evidenceStrength,
      evidence_ids: [row.id],
    })),
    management_insights_json: [
      {
        insight_id: "primary_management_read",
        insight: primaryDomainRead?.read ?? "The Manager needs stronger source agreement before scaling.",
        why_it_matters: "The next move should protect the artist from spending against the wrong signal.",
        decision_created: `Decide whether ${primaryDomainRead?.domain ?? "the current operating read"} should become active work.`,
        recommended_next_move: primaryDomainRead?.next_move ?? "Connect stronger source data before making a high-confidence move.",
        avoid: primaryDomainRead?.avoid ?? "Do not scale broad spend or external commitments until evidence and readiness signals agree.",
        confidence_level: confidenceReason ? "Medium" : "Low",
        evidence_ids: primaryDomainRead?.evidence_ids.length ? primaryDomainRead.evidence_ids : firstEvidenceId ? [firstEvidenceId] : [],
      },
    ],
    asset_reads_json: primaryAsset
      ? [
          {
            asset_type: "track",
            asset_id: primaryAsset.id,
            asset_name: primaryAsset.title,
            management_role: attentionLed && !conversionLed ? "public attention asset" : conversionLed ? "conversion-backed asset" : "current focus asset",
            read: `${primaryAsset.title} is the strongest management-relevant asset in the current evidence set.`,
            next_move: "Use the asset to test the operating domain before broad expansion.",
            watch_metric: conversionLed ? "source-confirmed conversion, retention, Shazams, playlist durability" : "public response, discovery, market proof, creator fit, playlist durability",
            risk: "The asset may be bigger than the durable fanbase.",
            evidence_ids: input.evidenceRows.filter((row) => row.subject_id === primaryAsset.id).map((row) => row.id),
          },
        ]
      : [],
      market_reads_json: kpiProfile.cityAffinityReads.map((cityRead) => ({
      market: cityRead.city,
      role: cityRead.role,
      read: cityRead.read,
      next_move: cityRead.role === "power_market" ? "Use this market as the first activation test." : "Watch before equal-prioritizing.",
      watch_metric: "city affinity, local discovery, listener persistence",
      evidence_ids: input.evidenceRows.filter((row) => (row.metric_name ?? "").toLowerCase().includes(cityRead.city.toLowerCase())).map((row) => row.id),
      })),
    domain_reads_json: domainReads,
    public_context_json: publicContext,
    open_decisions_json: domainReads.slice(0, 6).map((read) => ({
      decision: read.checkpoint_hint,
      domain: read.domain,
      evidence_ids: read.evidence_ids,
      confidence_level: read.confidence_level,
    })),
    do_not_do_json: [
      ...domainReads.map((read) => read.avoid),
      ...(includePrivateSourceGuardrails
        ? [
            "Do not create default private-analytics upload work unless a specific decision needs that source.",
            "Do not treat public web context as private analytics, legal proof, revenue proof, ROI proof, or conversion proof.",
          ]
        : []),
    ],
    mission_seed_json: {
      primary_mission_direction:
        missionImplications[0]?.possible_missions?.[0] ??
        missionCandidates[0]?.direction ??
        `Build the next mission from ${artistName}'s clearest career constraint, not from a generic promotion template.`,
      supporting_mission_directions: missionCandidates.slice(1).map((candidate) => candidate.direction),
      mission_candidates: missionCandidates,
      mission_implications: missionImplications,
      career_condition_diagnosis: careerConditionDiagnosis,
      do_not_generate_missions_for: [
        "generic strongest-song promotion",
        "playlist-save busywork",
        ...careerConditionDiagnosis.wrong_defaults_to_avoid,
        ...(includePrivateSourceGuardrails
          ? [
              "default private-analytics upload",
              "save/follow conversion without conversion evidence",
            ]
          : []),
        "broad spend",
        "external commitments without permission",
      ],
      mission_generation_notes:
        "Mission Genesis should compose management domains from these candidates, create only justified durable objectives, and keep tasks/checkpoints separate from the Today's Brief.",
    },
    conversation_memory_seed_json: {
      artist_personality: {
        primary_traits: [
          ...(artistName.toLowerCase().includes("blaqbonez") ? ["humor", "confidence", "internet-native", "rap-rooted"] : []),
          ...([...input.evidenceRows.map(evidenceText), input.profile.artist_direction ?? "", input.profile.current_goal ?? ""].join(" ").includes("humor") ? ["humor"] : []),
          ...([...input.evidenceRows.map(evidenceText), input.profile.artist_direction ?? "", input.profile.current_goal ?? ""].join(" ").includes("confidence") ? ["confidence"] : []),
          ...([...input.evidenceRows.map(evidenceText), input.profile.artist_direction ?? "", input.profile.current_goal ?? ""].join(" ").includes("rap") ? ["rap-rooted"] : []),
        ].filter((item, index, all) => all.indexOf(item) === index),
        risk: "Personality or feature attention may generate reach that does not automatically become music attachment.",
      },
      career_tension: {
        main_tension: missionImplications.some((item) => item.career_condition === "feature_leverage_moment")
          ? "feature leverage vs artist identity ownership"
          : careerConditionDiagnosis.primary_career_condition?.label ?? "career direction needs diagnosis",
        secondary_tension: "short-term signal vs durable artist leverage",
      },
      collaboration_strategy: {
        current_feature_context: missionImplications.some((item) => item.career_condition === "feature_leverage_moment")
          ? `${strongestAssetName} can create mainstream leverage but can overshadow ${artistName} if framing is weak.`
          : "",
        next_collaboration_needs: ["rap authority", "UK/diaspora bridge", "African youth culture bridge"].filter((item) =>
          artistName.toLowerCase().includes("blaqbonez") || missionImplications.some((implication) => implication.career_condition.includes("feature")),
        ),
      },
      mission_guardrails: [
        "Do not let features become bigger than artist identity.",
        "Do not make every mission a creator pilot.",
        "Do not treat content engagement as artist attachment.",
        ...careerConditionDiagnosis.wrong_defaults_to_avoid,
      ],
      what_manager_should_remember: [
        `${artistName} current priority: ${operatingPriority}.`,
        `${artistName} primary career condition: ${careerConditionDiagnosis.primary_career_condition?.condition_key ?? "unknown"}.`,
        kpiProfile.fanbaseVsEngagement.read,
        ...domainReads.slice(0, 3).map((read) => `${read.domain}: ${read.read}`),
      ],
      follow_up_questions_it_can_answer_better: ["Which operating domain should lead?", "Which market should lead?", "What should we avoid?"],
      open_uncertainties: domainReads.slice(0, 5).map((read) => read.checkpoint_hint),
    },
    supporting_evidence_json: supportingEvidence(input.evidenceRows),
    internal_only_json: {
      playbooks_considered: routing.consideredPlaybooks,
      playbooks_applied: routing.appliedPlaybooks,
      routing_notes: routing.routingNotes,
    },
    schema_version: "manager-intelligence-packet-v1",
    created_from_run_id: input.createdFromRunId ?? null,
  };
};
