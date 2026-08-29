import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withAppErrorCapture } from "../_shared/appFunction.ts";

type WatchRow={account_id:string;artist_workspace_id:string;artist_id:string};
Deno.serve(withAppErrorCapture("manager-career-watch-dispatcher",async(request)=>{
  if(request.method!=="POST") return json({error:"Method not allowed."},405);
  const secret=request.headers.get("x-workflow-worker-secret")??"";
  if(!constantTimeEqual(secret,requireEnv("WORKFLOW_WORKER_SECRET"))) return json({error:"Unauthorized."},401);
  const url=requireEnv("SUPABASE_URL");const key=requireEnv("SUPABASE_SERVICE_ROLE_KEY");const db=createClient(url,key);
  const {data,error}=await db.rpc("claim_due_manager_career_watch_v1",{batch_size:8});if(error)return json({error:"Due Career Watch work could not be claimed."},503);
  const rows=Array.isArray(data)?data as WatchRow[]:[];const results=[];
  for(const row of rows){try{const response=await fetch(`${url}/functions/v1/manager-career-watch`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({accountId:row.account_id,artistWorkspaceId:row.artist_workspace_id,artistId:row.artist_id,trigger:"scheduled"})});const body=await response.json().catch(()=>({}));results.push({artistWorkspaceId:row.artist_workspace_id,status:response.ok?"dispatched":"failed",downstreamStatus:response.status,runId:body?.runId??null});if(!response.ok)await db.from("manager_career_watch_state").update({last_error:`Career Watch dispatch failed (${response.status}).`,next_run_at:new Date(Date.now()+60*60_000).toISOString()}).eq("account_id",row.account_id).eq("artist_workspace_id",row.artist_workspace_id).eq("artist_id",row.artist_id);}catch(error){const message=error instanceof Error?error.message:"Career Watch dispatch failed.";await db.from("manager_career_watch_state").update({last_error:message.slice(0,1000),next_run_at:new Date(Date.now()+60*60_000).toISOString()}).eq("account_id",row.account_id).eq("artist_workspace_id",row.artist_workspace_id).eq("artist_id",row.artist_id);results.push({artistWorkspaceId:row.artist_workspace_id,status:"failed"});}}
  return json({processed:results.length,results});
}));
function requireEnv(key:string){const value=Deno.env.get(key);if(!value)throw new Error(`Missing required environment variable: ${key}`);return value;}function constantTimeEqual(left:string,right:string){if(!left||!right||left.length!==right.length)return false;let diff=0;for(let i=0;i<left.length;i+=1)diff|=left.charCodeAt(i)^right.charCodeAt(i);return diff===0;}function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});}
