import { describe, expect, it } from 'vitest';
import {
  artistUnderstandingInstructions,
  buildManagerArtistKnowledgeContext,
  compactArtistUnderstanding,
  isSemanticArtistUnderstanding,
} from '../supabase/functions/_shared/artistUnderstanding';
import { buildManagerHumanTaskGenerationContract } from '../supabase/functions/_shared/managerHumanTaskGenerationContract';

describe('Gate 5 artist understanding contract', () => {
  it('keeps artist-confirmed semantic meaning ahead of inference and scopes song context', () => {
    const rows:any[]=[
      {id:'1',scope_type:'music_item',scope_id:'odaeshi',understanding_key:'meaning',category:'meaning',statement:'generic toughness',source_kind:'manager_inference',confidence:'medium',authority:'inferred'},
      {id:'2',scope_type:'artist',scope_id:null,understanding_key:'identity',category:'artist_identity',statement:'strength and unity are central to the artist world',source_kind:'artist_statement',confidence:'high',authority:'artist_confirmed'},
      {id:'3',scope_type:'music_item',scope_id:'odaeshi',understanding_key:'meaning.confirmed',category:'meaning',statement:'surviving difficult things and remaining standing',source_kind:'artist_statement',confidence:'high',authority:'artist_confirmed'},
      {id:'4',scope_type:'music_item',scope_id:'other',understanding_key:'meaning',category:'meaning',statement:'unrelated song',source_kind:'artist_statement',confidence:'high',authority:'artist_confirmed'},
    ];
    const context=compactArtistUnderstanding(rows,{type:'music_item',id:'odaeshi'});
    expect(context.map(x=>x.id)).toEqual(['2','3','1']);
    expect(context.some(x=>x.statement==='unrelated song')).toBe(false);
  });

  it('does not duplicate World Model facts or raw documents as semantic understanding', () => {
    expect(isSemanticArtistUnderstanding({category:'resources',source_type:'operating_fact',understanding_key:'fact.resources'})).toBe(false);
    expect(isSemanticArtistUnderstanding({category:'source_material',source_type:'document',understanding_key:'source.document.lyrics.1'})).toBe(false);
    expect(isSemanticArtistUnderstanding({category:'cultural_context',source_type:'document_synthesis',understanding_key:'culture.odaeshi'})).toBe(true);
  });

  it('assembles semantic meaning and operational reality into one Manager knowledge context without merging ownership', () => {
    const knowledge=buildManagerArtistKnowledgeContext({
      understanding:[{id:'meaning',scope_type:'music_item',scope_id:'odaeshi',understanding_key:'meaning',category:'meaning',statement:'surviving difficult things and remaining standing',source_kind:'artist_statement',confidence:'high',authority:'artist_confirmed'}],
      operatingFacts:[{id:'resources',domain:'resources',fact_key:'available_people',scope_type:'artist',display_value:'two friends and a parked car',source_type:'user_answer',confidence:'high'}],
      focused:{type:'music_item',id:'odaeshi'},
    });
    expect(knowledge.semanticUnderstanding[0].statement).toContain('remaining standing');
    expect(knowledge.operatingReality[0].displayValue).toContain('two friends');
    expect(knowledge.semanticUnderstanding.some((item:any)=>item.category==='resources')).toBe(false);
  });

  it('forces visible Tasks to use semantic meaning and operating reality together',()=>{
    const rules=artistUnderstandingInstructions().join(' ');
    const taskContract=buildManagerHumanTaskGenerationContract();
    expect(rules).toContain('semanticUnderstanding contains canonical current meaning');
    expect(rules).toContain('operatingReality owns resources');
    expect(rules).toContain('Do not ask for information already present');
    expect(taskContract).toContain('semanticUnderstanding owns current artist identity');
    expect(taskContract).toContain('make it materially shape the work');
    expect(taskContract).toContain('Never invent meaning');
  });
});
