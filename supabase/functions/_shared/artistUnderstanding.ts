export type ArtistUnderstandingRow = {
  id: string;
  scope_type: 'artist' | 'music_item' | 'music_project';
  scope_id?: string | null;
  understanding_key: string;
  category: string;
  statement: string;
  structured_value?: unknown;
  source_kind: string;
  source_type?: string | null;
  source_id?: string | null;
  source_ref?: string | null;
  confidence: string;
  authority: string;
  updated_at?: string;
};

export type ArtistOperatingFactRow = {
  id: string;
  domain: string;
  fact_key: string;
  scope_type: string;
  scope_key?: string | null;
  value_json?: unknown;
  display_value?: string | null;
  source_type?: string | null;
  confidence?: string | null;
  updated_at?: string | null;
};

export type FocusedMusicScope = { type: 'music_item' | 'music_project'; id: string };

const authorityRank: Record<string, number> = {
  artist_confirmed: 4,
  trusted_source: 3,
  supported: 2,
  inferred: 1,
};

const semanticCategories = new Set([
  'meaning',
  'theme',
  'themes',
  'cultural_context',
  'identity',
  'artist_identity',
  'creative_direction',
  'creative_intent',
  'narrative',
  'positioning',
  'communication',
  'audience_context',
  'community_context',
  'influence',
  'influences',
]);

export function isSemanticArtistUnderstanding(row: Pick<ArtistUnderstandingRow, 'category' | 'source_type' | 'understanding_key'>) {
  const category = row.category.trim().toLowerCase();
  if (semanticCategories.has(category)) return true;
  if (row.source_type === 'operating_fact' || row.understanding_key.startsWith('fact.')) return false;
  return category !== 'source_material' && category !== 'resources' && category !== 'constraints' && category !== 'relationships' && category !== 'preferences' && category !== 'goals';
}

export function compactArtistUnderstanding(rows: ArtistUnderstandingRow[], focused?: FocusedMusicScope) {
  return rows
    .filter(isSemanticArtistUnderstanding)
    .filter((row) => row.scope_type === 'artist' || (focused && row.scope_type === focused.type && row.scope_id === focused.id))
    .sort((a, b) => (authorityRank[b.authority] ?? 0) - (authorityRank[a.authority] ?? 0) || String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))
    .slice(0, 40)
    .map((row) => ({
      id: row.id,
      scopeType: row.scope_type,
      scopeId: row.scope_id ?? null,
      key: row.understanding_key,
      category: row.category,
      statement: row.statement,
      value: row.structured_value ?? {},
      sourceKind: row.source_kind,
      sourceType: row.source_type ?? '',
      sourceId: row.source_id ?? '',
      sourceRef: row.source_ref ?? '',
      confidence: row.confidence,
      authority: row.authority,
      updatedAt: row.updated_at ?? '',
    }));
}

export function compactArtistOperatingReality(rows: ArtistOperatingFactRow[]) {
  return rows.slice(0, 60).map((row) => ({
    id: row.id,
    domain: row.domain,
    key: row.fact_key,
    scopeType: row.scope_type,
    scopeKey: row.scope_key ?? '',
    value: row.value_json ?? {},
    displayValue: row.display_value ?? '',
    sourceType: row.source_type ?? '',
    confidence: row.confidence ?? 'unknown',
    updatedAt: row.updated_at ?? '',
  }));
}

/**
 * A single Manager knowledge context assembled from canonical owners.
 * This object is runtime context only: semantic understanding remains in
 * artist_understandings and operational reality remains in artist_operating_facts.
 */
export function buildManagerArtistKnowledgeContext(input: {
  understanding: ArtistUnderstandingRow[];
  operatingFacts: ArtistOperatingFactRow[];
  focused?: FocusedMusicScope;
}) {
  return {
    semanticUnderstanding: compactArtistUnderstanding(input.understanding, input.focused),
    operatingReality: compactArtistOperatingReality(input.operatingFacts),
    rules: artistUnderstandingInstructions(),
  };
}

export function artistUnderstandingInstructions() {
  return [
    'semanticUnderstanding contains canonical current meaning and creative context: artist identity, music meaning, themes, cultural context, creative intent, narrative and positioning. It is not generic historical memory and it is not a copy of operational facts.',
    'operatingReality owns resources, collaborators/access, constraints, preferences, goals and other practical facts. Use semanticUnderstanding and operatingReality together when choosing work.',
    'artist_confirmed semantic understanding outranks trusted_source, supported and inferred understanding. Never present Manager inference as artist-confirmed fact.',
    'Documents and lyrics are source evidence, not semantic truth by themselves. Distinguish what the source literally says from what the Manager inferred from it.',
    'When meaning, culture, identity or creative intent changes the correct route, the Mission, Task, positioning, content idea or recommendation must visibly reflect that context rather than falling back to generic promotion.',
    'Do not ask for information already present in semanticUnderstanding or operatingReality. Ask only when unresolved uncertainty materially changes the decision and cannot be safely researched or inferred.',
    'Derived Manager Reads and runtime packets may use this knowledge, but they never outrank the canonical semantic understanding or operational facts that produced them.',
  ];
}
