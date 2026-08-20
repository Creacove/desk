import { ArrowRight, Check, SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, IconButton } from "../../design-system/desktopPrimitives";
import type { ManagerMissionContextQuestion } from "../../types/cleanProduction";

export type ManagerComposerProps = {
  draft: string;
  onDraftChange(value: string): void;
  onSend(): void;
  sendPending: boolean;
  sendError?: string | null;
  canSend?: boolean;
  placeholder?: string;
  guidedQuestion?: ReactNode;
  /** @deprecated Workspace actions belong inline in the conversation, never in the composer. */
  workspaceActions?: ReactNode;
  attachments?: ReactNode;
  leadingAction?: ReactNode;
  verificationNote?: boolean;
};

export type GuidedContextQuestionProps = {
  question: ManagerMissionContextQuestion;
  position: number;
  total: number;
  value: string;
  onChange(value: string): void;
  onSubmit(answerOverride?: string): void;
  onUseRecommendation(): void;
  onBack?(): void;
  onAnswerLater?(): void;
  sendPending: boolean;
};

export type ManagerWorkspaceActionTarget = "files" | "rights" | "details";
export type ManagerWorkspaceAction = {
  key: string;
  target: ManagerWorkspaceActionTarget;
  action: string;
  title: string;
  description: string;
  actionLabel: string;
};

/**
 * Compatibility parser for historical turns. New turns must emit workspace actions
 * as actions, not encode them as questions. Keep this only at the legacy boundary.
 */
export function parseManagerWorkspaceAction(question: ManagerMissionContextQuestion): ManagerWorkspaceAction | null {
  const match = question.key.match(/^workspace_action:(files|rights|details):([a-z0-9_-]+)$/i);
  if (!match) return null;
  const target = match[1].toLowerCase() as ManagerWorkspaceActionTarget;
  const action = match[2].toLowerCase();
  const fallbackLabel = target === "files" ? "Open Files" : target === "rights" ? "Review rights" : "Open Details";
  return {
    key: question.key,
    target,
    action,
    title: question.question.trim(),
    description: question.reason?.trim() ?? "",
    actionLabel: question.recommendedAnswer?.trim() || fallbackLabel,
  };
}

export function ManagerComposer({
  draft,
  onDraftChange,
  onSend,
  sendPending,
  sendError,
  canSend = Boolean(draft.trim()),
  placeholder = "What do you want to work on?",
  guidedQuestion,
  attachments,
  leadingAction,
  verificationNote = false,
}: ManagerComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const guided = Boolean(guidedQuestion);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 24), 160)}px`;
  }, [draft, guided]);

  function handleDraftChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    onDraftChange(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(Math.max(event.target.scrollHeight, 24), 160)}px`;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (canSend && !sendPending) onSend();
  }

  return (
    <div data-testid="manager-composer-dock" className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 lg:left-[13.5rem]">
      <div className="pointer-events-auto mx-auto w-full max-w-[48rem]">
        <div data-testid="manager-composer-surface" className="overflow-visible rounded-[16px] border border-foreground/10 bg-background/96 p-2 shadow-[0_10px_36px_hsl(var(--foreground)/0.10)] backdrop-blur-xl transition-[border-color,box-shadow] duration-150 focus-within:border-brand-accent/30 focus-within:shadow-[0_10px_36px_hsl(var(--foreground)/0.10),0_0_0_3px_hsl(var(--brand-accent)/0.055)]">
          {attachments ? <div className="px-2 pt-1">{attachments}</div> : null}
          {guidedQuestion ? (
            <div data-testid="manager-composer-guided" className="px-2 py-1">{guidedQuestion}</div>
          ) : (
            <div className="flex items-end gap-2 px-1.5 py-0.5">
              {leadingAction ? <div className="mb-1 shrink-0">{leadingAction}</div> : null}
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                aria-label="Work with Manager"
                rows={1}
                className="min-h-10 w-full resize-none bg-transparent px-2.5 py-2.5 text-[15px] font-medium leading-[1.5] text-foreground outline-none placeholder:text-muted-foreground/50"
                style={{ maxHeight: "160px", overflowY: "auto" }}
              />
              <IconButton type="button" onClick={onSend} disabled={!canSend} pending={sendPending} label="Send to Manager" variant="primary" size="md" className="mb-0.5 rounded-[11px]">
                <SendHorizontal className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          )}
          {sendError ? <p role="alert" className="px-4 pb-2 pt-1 text-[12px] font-medium text-destructive">{sendError}</p> : null}
        </div>
        {verificationNote && !guided ? <p className="mt-1.5 text-center text-[11px] font-medium text-muted-foreground/48">Verify important decisions before acting.</p> : null}
      </div>
    </div>
  );
}

/**
 * Historical compatibility only. It intentionally renders without floating/card
 * chrome so callers can place it directly underneath the Manager turn.
 */
export function ManagerWorkspaceActions({ actions, onOpen, disabled }: {
  actions: ManagerWorkspaceAction[];
  onOpen(action: ManagerWorkspaceAction): void;
  disabled?: boolean;
}) {
  if (!actions.length) return null;
  return (
    <div data-testid="manager-workspace-actions" aria-label="Manager required actions" className="mt-3 grid gap-2">
      {actions.map((action) => (
        <div key={action.key} className="flex flex-wrap items-start justify-between gap-3 border-l border-foreground/10 pl-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold leading-snug text-foreground">{action.title}</p>
            {action.description ? <p className="mt-0.5 max-w-[36rem] text-[11px] font-medium leading-relaxed text-muted-foreground">{action.description}</p> : null}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(action)} disabled={disabled}>{action.actionLabel}</Button>
        </div>
      ))}
    </div>
  );
}

export function GuidedContextQuestion({
  question,
  position,
  total,
  value,
  onChange,
  onSubmit,
  onUseRecommendation,
  onBack,
  onAnswerLater,
  sendPending,
}: GuidedContextQuestionProps) {
  const rawOptions = question.options ?? [];
  const isChoiceQuestion = question.answerKind === "single_select" || question.answerKind === "multi_select";
  const options = useMemo(() => {
    if (!isChoiceQuestion) return [];
    const customPattern = /^(?:other|something else)(?:…|\.\.\.)?$/i;
    const clean = rawOptions.map((option) => option.trim()).filter(Boolean).filter((option, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === option.toLowerCase()) === index);
    const withoutCustom = clean.filter((option) => !customPattern.test(option)).slice(0, 4);
    return [...withoutCustom, "Something else…"];
  }, [isChoiceQuestion, rawOptions.join("|")]);

  const selectedValues = value.split("\n").map((item) => item.trim()).filter(Boolean);
  const [otherOpen, setOtherOpen] = useState(false);
  const canSubmit = Boolean(value.trim());
  const recommended = question.recommendedAnswer?.trim() ?? "";

  function choose(option: string) {
    if (/^(?:other|something else)(?:…|\.\.\.)?$/i.test(option)) {
      setOtherOpen(true);
      onChange("");
      return;
    }
    setOtherOpen(false);
    if (question.answerKind === "multi_select") {
      const next = selectedValues.includes(option) ? selectedValues.filter((item) => item !== option) : [...selectedValues, option];
      onChange(next.join("\n"));
      return;
    }
    onChange(option);
    if (question.answerKind === "single_select") window.setTimeout(() => onSubmit(option), 0);
  }

  return (
    <div data-testid="manager-guided-question" className="grid gap-3 py-1">
      <div className="min-w-0">
        {total > 1 ? <p className="text-[11px] font-medium text-muted-foreground/65">{position + 1} of {total}</p> : null}
        <p className={`${total > 1 ? "mt-1" : ""} text-[15px] font-semibold leading-snug text-foreground`}>{question.question}</p>
      </div>

      {isChoiceQuestion ? (
        <div className="grid gap-2" role={question.answerKind === "single_select" ? "radiogroup" : "group"} aria-label={question.question}>
          {options.map((option) => {
            const selected = selectedValues.includes(option);
            const isRecommended = Boolean(recommended && option.toLowerCase() === recommended.toLowerCase());
            return (
              <button key={option} type="button" data-testid="manager-choice-option" onClick={() => choose(option)} disabled={sendPending} aria-pressed={selected} className={`flex min-h-11 w-full items-center gap-3 rounded-[11px] border px-3.5 py-2.5 text-left outline-none transition-colors duration-150 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand-accent/20 ${selected ? "border-brand-accent/25 bg-brand-accent/[0.055]" : "border-foreground/10 bg-background hover:border-foreground/18 hover:bg-foreground/[0.025]"}`}>
                <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-brand-accent bg-brand-accent text-white" : "border-foreground/25"}`}>{selected ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : null}</span>
                <span className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-foreground">{option}</span>
                {isRecommended ? <span className="shrink-0 rounded-full bg-foreground/[0.055] px-2 py-1 text-[11px] font-medium text-muted-foreground">Recommended</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {otherOpen || !isChoiceQuestion ? (
        <>
          {recommended && !isChoiceQuestion ? (
            <button type="button" onClick={() => { onUseRecommendation(); window.setTimeout(() => onSubmit(recommended), 0); }} disabled={sendPending} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[11px] border border-foreground/10 px-3.5 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-foreground/[0.025] disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand-accent/20">
              <span className="min-w-0 text-[12px] font-semibold leading-snug text-foreground">{recommended}</span>
              <span className="shrink-0 rounded-full bg-foreground/[0.055] px-2 py-1 text-[11px] font-medium text-muted-foreground">Recommended</span>
            </button>
          ) : null}
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (canSubmit && !sendPending) onSubmit(); } }}
            disabled={sendPending}
            autoFocus
            rows={1}
            aria-label={question.question}
            placeholder={question.answerKind === "money_range" ? "Enter a range or amount" : otherOpen ? "Tell Manager what you prefer" : "Write your answer"}
            className="min-h-11 max-h-32 w-full resize-none rounded-[11px] border border-foreground/10 bg-background px-3 py-3 text-[14px] font-medium leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/45 focus:border-brand-accent/35 focus:ring-2 focus:ring-brand-accent/8"
          />
        </>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {position > 0 ? <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={sendPending}>Back</Button> : null}
          {onAnswerLater ? <Button type="button" variant="ghost" size="sm" onClick={onAnswerLater} disabled={sendPending}>Answer later</Button> : null}
        </div>
        {question.answerKind === "multi_select" || !isChoiceQuestion || otherOpen ? (
          <Button type="button" variant="primary" size="sm" onClick={() => onSubmit()} pending={sendPending} disabled={!canSubmit} trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}>
            {position + 1 === total ? "Continue" : "Next"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
