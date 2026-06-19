import { ArrowRight, ClipboardCheck } from "lucide-react";
import { ProductButton, WorkspaceShell } from "../../design-system/components";
import type { CleanProductionView, ConversationViewModel, MissionGenesisResultViewModel } from "../../types/cleanProduction";
import { useState } from "react";

const managerQuestions = [
  {
    id: "goal",
    label: "Current goal",
    prompt: "What outcome should the Manager protect first?",
    suggestion: "Validate the strongest current music or catalog opportunity before approving scale spend.",
  },
  {
    id: "budget",
    label: "Budget posture",
    prompt: "What budget constraint should shape recommendations?",
    suggestion: "Keep the monthly budget at $5,000 and avoid full-scale spend until private signals improve.",
  },
  {
    id: "risk",
    label: "Decision risk",
    prompt: "What should the Manager avoid?",
    suggestion: "Do not rush public commitments, expensive spend, or rights-sensitive moves without proof.",
  },
];

export function ManagerOfficeScreen({
  answers,
  setAnswers,
  conversations,
  missionGenesisResult,
  missionGenesisAnswers,
  missionGenesisPending,
  onMissionGenesisAnswerChange,
  onSubmitMissionGenesisAnswers,
  onOpenCreatedMission,
  onBack,
  onConversation,
  onInvestigation,
}: {
  answers: Record<string, string>;
  setAnswers: (answers: Record<string, string>) => void;
  conversations: ConversationViewModel[];
  missionGenesisResult: MissionGenesisResultViewModel | null;
  missionGenesisAnswers: Record<string, string>;
  missionGenesisPending: boolean;
  onMissionGenesisAnswerChange: (key: string, value: string) => void;
  onSubmitMissionGenesisAnswers: () => void;
  onOpenCreatedMission: () => void;
  onBack: () => void;
  onConversation: (conversation: ConversationViewModel) => void;
  onInvestigation: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const answeredCount = managerQuestions.filter((question) => answers[question.id]?.trim()).length;
  const activeQuestion = managerQuestions[activeIndex] ?? managerQuestions[managerQuestions.length - 1];
  const allAnswered = submitted;

  function saveSuggestion() {
    setAnswers({ ...answers, [activeQuestion.id]: activeQuestion.suggestion });
  }

  function advance() {
    if (!answers[activeQuestion.id]?.trim()) {
      saveSuggestion();
      return;
    }

    if (activeIndex < managerQuestions.length - 1) {
      setActiveIndex((current) => current + 1);
    } else {
      setSubmitted(true);
    }
  }

  return (
    <WorkspaceShell eyebrow="Manager Office" title="Manager Briefing" onBack={onBack}>
      <div className="max-w-5xl">
        <MissionGenesisManagerPanel
          result={missionGenesisResult}
          answers={missionGenesisAnswers}
          pending={missionGenesisPending}
          onAnswerChange={onMissionGenesisAnswerChange}
          onSubmit={onSubmitMissionGenesisAnswers}
          onOpenCreatedMission={onOpenCreatedMission}
        />
        <div data-testid="manager-mobile-progress" className="mb-4 flex items-center justify-between rounded-[14px] border border-foreground/10 bg-white px-3.5 py-3 shadow-[0_1px_6px_rgba(17,19,24,0.045)] lg:hidden">
          <span className="text-[12px] font-semibold text-muted-foreground">Context progress</span>
          <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold text-background">{answeredCount}/{managerQuestions.length}</span>
        </div>
        <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Manager context</p>
              <h2 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">{allAnswered ? "Context synchronized" : activeQuestion.prompt}</h2>
              <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-3">
                The Manager asks for durable operating context before turning a question into a decision package or mission work.
              </p>
              {!allAnswered ? (
                <div className="mt-5">
                  <label className="grid gap-1.5">
                    <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{activeQuestion.label}</span>
                    <textarea
                      className="rounded-[12px] border border-foreground/8 bg-background p-3 text-[13px] font-bold text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/5 min-h-28"
                      value={answers[activeQuestion.id] ?? ""}
                      onChange={(event) => setAnswers({ ...answers, [activeQuestion.id]: event.target.value })}
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <ProductButton variant="secondary" onClick={saveSuggestion}>
                      Use suggested context
                    </ProductButton>
                    <ProductButton onClick={advance}>
                      {answeredCount === managerQuestions.length - 1 ? "Submit Context" : "Next Question"}
                    </ProductButton>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Manager directive</p>
                  <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] mt-3 p-4">
                    <p className="text-[13px] font-semibold leading-relaxed text-foreground/90">
                      Keep the release moving, protect the rights gate, and only recommend spend that has a measurable review path.
                    </p>
                  </div>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <input className="rounded-[12px] border border-foreground/8 bg-background p-3 text-[13px] font-bold text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/5" placeholder="Ask the Manager" defaultValue="We have $5,000. What should we do this month?" />
                    <ProductButton onClick={onInvestigation}>Ask Manager</ProductButton>
                  </div>
                </div>
              )}
            </div>
            <aside data-testid="manager-desktop-progress" className="hidden rounded-xl border border-foreground/8 bg-foreground/[0.025] p-4 lg:block lg:w-72">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Context progress</p>
              <p className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">
                {answeredCount}/{managerQuestions.length}
              </p>
              <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">Recent conversations unlock after required context is saved.</p>
            </aside>
          </div>
        </section>

        {allAnswered ? (
          <section className="mt-6">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-3">Conversation History</p>
            <div className="grid gap-3">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  aria-label={conversation.topic}
                  className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4 text-left"
                  onClick={() => onConversation(conversation)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold">{conversation.topic}</p>
                      <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-1">{conversation.summary}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function MissionGenesisManagerPanel({
  result,
  answers,
  pending,
  onAnswerChange,
  onSubmit,
  onOpenCreatedMission,
}: {
  result: MissionGenesisResultViewModel | null;
  answers: Record<string, string>;
  pending: boolean;
  onAnswerChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onOpenCreatedMission: () => void;
}) {
  if (!result || (result.outcome !== "candidate_needs_context" && result.outcome !== "activate_mission")) {
    return null;
  }

  return (
    <section className="mb-5 rounded-xl border border-foreground/10 bg-background p-5 shadow-sm">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission Genesis</p>
      <h2 className="mt-2 font-display text-[18px] font-bold tracking-tight text-foreground">{result.title}</h2>
      <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">{result.body}</p>
      {result.questions.length ? (
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
      {result.activatedMissionId ? (
        <div className="mt-4 rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Work created</p>
          <p className="mt-2 text-sm font-semibold text-foreground">Mission work is ready in Missions.</p>
          <div className="mt-4">
            <ProductButton onClick={onOpenCreatedMission}>Open created mission</ProductButton>
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
}: {
  conversation: ConversationViewModel;
  onBack: () => void;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string) => void;
}) {
  return (
    <WorkspaceShell eyebrow="Direct message" title={conversation.topic} onBack={onBack}>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4">
          {conversation.messages.map((message) => (
            <div key={message.id} className={message.speaker === "artist" ? "rounded-xl border border-foreground/10 bg-background shadow-sm p-4" : "rounded-xl border border-foreground/8 bg-foreground/[0.025] p-4"}>
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{message.label}</p>
              <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 mt-2">{message.body}</p>
            </div>
          ))}
          <div className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4">
            <input className="rounded-[12px] border border-foreground/8 bg-background p-3 text-[13px] font-bold text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/5" placeholder="Follow up in this thread" />
          </div>
        </section>
        <aside className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Work created</p>
          <div className="grid gap-3 mt-4">
            {conversation.createdWork.map((work) => (
              <button
                key={`${work.type}-${work.title}`}
                type="button"
                aria-label={work.type === "music_item" ? "Open created music item" : work.type === "mission" ? "Open created mission" : "Open created task"}
                className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4 text-left"
                onClick={() => onOpenCreatedWork(work.type, work.id)}
              >
                <p className="text-sm font-semibold">{work.title}</p>
                <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">{work.body}</p>
                <p className="mt-3 text-sm font-semibold text-muted-foreground">
                  {work.type === "music_item" ? "Open created music item" : work.type === "mission" ? "Open created mission" : "Open created task"}
                </p>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </WorkspaceShell>
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
