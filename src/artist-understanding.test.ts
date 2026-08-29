import { describe, expect, it } from 'vitest';
import {
  artistUnderstandingInstructions,
  buildManagerArtistKnowledgeContext,
  compactArtistUnderstanding,
  isSemanticArtistUnderstanding,
} from '../supabase/functions/_shared/artistUnderstanding';
import { buildManagerHumanTaskGenerationContract } from '../supabase/functions/_shared/managerHumanTaskGenerationContract';
import { buildManagerConversationModelContext } from '../supabase/functions/_shared/manager-conversation/context';

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
    expect(taskContract).toContain('focused song or project');
  });

  it('golden: deeper Odaeshi understanding reaches the actual conversation model input and changes it without cross-song leakage', () => {
    const input={
      accountId:'account',artistWorkspaceId:'workspace',artistId:'artist',body:'What should we do for this release?',
      musicSubject:{type:'music_item' as const,id:'odaeshi'},
    };
    const baseKnowledge={
      contractVersion:'manager-knowledge-v1',
      operatingReality:[
        {id:'people',domain:'people',key:'people.friends_available_for_content',scopeType:'artist',scopeKey:'artist',displayValue:'two friends are available'},
        {id:'place',domain:'places',key:'places.parked_car_access',scopeType:'artist',scopeKey:'artist',displayValue:'parked car is available'},
        {id:'money',domain:'money',key:'money.content_budget',scopeType:'artist',scopeKey:'artist',displayValue:'₦0 available for this content'},
      ],
      rules:[],
    };
    const packetFor=(meaning:string)=>({
      artist:{id:'artist',name:'Otmos'},
      focusedMusicSubject:{type:'music_item',id:'odaeshi',title:'Odaeshi'},
      memory:[{
        id:'knowledge',scope:'artist',kind:'fact',source_type:'manager_knowledge_v1',confidence:'high',reason:'canonical',
        content:JSON.stringify({
          ...baseKnowledge,
          semanticUnderstanding:[
            {id:'identity',scopeType:'artist',scopeId:null,key:'artist.identity',category:'artist_identity',statement:'strength and unity are central to the artist world',authority:'artist_confirmed',confidence:'high'},
            {id:'odaeshi',scopeType:'music_item',scopeId:'odaeshi',key:'music.meaning',category:'song_meaning',statement:meaning,authority:'artist_confirmed',confidence:'high'},
            {id:'other',scopeType:'music_item',scopeId:'other-song',key:'music.meaning',category:'song_meaning',statement:'romantic nightlife and escape',authority:'artist_confirmed',confidence:'high'},
          ],
        }),
      }],
      existingMissions:[],existingTasks:[],conversationHistory:[],evidence:[],music:{items:[],projects:[]},recentAgentReports:[],activePlaybookKeys:[],recommendedMissionPatterns:[],rules:{},
    });

    const resilience:any=buildManagerConversationModelContext(input,packetFor('surviving difficult things that should have broken us and remaining standing'),'conversation');
    const celebration:any=buildManagerConversationModelContext(input,packetFor('celebrating a breakthrough after years of work'),'conversation');
    const resilienceJson=JSON.stringify(resilience.openingBrief.managerKnowledge);
    const celebrationJson=JSON.stringify(celebration.openingBrief.managerKnowledge);

    expect(resilienceJson).toContain('remaining standing');
    expect(resilienceJson).toContain('strength and unity');
    expect(resilienceJson).toContain('two friends');
    expect(resilienceJson).toContain('parked car');
    expect(resilienceJson).toContain('₦0');
    expect(resilienceJson).not.toContain('romantic nightlife and escape');
    expect(celebrationJson).toContain('celebrating a breakthrough');
    expect(celebrationJson).not.toBe(resilienceJson);
    expect(resilience.openingBrief.truthPriority.join(' ')).toContain('use it before deciding, planning, reviewing, or asking the artist');
  });

  it('keeps managerKnowledge even when the opening brief hits the byte budget', () => {
    const context:any=buildManagerConversationModelContext({
      accountId:'account',artistWorkspaceId:'workspace',artistId:'artist',body:'Decide the next move',musicSubject:{type:'music_item',id:'odaeshi'},
    },{
      artist:{id:'artist',name:'Otmos'},
      focusedMusicSubject:{type:'music_item',id:'odaeshi',title:'Odaeshi',metadata:{noise:'x'.repeat(60000)}},
      memory:[{source_type:'manager_knowledge_v1',content:JSON.stringify({contractVersion:'manager-knowledge-v1',semanticUnderstanding:[{scopeType:'music_item',scopeId:'odaeshi',key:'music.meaning',category:'song_meaning',statement:'remaining standing',authority:'artist_confirmed'}],operatingReality:[]})}],
      conversationHistory:[],evidence:[],music:{items:[],projects:[]},existingMissions:[],existingTasks:[],recentAgentReports:[],activePlaybookKeys:[],recommendedMissionPatterns:[],rules:{},
    },'conversation');
    expect(context.openingBrief.version).toBe('manager_opening_brief_v5_compact');
    expect(JSON.stringify(context.openingBrief.managerKnowledge)).toContain('remaining standing');
  });
});
