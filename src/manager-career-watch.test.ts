import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {buildCareerWatchInstructions,buildCareerWatchRequest,normalizeCareerWatchOutput} from '../supabase/functions/_shared/manager-intelligence/careerWatch';

const worker=readFileSync('supabase/functions/manager-career-watch/index.ts','utf8');
const dispatcher=readFileSync('supabase/functions/manager-career-watch-dispatcher/index.ts','utf8');
const reliability=readFileSync('supabase/migrations/20260829200700_manager_career_watch_reliability.sql','utf8');

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
  it('turns supported findings into public-web evidence with explicit Career Watch decisions and limitations',()=>{
    const rows:any[]=normalizeCareerWatchOutput({accountId:'a',artistWorkspaceId:'w',artistId:'r',artistName:'Otmos',createdFromRunId:'run',output:{findings:[{title:'Open call',url:'https://example.com/open-call',sourceDomain:'example.com',publishedAt:'2026-08-29',opportunityType:'press',subjectName:'Open call',claim:'Submissions are open',whyItMatters:'Matches the current release story',fitReason:'Odaeshi resilience angle fits',recommendedDecision:'act',urgency:'now',confidence:'high',missionObjective:'Submit a focused Odaeshi press pitch before the deadline',nextMove:'Prepare the pitch package',riskOrLimitation:'Acceptance is not guaranteed'}]}});
    expect(rows).toHaveLength(1);
    expect(rows[0].source_kind).toBe('public_web');
    expect(rows[0].evidence_type).toBe('manager_career_watch');
    expect(rows[0].metadata.pipeline).toBe('manager_career_watch');
    expect(rows[0].metadata.recommended_decision).toBe('act');
    expect(rows[0].metadata.mission_objective).toContain('Odaeshi');
    expect(rows[0].limitation).toContain('not guaranteed');
  });
  it('drops findings without navigable evidence or a decision',()=>{
    const rows=normalizeCareerWatchOutput({accountId:'a',artistWorkspaceId:'w',artistId:'r',artistName:'Otmos',output:{findings:[{title:'rumor',url:'not-a-url',recommendedDecision:'act'},{title:'no decision',url:'https://example.com'}]}});
    expect(rows).toHaveLength(0);
  });
  it('does not turn public opportunity evidence into a new active Mission',()=>{
    expect(reliability).toContain('queue_manager_career_watch_review_v1');
    expect(reliability).toContain("status not in('complete','archived','cancelled')");
    expect(reliability).not.toContain('insert into public.missions');
  });
  it('serializes evidence deduplication and accounts for provider usage',()=>{
    expect(reliability).toContain('persist_manager_career_watch_evidence_v1');
    expect(reliability).toContain('pg_advisory_xact_lock');
    expect(worker).toContain('persist_manager_career_watch_evidence_v1');
    expect(worker).toContain('ai_run_usage_events');
    expect(worker).toContain('operation_key: "manager_career_watch_v1"');
  });
  it('makes scheduled execution lease-owned so duplicate and stale dispatches cannot win',()=>{
    expect(reliability).toContain('execution_token uuid');
    expect(reliability).toContain('begin_manager_career_watch_execution_v1');
    expect(reliability).toContain('finish_manager_career_watch_execution_v1');
    expect(dispatcher).toContain('executionToken: row.execution_token');
    expect(worker).toContain('p_execution_token: input.executionToken');
  });
  it('bounds scheduled downstream execution',()=>{
    expect(dispatcher).toContain('fetchProviderWithTimeout');
  });
});
