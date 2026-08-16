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

/**
 * The planning fields below are intentionally transport-only. They help the Manager
 * ground and score a document, but recipient-facing renderers must never serialize
 * purpose, audience, coreNarrative, claims or missingInputs into the public artifact.
 */
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
  optionalSections?: Array<{ key: string; title: string }>;
  maxTotalWords: number;
  requiresEvidence: boolean;
  requiresPublicResearch?: boolean;
  presentation: "prose" | "press_release" | "pitch" | "one_sheet" | "epk" | "table" | "timeline" | "lyrics" | "internal";
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
    maxTotalWords: 1600,
    requiresEvidence: true,
    presentation: "internal",
  },
  epk: {
    label: "EPK",
    requiredSections: [
      { key: "artist_bio", title: "Artist" },
      { key: "focus_release", title: "Focus release" },
      { key: "music_links", title: "Music" },
      { key: "visuals", title: "Photos and video" },
      { key: "contact", title: "Contact" },
    ],
    optionalSections: [
      { key: "highlights_press", title: "Highlights and press" },
      { key: "live", title: "Live" },
      { key: "team", title: "Team" },
    ],
    maxTotalWords: 1200,
    requiresEvidence: true,
    requiresPublicResearch: true,
    presentation: "epk",
  },
  artist_biography: {
    label: "Artist biography",
    requiredSections: [
      { key: "short_bio", title: "Short biography" },
      { key: "full_bio", title: "Full biography" },
    ],
    maxTotalWords: 650,
    requiresEvidence: true,
    requiresPublicResearch: true,
    presentation: "prose",
  },
  one_sheet: {
    label: "One-sheet",
    requiredSections: [
      { key: "artist_snapshot", title: "Artist" },
      { key: "career_highlights", title: "Highlights" },
      { key: "music_and_dsp", title: "Music" },
      { key: "links_contact", title: "Links and contact" },
    ],
    optionalSections: [
      { key: "press_and_quotes", title: "Press" },
      { key: "live", title: "Live" },
      { key: "team", title: "Team" },
    ],
    maxTotalWords: 650,
    requiresEvidence: true,
    requiresPublicResearch: true,
    presentation: "one_sheet",
  },
  press_release: {
    label: "Press release",
    requiredSections: [
      { key: "headline", title: "Headline" },
      { key: "dateline_lede", title: "Dateline and lead" },
      { key: "body", title: "Body" },
      { key: "release_details", title: "Release details" },
      { key: "about_artist", title: "About the artist" },
      { key: "press_contact", title: "Media contact" },
    ],
    optionalSections: [
      { key: "dek", title: "Subheadline" },
      { key: "artist_quote", title: "Artist quote" },
    ],
    maxTotalWords: 700,
    requiresEvidence: true,
    requiresPublicResearch: true,
    presentation: "press_release",
  },
  press_angle: {
    label: "Press angle",
    requiredSections: [
      { key: "angle", title: "Angle" },
      { key: "why_now", title: "Why now" },
      { key: "story_evidence", title: "Story evidence" },
      { key: "headline_options", title: "Headline options" },
      { key: "target_media", title: "Target media" },
    ],
    optionalSections: [{ key: "avoid", title: "Avoid" }],
    maxTotalWords: 600,
    requiresEvidence: true,
    requiresPublicResearch: true,
    presentation: "pitch",
  },
  spotify_editorial_pitch: {
    label: "Spotify editorial pitch",
    requiredSections: [
      { key: "release_info", title: "Release information" },
      { key: "editor_note", title: "Editor note" },
      { key: "genre_mood_culture", title: "Genre, mood and culture" },
      { key: "song_story", title: "Song story" },
      { key: "marketing_plan", title: "Marketing plan" },
      { key: "audience_territory", title: "Audience and territory" },
      { key: "credits", title: "Credits" },
    ],
    maxTotalWords: 450,
    requiresEvidence: true,
    requiresPublicResearch: true,
    presentation: "pitch",
  },
  playlist_pitch: {
    label: "Playlist pitch",
    requiredSections: [
      { key: "subject_line", title: "Subject" },
      { key: "opening", title: "Opening" },
      { key: "fit", title: "Why it fits" },
      { key: "song_story", title: "Song story" },
      { key: "cta", title: "Call to action" },
    ],
    optionalSections: [{ key: "proof", title: "Proof" }],
    maxTotalWords: 350,
    requiresEvidence: true,
    requiresPublicResearch: true,
    presentation: "pitch",
  },
  press_target_brief: {
    label: "Press target brief",
    requiredSections: [
      { key: "outlet_fit", title: "Outlet fit" },
      { key: "recent_coverage", title: "Recent coverage" },
      { key: "angle", title: "Angle" },
      { key: "contact_route", title: "Contact route" },
      { key: "pitch_notes", title: "Pitch notes" },
    ],
    optionalSections: [{ key: "risk", title: "Limitations" }],
    maxTotalWords: 650,
    requiresEvidence: true,
    requiresPublicResearch: true,
    presentation: "pitch",
  },
  press_pitch: {
    label: "Press pitch",
    requiredSections: [
      { key: "subject_line", title: "Subject" },
      { key: "opening", title: "Opening" },
      { key: "why_them", title: "Why this outlet" },
      { key: "story", title: "Story" },
      { key: "cta", title: "Call to action" },
    ],
    optionalSections: [{ key: "proof", title: "Proof" }],
    maxTotalWords: 450,
    requiresEvidence: true,
    requiresPublicResearch: true,
    presentation: "pitch",
  },
  content_plan: {
    label: "Content plan",
    requiredSections: [
      { key: "campaign_goal", title: "Campaign goal" },
      { key: "content_pillars", title: "Content pillars" },
      { key: "schedule", title: "Content schedule" },
      { key: "assets", title: "Assets" },
      { key: "measurement", title: "Measurement" },
    ],
    maxTotalWords: 1500,
    requiresEvidence: true,
    requiresPublicResearch: true,
    presentation: "table",
  },
  release_calendar: {
    label: "Release calendar",
    requiredSections: [
      { key: "timeline", title: "Release timeline" },
      { key: "key_deadlines", title: "Key deadlines" },
      { key: "approvals", title: "Approvals" },
      { key: "post_release", title: "Post-release" },
    ],
    maxTotalWords: 1300,
    requiresEvidence: false,
    presentation: "timeline",
  },
  lyrics: {
    label: "Lyrics",
    requiredSections: [{ key: "lyrics", title: "Lyrics" }],
    maxTotalWords: 10000,
    requiresEvidence: false,
    presentation: "lyrics",
  },
  credits: {
    label: "Credit sheet",
    requiredSections: [
      { key: "release_identity", title: "Release identity" },
      { key: "songwriting_publishing", title: "Songwriting and publishing" },
      { key: "production_engineering", title: "Production and engineering" },
      { key: "performers", title: "Performers" },
      { key: "recording_details", title: "Recording details" },
      { key: "identifiers", title: "Identifiers" },
    ],
    maxTotalWords: 1000,
    requiresEvidence: false,
    presentation: "table",
  },
  distributor_notes: {
    label: "Distribution delivery sheet",
    requiredSections: [
      { key: "release_metadata", title: "Release metadata" },
      { key: "track_metadata", title: "Track metadata" },
      { key: "rights_credits", title: "Rights and credits" },
      { key: "assets", title: "Delivery assets" },
      { key: "delivery", title: "Delivery instructions" },
    ],
    maxTotalWords: 1000,
    requiresEvidence: false,
    presentation: "table",
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

const internalLeakPatterns = [
  /\bmanager[- ]built artifact\b/i,
  /\bquality checked\b/i,
  /\breview draft\b/i,
  /\bcanonical version\b/i,
  /\bneeds verification\b/i,
  /\bretryable (?:workspace )?persistence\b/i,
  /\binternal release narrative\b/i,
  /\bcurrent workspace confirms\b/i,
  /\bdelivery[- ]ready\b/i,
  /\brelease[- ]package blocker\b/i,
];

const artistBioOperationalPatterns = [
  /\bISRC\b/i,
  /\bsplit confirmation\b/i,
  /\bdistributor evidence\b/i,
  /\bdelivery confirmation\b/i,
  /\brelease metadata\b/i,
  /\bclearance confirmation\b/i,
  /\bworkspace\b/i,
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
    missingInputs: cleanStringList(value.missingInputs, 40, 1200),
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

  // Only the internal campaign spine needs these planning fields to be editorially complete.
  // Public artifacts may carry them as hidden transport metadata, but they must never be
  // padded simply to make a quality gate happy.
  if (standard.internal) {
    if (wordCount(structure.purpose) < 5) {
      blockers.push("State the internal document purpose.");
      score -= 10;
    }
    if (wordCount(structure.audience) < 3) {
      blockers.push("Name the internal audience.");
      score -= 8;
    }
    if (wordCount(structure.coreNarrative) < 18) {
      blockers.push("Anchor the internal release narrative in a specific campaign story.");
      score -= 12;
    }
  }

  const sectionMap = new Map(structure.sections.map((section) => [section.key, section]));
  for (const required of standard.requiredSections) {
    const section = sectionMap.get(required.key);
    const declaredMissing = inputDeclaresSectionMissing(structure.missingInputs, required);
    if (!section) {
      if (declaredMissing) {
        warnings.push(`${required.title} is waiting on a verified input.`);
        score -= 4;
      } else {
        blockers.push(`Add the required ${required.title} content or declare the missing input internally.`);
        score -= 10;
      }
      continue;
    }
    if (wordCount(section.content) < 3) {
      blockers.push(`${required.title} is too thin to be useful.`);
      score -= 8;
    }
  }

  const totalWords = structure.sections.reduce((total, section) => total + wordCount(section.content), 0);
  if (totalWords > standard.maxTotalWords) {
    warnings.push(`${standard.label} is longer than its ${standard.maxTotalWords}-word working limit; tighten it.`);
    score -= 6;
  } else if (totalWords > 0) {
    passed.push("Document length stays inside the artifact's working limit.");
  }

  const publicCopy = structure.sections.map((section) => section.content).join("\n");
  const allCopy = [structure.coreNarrative, publicCopy].join("\n");
  const genericHits = genericLanguagePatterns.filter((pattern) => pattern.test(allCopy));
  if (genericHits.length) {
    warnings.push("Replace generic music-marketing language with artist-specific facts, images or stakes.");
    score -= Math.min(16, genericHits.length * 4);
  } else passed.push("Copy avoids common generic music-marketing clichés.");

  const placeholderHits = placeholderPatterns.filter((pattern) => pattern.test(publicCopy));
  if (placeholderHits.length) {
    blockers.push("Remove placeholders. Unknown facts belong in internal missingInputs, not recipient-facing copy.");
    score -= 18;
  } else passed.push("No placeholder copy detected.");

  if (!standard.internal) {
    const leakHits = internalLeakPatterns.filter((pattern) => pattern.test(publicCopy));
    if (leakHits.length) {
      blockers.push("Remove Desk-internal workflow, verification, persistence or approval language from recipient-facing copy.");
      score -= Math.min(28, leakHits.length * 7);
    } else passed.push("Recipient copy contains no Desk-internal workflow language.");
  }

  if (documentType === "artist_biography") {
    const operationalHits = artistBioOperationalPatterns.filter((pattern) => pattern.test(publicCopy));
    if (operationalHits.length) {
      blockers.push("Artist biography must describe the artist, not release operations, identifiers, delivery gates or workspace state.");
      score -= Math.min(30, operationalHits.length * 6);
    } else passed.push("Artist biography stays artist-first rather than operations-first.");
  }

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
      warnings.push("Ground factual and performance claims in workspace, artist or public-source evidence before approval.");
      score -= 8;
    } else passed.push("Evidence references are attached to the artifact internally.");
  }

  if (standard.requiresPublicResearch) {
    const publicSources = structure.claims.filter((claim) => claim.basis === "public_source" && isHttpsUrl(claim.sourceRef));
    if (!publicSources.length) {
      warnings.push("Complete current public research before treating this recipient-facing artifact as final-ready.");
      score -= 10;
    } else passed.push("Current public research is attached internally.");
  }

  if (structure.missingInputs.length) {
    warnings.push(`${structure.missingInputs.length} verified input${structure.missingInputs.length === 1 ? " is" : "s are"} still missing; keep the artifact in review without exposing those gaps to recipients.`);
    score -= Math.min(12, structure.missingInputs.length * 2);
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
  if (standard.internal) return renderInternalDocument(title, structure);

  // Recipient-facing work products deliberately omit all Desk transport and quality
  // metadata. missingInputs, claims, provenance, purpose, audience and coreNarrative
  // remain persisted in structure/quality JSON for the Manager and approval layer.
  if (documentType === "press_release") return renderPressRelease(title, structure);
  if (documentType === "lyrics") return renderLyrics(title, structure);

  const lines: string[] = [`# ${title}`];
  for (const section of orderedRenderableSections(documentType, structure)) {
    lines.push("", `## ${section.title}`, "", section.content.trim());
  }
  return lines.join("\n").trim();
}

export function documentStandardSummary(documentType: PremiumSongDocumentType) {
  const standard = songDocumentStandards[documentType];
  return {
    documentType,
    label: standard.label,
    internal: Boolean(standard.internal),
    presentation: standard.presentation,
    requiredSections: standard.requiredSections,
    optionalSections: standard.optionalSections ?? [],
    maxTotalWords: standard.maxTotalWords,
    requiresPublicResearch: Boolean(standard.requiresPublicResearch),
    qualityRules: [
      "Use the real industry form for this artifact rather than a generic AI report template.",
      "Use specific verified facts instead of generic music-marketing language.",
      "Unknown facts stay in internal missingInputs and are omitted from recipient-facing copy.",
      "Keep sources, evidence, confidence, purpose, audience and quality state in metadata rather than public copy.",
      "Never invent quotes, credits, identifiers, contact details, press, playlist support, dates, links or performance claims.",
    ],
  };
}

function renderInternalDocument(title: string, structure: StructuredSongDocument) {
  const lines: string[] = [
    `# ${title}`,
    "",
    "> Internal campaign strategy. Not recipient-facing copy.",
  ];
  if (structure.purpose) lines.push("", `**Purpose:** ${structure.purpose}`);
  if (structure.audience) lines.push(`**Audience:** ${structure.audience}`);
  if (structure.coreNarrative) lines.push("", `**Core narrative:** ${structure.coreNarrative}`);
  for (const section of structure.sections) {
    lines.push("", `## ${section.title}`, "", section.content.trim());
  }
  if (structure.missingInputs.length) {
    lines.push("", "## Internal gaps", "", ...structure.missingInputs.map((item) => `- ${item}`));
  }
  return lines.join("\n").trim();
}

function renderPressRelease(title: string, structure: StructuredSongDocument) {
  const sections = new Map(structure.sections.map((section) => [section.key, section]));
  const headline = sections.get("headline")?.content.trim() || title;
  const dek = sections.get("dek")?.content.trim();
  const lede = sections.get("dateline_lede")?.content.trim();
  const body = sections.get("body")?.content.trim();
  const quote = sections.get("artist_quote")?.content.trim();
  const releaseDetails = sections.get("release_details")?.content.trim();
  const about = sections.get("about_artist")?.content.trim();
  const contact = sections.get("press_contact")?.content.trim();
  const lines = [`# ${headline}`];
  if (dek) lines.push("", `_${dek}_`);
  if (lede) lines.push("", lede);
  if (body) lines.push("", body);
  if (quote) lines.push("", quote.split("\n").map((line) => `> ${line}`).join("\n"));
  if (releaseDetails) lines.push("", "## Release details", "", releaseDetails);
  if (about) lines.push("", "## About the artist", "", about);
  if (contact) lines.push("", "## Media contact", "", contact);
  return lines.join("\n").trim();
}

function renderLyrics(title: string, structure: StructuredSongDocument) {
  const lyrics = structure.sections.find((section) => section.key === "lyrics")?.content.trim()
    ?? structure.sections[0]?.content.trim()
    ?? "";
  return [`# ${title}`, "", lyrics].join("\n").trim();
}

function orderedRenderableSections(documentType: PremiumSongDocumentType, structure: StructuredSongDocument) {
  const standard = songDocumentStandards[documentType];
  const sectionMap = new Map(structure.sections.map((section) => [section.key, section]));
  const orderedKeys = [...standard.requiredSections, ...(standard.optionalSections ?? [])].map((section) => section.key);
  const known = orderedKeys.flatMap((key) => sectionMap.get(key) ? [sectionMap.get(key)!] : []);
  const seen = new Set(known.map((section) => section.key));
  const extras = structure.sections.filter((section) => !seen.has(section.key));
  return [...known, ...extras];
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

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanKey(value: unknown) {
  return cleanText(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function cleanStringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return unique(value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim().slice(0, maxLength)] : [])).slice(0, maxItems);
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
