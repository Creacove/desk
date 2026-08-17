import { ArrowRight, Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  placeholder = "Message the Manager…",
  guidedQuestion,
  workspaceActions,
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
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [draft, guided]);

  function handleDraftChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    onDraftChange(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 200)}px`;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (canSend && !sendPending) onSend();
  }

  return (
    <div
      data-testid="manager-composer-dock"
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 lg:left-[13.5rem]"
    >
      <div className="pointer-events-auto mx-auto w-full max-w-[48rem]">
        {workspaceActions ? <div className="mb-2">{workspaceActions}</div> : null}
        <div data-testid="manager-composer-surface" className="overflow-visible rounded-[1.5rem] border border-foreground/12 bg-background/96 p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          {attachments ? <div className="px-2 pt-1">{attachments}</div> : null}
          {guidedQuestion ? (
            <div data-testid="manager-composer-guided" className="px-2 py-1">{guidedQuestion}</div>
          ) : (
            <div className="flex items-end gap-2 px-2">
              {leadingAction ? <div className="mb-1.5 shrink-0">{leadingAction}</div> : null}
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                aria-label="Message the Manager"
                rows={1}
                className="min-h-11 w-full resize-none bg-transparent px-2 py-3 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/45"
                style={{ maxHeight: "200px", overflowY: "auto" }}
              />
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend || sendPending}
                aria-label="Send Manager message"
                className="mb-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/85 disabled:opacity-25"
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
          {sendError ? <p role="alert" className="px-4 pb-2 text-[11px] font-medium text-red-600">{sendError}</p> : null}
        </div>
        {verificationNote && !guided ? <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">Verify important decisions before acting.</p> : null}
      </div>
    </div>
  );
}

export function ManagerWorkspaceActions({
  actions,
  onOpen,
  disabled,
}: {
  actions: ManagerWorkspaceAction[];
  onOpen(action: ManagerWorkspaceAction): void;
  disabled?: boolean;
}) {
  if (!actions.length) return null;
  return (
    <section
      data-testid="manager-workspace-actions"
      aria-label="Manager required actions"
      className="overflow-hidden rounded-[16px] border border-foreground/10 bg-background/98 shadow-[0_8px_28px_rgba(0,0,0,0.08)] backdrop-blur-xl"
    >
      <div className="divide-y divide-foreground/8">
        {actions.map((action) => (
          <div key={action.key} className="grid grid-cols-1 gap-2.5 px-3.5 py-3 sm:flex sm:items-center sm:gap-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug text-foreground">{action.title}</p>
              {action.description ? <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-muted-foreground sm:line-clamp-2">{action.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => onOpen(action)}
              disabled={disabled}
              className="inline-flex min-h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 disabled:opacity-35 sm:w-auto"
            >
              {action.actionLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
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
  sendPending,
}: GuidedContextQuestionProps) {
  const rawOptions = question.options ?? [];
  const isChoiceQuestion = question.answerKind === "single_select" || question.answerKind === "multi_select";
  const options = useMemo(() => {
    const clean = rawOptions.map((option) => option.trim()).filter(Boolean).slice(0, 5);
    if (!isChoiceQuestion || question.answerKind !== "single_select") return clean;
    return clean.some((option) => /^other(?:…|\.\.\.)?$/i.test(option)) || clean.length >= 5 ? clean : [...clean, "Other…"];
  }, [isChoiceQuestion, question.answerKind, rawOptions.join("|")]);
  const selectedValues = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const [otherOpen, setOtherOpen] = useState(false);
  const canSubmit = Boolean(value.trim());
  const recommended = question.recommendedAnswer?.trim() ?? "";

  function choose(option: string) {
    if (/^other(?:…|\.\.\.)?$/i.test(option)) {
      setOtherOpen(true);
      onChange("");
      return;
    }
    setOtherOpen(false);
    if (question.answerKind === "multi_select") {
      const next = selectedValues.includes(option)
        ? selectedValues.filter((item) => item !== option)
        : [...selectedValues, option];
      onChange(next.join("\n"));
      return;
    }
    onChange(option);
    if (question.answerKind === "single_select") {
      window.setTimeout(() => onSubmit(option), 0);
    }
  }

  return (
    <div data-testid="manager-guided-question" className="grid gap-3 py-1">
      <div className="min-w-0">
        {total > 1 ? <p className="text-[10px] font-medium text-muted-foreground/65">{position + 1} of {total}</p> : null}
        <p className={`${total > 1 ? "mt-1" : ""} line-clamp-3 text-[15px] font-semibold leading-snug text-foreground`}>{question.question}</p>
      </div>

      {isChoiceQuestion && options.length ? (
        <div className="grid gap-2" role={question.answerKind === "single_select" ? "radiogroup" : "group"} aria-label={question.question}>
          {options.map((option) => {
            const selected = selectedValues.includes(option);
            const isRecommended = Boolean(recommended && option.toLowerCase() === recommended.toLowerCase());
            return (
              <button
                key={option}
                type="button"
                data-testid="manager-choice-option"
                onClick={() => choose(option)}
                disabled={sendPending}
                aria-pressed={selected}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:opacity-40 ${
                  selected
                    ? "border-foreground bg-foreground/[0.055]"
                    : "border-foreground/12 bg-background hover:border-foreground/28 hover:bg-foreground/[0.025]"
                }`}
              >
                <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-foreground bg-foreground text-background" : "border-foreground/25"}`}>
                  {selected ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : null}
                </span>
                <span className="min-w-0 flex-1 line-clamp-2 text-[12px] font-semibold leading-snug text-foreground">{option}</span>
                {isRecommended ? <span className="shrink-0 rounded-full bg-foreground/[0.06] px-2 py-1 text-[9px] font-semibold text-muted-foreground">Recommended</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {otherOpen || !isChoiceQuestion ? (
        <>
          {recommended && !isChoiceQuestion ? (
            <button
              type="button"
              onClick={() => {
                onUseRecommendation();
                window.setTimeout(() => onSubmit(recommended), 0);
              }}
              disabled={sendPending}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-foreground/12 px-3.5 py-2.5 text-left transition-colors hover:bg-foreground/[0.025] disabled:opacity-40"
            >
              <span className="min-w-0 line-clamp-2 text-[12px] font-semibold leading-snug text-foreground">{recommended}</span>
              <span className="shrink-0 rounded-full bg-foreground/[0.06] px-2 py-1 text-[9px] font-semibold text-muted-foreground">Recommended</span>
            </button>
          ) : null}
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSubmit && !sendPending) onSubmit();
              }
            }}
            disabled={sendPending}
            autoFocus
            rows={1}
            aria-label={question.question}
            placeholder={question.answerKind === "money_range" ? "Enter a range or amount" : otherOpen ? "Tell Manager what you prefer" : "Write your answer"}
            className="min-h-11 max-h-32 w-full resize-none rounded-xl border border-foreground/12 bg-background px-3 py-3 text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/45 focus:border-foreground/35"
          />
        </>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        {position > 0 ? <button type="button" onClick={onBack} disabled={sendPending} className="min-h-9 px-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">Back</button> : <span />}
        {question.answerKind === "multi_select" || !isChoiceQuestion || otherOpen ? (
          <button
            type="button"
            onClick={() => onSubmit()}
            disabled={!canSubmit || sendPending}
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[11px] font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-25"
          >
            {position + 1 === total ? "Continue" : "Next"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
