import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import type {
  MissionCheckpointViewModel,
  MissionTaskDeliverableViewModel,
  MissionTaskViewModel,
  MissionViewModel,
} from "../../types/cleanProduction";
import { TaskSheet } from "./MissionTaskSheet";
import { TaskRow } from "./MissionWorkParts";
import {
  type CompletionIntent,
  type TaskMutationState,
  errorMessage,
  getBlockingDependency,
  getInitialCheckpointId,
  getNextArtistTask,
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
  const initialCheckpointId = useMemo(() => getInitialCheckpointId(checkpoints, tasks), [checkpoints, tasks]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(targetTaskId ?? null);
  const [openStageIds, setOpenStageIds] = useState<string[]>(() => initialCheckpointId ? [initialCheckpointId] : []);
  const [optimisticApproved, setOptimisticApproved] = useState<string[]>([]);
  const [optimisticCompleted, setOptimisticCompleted] = useState<string[]>([]);
  const [mutations, setMutations] = useState<Record<string, TaskMutationState>>({});
  const [deliverablesByTask, setDeliverablesByTask] = useState<Record<string, MissionTaskDeliverableViewModel[]>>({});

  useEffect(() => {
    setSelectedTaskId(targetTaskId ?? null);
  }, [targetTaskId]);

  useEffect(() => {
    setOpenStageIds((current) => {
      const valid = current.filter((id) => checkpoints.some((checkpoint) => checkpoint.id === id));
      if (valid.length || !initialCheckpointId) return valid;
      return [initialCheckpointId];
    });
  }, [checkpoints, initialCheckpointId]);

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null;
  const attentionTask = getNextArtistTask(tasks, checkpoints, optimisticCompleted);
  const selectedCheckpoint = selectedTask
    ? checkpoints.find((checkpoint) => checkpoint.id === selectedTask.checkpointId)
    : undefined;
  const selectedBlocker = selectedCheckpoint ? getBlockingDependency(selectedCheckpoint, checkpoints) : undefined;

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
      if (!onUploadTaskDeliverable) throw new Error("Evidence upload is unavailable. The file was not saved.");
      const uploaded = await onUploadTaskDeliverable(task.id, { title: deliverable.title, file });
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

  function toggleStep(checkpointId: string) {
    setOpenStageIds((current) =>
      current.includes(checkpointId)
        ? current.filter((id) => id !== checkpointId)
        : [...current, checkpointId],
    );
  }

  return (
    <div className="grid min-w-0 gap-2">
      <div className="border-y border-foreground/9">
        {checkpoints.map((checkpoint) => {
          const stageTasks = tasks.filter((task) => task.checkpointId === checkpoint.id);
          const stageDone = stageTasks.filter((task) => isTaskOptimisticallyDone(task, optimisticCompleted)).length;
          const open = openStageIds.includes(checkpoint.id);
          const lockedBy = getBlockingDependency(checkpoint, checkpoints);
          const currentTaskInStep = attentionTask?.checkpointId === checkpoint.id ? attentionTask : null;

          return (
            <section key={checkpoint.id} data-testid={`task-group-${checkpoint.id}`} className="border-b border-foreground/8 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleStep(checkpoint.id)}
                className="flex min-h-[68px] w-full items-center justify-between gap-4 py-3.5 text-left"
                aria-expanded={open}
              >
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold leading-snug text-foreground">
                    Step {checkpoint.phase} · {checkpoint.title}
                  </span>
                  <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">
                    {stageDone} of {stageTasks.length} done
                  </span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground/55 transition-transform", open && "rotate-180")} />
              </button>

              {open ? (
                <div className="relative mb-4 ml-2 border-l border-foreground/10 pl-4 sm:ml-3 sm:pl-5">
                  {checkpoint.status === "Needs revision" && checkpoint.blockedReason ? (
                    <p className="mb-2 rounded-xl bg-[#fff8f3] px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-[#9a3412]">
                      Changes requested: {checkpoint.blockedReason}
                    </p>
                  ) : null}

                  {stageTasks.length ? (
                    <div className="grid gap-1">
                      {stageTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          done={isTaskOptimisticallyDone(task, optimisticCompleted)}
                          mutation={mutations[task.id]}
                          availableAfter={lockedBy?.title}
                          emphasized={currentTaskInStep?.id === task.id}
                          onOpen={() => setSelectedTaskId(task.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {selectedTask ? (
        <TaskSheet
          key={selectedTask.id}
          task={selectedTask}
          checkpoint={selectedCheckpoint}
          approved={optimisticApproved.includes(selectedTask.id) || selectedTask.approvalState === "approved"}
          done={isTaskOptimisticallyDone(selectedTask, optimisticCompleted)}
          mutation={mutations[selectedTask.id]}
          deliverables={resolveTaskDeliverables(selectedTask, deliverablesByTask[selectedTask.id])}
          availableAfter={selectedBlocker?.title}
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
