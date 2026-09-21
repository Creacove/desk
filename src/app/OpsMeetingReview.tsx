import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronDown, CircleAlert, RotateCcw, ShieldCheck } from "lucide-react";
import { ProductButton } from "../design-system/components";
import type { createBrowserSupabaseClient } from "../lib/supabaseClient";

type Client = ReturnType<typeof createBrowserSupabaseClient>;
type ReviewState = "loading" | "unprocessed" | "processing" | "review_ready" | "applying" | "applied" | "declined" | "failed" | "error";

export function OpsMeetingReview({ client, artistWorkspaceId, opsMeetingId, onBack }: { client: Client; artistWorkspaceId: string; opsMeetingId: string; onBack: () => void }) {
  const [state, setState] = useState<ReviewState>("loading");
  const [meeting, setMeeting] = useState<{ transcript: string | null; processing_status: string; desk_run_id: string | null; caseName: string } | null>(null);
  const [review, setReview] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: meetingRow, error: meetingError } = await client.from("ops_meetings").select("transcript,processing_status,desk_run_id,ops_cases(display_name,desk_workspace_id)").eq("id", opsMeetingId).maybeSingle();
      if (meetingError) throw meetingError;
      const linked = Array.isArray(meetingRow?.ops_cases) ? meetingRow?.ops_cases[0] : meetingRow?.ops_cases;
      if (!meetingRow || linked?.desk_workspace_id !== artistWorkspaceId) throw new Error("This meeting is not linked to the selected workspace.");
      setMeeting({ transcript: meetingRow.transcript, processing_status: meetingRow.processing_status, desk_run_id: meetingRow.desk_run_id, caseName: linked?.display_name ?? "Ops meeting" });
      if (!meetingRow.desk_run_id) { setReview(null); setState(meetingRow.processing_status === "failed" ? "failed" : "unprocessed"); return; }
      const { data: run, error: runError } = await client.from("manager_synthesis_runs").select("status,result_payload").eq("id", meetingRow.desk_run_id).eq("artist_workspace_id", artistWorkspaceId).maybeSingle();
      if (runError) throw runError;
      const payload = run?.result_payload as Record<string, any> | null;
      setReview(payload?.output ?? null);
      const status = payload?.reviewStatus ?? (meetingRow.processing_status === "processed" ? "applied" : run?.status === "failed" ? "failed" : meetingRow.processing_status);
      setState(status as ReviewState);
    } catch (loadError) {
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "The meeting review could not load.");
    }
  }, [artistWorkspaceId, client, opsMeetingId]);

  useEffect(() => { void load(); }, [load]);

  const callProcess = async () => {
    setBusy(true); setError(null); setState("processing");
    try {
      const { data, error: invokeError } = await client.functions.invoke("ops-meeting-process", { body: { opsMeetingId, artistWorkspaceId } });
      if (invokeError) throw invokeError;
      setReview(data?.review ?? null); setState(data?.status === "review_ready" ? "review_ready" : data?.status === "applied" ? "applied" : "processing");
      await load();
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "The meeting could not be processed."); setState("failed");
    } finally { setBusy(false); }
  };

  const decide = async (decision: "apply" | "decline") => {
    setBusy(true); setError(null); setState("applying");
    try {
      const { data, error: invokeError } = await client.functions.invoke("ops-meeting-apply", { body: { opsMeetingId, artistWorkspaceId, decision } });
      if (invokeError) throw invokeError;
      setReview(data?.review ?? review); setState(data?.status === "applied" ? "applied" : "declined");
      await load();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "The review decision could not be saved."); setState("failed");
    } finally { setBusy(false); }
  };

  const output = review ?? {};
  const decisions = Array.isArray(output.missionGraphDecisions) ? output.missionGraphDecisions : [];
  const questions = Array.isArray(output.contextQuestions) ? output.contextQuestions : [];
  const memory = Array.isArray(output.durableMemory) ? output.durableMemory : [];
  const isReady = state === "review_ready";
  return <main data-testid="ops-meeting-review" className="app-theme min-h-dvh bg-background px-5 py-6 text-foreground sm:px-8 lg:px-12"><div className="mx-auto w-full max-w-[860px]">
    <button type="button" className="mb-8 inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> Back to workspace</button>
    <header className="border-b border-foreground/10 pb-7"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent"><ShieldCheck className="h-3.5 w-3.5" /> Internal review</div><h1 className="mt-3 font-display text-[34px] font-semibold tracking-[-0.035em]">{meeting?.caseName ?? "Ops meeting"}</h1><p className="mt-2 text-[14px] font-medium text-muted-foreground">Meeting interpretation for your approval. Nothing changes in Desk until you apply it.</p></header>
    {error ? <div className="mt-6 flex items-start gap-3 border border-red-500/20 bg-red-500/5 p-4 text-[13px] text-red-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div> : null}
    {state === "loading" ? <p className="mt-10 text-[13px] text-muted-foreground">Loading meeting review…</p> : null}
    {state === "unprocessed" || state === "failed" ? <section className="mt-10 border border-foreground/10 p-6"><h2 className="font-display text-[20px] font-semibold">{state === "failed" ? "Review needs attention" : "Transcript ready"}</h2><p className="mt-2 text-[13px] text-muted-foreground">{meeting?.transcript ? "Process the transcript to prepare a review." : "Add a transcript in Ops before processing this meeting."}</p><div className="mt-5"><ProductButton onClick={() => void callProcess()} disabled={busy || !meeting?.transcript}>{state === "failed" ? <><RotateCcw className="h-4 w-4" /> Retry</> : "Process for review"}</ProductButton></div></section> : null}
    {state === "processing" || state === "applying" ? <div className="mt-10 border border-foreground/10 p-6"><p className="text-[13px] text-muted-foreground">{state === "applying" ? "Saving your decision…" : "Manager is preparing a bounded review…"}</p></div> : null}
    {review ? <section className="mt-10 space-y-8"><ReviewSection title="What we heard"><p>{output.responseBody || output.summary || "No summary was returned."}</p></ReviewSection><ReviewSection title="Recommended Desk changes"><div className="space-y-3">{decisions.length ? decisions.map((decision: any, index: number) => <div key={`${decision.mission?.title ?? "change"}-${index}`} className="border border-foreground/10 p-4"><strong>{decision.mission?.title ?? decision.decisionSummary ?? "Proposed change"}</strong><p className="mt-1 text-[13px] text-muted-foreground">{decision.decisionSummary || decision.mission?.summary || "Review the proposed mission update."}</p><span className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{decision.outcome === "update_existing_mission" ? "Update existing mission" : "New mission"}</span></div>) : <p className="text-[13px] text-muted-foreground">No durable Desk changes recommended.</p>}</div></ReviewSection>{questions.length ? <ReviewSection title="Open uncertainties"><ul className="space-y-2 text-[13px]">{questions.map((question: any, index: number) => <li key={`${question.key ?? "question"}-${index}`}>{question.question}</li>)}</ul></ReviewSection> : null}{memory.length ? <ReviewSection title="Memory candidates"><ul className="space-y-2 text-[13px]">{memory.map((item: string, index: number) => <li key={`${item}-${index}`}>{item}</li>)}</ul></ReviewSection> : null}<details className="border-t border-foreground/10 pt-5"><summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold text-muted-foreground">Transcript context<ChevronDown className="h-4 w-4" /></summary><p className="mt-4 whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground">{meeting?.transcript || "No transcript."}</p></details>{isReady ? <div className="sticky bottom-4 flex flex-wrap gap-2 border border-foreground/10 bg-background/95 p-3 backdrop-blur"><ProductButton onClick={() => void decide("apply")} disabled={busy}><Check className="h-4 w-4" /> Apply changes</ProductButton><ProductButton variant="secondary" onClick={() => void decide("decline")} disabled={busy}>Decline</ProductButton></div> : null}{state === "applied" ? <div className="flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5 p-4 text-[13px] text-emerald-800"><Check className="h-4 w-4" /> Applied to Desk. Existing records were reused where available.</div> : null}{state === "declined" ? <div className="border border-foreground/10 p-4 text-[13px] text-muted-foreground">Declined. No Desk records were changed.</div> : null}</section> : null}
  </div></main>;
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="font-display text-[18px] font-semibold">{title}</h2><div className="mt-3 text-[14px] leading-6 text-foreground/80">{children}</div></section>;
}
