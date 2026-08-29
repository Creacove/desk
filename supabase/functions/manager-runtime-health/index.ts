import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withAppErrorCapture } from "../_shared/appFunction.ts";

type Input={accountId?:string;mode?:"read"|"evaluate"};
Deno.serve(withAppErrorCapture("manager-runtime-health",async(request)=>{
  if(request.method!=="POST") return json({error:"Method not allowed."},405);
  const serviceRoleKey=requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const workerSecret=request.headers.get("x-workflow-worker-secret")??"";
  const auth=request.headers.get("Authorization")??"";
  if(!constantTimeEqual(auth,`Bearer ${serviceRoleKey}`)&&!constantTimeEqual(workerSecret,requireEnv("WORKFLOW_WORKER_SECRET"))) return json({error:"Unauthorized."},401);
  const input=await request.json().catch(()=>({})) as Input;
  if(input.accountId!=null&&!isUuid(input.accountId)) return json({error:"accountId must be a UUID."},400);
  const db=createClient(requireEnv("SUPABASE_URL"),serviceRoleKey);
  if(input.mode==="evaluate"){
    if(!input.accountId) return json({error:"evaluate mode requires accountId."},400);
    const {data,error}=await db.rpc("evaluate_manager_runtime_health_v1",{p_account_id:input.accountId});
    if(error) return json({error:"Runtime health evaluation failed."},503);
    return json(data??{});
  }
  const {data:diagnostics,error}=await db.rpc("manager_runtime_diagnostics_v1",{p_account_id:input.accountId??null});
  if(error) return json({error:"Runtime diagnostics failed."},503);
  let incidents:any[]=[];
  let query=db.from("manager_runtime_incidents").select("id,account_id,incident_key,severity,title,detail,status,first_seen_at,last_seen_at,metadata").is("resolved_at",null).order("last_seen_at",{ascending:false}).limit(100);
  if(input.accountId) query=query.eq("account_id",input.accountId);
  const incidentResult=await query;if(incidentResult.error) return json({error:"Runtime incidents could not be loaded."},503);incidents=incidentResult.data??[];
  return json({diagnostics:diagnostics??{},openIncidents:incidents});
}));
function requireEnv(key:string){const value=Deno.env.get(key);if(!value)throw new Error(`Missing required environment variable: ${key}`);return value;}function isUuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}function constantTimeEqual(left:string,right:string){const length=Math.max(left.length,right.length,1);let difference=left.length^right.length;for(let i=0;i<length;i+=1)difference|=(left.charCodeAt(i%Math.max(left.length,1))||0)^(right.charCodeAt(i%Math.max(right.length,1))||0);return difference===0;}function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});}
