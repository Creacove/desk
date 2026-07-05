import { ArrowRight, ChevronRight, ClipboardCheck, MessageSquareText, Music2, Route, Sparkles, UsersRound } from "lucide-react";
import { ProductButton, WorkspaceShell } from "../../design-system/components";
import type { CleanProductionView, ConversationViewModel, ManagerConversationContextAnswer, ManagerMissionContextQuestion, MissionGenesisResultViewModel } from "../../types/cleanProduction";
import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ChatGPT-style typewriter hook
// Drips characters from `target` into display at a capped speed (~28ms/char).
// When streaming stops it snaps immediately to full text.
// ---------------------------------------------------------------------------
function useTypewriter(target: string, streaming: boolean): string {
  const [displayed, setDisplayed] = useState(target);
  const frameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const displayedRef = useRef<string>(target);

  useEffect(() => {
    if (!streaming) {
      // Snap to full text when streaming ends
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      displayedRef.current = target;
      setDisplayed(target);
      return;
    }

    const CHAR_INTERVAL_MS = 18; // ~55 chars/sec — feels like fast human typing

    const tick = (now: number) => {
      const elapsed = now - lastTickRef.current;
      if (elapsed >= CHAR_INTERVAL_MS) {
        const currentLen = displayedRef.current.length;
        if (currentLen < target.length) {
          // Advance by however many chars fit in elapsed time (burst catch-up)
          const charsToAdd = Math.max(1, Math.floor(elapsed / CHAR_INTERVAL_MS));
          const next = target.slice(0, currentLen + charsToAdd);
          displayedRef.current = next;
          setDisplayed(next);
          lastTickRef.current = now;
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target, streaming]);

  // If the target shrank (shouldn't happen) or we're ahead, clamp
  if (!streaming) return target;
  return displayed.length <= target.length ? displayed : target;
}

// ---------------------------------------------------------------------------
// Conversation timestamp formatting
// Backend values are ISO timestamps; fixtures/tests already pass
// human-readable strings ("Just now", "14h ago") — parse fails gracefully.
// ---------------------------------------------------------------------------
function formatConversationTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// ManagerOfficeScreen
// ---------------------------------------------------------------------------
export function ManagerOfficeScreen({
  conversations,
  missionGenesisResult,
  missionGenesisAnswers,
  missionGenesisPending,
  missionGenesisError,
  onMissionGenesisAnswerChange,
  onSubmitMissionGenesisAnswers,
  onOpenCreatedMission,
  onBack,
  onConversation,
  onAskManager,
  askManagerPending,
  askManagerError,
}: {
  conversations: ConversationViewModel[];
  missionGenesisResult: MissionGenesisResultViewModel | null;
  missionGenesisAnswers: Record<string, string>;
  missionGenesisPending: boolean;
  missionGenesisError: string | null;
  onMissionGenesisAnswerChange: (key: string, value: string) => void;
  onSubmitMissionGenesisAnswers: (candidateMissionId?: string) => void;
  onOpenCreatedMission: () => void;
  onBack: () => void;
  onConversation: (conversation: ConversationViewModel) => void;
  onAskManager: (body: string) => void;
  askManagerPending: boolean;
  askManagerError: string | null;
}) {
  const [askText, setAskText] = useState("");

  return (
    <WorkspaceShell eyebrow="Manager" title="Manager's Office" onBack={onBack}>
      <div className="max-w-5xl">
        <MissionGenesisManagerPanel
          result={missionGenesisResult}
          answers={missionGenesisAnswers}
          pending={missionGenesisPending}
          error={missionGenesisError}
          onAnswerChange={onMissionGenesisAnswerChange}
          onSubmit={onSubmitMissionGenesisAnswers}
          onOpenCreatedMission={onOpenCreatedMission}
        />
        <section className="rounded-[18px] border border-foreground/10 bg-background p-6 shadow-sm sm:p-8">
              <div className="max-w-2xl">
                <p className="text-[14px] font-semibold leading-relaxed text-muted-foreground/85">Ask your Manager anything — a decision, a plan, or a review of what's happening.</p>
                <div className="relative mt-6">
                  <textarea
                    value={askText}
                    onChange={(event) => setAskText(event.target.value)}
                    placeholder="Ask the Manager for a directive or review..."
                    className="min-h-[126px] w-full resize-none rounded-[16px] border border-foreground/10 bg-foreground/[0.015] p-5 pr-16 font-ui text-[15px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brand-accent/40 focus:bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const body = askText.trim();
                      if (!body) return;
                      onAskManager(body);
                      setAskText("");
                    }}
                    disabled={!askText.trim() || askManagerPending}
                    aria-label="Ask Manager"
                    className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-25"
                  >
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                {askManagerError ? <p role="alert" className="mt-3 text-[12px] font-semibold text-red-700">{askManagerError}</p> : null}
                {askManagerPending ? <p className="mt-3 text-[12px] font-semibold text-muted-foreground">Manager is reading the workspace packet.</p> : null}
              </div>
        </section>

        <section className="mt-8">
              <div className="mb-4 flex items-center justify-between border-b border-foreground/8 px-1 pb-4">
                <div>
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/88">Conversation History</p>
                  <p className="mt-1 text-[12px] text-muted-foreground/78">Pick up a prior thread or start a new run.</p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    aria-label={conversation.topic}
                    className="group flex items-center gap-4 rounded-xl border border-transparent p-4 text-left transition-colors hover:border-foreground/8 hover:bg-foreground/[0.025]"
                    onClick={() => onConversation(conversation)}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5 text-foreground/80 transition-colors group-hover:bg-brand-accent/10 group-hover:text-brand-accent">
                      <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-foreground transition-colors group-hover:text-brand-accent">{conversation.topic}</p>
                    <div className="flex shrink-0 items-center gap-4">
                      {conversation.lastUpdate ? <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{formatConversationTimestamp(conversation.lastUpdate)}</span> : null}
                      <ChevronRight className="h-4 w-4 text-foreground/20 transition-colors group-hover:text-brand-accent" aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function MissionGenesisManagerPanel({
  result,
  answers,
  pending,
  error,
  onAnswerChange,
  onSubmit,
  onOpenCreatedMission,
}: {
  result: MissionGenesisResultViewModel | null;
  answers: Record<string, string>;
  pending: boolean;
  error: string | null;
  onAnswerChange: (key: string, value: string) => void;
  onSubmit: (candidateMissionId?: string) => void;
  onOpenCreatedMission: () => void;
}) {
  const candidateMissionIds = result?.candidateMissionIds?.length
    ? result.candidateMissionIds
    : result?.candidateMissionId
      ? [result.candidateMissionId]
      : [];
  const [selectedCandidateMissionId, setSelectedCandidateMissionId] = useState<string | undefined>(candidateMissionIds[0]);

  useEffect(() => {
    setSelectedCandidateMissionId(candidateMissionIds[0]);
  }, [candidateMissionIds.join("|")]);

  if (!result && !error) {
    return null;
  }

  return (
    <section className="mb-5 rounded-xl border border-foreground/10 bg-background p-5 shadow-sm">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission Genesis</p>
      {result ? (
        <>
          <h2 className="mt-2 font-display text-[18px] font-bold tracking-tight text-foreground">{result.title}</h2>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">{result.body}</p>
        </>
      ) : null}
      {error ? (
        <div role="alert" className="mt-4 rounded-[12px] border border-red-500/20 bg-red-500/[0.055] p-4">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-red-700">Mission Genesis failed</p>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-red-950/80">{error}</p>
        </div>
      ) : null}
      {candidateMissionIds.length > 1 ? (
        <div className="mt-4 rounded-[12px] border border-foreground/8 bg-foreground/[0.02] p-3">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Candidate mission lanes</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {candidateMissionIds.map((candidateMissionId, index) => (
              <button
                key={candidateMissionId}
                type="button"
                aria-pressed={selectedCandidateMissionId === candidateMissionId}
                onClick={() => setSelectedCandidateMissionId(candidateMissionId)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  selectedCandidateMissionId === candidateMissionId
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/10 bg-background text-foreground/72 hover:border-foreground/20"
                }`}
              >
                Candidate {index + 1}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {result?.questions.length ? (
        <div className="mt-4 grid gap-3">
          {result.questions.map((question) => (
            <label key={question.key} className="grid gap-1.5 text-[12px] font-semibold text-foreground">
              <span>{question.question}</span>
              <span className="text-[11px] leading-relaxed text-muted-foreground/82">{question.reason}</span>
              {question.answerKind === "single_select" ? (
                <select
                  aria-label={question.question}
                  value={answers[question.key] ?? ""}
                  onChange={(event) => onAnswerChange(question.key, event.target.value)}
                  className="h-10 rounded-[10px] border border-foreground/10 bg-background px-3 text-[13px] font-semibold outline-none"
                >
                  <option value="">Select answer</option>
                  {(question.options ?? []).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={question.question}
                  value={answers[question.key] ?? ""}
                  onChange={(event) => onAnswerChange(question.key, event.target.value)}
                  className="h-10 rounded-[10px] border border-foreground/10 bg-background px-3 text-[13px] font-semibold outline-none"
                />
              )}
            </label>
          ))}
          <div>
            <ProductButton onClick={() => onSubmit(selectedCandidateMissionId)} disabled={pending}>
              {pending ? "Continuing Mission Genesis" : "Continue Mission Genesis"}
            </ProductButton>
          </div>
        </div>
      ) : null}
      {result?.activatedMissionId || result?.activatedMissionIds?.length ? (
        <div className="mt-4 rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Work created</p>
          <p className="mt-2 text-sm font-semibold text-foreground">Mission work is ready in Missions.</p>
          <div className="mt-4">
            <ProductButton onClick={onOpenCreatedMission}>Open created missions</ProductButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// ConversationWorkspace — the main chat view
// ---------------------------------------------------------------------------
export function ConversationWorkspace({
  conversation,
  onBack,
  onOpenCreatedWork,
  onSendMessage,
  onSendContextAnswers,
  onRetryLastMessage,
  onOpenDecisionPackage,
  sendPending,
  sendError,
}: {
  conversation: ConversationViewModel;
  onBack: () => void;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string) => void | Promise<void>;
  onOpenDecisionPackage?: () => void;
  onSendMessage: (body: string, conversationId: string) => void;
  onSendContextAnswers: (
    body: string,
    conversationId: string,
    contextRequestId: string,
    contextAnswers: ManagerConversationContextAnswer[],
  ) => void;
  onRetryLastMessage?: () => void;
  sendPending: boolean;
  sendError: string | null;
}) {
  const [draft, setDraft] = useState("");
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageCreatedWork = conversation.messages.flatMap((message) => message.createdWork ?? []);
  const allCreatedWork = conversation.createdWork.length
    ? conversation.createdWork
    : messageCreatedWork;
  const shouldShowCreatedWorkSummary = allCreatedWork.length > 0 && messageCreatedWork.length === 0;
  const activeRun = conversation.activeRun;
  const isManagerThinking = sendPending || activeRun?.status === "running";
  const hasStreamingMessage = conversation.messages.some((message) => message.status === "streaming");
  const hasFailedManagerMessage = conversation.messages.some((message) => message.speaker === "manager" && message.status === "failed");

  // Auto-scroll on new content
  useEffect(() => {
    if (typeof scrollAnchorRef.current?.scrollIntoView === "function") {
      scrollAnchorRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }, [conversation.messages.length, activeRun?.streamedText, activeRun?.steps.length]);

  // Auto-resize textarea
  const handleDraftChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleSend = () => {
    const body = draft.trim();
    if (!body || sendPending) return;
    onSendMessage(body, conversation.id);
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <WorkspaceShell eyebrow="Direct message" title={conversation.topic} onBack={onBack}>
      {/*
        ChatGPT layout pattern:
        — A centered, width-constrained reading column gives the breathing room.
        — Manager text fills the column naturally (no bubble border).
        — User message is a right-aligned soft pill within the same column.
        — Side whitespace is the product of the column constraint, not padding hacks.
      */}
      <div className="mx-auto max-w-[680px] pb-44">
        <div className="flex flex-col gap-8">
          {conversation.messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              activeRun={activeRun}
              onRetryLastMessage={onRetryLastMessage}
              sendPending={sendPending}
              onSendContextAnswers={(answers) =>
                onSendContextAnswers(
                  "Context answers for Manager mission decision.",
                  conversation.id,
                  message.contextRequestId ?? message.id,
                  answers,
                )
              }
              onOpenCreatedWork={onOpenCreatedWork}
            />
          ))}

          {/* Thinking indicator — only shown when no streaming message exists yet */}
          {isManagerThinking && !hasStreamingMessage ? (
            <ThinkingIndicator activeRun={activeRun} />
          ) : null}

          <div ref={scrollAnchorRef} />
        </div>

        {/* Created work summary */}
        {shouldShowCreatedWorkSummary ? (
          <aside className="mt-10">
            <WorkArtifactGroup items={allCreatedWork} onOpenCreatedWork={onOpenCreatedWork} />
          </aside>
        ) : null}

        {/* Decision package */}
        {conversation.decisionPackage ? (
          <aside className="mt-6 rounded-[16px] border border-foreground/10 bg-background p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Decision package</p>
                <h3 className="mt-2 text-[16px] font-semibold leading-tight text-foreground">{conversation.decisionPackage.title}</h3>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/86">{conversation.decisionPackage.summary}</p>
              </div>
              {onOpenDecisionPackage ? (
                <button
                  type="button"
                  onClick={onOpenDecisionPackage}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-foreground/[0.045] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-foreground/80 transition-colors hover:bg-foreground/[0.07]"
                >
                  Open package
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Floating input bar                                                   */}
      {/* ------------------------------------------------------------------ */}
      {/*
        Input bar: pinned to the same 680px column as the messages.
        On mobile it spans full width with 16px gutter; on desktop it
        aligns exactly with the reading column for visual harmony.
      */}
      <div
        className="fixed bottom-20 left-0 right-0 z-40 px-4 lg:bottom-6"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-[680px]">
          <div className="overflow-hidden rounded-[20px] border border-foreground/10 bg-background/95 shadow-[0_8px_40px_rgba(0,0,0,0.1)] backdrop-blur-2xl">
            <div className="flex items-end gap-2 px-4 py-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message the Manager…"
                rows={1}
                className="min-h-[44px] w-full resize-none bg-transparent py-3 font-ui text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40"
                style={{ maxHeight: "200px", overflowY: "auto" }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim() || sendPending}
                aria-label="Send Manager message"
                className="mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all hover:bg-foreground/85 disabled:opacity-20"
              >
                <ArrowRight className="h-[14px] w-[14px]" aria-hidden="true" />
              </button>
            </div>
            {sendError && !hasFailedManagerMessage ? (
              <p role="alert" className="px-4 pb-2 text-[11px] font-medium text-red-600">{sendError}</p>
            ) : null}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground/35">Manager can make mistakes. Verify important decisions.</p>
        </div>
      </div>
    </WorkspaceShell>
  );
}

// ---------------------------------------------------------------------------
// Individual message row
// ---------------------------------------------------------------------------
function MessageRow({
  message,
  activeRun,
  onRetryLastMessage,
  sendPending,
  onSendContextAnswers,
  onOpenCreatedWork,
}: {
  message: ConversationViewModel["messages"][number];
  activeRun: ConversationViewModel["activeRun"];
  onRetryLastMessage?: () => void;
  sendPending: boolean;
  onSendContextAnswers: (answers: ManagerConversationContextAnswer[]) => void;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string) => void | Promise<void>;
}) {
  const isArtist = message.speaker === "artist";
  const isStreaming = message.status === "streaming";

  return (
    <div className={`flex flex-col ${isArtist ? "items-end" : "items-start"}`}>
      {/* Speaker label row */}
      <div className={`mb-2 flex items-center gap-2 ${isArtist ? "flex-row-reverse" : ""}`}>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${
            isArtist
              ? "bg-foreground/[0.06] text-foreground/70"
              : "bg-foreground text-background"
          }`}
        >
          {isArtist ? (
            <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </span>
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
          {message.label}
        </p>
      </div>

      {/* Message body */}
      {isArtist ? (
        // User message — subtle pill, no dark fill
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-foreground/[0.055] px-5 py-3.5 text-foreground">
          <p className="text-[15px] leading-[1.65]">{message.body}</p>
        </div>
      ) : (
        // Manager message — full width, no card border
        <div className="w-full">
          <RichMessageBody body={message.body} streaming={isStreaming} failed={message.status === "failed"} />

          {/* Inline activity status during streaming */}
          {isStreaming && activeRun?.steps.length ? (
            <ManagerActivityStatus run={activeRun} />
          ) : null}

          {/* Retry button on failed */}
          {message.status === "failed" && onRetryLastMessage ? (
            <button
              type="button"
              onClick={onRetryLastMessage}
              className="mt-4 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-foreground/75 transition-colors hover:bg-foreground/[0.045]"
            >
              Retry Manager message
            </button>
          ) : null}

          {/* Context questions */}
          {message.contextQuestions?.length ? (
            <ManagerContextQuestionForm
              questions={message.contextQuestions}
              disabled={sendPending}
              onSubmit={onSendContextAnswers}
            />
          ) : null}

          {/* Created work — rendered as hierarchical artifact, not a flat list */}
          {message.createdWork?.length ? (
            <WorkArtifactGroup items={message.createdWork} onOpenCreatedWork={onOpenCreatedWork} />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thinking indicator — replaces the old dual-line card
// ---------------------------------------------------------------------------
const THINKING_PHRASES = [
  "Analysing workspace…",
  "Reading context…",
  "Cross-referencing data…",
  "Shaping a response…",
  "Consulting the packet…",
  "Considering options…",
];

function ThinkingIndicator({ activeRun }: { activeRun: ConversationViewModel["activeRun"] }) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  // Rotate generic phrase every 1.8 s
  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  // Prefer the live activity label if we have one
  const latestStep = activeRun?.steps.length
    ? [...activeRun.steps].reverse().find((s) => s.status === "running") ?? activeRun.steps.at(-1)
    : null;
  const label = latestStep ? activityStatusLine(latestStep.label, latestStep.status) : THINKING_PHRASES[phraseIndex];

  return (
    <div className="flex items-start gap-3">
      {/* Manager avatar */}
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1 pt-0.5">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">Manager</p>
        {/* Three-dot pulse + rotating label */}
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: "300ms" }} />
          </span>
          <p
            key={label}
            className="animate-in fade-in slide-in-from-bottom-1 duration-300 text-[13px] text-muted-foreground"
          >
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manager activity status — always-visible inline line during streaming
// ---------------------------------------------------------------------------
function ManagerActivityStatus({ run }: { run: NonNullable<ConversationViewModel["activeRun"]> }) {
  const [expanded, setExpanded] = useState(false);
  const latestStep = [...run.steps].reverse().find((s) => s.status === "running") ?? run.steps.at(-1);
  const statusText = latestStep ? activityStatusLine(latestStep.label, latestStep.status) : "Manager is preparing the answer.";

  return (
    <div className="mt-4 border-t border-foreground/6 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Always-visible activity line */}
        <p
          key={statusText}
          className="animate-in fade-in duration-300 text-[12px] font-medium text-muted-foreground/80"
        >
          {statusText}
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-semibold text-brand-accent/70 transition-colors hover:text-brand-accent"
        >
          {expanded ? "Hide details" : "Details"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-3 grid gap-1.5">
          {run.steps.map((step) => (
            <div key={step.id} className="flex min-w-0 items-start gap-2.5 rounded-[8px] bg-foreground/[0.025] px-3 py-2">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  step.status === "failed"
                    ? "bg-red-500"
                    : step.status === "completed"
                    ? "bg-success"
                    : step.status === "running"
                    ? "bg-brand-accent"
                    : "bg-foreground/20"
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-foreground">{step.label}</span>
                {step.detail ? <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{step.detail}</span> : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function activityStatusLine(label: string, status: NonNullable<ConversationViewModel["activeRun"]>["steps"][number]["status"]) {
  if (status === "completed") return "Manager has the workspace context and is shaping the reply.";
  if (status === "failed") return "Manager hit a problem while preparing the reply.";
  return `${label.replace(/\.$/, "")}…`;
}

// ---------------------------------------------------------------------------
// RichMessageBody — ChatGPT-style typewriter during streaming
// ---------------------------------------------------------------------------
function RichMessageBody({ body, streaming, failed }: { body: string; streaming?: boolean; failed?: boolean }) {
  const displayed = useTypewriter(body, !!streaming);

  const blocks = displayed.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  if (!blocks.length) {
    return (
      <p className="text-[15px] leading-[1.65] text-current">
        {streaming ? <BlinkingCursor /> : displayed}
      </p>
    );
  }

  return (
    <div className={`space-y-4 text-[15px] leading-[1.65] text-foreground ${failed ? "text-red-700" : ""}`}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const isList = lines.length > 1 && lines.every((line) => /^([-*]|\d+\.)\s+/.test(line));

        // Heading detection (markdown ##)
        const isHeading = block.startsWith("## ") || block.startsWith("# ");
        if (isHeading) {
          const text = block.replace(/^#{1,3}\s+/, "");
          return (
            <p key={`h-${blockIndex}`} className="text-[16px] font-semibold text-foreground">
              {text}
              {streaming && blockIndex === blocks.length - 1 ? <BlinkingCursor /> : null}
            </p>
          );
        }

        if (isList) {
          return (
            <ul key={`list-${blockIndex}`} className="list-disc space-y-1.5 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={`${line}-${lineIndex}`} className="text-foreground/90">
                  {line.replace(/^([-*]|\d+\.)\s+/, "")}
                  {streaming && blockIndex === blocks.length - 1 && lineIndex === lines.length - 1 ? <BlinkingCursor /> : null}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`p-${blockIndex}`} className="text-foreground/90">
            {block}
            {streaming && blockIndex === blocks.length - 1 ? <BlinkingCursor /> : null}
          </p>
        );
      })}
    </div>
  );
}

function BlinkingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] animate-pulse rounded-sm bg-foreground/60"
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Context question form
// ---------------------------------------------------------------------------
function ManagerContextQuestionForm({
  questions,
  disabled,
  onSubmit,
}: {
  questions: ManagerMissionContextQuestion[];
  disabled: boolean;
  onSubmit: (answers: ManagerConversationContextAnswer[]) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const allAnswered = questions.every((question) => Boolean(answers[question.key]?.trim()));

  return (
    <form
      className="mt-5 border-t border-foreground/8 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!allAnswered || disabled) return;
        onSubmit(questions.map((question) => ({ questionKey: question.key, answer: answers[question.key]?.trim() ?? "" })));
      }}
    >
      <div className="grid gap-4">
        {questions.map((question) => (
          <label key={question.key} className="grid gap-2 text-[13px] font-semibold leading-relaxed text-foreground">
            <span>{question.question}</span>
            {question.reason ? <span className="text-[12px] font-medium text-muted-foreground">{question.reason}</span> : null}
            {question.answerKind === "single_select" && question.options?.length ? (
              <select
                value={answers[question.key] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value }))}
                disabled={disabled}
                aria-label={question.question}
                className="min-h-11 rounded-xl border border-foreground/10 bg-background px-3 font-ui text-[14px] text-foreground outline-none transition-colors focus:border-brand-accent/60"
              >
                <option value="">Select answer</option>
                {question.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                value={answers[question.key] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value }))}
                disabled={disabled}
                aria-label={question.question}
                className="min-h-11 rounded-xl border border-foreground/10 bg-background px-3 font-ui text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brand-accent/60"
              />
            )}
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={!allAnswered || disabled}
        className="mt-4 rounded-lg bg-foreground px-4 py-2.5 font-ui text-[11px] font-bold uppercase tracking-[0.04em] text-background transition-colors hover:bg-foreground/88 disabled:opacity-30"
      >
        Send Manager context answers
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// WorkArtifactGroup — the Claude/GPT "artifact" pattern
// Groups missions + tasks into a single hierarchical document card.
// Standalone task batches get their own grouped card.
// Music items get a compact inline card.
// ---------------------------------------------------------------------------
type WorkItem = ConversationViewModel["createdWork"][number];

function WorkArtifactGroup({
  items,
  onOpenCreatedWork,
}: {
  items: WorkItem[];
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string) => void | Promise<void>;
}) {
  const missions = items.filter((w) => w.type === "mission");
  const tasks = items.filter((w) => w.type === "task");
  const musicItems = items.filter((w) => w.type === "music_item");
  const missionIds = new Set(missions.map((mission) => mission.id).filter(Boolean));
  const standaloneTasks = tasks.filter((task) => !task.parentMissionId || !missionIds.has(task.parentMissionId));
  const missionCards = missions.map((mission) => (
    <MissionArtifactCard
      key={`mission-${mission.id ?? mission.title}`}
      mission={mission}
      tasks={tasks.filter((task) => task.parentMissionId && task.parentMissionId === mission.id)}
      onOpenCreatedWork={onOpenCreatedWork}
    />
  ));

  return (
    <div className="mt-6 flex flex-col gap-3">
      {/* Mission artifact — tasks nested inside */}
      {missionCards}
      {standaloneTasks.length ? (
        /* Standalone task batch — no parent mission */
        <TaskGroupCard tasks={standaloneTasks} onOpenCreatedWork={onOpenCreatedWork} />
      ) : null}

      {/* Music items — simple compact cards */}
      {musicItems.map((item) => (
        <MusicItemArtifactCard key={`music-${item.id ?? item.title}`} item={item} onOpenCreatedWork={onOpenCreatedWork} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MissionArtifactCard — the main artifact: mission header + nested tasks
// ---------------------------------------------------------------------------
function MissionArtifactCard({
  mission,
  tasks,
  onOpenCreatedWork,
}: {
  mission: WorkItem;
  tasks: WorkItem[];
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string) => void | Promise<void>;
}) {
  const statusLabel = mission.status ? mission.status.replace(/_/g, " ") : "created";
  const isUpdate = mission.status === "updated";

  return (
    <div className="overflow-hidden rounded-[16px] border border-foreground/10 bg-background shadow-sm">
      {/* Artifact header bar */}
      <div className="flex items-center gap-2.5 border-b border-foreground/8 bg-foreground/[0.02] px-4 py-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-accent/10 text-brand-accent">
          <Route className="h-3 w-3" aria-hidden="true" />
        </span>
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">
          Mission {statusLabel}
        </p>
        {tasks.length ? (
          <span className="ml-auto rounded-full bg-foreground/[0.06] px-2 py-0.5 font-ui text-[10px] font-semibold text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </span>
        ) : null}
      </div>

      {/* Mission body */}
      <div className="px-4 pt-4 pb-3">
        <h3 className="text-[15px] font-semibold leading-snug text-foreground">{mission.title}</h3>
        {mission.body ? (
          <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground/80">{mission.body}</p>
        ) : null}
      </div>

      {/* Nested tasks — tree pattern */}
      {tasks.length ? (
        <div className="mx-4 mb-3 overflow-hidden rounded-[10px] border border-foreground/8 bg-foreground/[0.018]">
          {tasks.map((task, index) => (
            <div
              key={`task-${task.id ?? task.title}-${index}`}
              className={`flex items-start gap-3 px-3.5 py-3 ${
                index < tasks.length - 1 ? "border-b border-foreground/8" : ""
              }`}
            >
              {/* Task status dot */}
              <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-foreground/12 bg-background">
                <ClipboardCheck className="h-2.5 w-2.5 text-muted-foreground/50" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug text-foreground">{task.title}</p>
                {task.body ? (
                  <p className="mt-0.5 text-[11.5px] leading-[1.5] text-muted-foreground/70">{task.body}</p>
                ) : null}
              </div>
              {/* Open individual task */}
              <button
                type="button"
                onClick={() => void onOpenCreatedWork(task.type, task.id)}
                aria-label={`Open task: ${task.title}`}
                className="mt-0.5 shrink-0 text-[11px] font-semibold text-brand-accent/70 transition-colors hover:text-brand-accent"
              >
                Open
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Primary CTA */}
      <div className="border-t border-foreground/8 px-4 py-3">
        <button
          type="button"
          onClick={() => void onOpenCreatedWork(mission.type, mission.id)}
          aria-label={`Open ${isUpdate ? "updated" : "created"} mission`}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-foreground px-4 py-2 text-[12px] font-semibold text-background transition-colors hover:bg-foreground/88"
        >
          Open {isUpdate ? "mission" : "created mission"}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskGroupCard — standalone tasks with no parent mission
// ---------------------------------------------------------------------------
function TaskGroupCard({
  tasks,
  onOpenCreatedWork,
}: {
  tasks: WorkItem[];
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string) => void | Promise<void>;
}) {
  // Determine if any are updates vs new
  const hasUpdates = tasks.some((t) => t.status === "updated");
  const label = hasUpdates ? "Tasks updated" : tasks.length === 1 ? "Task created" : "Tasks created";

  return (
    <div className="overflow-hidden rounded-[16px] border border-foreground/10 bg-background shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-foreground/8 bg-foreground/[0.02] px-4 py-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground/8 text-foreground/60">
          <ClipboardCheck className="h-3 w-3" aria-hidden="true" />
        </span>
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        {tasks.length > 1 ? (
          <span className="ml-auto rounded-full bg-foreground/[0.06] px-2 py-0.5 font-ui text-[10px] font-semibold text-muted-foreground">
            {tasks.length}
          </span>
        ) : null}
      </div>

      {/* Task list */}
      <div>
        {tasks.map((task, index) => (
          <div
            key={`standalone-task-${task.id ?? task.title}-${index}`}
            className={`flex items-start gap-3 px-4 py-3.5 ${
              index < tasks.length - 1 ? "border-b border-foreground/8" : ""
            }`}
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-foreground/12 bg-foreground/[0.02]">
              <ClipboardCheck className="h-2.5 w-2.5 text-muted-foreground/40" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-snug text-foreground">{task.title}</p>
              {task.body ? (
                <p className="mt-1 text-[12px] leading-[1.5] text-muted-foreground/75">{task.body}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void onOpenCreatedWork(task.type, task.id)}
              aria-label={`Open task: ${task.title}`}
              className="mt-0.5 shrink-0 rounded-md bg-foreground/[0.045] px-2.5 py-1 text-[11px] font-semibold text-foreground/70 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MusicItemArtifactCard — compact inline card for music items
// ---------------------------------------------------------------------------
function MusicItemArtifactCard({
  item,
  onOpenCreatedWork,
}: {
  item: WorkItem;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string) => void | Promise<void>;
}) {
  const statusLabel = item.status ? item.status.replace(/_/g, " ") : "created";
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-foreground/10 bg-background px-4 py-3.5 shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-foreground/[0.06] text-foreground/70">
        <Music2 className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ui text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Music item {statusLabel}</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{item.title}</p>
      </div>
      <button
        type="button"
        onClick={() => void onOpenCreatedWork(item.type, item.id)}
        aria-label={`Open music item: ${item.title}`}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground/[0.045] px-3 py-1.5 text-[11px] font-semibold text-foreground/75 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
      >
        Open
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InvestigationScreen
// ---------------------------------------------------------------------------
export function InvestigationScreen({ onBack, onDecision }: { onBack: () => void; onDecision: () => void }) {
  return (
    <WorkspaceShell eyebrow="Manager run" title="Investigation" onBack={onBack}>
      <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-6">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Checking evidence</p>
        <h2 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">The Manager is cross-referencing context, source limits, and mission risk.</h2>
        <div className="grid gap-3 mt-6">
          {["Artist setup context", "Active mission state", "Private analytics limitations", "Budget guardrail"].map((item) => (
            <div key={item} className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] flex items-center gap-3 p-4">
              <ClipboardCheck className="h-4 w-4 text-success" aria-hidden="true" />
              <p className="text-sm font-semibold">{item}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <ProductButton onClick={onDecision}>Open decision package</ProductButton>
        </div>
      </section>
    </WorkspaceShell>
  );
}

// ---------------------------------------------------------------------------
// DecisionPackageScreen
// ---------------------------------------------------------------------------
export function DecisionPackageScreen({
  onBack,
  onNavigate,
  conversation,
}: {
  onBack: () => void;
  onNavigate: (view: CleanProductionView) => void;
  conversation?: ConversationViewModel | null;
}) {
  const decisionPackage = conversation?.decisionPackage;

  if (!decisionPackage) {
    return (
      <WorkspaceShell eyebrow="Decision package" title="No saved package" onBack={onBack}>
        <section className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Persisted Manager output</p>
          <h2 className="mt-3 font-display text-[1.85rem] font-semibold leading-none text-foreground sm:text-[2.15rem]">No decision package has been saved for the active conversation.</h2>
          <p className="mt-4 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">
            Ask the Manager for a decision that requires a durable package, then return here from that conversation.
          </p>
          <div className="mt-6">
            <ProductButton variant="secondary" onClick={() => onNavigate("conversationWorkspace")}>Continue thread</ProductButton>
          </div>
        </section>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell eyebrow="Decision package" title={decisionPackage.title} onBack={onBack}>
      <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-6">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Recommendation</p>
        <h2 className="font-display text-[2rem] font-semibold leading-none text-foreground sm:text-[2.25rem] lg:text-[2.5rem] mt-3">{decisionPackage.title}</h2>
        <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-4">{decisionPackage.recommendation || decisionPackage.summary}</p>
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Package basis</p>
            <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 mt-3">{decisionPackage.summary}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Confidence: {decisionPackage.confidence}</p>
          </div>
          <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Work created</p>
            <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 mt-3">
              {decisionPackage.createdWork.length
                ? decisionPackage.createdWork.map((work) => `${work.type.replace("_", " ")}: ${work.title}`).join(" | ")
                : "No mission or task artifact was created by this package."}
            </p>
          </div>
        </div>
        {decisionPackage.limitations.length || decisionPackage.evidenceIds.length ? (
          <div className="mt-5 rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Evidence and limits</p>
            <p className="mt-3 text-[13px] font-semibold leading-relaxed text-foreground/90">
              {decisionPackage.evidenceIds.length ? `Evidence: ${decisionPackage.evidenceIds.join(", ")}` : "No evidence ids were attached."}
            </p>
            {decisionPackage.limitations.length ? <p className="mt-2 text-[12px] font-semibold leading-relaxed text-muted-foreground/82">{decisionPackage.limitations.join(" ")}</p> : null}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <ProductButton onClick={() => onNavigate("missionsWorkspace")}>Open created mission</ProductButton>
          <ProductButton variant="secondary" onClick={() => onNavigate("conversationWorkspace")}>Continue thread</ProductButton>
        </div>
      </section>
    </WorkspaceShell>
  );
}
