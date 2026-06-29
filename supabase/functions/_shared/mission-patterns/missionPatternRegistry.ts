export type MissionPattern = {
  key: string;
  name: string;
  domain: string;
  whenToUse: string[];
  likelyAgents: string[];
  evidenceNeeds: string[];
  taskTypes: string[];
  checkpointQuestions: string[];
  permissionBoundaries: string[];
  reviewTriggers: string[];
  successState: string;
  blockageState: string;
  changeConditions: string[];
};

type PacketLike = {
  artist?: {
    homeMarket?: string | null;
    goals?: unknown;
  } | null;
  managerIntelligenceMissionSeed?: {
    mission_candidates?: unknown;
  } | null;
  evidence?: unknown;
};

const missionPatternRegistry: MissionPattern[] = [
  {
    key: "career_north_star",
    name: "Career Architecture / North Star",
    domain: "Career Architecture",
    whenToUse: ["long-term direction is unclear", "too many competing opportunities", "artist needs do-not-do rules"],
    likelyAgents: ["Manager", "Marketing", "Sync & Deals"],
    evidenceNeeds: ["artist goals", "catalog direction", "audience thesis", "prior decisions", "constraints"],
    taskTypes: ["define career thesis", "name do-not-do moves", "select next career unlock", "archive distracting work"],
    checkpointQuestions: ["Is the direction specific enough to guide decisions?", "Does the next move improve leverage?"],
    permissionBoundaries: ["public positioning changes", "sensitive strategy changes"],
    reviewTriggers: ["artist changes goal", "new market proof appears", "current thesis fails mission reviews"],
    successState: "A reusable career thesis shapes future mission decisions.",
    blockageState: "Goals conflict, values are unclear, or the team cannot agree on the next unlock.",
    changeConditions: ["artist goal changes", "stronger opportunity appears", "current thesis stops guiding work"],
  },
  {
    key: "artist_positioning",
    name: "Artist Positioning",
    domain: "Artist Positioning And Narrative",
    whenToUse: ["story is unclear", "market signal needs cultural framing", "public language needs approval"],
    likelyAgents: ["Manager", "Marketing", "Sync & Deals"],
    evidenceNeeds: ["artist direction", "audience comments", "catalog", "memory", "market context"],
    taskTypes: ["draft positioning thesis", "approve public language", "reject off-brand moves"],
    checkpointQuestions: ["Is the positioning specific enough to guide work?", "Does the story travel without flattening the artist?"],
    permissionBoundaries: ["public copy", "brand commitments", "sensitive narrative changes"],
    reviewTriggers: ["audience response changes", "artist preference changes", "cultural context changes"],
    successState: "A durable artist-specific story guides campaigns, markets, and partnerships.",
    blockageState: "Positioning is generic, conflicts with artist values, or lacks audience proof.",
    changeConditions: ["new audience language emerges", "artist rejects the lane", "market context changes"],
  },
  {
    key: "focus_asset_selection",
    name: "A&R / Focus Asset Selection",
    domain: "A&R And Creative Development",
    whenToUse: ["several songs compete for attention", "one asset should lead a cycle", "creative rationale is unclear"],
    likelyAgents: ["Manager", "Marketing", "Sync & Deals"],
    evidenceNeeds: ["catalog metadata", "song evidence", "comments", "save/listener data if available", "creative references"],
    taskTypes: ["compare focus assets", "gather audience proof", "define creative rationale", "approve focus asset"],
    checkpointQuestions: ["Does the asset match the artist goal?", "Is audience proof credible enough to lead?"],
    permissionBoundaries: ["public release decision", "external pitching", "spend"],
    reviewTriggers: ["another asset materially outperforms", "strategic goal changes", "audience proof weakens"],
    successState: "One focus asset has a clear role, evidence base, and creative rationale.",
    blockageState: "Split attention, weak material, or conflicting team preference prevents focus.",
    changeConditions: ["new asset outperforms", "artist preference changes", "campaign goal changes"],
  },
  {
    key: "collaboration_strategy",
    name: "Collaboration Strategy",
    domain: "Collaboration Strategy",
    whenToUse: ["a feature can create artist-level leverage", "collaborator attention may overshadow the artist", "next collaborator map is needed"],
    likelyAgents: ["Manager", "A&R", "Marketing", "PR"],
    evidenceNeeds: ["collaboration context", "public narrative", "catalog role", "audience attachment", "market bridge"],
    taskTypes: ["map feature attachment", "center artist narrative", "build collaborator map", "route attention into catalog"],
    checkpointQuestions: ["Is the feature strengthening the artist, not only the song or collaborator?", "Does the next collaborator map improve leverage?"],
    permissionBoundaries: ["public narrative changes", "external collaborator outreach", "spend"],
    reviewTriggers: ["feature attention grows without artist attachment", "new collaborator opportunity appears", "artist positioning changes"],
    successState: "The collaboration creates artist-owned leverage and a clear next relationship map.",
    blockageState: "The feature remains collaborator-led, song-led, or unsupported by artist-level attachment.",
    changeConditions: ["feature attachment changes", "collaborator availability changes", "artist position changes"],
  },
  {
    key: "catalog_asset_narrative",
    name: "Catalog Song Asset / Narrative",
    domain: "Catalog And Narrative Strategy",
    whenToUse: ["a song needs a role in the artist story", "attention must be routed into catalog", "song growth may not equal artist growth"],
    likelyAgents: ["Manager", "A&R", "Marketing", "PR"],
    evidenceNeeds: ["track evidence", "catalog context", "public response", "fan language"],
    taskTypes: ["define song role", "route attention into catalog", "measure artist attachment", "prepare narrative angle"],
    checkpointQuestions: ["Is the song growing the artist's profile or only its own metrics?", "Does the narrative connect the song to catalog and fan ownership?"],
    permissionBoundaries: ["public copy", "external pitching", "spend"],
    reviewTriggers: ["song grows without artist growth", "new catalog signal appears", "fan language changes"],
    successState: "The song has a clear artist-level role and routing path.",
    blockageState: "The song remains a disconnected attention asset.",
    changeConditions: ["artist attachment improves", "catalog signal changes", "public narrative changes"],
  },
  {
    key: "fan_ownership",
    name: "Fan Ownership",
    domain: "Fan Ownership",
    whenToUse: ["attention needs to become artist-level language", "community or owned audience path is unclear", "personality attention must attach to music"],
    likelyAgents: ["Manager", "Marketing", "Creative"],
    evidenceNeeds: ["fan language", "comments", "catalog movement", "owned channel readiness", "conversion proof where available"],
    taskTypes: ["separate attention from attachment", "build owned fan path", "route catalog", "review fan language"],
    checkpointQuestions: ["Is attention becoming artist-level fan ownership?", "Does the owned path improve without forcing unsupported conversion claims?"],
    permissionBoundaries: ["public posts", "fan channel changes", "spend"],
    reviewTriggers: ["attention decays", "fan language changes", "owned channel proof appears"],
    successState: "The team can see whether attention is becoming artist-level ownership.",
    blockageState: "Attention remains noisy, song-only, or personality-only.",
    changeConditions: ["conversion proof appears", "fan language changes", "artist position changes"],
  },
  {
    key: "release_planning",
    name: "Release Planning",
    domain: "Release And Catalog Strategy",
    whenToUse: ["release date, readiness, or sequencing is in question", "release safety depends on rights or delivery"],
    likelyAgents: ["Manager", "Marketing", "Finance/Rights"],
    evidenceNeeds: ["rights/splits", "distributor status", "DSP pitch readiness", "content assets", "budget"],
    taskTypes: ["confirm rights", "submit distributor package", "prepare pitch assets", "verify live links"],
    checkpointQuestions: ["Is the release safe to proceed?", "Is the campaign ready for launch?"],
    permissionBoundaries: ["public date changes", "submissions", "spend", "external outreach"],
    reviewTriggers: ["rights fail", "delivery status changes", "source data changes", "team capacity changes"],
    successState: "The release is safe, coordinated, and reviewable after signal appears.",
    blockageState: "Rights, delivery, missing assets, weak evidence, or missing approval blocks progress.",
    changeConditions: ["rights proof appears", "release timing changes", "campaign readiness changes"],
  },
  {
    key: "creator_content_validation",
    name: "Creator / Content Validation",
    domain: "Audience And Fan Development",
    whenToUse: ["public attention needs validation", "creator or content angle may be repeatable", "attention must be separated from conversion"],
    likelyAgents: ["Manager", "Marketing"],
    evidenceNeeds: ["TikTok/Instagram/YouTube signals", "comments", "creator list", "smart-link data", "private analytics when available"],
    taskTypes: ["build creator list", "approve content tests", "post or seed content", "upload test results"],
    checkpointQuestions: ["Is attention repeatable?", "Is participation becoming owned or repeat behavior?"],
    permissionBoundaries: ["creator outreach", "public posts", "paid spend"],
    reviewTriggers: ["content angle changes", "creator niche outperforms", "conversion remains absent"],
    successState: "A content angle earns a continue, change, pause, or scale decision.",
    blockageState: "Attention is noisy, conversion is missing, or creator fit is weak.",
    changeConditions: ["conversion proof appears", "creator niche changes", "attention decays"],
  },
  {
    key: "city_live_market_validation",
    name: "City / Live-Market Validation",
    domain: "Market Expansion",
    whenToUse: ["city or country concentration appears", "live opportunity needs proof", "routing risk is unclear"],
    likelyAgents: ["Manager", "Touring", "Marketing"],
    evidenceNeeds: ["city streaming", "social geography", "comments", "live history", "ticketing proxies", "venue notes"],
    taskTypes: ["verify city demand", "upload live history", "build venue/promoter list", "scope a low-risk city test"],
    checkpointQuestions: ["Is the market or city strong enough to test?", "Is live risk acceptable before booking outreach?"],
    permissionBoundaries: ["booking outreach", "promoter outreach", "deposits", "local spend"],
    reviewTriggers: ["stronger city signal appears", "live cost changes", "team capacity changes"],
    successState: "A city or market test is justified with review rules.",
    blockageState: "Geography is weak, live history is missing, or cost/risk is too high.",
    changeConditions: ["stronger market appears", "cost changes", "live evidence improves"],
  },
  {
    key: "sync_deal_readiness",
    name: "Sync / Deal Readiness",
    domain: "Partnerships, Brand, Sync, And Deals",
    whenToUse: ["brand, sync, partnership, or deal opportunity needs evaluation", "pitch materials or rights are incomplete"],
    likelyAgents: ["Manager", "Sync & Deals", "Finance/Rights"],
    evidenceNeeds: ["rights clarity", "clean assets", "pitch materials", "audience proof", "brand fit"],
    taskTypes: ["upload clean assets", "build pitch package", "confirm rights", "prepare safe referral"],
    checkpointQuestions: ["Is the opportunity rights-safe and artist-aligned?", "Is the pitch package credible enough to send?"],
    permissionBoundaries: ["external pitch", "deal negotiation", "legal or finance conclusions"],
    reviewTriggers: ["rights clear", "assets improve", "opportunity no longer fits"],
    successState: "A safe pitch, referral, or decline decision exists.",
    blockageState: "Rights are unclear, assets are missing, or fit is weak.",
    changeConditions: ["rights proof appears", "brand fit changes", "asset package improves"],
  },
  {
    key: "rights_cleanup",
    name: "Rights Cleanup",
    domain: "Rights, Finance, And Business Affairs",
    whenToUse: ["splits, ownership, metadata, or finance proof blocks action", "risk should slow external moves"],
    likelyAgents: ["Manager", "Finance/Rights", "Sync & Deals"],
    evidenceNeeds: ["split sheet", "ownership notes", "metadata", "distributor records", "royalty statements"],
    taskTypes: ["upload split sheet", "confirm ownership notes", "fix metadata", "request legal review"],
    checkpointQuestions: ["Are rights clear enough to proceed?", "Has missing proof been resolved?"],
    permissionBoundaries: ["legal conclusions", "finance conclusions", "external submissions"],
    reviewTriggers: ["new document appears", "conflict resolves", "legal review changes risk"],
    successState: "Risk is reduced and the next action can safely unlock.",
    blockageState: "Missing signatures, conflicting documents, or legal uncertainty block progress.",
    changeConditions: ["document appears", "ownership conflict changes", "metadata is corrected"],
  },
  {
    key: "team_operations",
    name: "Team Operations",
    domain: "Team, Operations, And Capacity",
    whenToUse: ["owners are unclear", "capacity is overloaded", "approval flow blocks execution"],
    likelyAgents: ["Manager"],
    evidenceNeeds: ["tasks", "deadlines", "user replies", "team capacity memory", "approval chain"],
    taskTypes: ["assign owner", "clarify capacity", "approve workflow", "archive stale work"],
    checkpointQuestions: ["Is the operating process clear enough to continue?", "Does every task have an accountable owner?"],
    permissionBoundaries: ["sensitive role changes", "process changes with external commitments"],
    reviewTriggers: ["team capacity changes", "priority changes", "deadline risk changes"],
    successState: "Ownership and approval flow are clear enough for the mission to move.",
    blockageState: "No owner, overloaded team, or unclear approval chain blocks the work.",
    changeConditions: ["owner changes", "capacity changes", "priority changes"],
  },
  {
    key: "data_source_completeness",
    name: "Data / Source Completeness",
    domain: "Data Sovereignty And Intelligence",
    whenToUse: ["missing sources block decision quality", "private evidence is required before confidence can rise"],
    likelyAgents: ["Manager", "Marketing", "Finance/Rights"],
    evidenceNeeds: ["source readiness", "uploads", "connector status", "missing proof", "source limitations"],
    taskTypes: ["connect source", "upload CSV or file", "verify identity", "label limitation"],
    checkpointQuestions: ["Are the required sources available?", "Is evidence quality sufficient for the decision?"],
    permissionBoundaries: ["source connection", "file upload", "private data handling"],
    reviewTriggers: ["source becomes available", "upload fails", "mission can proceed with explicit limitation"],
    successState: "Decision confidence improves or the limitation is explicit.",
    blockageState: "Source is unavailable, stale, malformed, or not enough to support the decision.",
    changeConditions: ["source connects", "file uploads", "limitation changes"],
  },
  {
    key: "reputation_wellbeing",
    name: "Reputation / Crisis / Wellbeing",
    domain: "Reputation, Crisis, And Wellbeing",
    whenToUse: ["public risk, sensitive conflict, burnout, or wellbeing concern may harm the artist"],
    likelyAgents: ["Manager"],
    evidenceNeeds: ["user context", "public conversation", "stakeholder notes", "deadlines", "workload", "risk history"],
    taskTypes: ["pause risky action", "prepare response draft", "request human/legal review", "reduce workload"],
    checkpointQuestions: ["Is the artist protected?", "Is the next public or sensitive step safe?"],
    permissionBoundaries: ["public response", "legal-sensitive action", "reputation-sensitive action"],
    reviewTriggers: ["new facts appear", "user approval changes", "legal advice changes", "public context changes"],
    successState: "Risk is contained without damaging long-term leverage.",
    blockageState: "Facts are incomplete, sensitivity is high, or action would create avoidable harm.",
    changeConditions: ["new facts appear", "approval changes", "risk clears"],
  },
];

export function getMissionPatternRegistry() {
  return missionPatternRegistry;
}

export function selectMissionPatternsForPacket(packet: PacketLike) {
  const text = normalize(
    JSON.stringify({
      artist: packet.artist ?? {},
      candidates: packet.managerIntelligenceMissionSeed?.mission_candidates ?? [],
      evidence: packet.evidence ?? [],
    }),
  );
  const selected = new Map<string, MissionPattern>();

  const add = (key: string) => {
    const pattern = missionPatternRegistry.find((item) => item.key === key);
    if (pattern) selected.set(pattern.key, pattern);
  };

  if (matchesAny(text, ["audience", "fan", "creator", "content", "tiktok", "instagram", "youtube", "repeatable", "owned"])) {
    add("fan_ownership");
    add("creator_content_validation");
  }
  if (matchesAny(text, ["market", "city", "lagos", "london", "diaspora", "live", "tour", "venue", "promoter"])) {
    add("city_live_market_validation");
  }
  if (matchesAny(text, ["split", "rights", "ownership", "metadata", "royalty", "finance", "budget", "deal risk"])) {
    add("rights_cleanup");
  }
  if (matchesAny(text, ["source", "private data", "upload", "csv", "smart link", "analytics", "proof", "missing"])) {
    add("data_source_completeness");
  }
  if (matchesAny(text, ["positioning", "narrative", "story", "brand posture", "public language"])) {
    add("artist_positioning");
  }
  if (matchesAny(text, ["focus asset", "song", "catalog", "creative", "a&r", "collaboration", "feature", "collaborator", "asake", "artist attachment"])) {
    add("collaboration_strategy");
    add("catalog_asset_narrative");
    add("focus_asset_selection");
  }
  if (matchesAny(text, ["release", "distributor", "dsp pitch", "launch", "date"])) {
    add("release_planning");
  }
  if (matchesAny(text, ["team capacity", "overloaded", "no owner assigned", "approval chain", "accountability"])) {
    add("team_operations");
  }
  if (matchesAny(text, ["sync", "deal", "brand", "partnership", "pitch", "license", "sponsorship"])) {
    add("sync_deal_readiness");
  }
  if (matchesAny(text, ["crisis", "reputation", "wellbeing", "burnout", "sensitive", "conflict", "public risk"])) {
    add("reputation_wellbeing");
  }
  if (matchesAny(text, ["career direction", "north star", "long-term", "competing opportunities", "do-not-do"])) {
    add("career_north_star");
  }

  if (selected.size === 0) {
    add("career_north_star");
    add("data_source_completeness");
  }

  return [...selected.values()].slice(0, 6);
}

function normalize(value: string) {
  return value.toLowerCase();
}

function matchesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}
