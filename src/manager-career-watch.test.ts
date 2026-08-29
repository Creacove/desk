import {describe,expect,it} from 'vitest';
import {buildCareerWatchInstructions,buildCareerWatchRequest,normalizeCareerWatchOutput} from '../supabase/functions/_shared/manager-intelligence/careerWatch';

describe('Gate 6 Manager Career Watch',()=>{
  it('searches for artist-specific external changes rather than generic news',()=>{
    const instructions=buildCareerWatchInstructions();
    expect(instructions).toContain('not a news feed');
    expect(instructions).toContain('specific URL');
    expect(instructions).toContain('current goal, direction, identity/meaning');
    expect(instructions).toContain('Do not infer private analytics');
    expect(instructions).toContain('act, watch, or ignore');
  });
  it('forces web search and supplies the Manager knowledge contract',()=>{
    const request:any=buildCareerWatchRequest({artistName:'Otmos',homeMarket:'Nigeria',currentGoal:'grow Odaeshi',artistDirection:'strength and unity'},{semanticUnderstanding:[{statement:'remaining standing'}],operatingReality:[{displayValue:'₦0'}]});
    expect(request.tools).toEqual([{type:'web_search'}]);
    expect(request.tool_choice).toBe('required');
    expect(request.input).toContain('remaining standing');
    expect(request.input).toContain('₦0');
  });
  it('turns supported findings into evidence with explicit Manager decisions and limitations',()=>{
    const rows:any[]=normalizeCareerWatchOutput({accountId:'a',artistWorkspaceId:'w',artistId:'r',artistName:'Otmos',createdFromRunId:'run',output:{findings:[{title:'Open call',url:'https://example.com/open-call',sourceDomain:'example.com',publishedAt:'2026-08-29',opportunityType:'press',subjectName:'Open call',claim:'Submissions are open',whyItMatters:'Matches the current release story',fitReason:'Odaeshi resilience angle fits',recommendedDecision:'act',urgency:'now',confidence:'high',missionObjective:'Submit a focused Odaeshi press pitch before the deadline',nextMove:'Prepare the pitch package',riskOrLimitation:'Acceptance is not guaranteed'}]}});
    expect(rows).toHaveLength(1);
    expect(rows[0].source_kind).toBe('career_watch');
    expect(rows[0].metadata.recommended_decision).toBe('act');
    expect(rows[0].metadata.mission_objective).toContain('Odaeshi');
    expect(rows[0].limitation).toContain('not guaranteed');
  });
  it('drops findings without navigable evidence or a decision',()=>{
    const rows=normalizeCareerWatchOutput({accountId:'a',artistWorkspaceId:'w',artistId:'r',artistName:'Otmos',output:{findings:[{title:'rumor',url:'not-a-url',recommendedDecision:'act'},{title:'no decision',url:'https://example.com'}]}});
    expect(rows).toHaveLength(0);
  });
});
