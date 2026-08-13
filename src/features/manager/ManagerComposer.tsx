import { ArrowRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
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

export function ManagerComposer({
  draft,
  onDraftChange,
  onSend,
  sendPending,
  sendError,
  canSend = Boolean(draft.trim()),
  placeholder = "Message the Manager…",
  guidedQuestion,
  attachments,
  leadingAction,
  verificationNote = true,
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
  const options = question.options ?? [];
  const selectedValues = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const canSubmit = Boolean(value.trim());
  const isChoiceQuestion = question.answerKind === "single_select" || question.answerKind === "multi_select";

  function choose(option: string) {
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground/70">
            {position + 1} of {total}
          </p>
          <p className="mt-1 text-[14px] font-semibold leading-relaxed text-foreground">{question.question}</p>
          {question.reason ? <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{question.reason}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => {
            const answer = "I'm not sure — use your best recommendation and state the assumption.";
            onChange(answer);
            window.setTimeout(() => onSubmit(answer), 0);
          }}
          disabled={sendPending}
          className="shrink-0 pt-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          I’m not sure
        </button>
      </div>

      {question.recommendedAnswer ? (
        <button
          type="button"
          onClick={() => {
            onUseRecommendation();
            window.setTimeout(() => onSubmit(question.recommendedAnswer ?? ""), 0);
          }}
          disabled={sendPending}
          className="rounded-xl border border-foreground/12 px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.04] disabled:opacity-40"
        >
          <span className="block text-[10px] font-semibold text-brand-accent">Recommended</span>
          <span className="mt-0.5 block text-[12px] font-medium text-foreground">{question.recommendedAnswer}</span>
          {question.recommendationReason ? <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{question.recommendationReason}</span> : null}
        </button>
      ) : null}

      {isChoiceQuestion && options.length ? (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = selectedValues.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                disabled={sendPending}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-2 text-left text-[12px] font-semibold transition-colors disabled:opacity-40 ${
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/12 bg-background text-foreground/80 hover:border-foreground/30 hover:bg-foreground/[0.04]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : (
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
          placeholder={question.answerKind === "money_range" ? "Enter a range or amount" : "Write your answer"}
          className="min-h-11 w-full resize-none rounded-xl border border-foreground/12 bg-background px-3 py-3 text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/45 focus:border-foreground/35"
        />
      )}

      <div className="flex items-center justify-between gap-3">
        {position > 0 ? <button type="button" onClick={onBack} disabled={sendPending} className="min-h-10 px-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Back</button> : <span />}
        {question.answerKind === "multi_select" || !isChoiceQuestion ? (
          <button
            type="button"
            onClick={() => onSubmit()}
            disabled={!canSubmit || sendPending}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[12px] font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-25"
          >
            {position + 1 === total ? "Send answers" : "Continue"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
