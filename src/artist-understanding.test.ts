import { describe, expect, it } from 'vitest';
import { artistUnderstandingInstructions, compactArtistUnderstanding } from '../supabase/functions/_shared/artistUnderstanding';

describe('Gate 5 artist understanding contract', () => {
  it('keeps artist-confirmed meaning ahead of inference and scopes song context', () => {
    const rows:any[]=[
      {id:'1',scope_type:'music_item',scope_id:'odaeshi',understanding_key:'meaning',category:'meaning',statement:'generic toughness',source_kind:'manager_inference',confidence:'medium',authority:'inferred'},
      {id:'2',scope_type:'artist',scope_id:null,understanding_key:'resources',category:'resources',statement:'two friends, parked car, zero budget',source_kind:'artist_statement',confidence:'high',authority:'artist_confirmed'},
      {id:'3',scope_type:'music_item',scope_id:'odaeshi',understanding_key:'meaning.confirmed',category:'meaning',statement:'surviving difficult things and remaining standing',source_kind:'artist_statement',confidence:'high',authority:'artist_confirmed'},
      {id:'4',scope_type:'music_item',scope_id:'other',understanding_key:'meaning',category:'meaning',statement:'unrelated song',source_kind:'artist_statement',confidence:'high',authority:'artist_confirmed'},
    ];
    const packet=compactArtistUnderstanding(rows,{type:'music_item',id:'odaeshi'});
    expect(packet.map(x=>x.id)).toEqual(['2','3','1']);
    expect(packet.some(x=>x.statement==='unrelated song')).toBe(false);
  });
  it('requires decisions to use meaning/resources and avoids redundant questions',()=>{
    const rules=artistUnderstandingInstructions().join(' ');
    expect(rules).toContain('Use song meaning, culture, identity, resources');
    expect(rules).toContain('Do not ask for information already present');
    expect(rules).toContain('Never present Manager inference as artist-confirmed fact');
  });
});
