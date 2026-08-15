export const premiumSongDocumentTypes = [
  "release_narrative",
  "epk",
  "artist_biography",
  "one_sheet",
  "press_release",
  "press_angle",
  "spotify_editorial_pitch",
  "playlist_pitch",
  "press_target_brief",
  "press_pitch",
  "content_plan",
  "release_calendar",
  "lyrics",
  "credits",
  "distributor_notes",
] as const;

export type PremiumSongDocumentType = typeof premiumSongDocumentTypes[number];

export type SongDocumentSection = {
  key: string;
  title: string;
  content: string;
  evidenceRefs: string[];
};

export type SongDocumentClaim = {
  text: string;
  basis: "workspace" | "public_source" | "artist_input" | "inference";
  sourceRef: string;
  confidence: "high" | "medium" | "low";
};

export type StructuredSongDocument = {
  purpose: string;
  audience: string;
  coreNarrative: string;
  sections: SongDocumentSection[];
  claims: SongDocumentClaim[];
  missingInputs: string[];
};

export type SongDocumentQuality = {
  score: number;
  readiness: "ready" | "needs_review";
  blockers: string[];
  warnings: string[];
  passed: string[];
  requiredSections: string[];
  schemaVersion: "song_document_v2";
};

type SongDocumentStandard = {
  label: string;
  internal?: boolean;
  requiredSections: Array<{ key: string; title: string }>;
  minTotalWords: number;
  maxTotalWords: number;
  minSectionWords: number;
  requiresEvidence: boolean;
};

export const songDocumentStandards: Record<PremiumSongDocumentType, SongDocumentStandard> = {
  release_narrative: {
    label: "Release narrative",
    internal: true,
    requiredSections: [
      { key: "positioning", title: "Positioning" },
      { key: "story", title: "Release story" },
      { key: "audience", title: "Audience" },
      { key: "campaign_thesis", title: "Campaign thesis" },
      { key: "proof", title: "Proof and signals" },
      { key: "creative_world", title: "Creative world" },
      { key: "language_guardrails", title: "Language guardrails" },
    ],
    minTotalWords: 240,
    maxTotalWords: 1600,
    minSectionWords: 24,
    requiresEvidence: true,
  },
  epk: {
    label: "EPK",
    requiredSections: [
      { key: "artist_snapshot", title: "Artist snapshot" },
      { key: "release_story", title: "Release story" },
      { key: "why_now", title: "Why now" },
      { key: "sound_and_context", title: "Sound and context" },
      { key: "proof", title: "Proof" },
      { key: "press_angles", title: "Press angles" },
      { key: "assets_and_links", title: "Assets and links" },
      { key: "contact", title: "Contact" },
    ],
    minTotalWords: 320,
    maxTotalWords: 1800,
    minSectionWords: 20,
    requiresEvidence: true,
  },
  artist_biography: {
    label: "Artist biography",
    requiredSections: [
      { key: "short_bio", title: "Short bio" },
      { key: "medium_bio", title: "Medium bio" },
      { key: "full_bio", title: "Full bio" },
    ],
    minTotalWords: 260,
    maxTotalWords: 1600,
    minSectionWords: 45,
    requiresEvidence: true,
  },
  one_sheet: {
    label: "One-sheet",
    requiredSections: [
      { key: "hook", title: "Hook" },
      { key: "positioning", title: "Positioning" },
      { key: "release_story", title: "Release story" },
      { key: "proof", title: "Proof" },
      { key: "audience", title: "Audience" },
      { key: "campaign", title: "Campaign" },
      { key: "links_contact", title: "Links and contact" },
    ],
    minTotalWords: 190,
    maxTotalWords: 900,
    minSectionWords: 14,
    requiresEvidence: true,
  },
  press_release: {
    label: "Press release",
    requiredSections: [
      { key: "headline", title: "Headline" },
      { key: "dek", title: "Dek" },
      { key: "dateline_lede", title: "Dateline and lede" },
      { key: "body", title: "Release story" },
      { key: "artist_quote", title: "Artist quote" },
      { key: "release_details", title: "Release details" },
      { key: "about_artist", title: "About the artist" },
      { key: "press_contact", title: "Press contact" },
    ],
    minTotalWords: 300,
    maxTotalWords: 1250,
    minSectionWords: 14,
    requiresEvidence: true,
  },
  press_angle: {
    label: "Press angle",
    requiredSections: [
      { key: "angle", title: "Angle" },
      { key: "why_now", title: "Why now" },
      { key: "story_evidence", title: "Story evidence" },
      { key: "headline_options", title: "Headline options" },
      { key: "target_media", title: "Target media" },
      { key: "avoid", title: "Avoid" },
    ],
    minTotalWords: 160,
    maxTotalWords: 750,
    minSectionWords: 14,
    requiresEvidence: true,
  },
  spotify_editorial_pitch: {
    label: "Spotify editorial pitch",
    requiredSections: [
      { key: "pitch", title: "Pitch" },
      { key: "context", title: "Song context" },
      { key: "marketing", title: "Marketing plan" },
      { key: "territory", title: "Territory and audience" },
      { key: "credits", title: "Credits" },
    ],
    minTotalWords: 90,
    maxTotalWords: 450,
    minSectionWords: 12,
    requiresEvidence: true,
  },
  playlist_pitch: {
    label: "Playlist pitch",
    requiredSections: [
      { key: "subject_line", title: "Subject line" },
      { key: "opening", title: "Opening" },
      { key: "fit", title: "Why it fits" },
      { key: "song_story", title: "Song story" },
      { key: "proof", title: "Proof" },
      { key: "cta", title: "Call to action" },
    ],
    minTotalWords: 90,
    maxTotalWords: 500,
    minSectionWords: 10,
    requiresEvidence: true,
  },
  press_target_brief: {
    label: "Press target brief",
    requiredSections: [
      { key: "outlet_fit", title: "Outlet fit" },
      { key: "recent_coverage", title: "Recent coverage" },
      { key: "angle", title: "Angle" },
      { key: "contact_route", title: "Contact route" },
      { key: "pitch_notes", title: "Pitch notes" },
      { key: "risk", title: "Risk and limitations" },
    ],
    minTotalWords: 160,
    maxTotalWords: 800,
    minSectionWords: 14,
    requiresEvidence: true,
  },
  press_pitch: {
    label: "Press pitch",
    requiredSections: [
      { key: "subject_line", title: "Subject line" },
      { key: "opening", title: "Opening" },
      { key: "why_them", title: "Why this outlet" },
      { key: "story", title: "Story" },
      { key: "proof", title: "Proof" },
      { key: "cta", title: "Call to action" },
    ],
    minTotalWords: 110,
    maxTotalWords: 600,
    minSectionWords: 10,
    requiresEvidence: true,
  },
  content_plan: {
    label: "Content plan",
    requiredSections: [
      { key: "campaign_idea", title: "Campaign idea" },
      { key: "content_pillars", title: "Content pillars" },
      { key: "formats", title: "Formats" },
      { key: "timeline", title: "Timeline" },
      { key: "calls_to_action", title: "Calls to action" },
      { key: "measurement", title: "Measurement" },
      { key: "guardrails", title: "Guardrails" },
    ],
    minTotalWords: 340,
    maxTotalWords: 2200,
    minSectionWords: 24,
    requiresEvidence: true,
  },
  release_calendar: {
    label: "Release calendar",
    requiredSections: [
      { key: "milestones", title: "Milestones" },
      { key: "owned_actions", title: "Owned actions" },
      { key: "external_deadlines", title: "External deadlines" },
      { key: "dependencies", title: "Dependencies" },
      { key: "approval_points", title: "Approval points" },
    ],
    minTotalWords: 180,
    maxTotalWords: 1800,
    minSectionWords: 18,
    requiresEvidence: false,
  },
  lyrics: {
    label: "Lyrics",
    requiredSections: [{ key: "lyrics", title: "Lyrics" }],
    minTotalWords: 10,
    maxTotalWords: 10000,
    minSectionWords: 10,
    requiresEvidence: false,
  },
  credits: {
    label: "Credits",
    requiredSections: [
      { key: "recording_credits", title: "Recording credits" },
      { key: "writing_credits", title: "Writing credits" },
      { key: "production_credits", title: "Production credits" },
    ],
    minTotalWords: 20,
    maxTotalWords: 1200,
    minSectionWords: 5,
    requiresEvidence: false,
  },
  distributor_notes: {
    label: "Distributor notes",
    requiredSections: [
      { key: "release_identity", title: "Release identity" },
      { key: "delivery_notes", title: "Delivery notes" },
      { key: "metadata_checks", title: "Metadata checks" },
    ],
    minTotalWords: 45,
    maxTotalWords: 900,
    minSectionWords: 10,
    requiresEvidence: false,
  },
};

const genericLanguagePatterns = [
  /\bmaking waves\b/i,
  /\brising star\b/i,
  /\bunique sound\b/i,
  /\bset to take (?:the )?world by storm\b/i,
  /\bgame[- ]changing\b/i,
  /\bsonic journey\b/i,
  /\bgenre[- ]bending\b/i,
  /\bcaptivating audiences\b/i,
  /\bpoised to\b/i,
  /\bmore than just (?:a|an)\b/i,
];

const placeholderPatterns = [
  /\bTBD\b/i,
  /\bTK\b/,
  /\bTODO\b/i,
  /\bplaceholder\b/i,
  /\binsert (?:link|name|date|quote|contact|number|stat)\b/i,
  /\[insert[^\]]*\]/i,
  /\{\{[^}]+\}\}/,
];

export function isPremiumSongDocumentType(value: unknown): value is PremiumSongDocumentType {
  return typeof value === "string" && (premiumSongDocumentTypes as readonly string[]).includes(value);
}

export function normalizeStructuredSongDocument(value: unknown): StructuredSongDocument | null {
  if (!isRecord(value)) return null;
  const purpose = cleanText(value.purpose, 1200);
  const audience = cleanText(value.audience, 1200);
  const coreNarrative = cleanText(value.coreNarrative, 5000);
  const sections = Array.isArray(value.sections)
    ? value.sections.flatMap((section) => {
        if (!isRecord(section)) return [];
        const key = cleanKey(section.key);
        const title = cleanText(section.title, 240);
        const content = cleanText(section.content, 12000);
        if (!key || !title || !content) return [];
        return [{ key, title, content, evidenceRefs: cleanStringList(section.evidenceRefs, 20, 500) }];
      })
    : [];
  const claims: SongDocumentClaim[] = Array.isArray(value.claims)
    ? value.claims.flatMap((claim) => {
        if (!isRecord(claim)) return [];
        const text = cleanText(claim.text, 1600);
        const basis = claim.basis === "workspace" || claim.basis === "public_source" || claim.basis === "artist_input" || claim.basis === "inference"
          ? claim.basis
          : null;
        const sourceRef = cleanText(claim.sourceRef, 1200);
        const confidence = claim.confidence === "high" || claim.confidence === "medium" || claim.confidence === "low"
          ? claim.confidence
          : null;
        if (!text || !basis || !confidence) return [];
        return [{ text, basis, sourceRef, confidence }];
      })
    : [];
  return {
    purpose,
    audience,
    coreNarrative,
    sections,
    claims,
    missingInputs: cleanStringList(value.missingInputs, 20, 1200),
  };
}

export function assessStructuredSongDocument(
  documentType: PremiumSongDocumentType,
  structure: StructuredSongDocument,
): SongDocumentQuality {
  const standard = songDocumentStandards[documentType];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const passed: string[] = [];
  let score = 100;

  if (wordCount(structure.purpose) < 5) {
    blockers.push("State the document's concrete purpose.");
    score -= 12;
  } else passed.push("Purpose is explicit.");

  if (wordCount(structure.audience) < 3) {
    blockers.push("Name the intended audience or recipient.");
    score -= 10;
  } else passed.push("Audience is explicit.");

  if (documentType !== "lyrics" && documentType !== "credits" && wordCount(structure.coreNarrative) < 18) {
    blockers.push("Anchor the document in a specific campaign narrative instead of generic release copy.");
    score -= 15;
  } else if (structure.coreNarrative) passed.push("Core narrative is present.");

  const sectionMap = new Map(structure.sections.map((section) => [section.key, section]));
  for (const required of standard.requiredSections) {
    const section = sectionMap.get(required.key);
    const declaredMissing = inputDeclaresSectionMissing(structure.missingInputs, required);
    if (!section) {
      if (declaredMissing) {
        warnings.push(`${required.title} is waiting on a verified input.`);
        score -= 4;
      } else {
        blockers.push(`Add the required ${required.title} section or declare the missing input explicitly.`);
        score -= 12;
      }
      continue;
    }
    const words = wordCount(section.content);
    if (words < Math.max(4, Math.floor(standard.minSectionWords * 0.55))) {
      if (declaredMissing) {
        warnings.push(`${required.title} is intentionally incomplete until a verified input is available.`);
        score -= 4;
      } else {
        blockers.push(`${required.title} is too thin to be useful.`);
        score -= 9;
      }
    } else if (words < standard.minSectionWords) {
      warnings.push(`${required.title} should be more specific.`);
      score -= 4;
    }
  }

  const totalWords = structure.sections.reduce((total, section) => total + wordCount(section.content), 0);
  const hardMinimum = Math.max(10, Math.floor(standard.minTotalWords * 0.65));
  if (totalWords < hardMinimum) {
    blockers.push(`${standard.label} is underdeveloped at ${totalWords} words; a useful draft needs at least ${hardMinimum} words even when inputs are missing.`);
    score -= 14;
  } else if (totalWords < standard.minTotalWords) {
    warnings.push(`${standard.label} is usable but incomplete at ${totalWords} words; target ${standard.minTotalWords} when the missing inputs are available.`);
    score -= 6;
  } else if (totalWords > standard.maxTotalWords) {
    warnings.push(`${standard.label} is longer than the ${standard.maxTotalWords}-word working limit; tighten it.`);
    score -= 5;
  } else passed.push("Length is appropriate for the artifact.");

  const allCopy = [
    structure.purpose,
    structure.audience,
    structure.coreNarrative,
    ...structure.sections.map((section) => section.content),
  ].join("\n");
  const genericHits = genericLanguagePatterns.filter((pattern) => pattern.test(allCopy));
  if (genericHits.length) {
    warnings.push("Replace generic music-marketing language with artist-specific facts, images or stakes.");
    score -= Math.min(16, genericHits.length * 4);
  } else passed.push("Copy avoids common generic music-marketing clichés.");

  const placeholderHits = placeholderPatterns.filter((pattern) => pattern.test(allCopy));
  if (placeholderHits.length) {
    blockers.push("Remove placeholders. Unknown facts belong in missingInputs, not in recipient-facing copy.");
    score -= 18;
  } else passed.push("No placeholder copy detected.");

  const unsupportedClaims = structure.claims.filter((claim) => {
    if (claim.basis === "inference") return claim.confidence === "high" || !claim.sourceRef;
    if (claim.basis === "public_source") return !isHttpsUrl(claim.sourceRef);
    return !claim.sourceRef;
  });
  if (unsupportedClaims.length) {
    blockers.push(`${unsupportedClaims.length} claim${unsupportedClaims.length === 1 ? "" : "s"} need a valid source basis or lower-confidence inference label.`);
    score -= Math.min(24, unsupportedClaims.length * 6);
  } else if (structure.claims.length) passed.push("Claims carry an explicit source basis.");

  if (standard.requiresEvidence) {
    const evidenceRefs = new Set(structure.sections.flatMap((section) => section.evidenceRefs).filter(Boolean));
    const groundedClaims = structure.claims.filter((claim) => claim.basis !== "inference" && claim.sourceRef);
    if (!evidenceRefs.size && !groundedClaims.length) {
      warnings.push("Add evidence references for factual or performance claims before treating this as final-ready.");
      score -= 8;
    } else passed.push("Evidence references are attached to the artifact.");
  }

  if (structure.missingInputs.length) {
    warnings.push(`${structure.missingInputs.length} input${structure.missingInputs.length === 1 ? " is" : "s are"} still missing; keep the artifact in review.`);
    score -= Math.min(12, structure.missingInputs.length * 3);
  } else passed.push("No unresolved input is declared.");

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    readiness: blockers.length || warnings.length || score < 82 ? "needs_review" : "ready",
    blockers: unique(blockers),
    warnings: unique(warnings),
    passed: unique(passed),
    requiredSections: standard.requiredSections.map((section) => section.key),
    schemaVersion: "song_document_v2",
  };
}

export function renderStructuredSongDocument(
  documentType: PremiumSongDocumentType,
  title: string,
  structure: StructuredSongDocument,
) {
  const standard = songDocumentStandards[documentType];
  const lines: string[] = [`# ${title}`];
  if (standard.internal) {
    lines.push("", "> Internal campaign strategy. Not recipient-facing copy.");
  }
  lines.push("", `**Purpose:** ${structure.purpose}`, `**Audience:** ${structure.audience}`);
  if (structure.coreNarrative) lines.push("", `**Core narrative:** ${structure.coreNarrative}`);
  for (const section of structure.sections) {
    lines.push("", `## ${section.title}`, "", section.content);
  }
  if (structure.missingInputs.length) {
    lines.push("", "## Needs verification", "", ...structure.missingInputs.map((item) => `- ${item}`));
  }
  return lines.join("\n").trim();
}

export function documentStandardSummary(documentType: PremiumSongDocumentType) {
  const standard = songDocumentStandards[documentType];
  return {
    documentType,
    label: standard.label,
    internal: Boolean(standard.internal),
    requiredSections: standard.requiredSections,
    minTotalWords: standard.minTotalWords,
    maxTotalWords: standard.maxTotalWords,
    qualityRules: [
      "Use specific verified facts instead of generic music-marketing language.",
      "Put unknown facts in missingInputs; never insert placeholders into recipient-facing copy.",
      "Attach a source basis to factual claims and public performance claims.",
      "Keep every artifact aligned to the current release narrative.",
    ],
  };
}

function inputDeclaresSectionMissing(missingInputs: string[], required: { key: string; title: string }) {
  const needles = [normalizeSearchText(required.key), normalizeSearchText(required.title)].filter(Boolean);
  return missingInputs.some((input) => {
    const haystack = normalizeSearchText(input);
    return needles.some((needle) => haystack.includes(needle) || needle.includes(haystack));
  });
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function cleanKey(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120)
    : "";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return unique(value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim().slice(0, maxLength)] : [])).slice(0, maxItems);
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
