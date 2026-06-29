import { ArrowRight, ChevronRight, ClipboardCheck, Loader2, MessageSquareText, Music2, Route, Sparkles, UsersRound } from "lucide-react";
import { ProductButton, WorkspaceShell } from "../../design-system/components";
import type { CleanProductionView, ConversationViewModel, ManagerConversationContextAnswer, ManagerMissionContextQuestion, MissionGenesisResultViewModel } from "../../types/cleanProduction";
import { useEffect, useRef, useState } from "react";

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
  onInvestigation,
}: {
  conversations: ConversationViewModel[];
  missionGenesisResult: MissionGenesisResultViewModel | null;
  missionGenesisAnswers: Record<string, string>;
  missionGenesisPending: boolean;
  missionGenesisError: string | null;
  onMissionGenesisAnswerChange: (key: string, value: string) => void;
  onSubmitMissionGenesisAnswers: () => void;
  onOpenCreatedMission: () => void;
  onBack: () => void;
  onConversation: (conversation: ConversationViewModel) => void;
  onAskManager: (body: string) => void;
  askManagerPending: boolean;
  askManagerError: string | null;
  onInvestigation: () => void;
}) {
  const [askText, setAskText] = useState("");
  const promptChips = [
    "Review the next strongest move from today's read.",
    "What should we do with a $5,000 budget this month?",
    "Which rights or source gaps block the current release?",
    "Build the next mission from the strongest management lenses.",
  ];

  return (
    <WorkspaceShell eyebrow="Manager Office" title="Manager Briefing" onBack={onBack}>
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
        {!missionGenesisResult && (
          <>
            <section className="rounded-[18px] border border-foreground/10 bg-background p-6 shadow-sm sm:p-8">
              <div className="max-w-2xl">
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" />
                  <p className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-success/70">Context synchronized</p>
                </div>
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Manager Directive</p>
                <h2 className="font-display mt-2 text-[20px] font-bold tracking-tight text-foreground">Ask the Manager to turn the current packet into a decision.</h2>
                <div className="mt-6 flex flex-wrap gap-2">
                  {promptChips.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setAskText(prompt)}
                      className="rounded-full border border-foreground/8 bg-foreground/[0.035] px-3.5 py-2 text-[11px] font-bold text-foreground/84 transition-colors hover:border-brand-accent/25 hover:bg-brand-accent/5 hover:text-brand-accent"
                    >
                      {prompt.split(" ").slice(0, 4).join(" ")}
                    </button>
                  ))}
                </div>
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
                    className="group flex items-center justify-between gap-4 rounded-xl border border-transparent p-4 text-left transition-colors hover:border-foreground/8 hover:bg-foreground/[0.025]"
                    onClick={() => onConversation(conversation)}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5 text-foreground/80 transition-colors group-hover:bg-brand-accent/10 group-hover:text-brand-accent">
                        <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-foreground transition-colors group-hover:text-brand-accent">{conversation.topic}</p>
                        <p className="mt-1 truncate text-[12px] text-muted-foreground/78">{conversation.status || conversation.summary}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {conversation.lastUpdate ? <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{conversation.lastUpdate}</span> : null}
                      <ChevronRight className="h-4 w-4 text-foreground/20 transition-colors group-hover:text-brand-accent" aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
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
  onSubmit: () => void;
  onOpenCreatedMission: () => void;
}) {
  if (!result && !error) {
    return null;
  }

  if (result && result.outcome !== "candidate_needs_context" && result.outcome !== "activate_mission" && !error) {
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
            <ProductButton onClick={onSubmit} disabled={pending}>
              {pending ? "Continuing Mission Genesis" : "Continue Mission Genesis"}
            </ProductButton>
          </div>
        </div>
      ) : null}
      {result?.activatedMissionId ? (
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

export function ConversationWorkspace({
  conversation,
  onBack,
  onOpenCreatedWork,
  onSendMessage,
  onSendContextAnswers,
  onRetryLastMessage,
  sendPending,
  sendError,
}: {
  conversation: ConversationViewModel;
  onBack: () => void;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string) => void | Promise<void>;
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
  const messageCreatedWork = conversation.messages.flatMap((message) => message.createdWork ?? []);
  const allCreatedWork = conversation.createdWork.length
    ? conversation.createdWork
    : messageCreatedWork;
  const shouldShowCreatedWorkSummary = allCreatedWork.length > 0 && messageCreatedWork.length === 0;
  const activeRun = conversation.activeRun;
  const isManagerThinking = sendPending || activeRun?.status === "running";
  const hasFailedManagerMessage = conversation.messages.some((message) => message.speaker === "manager" && message.status === "failed");

  useEffect(() => {
    if (typeof scrollAnchorRef.current?.scrollIntoView === "function") {
      scrollAnchorRef.current.scrollIntoView({ block: "end" });
    }
  }, [conversation.messages.length, activeRun?.streamedText, activeRun?.steps.length]);

  return (
    <WorkspaceShell eyebrow="Direct message" title={conversation.topic} onBack={onBack}>
      <div className="mx-auto max-w-4xl pb-32">
        <section className="flex flex-col gap-7">
          {conversation.messages.map((message) => (
            <div key={message.id} className={`flex flex-col gap-4 ${message.speaker === "artist" ? "items-end" : ""}`}>
              <div className={`flex items-center gap-3 ${message.speaker === "artist" ? "flex-row-reverse" : ""}`}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ${message.speaker === "artist" ? "bg-foreground/[0.08] text-foreground" : "bg-foreground text-background"}`}>
                  {message.speaker === "artist" ? <UsersRound className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                </span>
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/88">
                  {message.label}
                  {message.status === "streaming" ? <span className="ml-2 normal-case tracking-normal text-brand-accent">streaming</span> : null}
                </p>
              </div>
              <div className={`max-w-2xl rounded-2xl border p-5 shadow-sm ${message.speaker === "artist" ? "rounded-tr-none border-foreground/10 bg-foreground text-background" : "rounded-tl-none border-foreground/8 bg-background text-foreground"}`}>
                <RichMessageBody body={message.body} streaming={message.status === "streaming"} failed={message.status === "failed"} />
                {message.status === "streaming" && activeRun?.steps.length ? <ManagerActivityDisclosure run={activeRun} /> : null}
                {message.status === "failed" && onRetryLastMessage ? (
                  <button
                    type="button"
                    onClick={onRetryLastMessage}
                    className="mt-4 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-foreground/75 transition-colors hover:bg-foreground/[0.045]"
                  >
                    Retry Manager message
                  </button>
                ) : null}
                {message.contextQuestions?.length ? (
                  <ManagerContextQuestionForm
                    questions={message.contextQuestions}
                    disabled={sendPending}
                    onSubmit={(answers) =>
                      onSendContextAnswers(
                        "Context answers for Manager mission decision.",
                        conversation.id,
                        message.contextRequestId ?? message.id,
                        answers,
                      )
                    }
                  />
                ) : null}
                {message.createdWork?.length ? (
                  <div className="mt-6 grid gap-3">
                    {message.createdWork.map((work) => (
                      <CreatedWorkCard key={`${work.type}-${work.id ?? work.title}`} work={work} onOpenCreatedWork={onOpenCreatedWork} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {isManagerThinking && !conversation.messages.some((message) => message.status === "streaming") ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background shadow-sm">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/88">Manager</p>
              </div>
              <div className="max-w-2xl rounded-2xl rounded-tl-none border border-foreground/8 bg-background p-5 text-foreground shadow-sm">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-accent" aria-hidden="true" />
                  <div>
                    <p className="text-[15px] font-semibold leading-[1.55] text-foreground">Manager is thinking</p>
                    <p className="text-[12px] font-semibold leading-[1.55] text-muted-foreground">Manager is writing a reply.</p>
                  </div>
                </div>
                {activeRun?.steps.length ? <ManagerActivityDisclosure run={activeRun} /> : null}
              </div>
            </div>
          ) : null}
          <div ref={scrollAnchorRef} />
        </section>

        {shouldShowCreatedWorkSummary ? (
          <aside className="mt-10 rounded-[16px] border border-foreground/10 bg-background p-4 shadow-sm">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Work created</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {allCreatedWork.map((work) => (
                <CreatedWorkCard key={`${work.type}-${work.id ?? work.title}-aside`} work={work} onOpenCreatedWork={onOpenCreatedWork} />
              ))}
            </div>
          </aside>
        ) : null}

        <div className="fixed bottom-24 left-0 right-0 z-40 px-3 lg:bottom-12 lg:px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto max-w-3xl rounded-[24px] border border-foreground/10 bg-background/90 p-2 shadow-2xl backdrop-blur-xl lg:rounded-[28px]">
            <div className="relative flex items-center gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    const body = draft.trim();
                    if (!body || sendPending) return;
                    onSendMessage(body, conversation.id);
                    setDraft("");
                  }
                }}
                placeholder="Type a message to the Manager..."
                className="min-h-[56px] w-full resize-none bg-transparent px-5 py-4 font-ui text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              <button
                type="button"
                onClick={() => {
                  if (!draft.trim()) return;
                  onSendMessage(draft.trim(), conversation.id);
                  setDraft("");
                }}
                disabled={!draft.trim() || sendPending}
                aria-label="Send Manager message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-accent text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-25"
              >
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {sendError && !hasFailedManagerMessage ? <p role="alert" className="px-5 pb-3 text-[12px] font-semibold text-red-700">{sendError}</p> : null}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

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

function ManagerActivityDisclosure({ run }: { run: NonNullable<ConversationViewModel["activeRun"]> }) {
  const [open, setOpen] = useState(false);
  const latestRunningStep = [...run.steps].reverse().find((step) => step.status === "running") ?? run.steps.at(-1);
  return (
    <div className="mt-4 border-t border-foreground/8 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] font-semibold leading-relaxed text-muted-foreground">
          {latestRunningStep ? activityStatusLine(latestRunningStep.label, latestRunningStep.status) : "Manager is preparing the answer."}
        </p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand-accent transition-colors hover:text-foreground"
        >
          {open ? "Hide Manager activity" : "View Manager activity"}
        </button>
      </div>
      {open ? (
        <div className="mt-3 grid gap-2">
          {run.steps.map((step) => (
            <div key={step.id} className="flex min-w-0 items-start gap-3 rounded-[10px] border border-foreground/8 bg-foreground/[0.02] px-3 py-2.5">
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${step.status === "failed" ? "bg-red-600" : step.status === "completed" ? "bg-success" : step.status === "running" ? "bg-brand-accent" : "bg-foreground/20"}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[12px] font-bold text-foreground">{step.label}</span>
                {step.detail ? <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">{step.detail}</span> : null}
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
  return `${label.replace(/\.$/, "")}...`;
}

function RichMessageBody({ body, streaming, failed }: { body: string; streaming?: boolean; failed?: boolean }) {
  const blocks = body.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (!blocks.length) {
    return <p className="text-[15px] font-normal leading-[1.6] text-current">{streaming ? " " : body}</p>;
  }

  return (
    <div className={`space-y-3 text-[15px] font-normal leading-[1.65] text-current ${failed ? "text-red-950" : ""}`}>
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const isList = lines.length > 1 && lines.every((line) => /^([-*]|\d+\.)\s+/.test(line));
        if (isList) {
          return (
            <ul key={`${block}-${index}`} className="list-disc space-y-1 pl-5">
              {lines.map((line) => <li key={line}>{line.replace(/^([-*]|\d+\.)\s+/, "")}</li>)}
            </ul>
          );
        }
        return (
          <p key={`${block}-${index}`}>
            {block}
            {streaming && index === blocks.length - 1 ? <span className="ml-1 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-brand-accent" aria-hidden="true" /> : null}
          </p>
        );
      })}
    </div>
  );
}

function CreatedWorkCard({
  work,
  onOpenCreatedWork,
}: {
  work: ConversationViewModel["createdWork"][number];
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string) => void | Promise<void>;
}) {
  const WorkIcon = work.type === "music_item" ? Music2 : work.type === "mission" ? Route : ClipboardCheck;
  const artifactLabel = work.type === "music_item" ? "music item" : work.type;
  const statusLabel = work.status ? work.status.replace(/_/g, " ") : "created";
  const buttonLabel = work.type === "task" ? `Open created ${artifactLabel}: ${work.title}` : `Open created ${artifactLabel}`;
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4 text-foreground shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/[0.06] text-foreground">
          <WorkIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/85">{artifactLabel} {statusLabel}</p>
      </div>
      <h3 className="text-[14px] font-semibold text-foreground">{work.title}</h3>
      <p className="mt-1.5 text-[12px] leading-[1.5] text-muted-foreground/88">{work.body}</p>
      <button
        type="button"
        onClick={() => void onOpenCreatedWork(work.type, work.id)}
        aria-label={buttonLabel}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground/[0.035] py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
      >
        Open created {artifactLabel}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

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

export function DecisionPackageScreen({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate: (view: CleanProductionView) => void;
}) {
  return (
    <WorkspaceShell eyebrow="Decision package" title="Budget call" onBack={onBack}>
      <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-6">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Recommendation</p>
        <h2 className="font-display text-[2rem] font-semibold leading-none text-foreground sm:text-[2.25rem] lg:text-[2.5rem] mt-3">Use a capped validation test before approving scale spend.</h2>
        <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-4">
          Hold back flexible budget until source-backed signal review is available. Do not fund a full video or full paid-media push yet.
        </p>
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Why this call</p>
            <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 mt-3">Momentum is credible, but private saves, source-of-stream, and rights proof are still incomplete.</p>
          </div>
          <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Work created</p>
            <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 mt-3">Mission: validate the active opportunity before scale spend. Task: approve capped campaign test budget.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <ProductButton onClick={() => onNavigate("missionsWorkspace")}>Open created mission</ProductButton>
          <ProductButton variant="secondary" onClick={() => onNavigate("conversationWorkspace")}>Continue thread</ProductButton>
        </div>
      </section>
    </WorkspaceShell>
  );
}
