import { Check, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type {
  MissionCheckpointViewModel,
  MissionTaskDeliverableViewModel,
  MissionTaskViewModel,
} from "../../types/cleanProduction";
import {
  type CompletionIntent,
  type TaskMutationState,
  humanDeliverableStatus,
  managerDraftNeedsRevision,
  resolveTaskCompletionMode,
  resolveTaskWorkMode,
} from "./missionModel";

export function TaskSheet({
  task,
  checkpoint,
  approved,
  done,
  mutation,
  deliverables,
  availableAfter,
  onClose,
  onApprove,
  onComplete,
  onUpload,
  onWorkWithManager,
}: {
  task: MissionTaskViewModel;
  checkpoint?: MissionCheckpointViewModel;
  approved: boolean;
  done: boolean;
  mutation?: TaskMutationState;
  deliverables: MissionTaskDeliverableViewModel[];
  availableAfter?: string;
  onClose: () => void;
  onApprove: () => void;
  onComplete: (intent: CompletionIntent, note: string) => void;
  onUpload: (deliverable: MissionTaskDeliverableViewModel, file: File) => void;
  onWorkWithManager: () => void;
}) {
  const [intent, setIntent] = useState<CompletionIntent | null>(null);
  const [note, setNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const workMode = resolveTaskWorkMode(task);
  const completionMode = resolveTaskCompletionMode(task);
  const pending = mutation?.status === "pending";
  const blocked = task.result?.status === "blocked" || task.approvalState === "blocked";
  const unavailable = Boolean(availableAfter);
  const canComplete = !unavailable && (task.approvalState !== "needs approval" || approved);
  const noteRequired = intent === "blocked" || completionMode === "result_note";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, pending]);

  function pickFile(deliverable: MissionTaskDeliverableViewModel) {
    if (unavailable) return;
    setUploadTargetId(deliverable.id);
    fileInputRef.current?.click();
  }

  function submitCompletion() {
    if (!intent || unavailable) return;
    if (noteRequired && !note.trim()) return;
    onComplete(intent, note);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/32 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-task-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[26px] border border-foreground/10 bg-background shadow-2xl sm:max-w-[620px] sm:rounded-[24px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-foreground/8 bg-background/96 px-4 py-3 backdrop-blur-xl sm:px-5">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">
            {checkpoint ? `Step ${checkpoint.phase} · ${checkpoint.title}` : "Mission work"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-6">
          <div className="flex items-start gap-3">
            <span className={cn("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", done ? "border-brand-accent bg-brand-accent text-white" : "border-foreground/15")}>
              {done ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <div className="min-w-0">
              <h2 id="mission-task-sheet-title" className="font-display text-[25px] font-semibold leading-tight tracking-[-0.025em] text-foreground">
                {task.title}
              </h2>
              {task.deadline ? <p className="mt-2 text-[12px] font-semibold text-muted-foreground">{task.deadline}</p> : null}
            </div>
          </div>

          {availableAfter ? (
            <p className="mt-5 rounded-[12px] bg-foreground/[0.035] px-3.5 py-3 text-[12px] font-semibold text-muted-foreground">
              Available after {availableAfter}
            </p>
          ) : null}

          {task.purpose ? (
            <p className="mt-5 max-w-[540px] text-[14px] font-medium leading-[1.65] text-foreground/80">{task.purpose}</p>
          ) : null}

          {task.steps.length ? (
            <section className="mt-6 border-t border-foreground/8 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">What to do</p>
              <div className="mt-3 grid gap-2.5">
                {task.steps.map((step, index) => (
                  <div key={`${task.id}-step-${index}`} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.055] text-[9px] font-bold text-muted-foreground">{index + 1}</span>
                    <p className="pt-0.5 text-[12.5px] font-medium leading-relaxed text-foreground/78">{step}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {deliverables.length ? (
            <section className="mt-6 border-t border-foreground/8 pt-5">
              <div className="grid gap-2">
                {deliverables.map((deliverable) => (
                  <div key={deliverable.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-foreground/8 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-bold text-foreground">{deliverable.title}</p>
                      <p className="mt-1 truncate text-[10.5px] font-semibold text-muted-foreground">
                        {deliverable.fileName || humanDeliverableStatus(deliverable.status)}
                      </p>
                    </div>
                    {!["uploaded", "checking", "accepted"].includes(deliverable.status) ? (
                      <button
                        type="button"
                        onClick={() => pickFile(deliverable)}
                        disabled={pending || unavailable}
                        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[10px] border border-foreground/10 px-3 text-[11px] font-bold text-foreground transition-colors hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-brand-accent">Ready</span>
                    )}
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                aria-label={`Upload file for ${task.title}`}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  const target = deliverables.find((deliverable) => deliverable.id === uploadTargetId);
                  if (file && target && !unavailable) onUpload(target, file);
                  event.currentTarget.value = "";
                }}
              />
            </section>
          ) : null}

          {task.managerDraft ? (
            <section className="mt-6 rounded-[16px] bg-foreground/[0.03] px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">Draft</p>
              <p className="mt-2 text-[13px] font-bold text-foreground">{task.managerDraft.title}</p>
              <ManagerDraftDocument content={task.managerDraft.summary} />
            </section>
          ) : null}

          {task.result?.summary ? (
            <section className="mt-5 border-t border-foreground/8 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">Result</p>
              <p className="mt-2 text-[13px] font-bold leading-relaxed text-foreground">{task.result.summary}</p>
              {task.result.interpretation ? <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">{task.result.interpretation}</p> : null}
              {task.result.followUp ? <p className="mt-2 text-[12px] font-bold leading-relaxed text-brand-accent">{task.result.followUp}</p> : null}
            </section>
          ) : null}

          {mutation?.status === "error" ? (
            <p role="alert" className="mt-5 rounded-[12px] bg-red-50 px-3.5 py-3 text-[12px] font-semibold text-red-700">
              {mutation.message}
            </p>
          ) : null}

          {done ? (
            <div className="mt-7 flex min-h-12 items-center gap-2 rounded-[14px] bg-brand-accent/[0.07] px-4 text-[13px] font-bold text-brand-accent">
              <Check className="h-4 w-4" />
              Done
            </div>
          ) : unavailable ? (
            <div className="mt-7 border-t border-foreground/8 pt-5">
              <button
                type="button"
                disabled
                className="min-h-12 w-full rounded-[12px] bg-foreground px-4 text-[13px] font-bold text-background opacity-35"
              >
                {task.approvalState === "needs approval" ? "Review" : completionMode === "manager_draft" ? "Continue" : deliverables.length ? "Upload" : "Complete"}
              </button>
            </div>
          ) : workMode === "manager_work" ? (
            <div className="mt-7 rounded-[14px] bg-foreground/[0.035] px-4 py-4">
              <p className="text-[13px] font-bold text-foreground">In progress</p>
            </div>
          ) : intent ? (
            <div className="mt-7 border-t border-foreground/8 pt-5">
              <label htmlFor={`task-note-${task.id}`} className="text-[11px] font-bold text-foreground">
                {intent === "blocked" ? "What’s stopping this?" : completionMode === "result_note" ? "What changed?" : "Add a note (optional)"}
              </label>
              <textarea
                id={`task-note-${task.id}`}
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={intent === "blocked" ? "Describe what’s stopping the work." : "Add the outcome."}
                className="mt-2 w-full resize-none rounded-[14px] border border-foreground/10 bg-background px-3.5 py-3 text-[13px] font-medium leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-brand-accent/45"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setIntent(null); setNote(""); }}
                  disabled={pending}
                  className="min-h-11 rounded-[11px] border border-foreground/10 text-[12px] font-bold text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitCompletion}
                  disabled={pending || (noteRequired && !note.trim())}
                  className="inline-flex min-h-11 items-center justify-center rounded-[11px] bg-foreground px-4 text-[12px] font-bold text-background disabled:opacity-40"
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {intent === "blocked" ? "Send" : completionMode === "manager_draft" ? "Submit for review" : "Mark complete"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-7 grid gap-2 border-t border-foreground/8 pt-5">
              {task.approvalState === "needs approval" && !approved ? (
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={pending}
                  className="inline-flex min-h-12 items-center justify-center rounded-[12px] bg-foreground px-4 text-[13px] font-bold text-background disabled:opacity-45"
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Review
                </button>
              ) : completionMode === "manager_draft" && (!task.managerDraft || managerDraftNeedsRevision(task)) ? (
                <button
                  type="button"
                  onClick={onWorkWithManager}
                  disabled={pending}
                  className="min-h-12 rounded-[12px] bg-foreground px-4 text-[13px] font-bold text-background disabled:opacity-45"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIntent("completed")}
                  disabled={pending || blocked || !canComplete}
                  className="min-h-12 rounded-[12px] bg-foreground px-4 text-[13px] font-bold text-background disabled:opacity-40"
                >
                  {completionMode === "manager_draft" ? "Submit for review" : completionMode === "result_note" ? "Add result" : "Mark complete"}
                </button>
              )}

              {!blocked ? (
                <button
                  type="button"
                  onClick={() => setIntent("blocked")}
                  disabled={pending}
                  className="min-h-11 rounded-[11px] text-[12px] font-bold text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground disabled:opacity-45"
                >
                  Something’s blocking me
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ManagerDraftDocument({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="mt-3 grid gap-2.5 text-[12.5px] font-medium leading-relaxed text-foreground/78">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <span key={`space-${index}`} className="h-0.5" aria-hidden="true" />;
        if (line.startsWith("## ")) {
          return <h3 key={`${index}-${line}`} className="font-display text-[17px] font-semibold text-foreground">{renderInlineMarkdown(line.slice(3))}</h3>;
        }
        if (line.startsWith("# ")) {
          return <h3 key={`${index}-${line}`} className="font-display text-[19px] font-semibold text-foreground">{renderInlineMarkdown(line.slice(2))}</h3>;
        }
        if (/^[-*] /.test(line)) {
          return (
            <div key={`${index}-${line}`} className="grid grid-cols-[8px_minmax(0,1fr)] gap-2.5 pl-1">
              <span className="mt-[8px] h-1 w-1 rounded-full bg-foreground/45" aria-hidden="true" />
              <p>{renderInlineMarkdown(line.replace(/^[-*] /, ""))}</p>
            </div>
          );
        }
        return <p key={`${index}-${line}`}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

function renderInlineMarkdown(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={`${index}-${part}`} className="font-bold text-foreground">{part.slice(2, -2)}</strong>
    : <span key={`${index}-${part}`}>{part}</span>);
}
