import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildManagerConversationModelContext } from '../supabase/functions/_shared/manager-conversation/context';
import { assertExecutableHumanTask } from '../supabase/functions/_shared/managerTaskQuality';
import { buildCareerWatchRequest } from '../supabase/functions/_shared/manager-intelligence/careerWatch';

const taskExecution = read('supabase/functions/manager-task-execution/index.ts');
const taskReview = read('supabase/functions/manager-review-task-result/index.ts');
const adaptiveRuntime = read('supabase/functions/manager-runtime-runner/index.ts');
const workflowRecovery = read('supabase/functions/workflow-recovery/index.ts');
const permissionAction = read('supabase/functions/manager-permission-action/index.ts');
const splitSender = read('supabase/functions/send-split-confirmations/index.ts');
const careerWatchWorker = read('supabase/functions/manager-career-watch/index.ts');
const productionSupabase = read('src/services/productionSupabase.ts');
const workSurface = read('src/features/missions/MissionWorkSurface.tsx');
const todayRuntime = read('src/features/desk/TodayRuntimeExecution.tsx');
const worldModel = read('supabase/migrations/20260829080300_world_model_question_engine.sql');
const resultAdaptation = read('supabase/migrations/20260829080800_generic_task_result_adaptation.sql');
const continuation = read('supabase/migrations/20260829080630_manager_result_adaptation_continuation.sql');
const careerWatchMigration = read('supabase/migrations/20260829190000_manager_career_watch.sql');

const knowledge = {
  contractVersion: 'manager-knowledge-v1',
  semanticUnderstanding: [
    { id:'identity', scopeType:'artist', scopeId:null, key:'artist.identity', category:'artist_identity', statement:'strength and unity are central to the artist world', authority:'artist_confirmed', confidence:'high' },
    { id:'meaning', scopeType:'music_item', scopeId:'odaeshi', key:'music.meaning', category:'song_meaning', statement:'surviving difficult things that should have broken us and remaining standing', authority:'artist_confirmed', confidence:'high' },
  ],
  operatingReality: [
    { id:'people', domain:'people', key:'people.friends_available_for_content', scopeType:'artist', scopeKey:'artist', displayValue:'two friends are available', confidence:'high' },
    { id:'place', domain:'places', key:'places.parked_car_access', scopeType:'artist', scopeKey:'artist', displayValue:'a parked car is available', confidence:'high' },
    { id:'money', domain:'money', key:'money.content_budget', scopeType:'artist', scopeKey:'artist', displayValue:'₦0 is available for this content', confidence:'high' },
  ],
  rules: [],
};

function packet() {
  return {
    artist:{id:'artist',name:'Otmos'},
    focusedMusicSubject:{type:'music_item' as const,id:'odaeshi',title:'Odaeshi'},
    memory:[{id:'knowledge',scope:'artist',kind:'fact',source_type:'manager_knowledge_v1',confidence:'high',reason:'canonical',content:JSON.stringify(knowledge)}],
    existingMissions:[],existingTasks:[],conversationHistory:[],evidence:[],music:{items:[],projects:[]},recentAgentReports:[],activePlaybookKeys:[],recommendedMissionPatterns:[],rules:{},
  };
}

describe('Gate 7 full Manager golden path', () => {
  it('starts reasoning from the same durable artist/song knowledge used everywhere else', () => {
    const context:any = buildManagerConversationModelContext({accountId:'a',artistWorkspaceId:'w',artistId:'artist',body:'I want to release Odaeshi',musicSubject:{type:'music_item',id:'odaeshi'}}, packet(), 'conversation');
    const managerKnowledge = JSON.stringify(context.openingBrief.managerKnowledge);
    expect(managerKnowledge).toContain('remaining standing');
    expect(managerKnowledge).toContain('two friends');
    expect(managerKnowledge).toContain('parked car');
    expect(managerKnowledge).toContain('₦0');
    expect(context.openingBrief.truthPriority.join(' ')).toContain('before deciding, planning, reviewing, or asking the artist');
  });

  it('turns that understanding into exact human work rather than generic advice', () => {
    const task = {
      title:'Shoot “What couldn’t finish us?”',
      purpose:'Test Odaeshi as a shared language for resilience using the artist-confirmed meaning and resources already available.',
      steps:[
        'Park the available car somewhere quiet, mount the phone vertically, and frame Otmos with the two available friends.',
        'Ask each friend for one thing they thought they would not come back from; keep each answer to one natural sentence.',
        'Otmos closes with “That’s Odaeshi,” then bring the Odaeshi song in immediately after the line.',
        'Edit with simple hard cuts, post to TikTok or Reels with a prompt asking what people survived, and use a quiet room with all three people if the parked car is unavailable.',
      ],
      completionExpectation:'One vertical video is live on TikTok or Reels and the public post link or live confirmation is returned to Desk.',
      managerResponsibility:'Desk chose the concept from Odaeshi’s meaning, the available people/place and zero budget, prepared the execution route, and will review the result and change the next move.',
      userResponsibility:'Otmos and the two friends record and post the physical/social content.',
      riskIfLate:'Desk loses the current learning window for whether the resilience framing is landing with the audience.',
    };
    expect(() => assertExecutableHumanTask(task)).not.toThrow();
    expect(JSON.stringify(task)).toContain('Odaeshi');
    expect(JSON.stringify(task)).toContain('two available friends');
    expect(JSON.stringify(task)).toContain('available car');
  });

  it('uses the production human execution, result review and adaptive continuation chain', () => {
    expect(workSurface).toContain('startMissionTask(task.id)');
    expect(workSurface).toContain('onCompleteTask(');
    expect(productionSupabase).toContain('client.functions.invoke("manager-review-task-result"');
    expect(taskExecution).toContain('status: "in_progress"');
    expect(taskReview).toContain('task_results');
    expect(taskReview).toContain('manager_interpretation');
    expect(taskReview).toContain('reviewMustUpdateMissionState: true');
    expect(resultAdaptation).toContain("'adaptive_replan'");
    expect(resultAdaptation).toContain('do not wait for the artist to ask what next');
    expect(adaptiveRuntime).toContain('freshMemory');
    expect(adaptiveRuntime).toContain('operatingFacts');
    expect(continuation).toContain('manager_next_executable_task_v1');
    expect(continuation).toContain('manager_continuation_ready');
    expect(todayRuntime).toContain('Desk is watching:');
  });

  it('lets one necessary resource question update canonical reality and resume the same review', () => {
    expect(worldModel).toContain('persist_manager_question_request_v1');
    expect(worldModel).toContain('capture_world_model_answer_v1');
    expect(worldModel).toContain("'user_answer'");
    expect(worldModel).toContain("set status = 'due'");
    expect(worldModel).toContain("'source', 'world-model-answer'");
    expect(worldModel).toContain('use the stored fallback instead of asking the same question again');
  });

  it('proactively watches the outside world using the same Manager knowledge and real provenance', () => {
    const request:any = buildCareerWatchRequest({artistName:'Otmos',homeMarket:'Nigeria',genres:['Afrobeats'],currentGoal:'move Odaeshi forward',artistDirection:'strength and unity'}, knowledge);
    expect(request.tools).toEqual([{type:'web_search'}]);
    expect(request.input).toContain('remaining standing');
    expect(request.input).toContain('two friends');
    expect(request.instructions).toContain('not a news feed');
    expect(careerWatchMigration).toContain("e.evidence_type<>'manager_career_watch'");
    expect(careerWatchMigration).toContain("'adaptive_replan'");
    expect(careerWatchMigration).toContain("'due'");
    expect(careerWatchMigration).toContain("review_key:='career-watch:'");
    expect(careerWatchWorker).toContain('.eq("evidence_type","manager_career_watch")');
    expect(careerWatchWorker).toContain('mode:"adaptive_replan"');
    expect(careerWatchWorker).toContain('source:"manager-career-watch"');
  });

  it('keeps external action behind Manager intent and artist approval, then wakes continuation', () => {
    const producer = read('supabase/tests/manager_action_producer_smoke.sql');
    expect(producer).toContain('prepare_split_confirmations_for_approval');
    expect(producer).toContain('resolve_manager_permission_v1');
    expect(producer).toContain('complete_manager_action_execution_v1');
    expect(producer).toContain("trigger_type = 'adaptive_replan'");
    expect(producer).toContain("runtime_key = 'permission:'");
    expect(permissionAction).toContain('shouldExecute');
    expect(splitSender).toContain('manager_action_execution_receipts');
    expect(splitSender).toContain('permission.status !== "approved"');
    expect(splitSender).toContain('sameJson(action.payload, permission.parameters)');
    expect(splitSender).toContain('sameJson(action.payload, receipt.request_payload)');
    expect(splitSender).toContain('"Idempotency-Key"');
    expect(workflowRecovery).toContain('adaptive_replan');
  });

  it('has an explicit state when no human Task is next instead of forcing “what next?”', () => {
    expect(continuation).toContain('No human action is required right now');
    expect(continuation).toContain('No further human action is currently required');
    expect(continuation).toContain("continuation_kind := 'manager_checkpoint'");
    expect(continuation).toContain("continuation_kind := 'no_human_work'");
  });
});

function read(path:string){return readFileSync(join(process.cwd(),path),'utf8');}
