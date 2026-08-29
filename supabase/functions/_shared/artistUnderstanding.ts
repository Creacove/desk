export type ArtistUnderstandingRow = {
  id: string; scope_type: 'artist'|'music_item'|'music_project'; scope_id?: string|null;
  understanding_key: string; category: string; statement: string; structured_value?: unknown;
  source_kind: string; source_type?: string|null; source_id?: string|null; source_ref?: string|null;
  confidence: string; authority: string; updated_at?: string;
};

const authorityRank: Record<string, number> = { artist_confirmed: 4, trusted_source: 3, supported: 2, inferred: 1 };

export function compactArtistUnderstanding(rows: ArtistUnderstandingRow[], focused?: {type:'music_item'|'music_project';id:string}) {
  return rows
    .filter((row) => row.scope_type === 'artist' || (focused && row.scope_type === focused.type && row.scope_id === focused.id))
    .sort((a,b) => (authorityRank[b.authority]??0)-(authorityRank[a.authority]??0) || String(b.updated_at??'').localeCompare(String(a.updated_at??'')))
    .slice(0, 40)
    .map((row) => ({ id:row.id, scopeType:row.scope_type, scopeId:row.scope_id??null, key:row.understanding_key, category:row.category, statement:row.statement, value:row.structured_value??{}, sourceKind:row.source_kind, sourceType:row.source_type??'', sourceId:row.source_id??'', sourceRef:row.source_ref??'', confidence:row.confidence, authority:row.authority, updatedAt:row.updated_at??'' }));
}

export function artistUnderstandingInstructions() {
  return [
    'artistUnderstanding is canonical current meaning/context, not generic historical memory.',
    'artist_confirmed understanding outranks trusted_source, supported, and inferred understanding.',
    'Use song meaning, culture, identity, resources, relationships, constraints, preferences and goals when choosing work; do not reduce decisions to metrics when this context changes the move.',
    'Do not ask for information already present in artistUnderstanding. Research or infer safely before asking; ask only when unresolved uncertainty would materially change the decision.',
    'Never present Manager inference as artist-confirmed fact.'
  ];
}
