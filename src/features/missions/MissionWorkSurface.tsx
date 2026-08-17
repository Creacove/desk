import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import type {
  MissionCheckpointViewModel,
  MissionTaskDeliverableViewModel,
  MissionTaskViewModel,
  MissionViewModel,
} from "../../types/cleanProduction";
import { TaskSheet } from "./MissionTaskSheet";
import { MissionBrief, MissionNow, StageIcon, TaskRow } from "./MissionWorkParts";
import {
  type CompletionIntent,
  type TaskMutationState,
  errorMessage,
  getBlockingDependency,
  getInitialCheckpointId,
  getNextArtistTask,
  humanCheckpointStatus,
  isOpenArtistTask,
  isTaskOptimisticallyDone,
  omitKey,
  replaceDeliverable,
  resolveTaskDeliverables,
} from "./missionModel";

export function WorkSurface({
  mission,
  checkpoints,
  tasks,
  targetTaskId,
  onApproveTask,
  onCompleteTask,
  onUploadTaskDeliverable,
  onWorkWithManager,
}: {
  mission: MissionViewModel;
  checkpoints: MissionCheckpointViewModel[];
  tasks: MissionTaskViewModel[];
  targetTaskId?: string;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked", note: string, documentIds?: string[], managerOutputId?: string) => Promise<void>;
  onUploadTaskDeliverable?: (taskId: string, input: { title: string; file: File }) => Promise<MissionTaskDeliverableViewModel>;
  onWorkWithManager?: (taskId: string) => void;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(targetTaskId ?? null);
  const [openStageId, setOpenStageId] = useState<string>(() => getInitialCheckpointId(checkpoints, tasks));
  const [optimisticApproved, setOptimisticApproved] = useState<string[]>([]);
  const [optimisticCompleted, setOptimisticCompleted] = useState<string[]>([]);
  const [mutations, setMutations] = useState<Record<string, TaskMutationState>>({});
  const [deliverablesByTask, setDeliverablesByTask] = useState<Record<string, MissionTaskDeliverableViewModel[]>>({});

  useEffect(() => {
    setSelectedTaskId(targetTaskId ?? null);
  }, [targetTaskId]);

  useEffect(() => {
    const next = getInitialCheckpointId(checkpoints, tasks);
    if (!openStageId || !checkpoints.some((checkpoint) => checkpoint.id === openStageId)) setOpenStageId(next);
  }, [checkpoints, tasks, openStageId]);

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null;
  const attentionTask = getNextArtistTask(tasks, checkpoints, optimisticCompleted);
  const attentionCheckpoint = attentionTask ? checkpoints.find((checkpoint) => checkpoint.id === attentionTask.checkpointId) : undefined;

  async function approveTask(task: MissionTaskViewModel) {
    setMutations((current) => ({ ...current, [task.id]: { kind: "approve", status: "pending" } }));
    try {
      await onApproveTask(task.id);
      setOptimisticApproved((current) => [...new Set([...current, task.id])]);
      setMutations((current) => omitKey(current, task.id));
    } catch (error) {
      setMutations((current) => ({
        ...current,
        [task.id]: { kind: "approve", status: "error", message: errorMessage(error, "Approval failed. Try again.") },
      }));
    }
  }

  async function completeTask(task: MissionTaskViewModel, intent: CompletionIntent, note: string) {
    setMutations((current) => ({ ...current, [task.id]: { kind: intent === "blocked" ? "block" : "complete", status: "pending" } }));
    const deliverables = resolveTaskDeliverables(task, deliverablesByTask[task.id]);
    try {
      await onCompleteTask(
        task.id,
        intent,
        note.trim(),
        deliverables.map((deliverable) => deliverable.documentId).filter(Boolean) as string[],
        task.managerDraft?.id,
      );
      if (intent === "completed") setOptimisticCompleted((current) => [...new Set([...current, task.id])]);
      setMutations((current) => omitKey(current, task.id));
    } catch (error) {
      setMutations((current) => ({
        ...current,
        [task.id]: {
          kind: intent === "blocked" ? "block" : "complete",
          status: "error",
          message: errorMessage(
            error,
            intent === "blocked"
              ? "Could not report the blocker."
              : task.completionMode === "manager_draft"
                ? "Manager review did not finish. Submit again to retry."
                : "Could not save this result.",
          ),
        },
      }));
    }
  }

  async function uploadDeliverable(task: MissionTaskViewModel, deliverable: MissionTaskDeliverableViewModel, file: File) {
    setMutations((current) => ({ ...current, [task.id]: { kind: "upload", status: "pending" } }));
    const uploading = { ...deliverable, status: "uploading" as const, fileName: file.name };
    setDeliverablesByTask((current) => ({
      ...current,
      [task.id]: replaceDeliverable(resolveTaskDeliverables(task, current[task.id]), uploading),
    }));

    try {
      const uploaded = onUploadTaskDeliverable
        ? await onUploadTaskDeliverable(task.id, { title: deliverable.title, file })
        : {
            ...deliverable,
            status: "uploaded" as const,
            documentId: `local-${task.id}-${Date.now()}`,
            fileName: file.name,
            validationSummary: "Ready for Manager review.",
          };
      setDeliverablesByTask((current) => ({
        ...current,
        [task.id]: replaceDeliverable(resolveTaskDeliverables(task, current[task.id]), { ...uploaded, id: deliverable.id }),
      }));
      setMutations((current) => omitKey(current, task.id));
    } catch (error) {
      setDeliverablesByTask((current) => ({
        ...current,
        [task.id]: replaceDeliverable(resolveTaskDeliverables(task, current[task.id]), {
          ...deliverable,
          status: "failed",
          fileName: file.name,
        }),
      }));
      setMutations((current) => ({
        ...current,
        [task.id]: { kind: "upload", status: "error", message: errorMessage(error, "Upload failed. Try again.") },
      }));
    }
  }

  return (
    <div className="grid min-w-0 gap-8">
      <MissionNow
        mission={mission}
        task={attentionTask}
        checkpoint={attentionCheckpoint}
        optimisticApproved={optimisticApproved}
        optimisticCompleted={optimisticCompleted}
        mutations={mutations}
        onOpenTask={(task) => setSelectedTaskId(task.id)}
      />

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">Work</p>
            <h2 className="mt-1 font-display text-[23px] font-semibold tracking-[-0.025em] text-foreground">The path from here</h2>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">{tasks.filter((task) => isTaskOptimisticallyDone(task, optimisticCompleted)).length}/{tasks.length || 0} done</span>
        </div>

        <div className="border-y border-foreground/9">
          {checkpoints.map((checkpoint) => {
            const stageTasks = tasks.filter((task) => task.checkpointId === checkpoint.id);
            const stageDone = stageTasks.filter((task) => isTaskOptimisticallyDone(task, optimisticCompleted)).length;
            const open = openStageId === checkpoint.id;
            const lockedBy = getBlockingDependency(checkpoint, checkpoints);
            const stageComplete = checkpoint.status === "Met" || checkpoint.status === "Ready for AI review";
            const needsAttention = stageTasks.some((task) => isOpenArtistTask(task) && !isTaskOptimisticallyDone(task, optimisticCompleted));
            const stageStatus = lockedBy
              ? `Starts after ${lockedBy.title}`
              : checkpoint.status === "Needs revision"
                ? "Needs attention"
                : stageTasks.length && stageDone === stageTasks.length && !stageComplete
                  ? "Manager reviewing"
                  : stageTasks.length
                    ? `${stageDone} of ${stageTasks.length} done`
                    : checkpoint.status === "Watching signal"
                      ? "Manager is watching this"
                      : humanCheckpointStatus(checkpoint.status);

            return (
              <article key={checkpoint.id} data-testid={`task-group-${checkpoint.id}`} className="border-b border-foreground/8 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenStageId((current) => current === checkpoint.id ? "" : checkpoint.id)}
                  className="grid min-h-[72px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3.5 text-left sm:min-h-[78px]"
                  aria-expanded={open}
                >
                  <StageIcon complete={stageComplete} attention={needsAttention || checkpoint.status === "Needs revision"} phase={checkpoint.phase} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold text-foreground">{checkpoint.title}</span>
                    <span className="mt-1 block truncate text-[11px] font-semibold text-muted-foreground">{stageStatus}</span>
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground/55 transition-transform", open && "rotate-180")} />
                </button>

                {open ? (
                  <div className="pb-3 pl-10 sm:pl-11">
                    {lockedBy ? (
                      <p className="pb-4 pr-3 text-[12px] font-medium leading-relaxed text-muted-foreground">
                        This stage will open after <span className="font-bold text-foreground">{lockedBy.title}</span>.
                      </p>
                    ) : null}

                    {checkpoint.status === "Needs revision" && checkpoint.blockedReason ? (
                      <div className="mb-3 mr-3 rounded-[14px] bg-[#fff8f3] px-3.5 py-3 text-[12px] font-semibold leading-relaxed text-[#9a3412]">
                        {checkpoint.blockedReason}
                      </div>
                    ) : null}

                    {stageTasks.length ? (
                      <div className="divide-y divide-foreground/7 border-t border-foreground/7">
                        {stageTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            approved={optimisticApproved.includes(task.id) || task.approvalState === "approved"}
                            done={isTaskOptimisticallyDone(task, optimisticCompleted)}
                            mutation={mutations[task.id]}
                            locked={Boolean(lockedBy)}
                            onOpen={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="pb-4 pr-3 text-[12px] font-medium leading-relaxed text-muted-foreground">
                        Nothing is needed from you here. The Manager will surface an action if that changes.
                      </p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <MissionBrief mission={mission} />

      {selectedTask ? (
        <TaskSheet
          key={selectedTask.id}
          task={selectedTask}
          checkpoint={checkpoints.find((checkpoint) => checkpoint.id === selectedTask.checkpointId)}
          approved={optimisticApproved.includes(selectedTask.id) || selectedTask.approvalState === "approved"}
          done={isTaskOptimisticallyDone(selectedTask, optimisticCompleted)}
          mutation={mutations[selectedTask.id]}
          deliverables={resolveTaskDeliverables(selectedTask, deliverablesByTask[selectedTask.id])}
          onClose={() => setSelectedTaskId(null)}
          onApprove={() => approveTask(selectedTask)}
          onComplete={(intent, note) => {
            if (intent === "completed" && selectedTask.completionMode === "manager_draft") setSelectedTaskId(null);
            void completeTask(selectedTask, intent, note);
          }}
          onUpload={(deliverable, file) => uploadDeliverable(selectedTask, deliverable, file)}
          onWorkWithManager={() => onWorkWithManager?.(selectedTask.id)}
        />
      ) : null}
    </div>
  );
}
