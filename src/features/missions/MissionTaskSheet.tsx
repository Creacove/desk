import { Check, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "../../design-system/desktopPrimitives";
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/28 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-task-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] border border-foreground/10 bg-background shadow-[0_28px_80px_hsl(var(--foreground)/0.18)] sm:max-w-[620px] sm:rounded-[20px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-foreground/8 bg-background/96 px-4 py-3 backdrop-blur-xl sm:px-5">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/68">
            {checkpoint ? `Step ${checkpoint.phase} · ${checkpoint.title}` : "Mission work"}
          </p>
          <IconButton type="button" onClick={onClose} label="Close task" variant="ghost" size="md">
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-6">
          <div className="flex items-start gap-3">
            <span className={cn("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", done ? "border-brand-accent bg-brand-accent text-white" : "border-foreground/15")}>
              {done ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <div className="min-w-0">
              <h2 id="mission-task-sheet-title" className="font-display text-[24px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[26px]">
                {task.title}
              </h2>
              {task.deadline ? <p className="mt-2 text-[12px] font-medium text-muted-foreground">{task.deadline}</p> : null}
            </div>
          </div>

          {availableAfter ? (
            <p className="mt-5 rounded-[12px] bg-foreground/[0.035] px-3.5 py-3 text-[12px] font-medium text-muted-foreground">
              Available after {availableAfter}
            </p>
          ) : null}

          {task.purpose ? (
            <p className="os-body-copy mt-5 w-full font-medium text-foreground/80">{task.purpose}</p>
          ) : null}

          {task.steps.length ? (
            <section className="mt-6 border-t border-foreground/8 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/68">What to do</p>
              <div className="mt-3 grid gap-3">
                {task.steps.map((step, index) => (
                  <div key={`${task.id}-step-${index}`} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5">
                    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-foreground/[0.055] text-[11px] font-semibold text-muted-foreground">{index + 1}</span>
                    <p className="os-body-copy pt-0.5 font-medium text-foreground/78">{step}</p>
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
                      <p className="os-list-title truncate text-foreground">{deliverable.title}</p>
                      <p className="os-list-meta mt-1 truncate font-medium text-muted-foreground">
                        {deliverable.fileName || humanDeliverableStatus(deliverable.status)}
                      </p>
                    </div>
                    {!["uploaded", "checking", "accepted"].includes(deliverable.status) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => pickFile(deliverable)}
                        disabled={pending || unavailable}
                        pending={pending && mutation?.kind === "upload" && uploadTargetId === deliverable.id}
                        leadingIcon={<Upload className="h-3.5 w-3.5" />}
                      >
                        Upload
                      </Button>
                    ) : (
                      <span className="text-[12px] font-semibold text-brand-accent">Ready</span>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/68">Draft</p>
              <p className="mt-2 text-[13px] font-semibold text-foreground">{task.managerDraft.title}</p>
              <ManagerDraftDocument content={task.managerDraft.summary} />
            </section>
          ) : null}

          {task.result?.summary ? (
            <section className="mt-5 border-t border-foreground/8 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/68">Result</p>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-foreground">{task.result.summary}</p>
              {task.result.interpretation ? <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">{task.result.interpretation}</p> : null}
              {task.result.followUp ? <p className="mt-2 text-[12px] font-semibold leading-relaxed text-brand-accent">{task.result.followUp}</p> : null}
            </section>
          ) : null}

          {mutation?.status === "error" ? (
            <p role="alert" className="mt-5 rounded-[12px] bg-destructive/5 px-3.5 py-3 text-[12px] font-medium text-destructive">
              {mutation.message}
            </p>
          ) : null}

          {done ? (
            <div className="mt-7 flex min-h-12 items-center gap-2 rounded-[14px] bg-brand-accent/[0.07] px-4 text-[13px] font-semibold text-brand-accent">
              <Check className="h-4 w-4" />
              Done
            </div>
          ) : unavailable ? (
            <div className="mt-7 border-t border-foreground/8 pt-5">
              <Button type="button" size="lg" disabled className="w-full">
                {task.approvalState === "needs approval" ? "Approve" : completionMode === "manager_draft" ? "Work with Manager" : deliverables.length ? "Upload" : "Mark complete"}
              </Button>
            </div>
          ) : workMode === "manager_work" ? (
            <div className="mt-7 rounded-[14px] bg-foreground/[0.035] px-4 py-4">
              <p className="text-[13px] font-semibold text-foreground">In progress</p>
            </div>
          ) : intent ? (
            <div className="mt-7 border-t border-foreground/8 pt-5">
              <label htmlFor={`task-note-${task.id}`} className="text-[12px] font-semibold text-foreground">
                {intent === "blocked" ? "What’s stopping this?" : completionMode === "result_note" ? "What changed?" : "Add a note (optional)"}
              </label>
              <textarea
                id={`task-note-${task.id}`}
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={intent === "blocked" ? "Describe what’s stopping the work." : "Add the outcome."}
                className="mt-2 w-full resize-none rounded-[14px] border border-foreground/10 bg-background px-3.5 py-3 text-[14px] font-medium leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-brand-accent/45 focus:ring-2 focus:ring-brand-accent/8"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => { setIntent(null); setNote(""); }}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={submitCompletion}
                  pending={pending}
                  disabled={noteRequired && !note.trim()}
                >
                  {intent === "blocked" ? "Report blocker" : completionMode === "manager_draft" ? "Submit for review" : "Mark complete"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-7 grid gap-2 border-t border-foreground/8 pt-5">
              {task.approvalState === "needs approval" && !approved ? (
                <Button type="button" size="lg" onClick={onApprove} pending={pending} className="w-full">
                  Approve
                </Button>
              ) : completionMode === "manager_draft" && (!task.managerDraft || managerDraftNeedsRevision(task)) ? (
                <Button type="button" size="lg" onClick={onWorkWithManager} disabled={pending} className="w-full">
                  Work with Manager
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setIntent("completed")}
                  disabled={pending || blocked || !canComplete}
                  className="w-full"
                >
                  {completionMode === "manager_draft" ? "Submit for review" : completionMode === "result_note" ? "Add result" : "Mark complete"}
                </Button>
              )}

              {!blocked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => setIntent("blocked")}
                  disabled={pending}
                  className="w-full"
                >
                  Report a blocker
                </Button>
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
    <div className="mt-3 grid gap-2.5 text-[13px] font-medium leading-relaxed text-foreground/78">
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
    ? <strong key={`${index}-${part}`} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    : <span key={`${index}-${part}`}>{part}</span>);
}
