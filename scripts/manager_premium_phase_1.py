from pathlib import Path

ROOT = Path('.')


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1))


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content)


# Manager wrapper: premium Office + intentional conversation loading/error states.
replace_once(
    'src/features/manager/ManagerScreens.tsx',
    'import type { ComponentProps } from "react";\nimport { useMemo, useState } from "react";',
    'import type { ComponentProps } from "react";\nimport { useEffect, useMemo, useState } from "react";',
)
replace_once(
    'src/features/manager/ManagerScreens.tsx',
    '''import {
  ConversationWorkspace as LegacyConversationWorkspace,
  DecisionPackageScreen,
  InvestigationScreen,
  ManagerOfficeScreen,
} from "./ManagerScreensLegacy";''',
    '''import {
  ConversationWorkspace as LegacyConversationWorkspace,
  DecisionPackageScreen,
  InvestigationScreen,
  ManagerOfficeScreen as LegacyManagerOfficeScreen,
} from "./ManagerScreensLegacy";''',
)
replace_once(
    'src/features/manager/ManagerScreens.tsx',
    'import { SongDocumentEditor } from "../music/SongDocumentEditor";',
    'import { ProductButton, WorkspaceHeader, WorkspaceShell } from "../../design-system/components";\nimport { SongDocumentEditor } from "../music/SongDocumentEditor";',
)
replace_once(
    'src/features/manager/ManagerScreens.tsx',
    'export { DecisionPackageScreen, InvestigationScreen, ManagerOfficeScreen };\n\ntype ConversationWorkspaceProps = ComponentProps<typeof LegacyConversationWorkspace>;',
    '''export { DecisionPackageScreen, InvestigationScreen };

type ManagerOfficeScreenProps = ComponentProps<typeof LegacyManagerOfficeScreen> & {
  conversationsPending?: boolean;
  conversationsError?: string | null;
  onRetryConversations?: () => void;
};

export function ManagerOfficeScreen({
  conversations,
  missionGenesisResult,
  missionGenesisAnswers,
  missionGenesisPending,
  missionGenesisError,
  onMissionGenesisAnswerChange,
  onSubmitMissionGenesisAnswers,
  onOpenCreatedMission,
  onConversation,
  onAskManager,
  askManagerPending,
  askManagerError,
  conversationsPending = false,
  conversationsError,
  onRetryConversations,
}: ManagerOfficeScreenProps) {
  const [askText, setAskText] = useState("");
  const candidateMissionIds = useMemo(() => (
    missionGenesisResult?.candidateMissionIds?.length
      ? missionGenesisResult.candidateMissionIds
      : missionGenesisResult?.candidateMissionId
        ? [missionGenesisResult.candidateMissionId]
        : []
  ), [missionGenesisResult?.candidateMissionId, missionGenesisResult?.candidateMissionIds?.join("|")]);
  const candidateMissionKey = candidateMissionIds.join("|");
  const [selectedCandidateMissionId, setSelectedCandidateMissionId] = useState<string | undefined>(candidateMissionIds[0]);

  useEffect(() => {
    setSelectedCandidateMissionId((current) => current && candidateMissionIds.includes(current) ? current : candidateMissionIds[0]);
  }, [candidateMissionKey]);

  function submitQuestion() {
    const body = askText.trim();
    if (!body || askManagerPending) return;
    onAskManager(body);
    setAskText("");
  }

  return (
    <section className="app-workspace app-workspace-reveal">
      <WorkspaceHeader title="Manager" />
      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="min-w-0">
          <ManagerMissionContext
            result={missionGenesisResult}
            answers={missionGenesisAnswers}
            pending={missionGenesisPending}
            error={missionGenesisError}
            candidateMissionIds={candidateMissionIds}
            selectedCandidateMissionId={selectedCandidateMissionId}
            onSelectCandidate={setSelectedCandidateMissionId}
            onAnswerChange={onMissionGenesisAnswerChange}
            onSubmit={() => onSubmitMissionGenesisAnswers(selectedCandidateMissionId)}
            onOpenCreatedMission={onOpenCreatedMission}
          />

          <section aria-label="Ask Manager" className="border-b border-foreground/8 pb-7">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitQuestion();
              }}
              className="flex min-w-0 items-end gap-2 border-b border-foreground/12 py-2 transition-colors focus-within:border-brand-accent/45"
            >
              <textarea
                value={askText}
                rows={1}
                onChange={(event) => setAskText(event.target.value)}
                onInput={(event) => {
                  const field = event.currentTarget;
                  field.style.height = "auto";
                  field.style.height = `${Math.min(field.scrollHeight, 144)}px`;
                }}
                placeholder="Ask Manager anything about this artist"
                aria-label="Ask Manager anything about this artist"
                className="min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-3 text-[15px] font-medium leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
                style={{ maxHeight: "144px", overflowY: "auto" }}
              />
              <button
                type="submit"
                disabled={!askText.trim() || askManagerPending}
                aria-label={askManagerPending ? "Manager is working" : "Ask Manager"}
                aria-busy={askManagerPending}
                className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-[18px] font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-25"
              >
                {askManagerPending ? <span className="animate-pulse">...</span> : <span aria-hidden="true">→</span>}
              </button>
            </form>
            {askManagerError ? <p role="alert" className="mt-3 text-[12px] font-medium text-red-600">{askManagerError}</p> : null}
          </section>
        </main>

        <aside className="min-w-0 border-t border-foreground/8 pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-semibold text-foreground">Conversations</h2>
            {conversations.length ? <span className="text-[11px] tabular-nums text-muted-foreground/55">{conversations.length}</span> : null}
          </div>

          {conversationsPending ? (
            <div data-testid="manager-office-conversations-loading" className="mt-4 grid gap-2" aria-label="Loading conversations">
              {[0, 1, 2].map((index) => (
                <div key={index} className="animate-pulse rounded-[10px] py-3">
                  <div className="h-3 w-3/4 rounded bg-foreground/[0.08]" />
                  <div className="mt-2 h-2.5 w-20 rounded bg-foreground/[0.05]" />
                </div>
              ))}
            </div>
          ) : conversationsError ? (
            <div className="mt-4 border-l-2 border-danger pl-3">
              <p className="text-[12px] font-medium leading-relaxed text-danger">Conversations could not load.</p>
              {onRetryConversations ? <button type="button" onClick={onRetryConversations} className="mt-2 text-[12px] font-semibold text-foreground underline decoration-foreground/20 underline-offset-4">Try again</button> : null}
            </div>
          ) : conversations.length ? (
            <div className="mt-3 divide-y divide-foreground/7">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  aria-label={`Open ${conversation.topic}`}
                  onClick={() => onConversation(conversation)}
                  className="group block w-full py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25"
                >
                  <p className="truncate text-[13px] font-semibold text-foreground/92 transition-colors group-hover:text-foreground">{conversation.topic}</p>
                  {conversation.lastUpdate ? <p className="mt-1 text-[11px] font-medium text-muted-foreground/55">{formatManagerTimestamp(conversation.lastUpdate)}</p> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-[12px] font-medium leading-relaxed text-muted-foreground">No conversations yet. Ask Manager something to start.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function ManagerMissionContext({
  result,
  answers,
  pending,
  error,
  candidateMissionIds,
  selectedCandidateMissionId,
  onSelectCandidate,
  onAnswerChange,
  onSubmit,
  onOpenCreatedMission,
}: {
  result: ComponentProps<typeof LegacyManagerOfficeScreen>["missionGenesisResult"];
  answers: Record<string, string>;
  pending: boolean;
  error: string | null;
  candidateMissionIds: string[];
  selectedCandidateMissionId?: string;
  onSelectCandidate: (id: string) => void;
  onAnswerChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onOpenCreatedMission: () => void;
}) {
  if (!result && !error) return null;

  return (
    <section className="mb-7 border-b border-foreground/8 pb-7" aria-label="Manager mission context">
      {result ? (
        <>
          <p className="text-[11px] font-semibold text-muted-foreground">Manager needs a little more context</p>
          <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.02em] text-foreground">{result.title}</h2>
          {result.body ? <p className="mt-2 max-w-[46rem] text-[13px] font-medium leading-relaxed text-muted-foreground">{result.body}</p> : null}
        </>
      ) : null}

      {candidateMissionIds.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Mission options">
          {candidateMissionIds.map((candidateMissionId, index) => (
            <button
              key={candidateMissionId}
              type="button"
              aria-pressed={selectedCandidateMissionId === candidateMissionId}
              onClick={() => onSelectCandidate(candidateMissionId)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${selectedCandidateMissionId === candidateMissionId ? "bg-foreground text-background" : "bg-foreground/[0.05] text-muted-foreground hover:text-foreground"}`}
            >
              Option {index + 1}
            </button>
          ))}
        </div>
      ) : null}

      {result?.questions.length ? (
        <div className="mt-5 grid gap-4">
          {result.questions.map((question) => (
            <label key={question.key} className="grid gap-2">
              <span className="text-[13px] font-semibold leading-snug text-foreground">{question.question}</span>
              {question.answerKind === "single_select" ? (
                <select
                  aria-label={question.question}
                  value={answers[question.key] ?? ""}
                  onChange={(event) => onAnswerChange(question.key, event.target.value)}
                  disabled={pending}
                  className="h-11 rounded-[10px] border border-foreground/10 bg-background px-3 text-[13px] font-medium text-foreground outline-none focus:border-brand-accent/35"
                >
                  <option value="">Select answer</option>
                  {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  aria-label={question.question}
                  value={answers[question.key] ?? ""}
                  onChange={(event) => onAnswerChange(question.key, event.target.value)}
                  disabled={pending}
                  className="h-11 rounded-[10px] border border-foreground/10 bg-background px-3 text-[13px] font-medium text-foreground outline-none focus:border-brand-accent/35"
                />
              )}
            </label>
          ))}
          <div><ProductButton onClick={onSubmit} disabled={pending}>{pending ? "Continuing..." : "Continue"}</ProductButton></div>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 border-l-2 border-danger pl-3">
          <p className="text-[12px] font-medium leading-relaxed text-danger">{error}</p>
          <button type="button" onClick={onSubmit} disabled={pending} className="mt-2 text-[12px] font-semibold text-foreground underline decoration-foreground/20 underline-offset-4 disabled:opacity-40">Try again</button>
        </div>
      ) : null}

      {result?.activatedMissionId || result?.activatedMissionIds?.length ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/8 pt-4">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Mission ready</p>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">The work is now available in Missions.</p>
          </div>
          <ProductButton variant="secondary" onClick={onOpenCreatedMission}>View mission</ProductButton>
        </div>
      ) : null}
    </section>
  );
}

function formatManagerTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type ConversationWorkspaceProps = ComponentProps<typeof LegacyConversationWorkspace> & {
  detailPending?: boolean;
  detailError?: string | null;
  onRetryDetail?: () => void;
};''',
)
replace_once(
    'src/features/manager/ManagerScreens.tsx',
    '''export function ConversationWorkspace(props: ConversationWorkspaceProps) {
  const { conversation, onOpenCreatedWork, onOpenMusicSubject, sendPending, musicRepository } = props;
  const [documentPreviewTarget, setDocumentPreviewTarget] = useState<DocumentPreviewTarget | null>(null);''',
    '''export function ConversationWorkspace(props: ConversationWorkspaceProps) {
  const { conversation, onOpenCreatedWork, onOpenMusicSubject, sendPending, musicRepository, detailPending = false, detailError, onRetryDetail } = props;
  const [documentPreviewTarget, setDocumentPreviewTarget] = useState<DocumentPreviewTarget | null>(null);
  const [showDetailLoading, setShowDetailLoading] = useState(false);

  useEffect(() => {
    if (!detailPending) {
      setShowDetailLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowDetailLoading(true), 140);
    return () => window.clearTimeout(timer);
  }, [detailPending]);''',
)
replace_once(
    'src/features/manager/ManagerScreens.tsx',
    '''  function openWorkspaceAction(action: ManagerWorkspaceAction) {
    const subject = conversation.musicSubject;
    if (!subject) return;
    if (subject.type === "music_item" && action.target === "files") {
      void onOpenCreatedWork("music_item", subject.id, "files");
      return;
    }
    onOpenMusicSubject?.(subject);
  }

  return (
    <>''',
    '''  function openWorkspaceAction(action: ManagerWorkspaceAction) {
    const subject = conversation.musicSubject;
    if (!subject) return;
    if (subject.type === "music_item" && action.target === "files") {
      void onOpenCreatedWork("music_item", subject.id, "files");
      return;
    }
    onOpenMusicSubject?.(subject);
  }

  if (detailError) {
    return (
      <WorkspaceShell eyebrow="Manager conversation" title={conversation.topic} onBack={props.onBack} punctuateTitle={false} variant="conversation" backLabel="Back to Manager's Office">
        <div data-testid="manager-conversation-load-error" className="mx-auto w-full max-w-[48rem] px-1 py-8 sm:px-2">
          <p className="text-[13px] font-semibold text-foreground">Couldn't load this conversation</p>
          <p className="mt-2 max-w-md text-[12px] font-medium leading-relaxed text-muted-foreground">{detailError}</p>
          {onRetryDetail ? <div className="mt-4"><ProductButton onClick={onRetryDetail}>Try again</ProductButton></div> : null}
        </div>
      </WorkspaceShell>
    );
  }

  if (detailPending && (showDetailLoading || !conversation.messages?.length)) {
    return (
      <WorkspaceShell eyebrow="Manager conversation" title={conversation.topic} onBack={props.onBack} punctuateTitle={false} variant="conversation" backLabel="Back to Manager's Office">
        <div data-testid="manager-conversation-loading" aria-label="Loading conversation" className="mx-auto w-full max-w-[48rem] px-1 pb-28 pt-7 sm:px-2">
          <div className="animate-pulse">
            <div className="h-3 w-28 rounded bg-foreground/[0.07]" />
            <div className="mt-4 h-4 w-5/6 rounded bg-foreground/[0.08]" />
            <div className="mt-2 h-4 w-2/3 rounded bg-foreground/[0.06]" />
            <div className="mt-8 ml-auto h-10 w-2/3 rounded-[18px] bg-foreground/[0.055]" />
            <div className="mt-8 h-4 w-3/4 rounded bg-foreground/[0.08]" />
            <div className="mt-2 h-4 w-1/2 rounded bg-foreground/[0.06]" />
          </div>
          <p className="mt-6 text-[12px] font-medium text-muted-foreground">Loading conversation...</p>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <>''',
)

# ProductionApp: separate list/detail loading from Manager send errors.
replace_once(
    'src/app/ProductionApp.tsx',
    '  const [conversationDetailPending, setConversationDetailPending] = useState(false);\n  const [missionDetailPending, setMissionDetailPending] = useState(false);',
    '  const [conversationDetailPending, setConversationDetailPending] = useState(false);\n  const [conversationDetailError, setConversationDetailError] = useState<string | null>(null);\n  const [conversationListPending, setConversationListPending] = useState(false);\n  const [conversationListError, setConversationListError] = useState<string | null>(null);\n  const [missionDetailPending, setMissionDetailPending] = useState(false);',
)
replace_once(
    'src/app/ProductionApp.tsx',
    '''  useEffect(() => {
    if (view !== "managerOffice" || conversationListLoaded.current) return;
    let cancelled = false;
    void loadConversationListResource()
      .then((nextConversations) => {
        if (!cancelled) {
          conversationListLoaded.current = true;
          setConversations(nextConversations);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setViewModelError(readErrorMessage(loadError, "Manager conversations could not load."));
      });
    return () => {
      cancelled = true;
    };
  }, [repositories.manager, resourceWorkspaceId, view]);''',
    '''  useEffect(() => {
    if (view !== "managerOffice" || conversationListLoaded.current) return;
    let cancelled = false;
    setConversationListPending(true);
    setConversationListError(null);
    void loadConversationListResource()
      .then((nextConversations) => {
        if (!cancelled) {
          conversationListLoaded.current = true;
          setConversations(nextConversations);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setConversationListError(readErrorMessage(loadError, "Manager conversations could not load."));
      })
      .finally(() => {
        if (!cancelled) setConversationListPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repositories.manager, resourceWorkspaceId, view]);

  function retryManagerConversationList() {
    conversationListLoaded.current = false;
    setConversationListPending(true);
    setConversationListError(null);
    void loadConversationListResource()
      .then((nextConversations) => {
        conversationListLoaded.current = true;
        setConversations(nextConversations);
      })
      .catch((loadError) => setConversationListError(readErrorMessage(loadError, "Manager conversations could not load.")))
      .finally(() => setConversationListPending(false));
  }''',
)
replace_once(
    'src/app/ProductionApp.tsx',
    '''  async function openConversation(conversation: ConversationViewModel) {
    setManagerTaskContextId(conversation.taskContextId ?? null);
    setSelectedConversation(conversation);
    navigate("conversationWorkspace");
    const request = ++conversationDetailRequest.current;
    setConversationDetailPending(true);
    try {
      const detail = await resourceRequests.load(resourceWorkspaceId, `conversation:${conversation.id}`, () =>
        repositories.manager.loadConversation?.(conversation.id)
          ?? repositories.manager.loadConversations().then((items) => items.find((item) => item.id === conversation.id) ?? null)
      );
      if (request !== conversationDetailRequest.current || !detail) return;
      setSelectedConversation(detail);
      setConversations((current) => [detail, ...current.filter((item) => item.id !== detail.id)]);
      setManagerTaskContextId(detail.taskContextId ?? null);
    } catch (loadError) {
      if (request === conversationDetailRequest.current) {
        setManagerSendError(readErrorMessage(loadError, "Conversation detail could not load."));
      }
    } finally {
      if (request === conversationDetailRequest.current) setConversationDetailPending(false);
    }
  }''',
    '''  async function openConversation(conversation: ConversationViewModel) {
    setManagerTaskContextId(conversation.taskContextId ?? null);
    setSelectedConversation(conversation);
    setConversationDetailError(null);
    navigate("conversationWorkspace");
    const request = ++conversationDetailRequest.current;
    setConversationDetailPending(true);
    try {
      const detail = await resourceRequests.load(resourceWorkspaceId, `conversation:${conversation.id}`, () =>
        repositories.manager.loadConversation?.(conversation.id)
          ?? repositories.manager.loadConversations().then((items) => items.find((item) => item.id === conversation.id) ?? null)
      );
      if (request !== conversationDetailRequest.current || !detail) return;
      setSelectedConversation(detail);
      setConversations((current) => [detail, ...current.filter((item) => item.id !== detail.id)]);
      setManagerTaskContextId(detail.taskContextId ?? null);
    } catch (loadError) {
      if (request === conversationDetailRequest.current) {
        setConversationDetailError(readErrorMessage(loadError, "Conversation detail could not load."));
      }
    } finally {
      if (request === conversationDetailRequest.current) setConversationDetailPending(false);
    }
  }''',
)
replace_once(
    'src/app/ProductionApp.tsx',
    '''              askManagerPending={managerSendPending}
              askManagerError={managerSendError}
            />''',
    '''              askManagerPending={managerSendPending}
              askManagerError={managerSendError}
              conversationsPending={conversationListPending}
              conversationsError={conversationListError}
              onRetryConversations={retryManagerConversationList}
            />''',
)
replace_once(
    'src/app/ProductionApp.tsx',
    '''                sendPending={managerSendPending}
                sendError={managerSendError}
              />''',
    '''                sendPending={managerSendPending}
                sendError={managerSendError}
                detailPending={conversationDetailPending}
                detailError={conversationDetailError}
                onRetryDetail={() => void openConversation(activeConversation)}
              />''',
)

# Composer: remove the permanent disclaimer and reduce floating action chrome.
replace_once('src/features/manager/ManagerComposer.tsx', '  verificationNote = true,', '  verificationNote = false,')
replace_once(
    'src/features/manager/ManagerComposer.tsx',
    '''    <section
      data-testid="manager-workspace-actions"
      aria-label="Manager required actions"
      className="overflow-hidden rounded-[18px] border border-foreground/12 bg-background/98 shadow-[0_10px_32px_rgba(0,0,0,0.1)] backdrop-blur-xl"
    >
      <div className="border-b border-foreground/8 px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Action required</p>
      </div>
      <div className="divide-y divide-foreground/8">''',
    '''    <section
      data-testid="manager-workspace-actions"
      aria-label="Manager required actions"
      className="overflow-hidden rounded-[16px] border border-foreground/10 bg-background/98 shadow-[0_8px_28px_rgba(0,0,0,0.08)] backdrop-blur-xl"
    >
      <div className="divide-y divide-foreground/8">''',
)

# Opportunity artifact: answer first, targets immediately, details inline.
write('src/features/manager/OpportunityArtifact.tsx', '''import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Clipboard, ExternalLink, FileText, Link2, RotateCcw, Sparkles, Target, X } from "lucide-react";
import type { ReleaseOpportunityArtifactViewModel, ReleaseOpportunityTargetViewModel } from "../../types/cleanProduction";

export function OpportunityArtifact({ artifact, onPreparePitch, onRecordOutcome, onOpenFiles, onOpenMission, onRetry }: {
  artifact: ReleaseOpportunityArtifactViewModel;
  onPreparePitch: (target: ReleaseOpportunityTargetViewModel) => void | Promise<void>;
  onRecordOutcome: (target: ReleaseOpportunityTargetViewModel, input: { status: ReleaseOpportunityTargetViewModel["status"]; manualOutcome: string }) => void | Promise<void>;
  onOpenFiles: (musicItemId: string) => void | Promise<void>;
  onOpenMission?: (missionId: string) => void | Promise<void>;
  onRetry: (artifact: ReleaseOpportunityArtifactViewModel) => void | Promise<void>;
}) {
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [outcomeTargetId, setOutcomeTargetId] = useState<string | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState<ReleaseOpportunityTargetViewModel["status"]>("submitted_manually");
  const [outcomeNote, setOutcomeNote] = useState("");
  const [copiedTargetId, setCopiedTargetId] = useState<string | null>(null);
  const [preparingTargetId, setPreparingTargetId] = useState<string | null>(null);
  const [savingOutcome, setSavingOutcome] = useState(false);

  const allTargets = useMemo(() => [...artifact.shortlist, ...artifact.watch, ...artifact.excluded], [artifact]);
  const outcomeTarget = allTargets.find((target) => target.id === outcomeTargetId);
  const targetLabel = artifact.opportunityType === "playlist" ? "playlist" : "press";
  const primaryCount = artifact.shortlist.length || artifact.watch.length;
  const title = artifact.opportunityType === "playlist" ? "Playlist opportunities" : "Press opportunities";
  const headline = artifact.shortlist.length
    ? `${artifact.shortlist.length} ${artifact.shortlist.length === 1 ? "target is" : "targets are"} ready to pitch`
    : artifact.watch.length
      ? `${artifact.watch.length} ${artifact.watch.length === 1 ? "target is" : "targets are"} worth watching`
      : `No strong ${targetLabel} match yet`;
  const summary = artifact.shortlist.length
    ? "These have enough evidence and a usable route to prepare a pitch."
    : artifact.watch.length
      ? "None are ready to pitch yet. You can still inspect what Manager found and what is missing."
      : artifact.failure?.message ?? "Manager did not find a target strong enough to recommend.";

  useEffect(() => {
    if (expandedTargetId && !allTargets.some((target) => target.id === expandedTargetId)) setExpandedTargetId(null);
  }, [allTargets, expandedTargetId]);

  async function preparePitch(target: ReleaseOpportunityTargetViewModel) {
    if (preparingTargetId) return;
    try {
      setPreparingTargetId(target.id);
      await onPreparePitch(target);
    } finally {
      setPreparingTargetId(null);
    }
  }

  async function copyPitch(target: ReleaseOpportunityTargetViewModel) {
    const body = target.package?.pitchBody?.trim();
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopiedTargetId(target.id);
      window.setTimeout(() => setCopiedTargetId((current) => current === target.id ? null : current), 1500);
    } catch {
      setCopiedTargetId(null);
    }
  }

  async function saveOutcome() {
    if (!outcomeTarget || !outcomeNote.trim() || savingOutcome) return;
    try {
      setSavingOutcome(true);
      await onRecordOutcome(outcomeTarget, { status: outcomeStatus, manualOutcome: outcomeNote.trim() });
      setOutcomeTargetId(null);
      setOutcomeNote("");
    } finally {
      setSavingOutcome(false);
    }
  }

  const details = (target: ReleaseOpportunityTargetViewModel) => (
    <TargetDetails
      artifact={artifact}
      target={target}
      preparing={preparingTargetId === target.id}
      copied={copiedTargetId === target.id}
      outcomeTarget={outcomeTarget}
      outcomeStatus={outcomeStatus}
      outcomeNote={outcomeNote}
      savingOutcome={savingOutcome}
      onPrepare={() => void preparePitch(target)}
      onCopy={() => void copyPitch(target)}
      onOpenFiles={() => void onOpenFiles(artifact.musicItemId)}
      onStartOutcome={() => { setOutcomeTargetId(target.id); setOutcomeNote(target.manualOutcome ?? ""); }}
      onCloseOutcome={() => setOutcomeTargetId(null)}
      onOutcomeStatus={setOutcomeStatus}
      onOutcomeNote={setOutcomeNote}
      onSaveOutcome={() => void saveOutcome()}
    />
  );

  return (
    <article data-testid="release-opportunity-artifact" className="mt-5 border-t border-foreground/8 pt-5">
      <header>
        <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/65">{title}</p>
        <h3 className="mt-2 text-[18px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{headline}</h3>
        <p className="mt-2 max-w-[44rem] text-[13px] font-medium leading-relaxed text-muted-foreground">{summary}</p>
      </header>

      {primaryCount ? (
        <div className="mt-5 grid gap-6">
          <OpportunitySection title="Ready to pitch" targets={artifact.shortlist} expandedTargetId={expandedTargetId} onToggle={(target) => setExpandedTargetId((current) => current === target.id ? null : target.id)} renderDetails={details} />
          <OpportunitySection title="Worth watching" targets={artifact.watch} expandedTargetId={expandedTargetId} onToggle={(target) => setExpandedTargetId((current) => current === target.id ? null : target.id)} renderDetails={details} />
        </div>
      ) : null}

      {artifact.excluded.length ? (
        <div className="mt-5 border-t border-foreground/8 pt-4">
          <button type="button" aria-expanded={showSkipped} onClick={() => setShowSkipped((current) => !current)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
            {showSkipped ? "Hide skipped" : `Show skipped (${artifact.excluded.length})`}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSkipped ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {showSkipped ? <div className="mt-3"><OpportunitySection title="Skipped" targets={artifact.excluded} expandedTargetId={expandedTargetId} onToggle={(target) => setExpandedTargetId((current) => current === target.id ? null : target.id)} renderDetails={details} muted /></div> : null}
        </div>
      ) : null}

      {artifact.failure ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-danger pl-3" role="alert">
          <p className="text-[12px] font-medium leading-relaxed text-danger">{artifact.failure.message}</p>
          {artifact.failure.retryable ? <button type="button" onClick={() => void onRetry(artifact)} className="inline-flex min-h-9 items-center gap-1.5 text-[12px] font-semibold text-danger"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Try again</button> : null}
        </div>
      ) : null}

      {artifact.missionId && onOpenMission ? <button type="button" onClick={() => void onOpenMission(artifact.missionId!)} className="mt-5 text-[12px] font-semibold text-muted-foreground underline decoration-foreground/15 underline-offset-4 hover:text-foreground">View related mission</button> : null}
    </article>
  );
}

function OpportunitySection({ title, targets, expandedTargetId, onToggle, renderDetails, muted = false }: {
  title: string;
  targets: ReleaseOpportunityTargetViewModel[];
  expandedTargetId: string | null;
  onToggle: (target: ReleaseOpportunityTargetViewModel) => void;
  renderDetails: (target: ReleaseOpportunityTargetViewModel) => ReactNode;
  muted?: boolean;
}) {
  if (!targets.length) return null;
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-[11px] font-semibold text-muted-foreground">{title}</h4><span className="text-[10px] tabular-nums text-muted-foreground/55">{targets.length}</span></div>
      <div className="divide-y divide-foreground/8 border-y border-foreground/8">
        {targets.map((target) => {
          const expanded = expandedTargetId === target.id;
          return (
            <div key={target.id}>
              <button type="button" aria-label={`Open ${target.targetName}`} aria-expanded={expanded} onClick={() => onToggle(target)} className="group flex w-full items-start gap-3 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${muted ? "bg-foreground/[0.035] text-muted-foreground" : "bg-foreground/[0.055] text-foreground/70"}`} aria-hidden="true"><Target className="h-3.5 w-3.5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-snug text-foreground">{target.targetName}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{target.platform ?? "Target"}</span>
                  {target.fit?.explanation ? <span className="mt-1.5 line-clamp-2 block text-[12px] font-medium leading-relaxed text-muted-foreground/85">{target.fit.explanation}</span> : null}
                </span>
                <ChevronDown className={`mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/45 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {expanded ? <div className="pb-4 pl-11">{renderDetails(target)}</div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TargetDetails({ artifact, target, preparing, copied, outcomeTarget, outcomeStatus, outcomeNote, savingOutcome, onPrepare, onCopy, onOpenFiles, onStartOutcome, onCloseOutcome, onOutcomeStatus, onOutcomeNote, onSaveOutcome }: {
  artifact: ReleaseOpportunityArtifactViewModel;
  target: ReleaseOpportunityTargetViewModel;
  preparing: boolean;
  copied: boolean;
  outcomeTarget?: ReleaseOpportunityTargetViewModel;
  outcomeStatus: ReleaseOpportunityTargetViewModel["status"];
  outcomeNote: string;
  savingOutcome: boolean;
  onPrepare: () => void;
  onCopy: () => void;
  onOpenFiles: () => void;
  onStartOutcome: () => void;
  onCloseOutcome: () => void;
  onOutcomeStatus: (status: ReleaseOpportunityTargetViewModel["status"]) => void;
  onOutcomeNote: (note: string) => void;
  onSaveOutcome: () => void;
}) {
  const isSpotifyEditorial = /spotify\\s+(?:editorial|for artists)|editorial\\s+playlist/i.test(`${target.platform ?? ""} ${target.targetName}`);
  return (
    <div className="border-l border-foreground/10 pl-4">
      <div className="flex flex-wrap items-center gap-2"><SafetyBadge state={target.safetyState} /><span className="text-[10px] font-medium capitalize text-muted-foreground">{target.confidence} confidence</span></div>
      {target.requirements?.length ? <div className="mt-3"><p className="text-[11px] font-semibold text-foreground">Before you pitch</p><ul className="mt-1.5 grid gap-1 text-[11px] font-medium leading-relaxed text-muted-foreground">{target.requirements.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}</ul></div> : null}
      {isSpotifyEditorial ? <p className="mt-3 text-[11px] font-medium leading-relaxed text-muted-foreground">Spotify editorial pitches go through Spotify for Artists. Manager will prepare the pitch, not submit it for you.</p> : null}
      {target.publicContact ? <p className="mt-3 text-[11px] font-medium text-muted-foreground">Public contact: <ContactLink contact={target.publicContact} /> {target.publicContact.verifiedAt ? <span className="text-muted-foreground/60">· verified {target.publicContact.verifiedAt.slice(0, 10)}</span> : null}</p> : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold">{target.targetUrl ? <ExternalAnchor href={target.targetUrl} label="Open submission route" /> : null}{target.sourceUrl ? <ExternalAnchor href={target.sourceUrl} label="View source" /> : null}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onPrepare} disabled={preparing} aria-busy={preparing} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 disabled:opacity-45"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{preparing ? "Preparing..." : "Prepare pitch"}</button>
        {target.package?.shareUrl ? <ExternalAnchor href={target.package.shareUrl} label="Open share link" icon={<Link2 className="h-3.5 w-3.5" aria-hidden="true" />} buttonLike /> : <button type="button" onClick={onOpenFiles} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.035]"><FileText className="h-3.5 w-3.5" aria-hidden="true" />Open Files</button>}
        <button type="button" onClick={onStartOutcome} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.035]"><Check className="h-3.5 w-3.5" aria-hidden="true" />Record outcome</button>
      </div>
      {target.package?.pitchBody ? <div className="mt-4 border-t border-foreground/8 pt-3"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold text-foreground">Pitch draft</p><button type="button" onClick={onCopy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"><Clipboard className="h-3.5 w-3.5" aria-hidden="true" />{copied ? "Copied" : "Copy"}</button></div><p className="mt-2 whitespace-pre-wrap text-[12px] font-medium leading-relaxed text-muted-foreground">{target.package.pitchBody}</p></div> : null}
      {outcomeTarget?.id === target.id ? <div className="mt-4 border-t border-foreground/8 pt-3"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold text-foreground">What happened?</p><button type="button" aria-label="Close outcome form" onClick={onCloseOutcome} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" aria-hidden="true" /></button></div><div className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_auto]"><select value={outcomeStatus} onChange={(event) => onOutcomeStatus(event.target.value as ReleaseOpportunityTargetViewModel["status"])} className="h-10 rounded-lg border border-foreground/10 bg-background px-2.5 text-[12px] font-medium text-foreground">{(["submitted_manually", "replied", "accepted", "declined", "watch"] as const).map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select><input value={outcomeNote} onChange={(event) => onOutcomeNote(event.target.value)} placeholder="Add a short note" className="h-10 min-w-0 rounded-lg border border-foreground/10 bg-background px-3 text-[12px] font-medium text-foreground outline-none focus:border-brand-accent/35" /><button type="button" onClick={onSaveOutcome} disabled={!outcomeNote.trim() || savingOutcome} className="h-10 rounded-lg bg-foreground px-3 text-[11px] font-semibold text-background disabled:opacity-40">{savingOutcome ? "Saving..." : "Save"}</button></div></div> : null}
      {target.limitations?.length ? <p className="mt-3 text-[10px] font-medium leading-relaxed text-muted-foreground/65">{target.limitations.slice(0, 2).join(" · ")}</p> : null}
      <span className="sr-only">{artifact.subject.title}</span>
    </div>
  );
}

function ContactLink({ contact }: { contact: NonNullable<ReleaseOpportunityTargetViewModel["publicContact"]> }) {
  const href = contact.kind === "email" ? `mailto:${contact.value}` : contact.kind === "phone" ? `tel:${contact.value}` : contact.value;
  return <a href={href} target={contact.kind === "url" ? "_blank" : undefined} rel={contact.kind === "url" ? "noreferrer" : undefined} className="font-semibold text-foreground underline decoration-foreground/20 underline-offset-2">{contact.value}</a>;
}

function ExternalAnchor({ href, label, icon, buttonLike = false }: { href: string; label: string; icon?: ReactNode; buttonLike?: boolean }) {
  return <a href={href} target="_blank" rel="noreferrer" className={buttonLike ? "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.035]" : "inline-flex items-center gap-1 text-[11px] font-semibold text-foreground underline decoration-foreground/15 underline-offset-3"}>{icon ?? <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}{label}</a>;
}

function SafetyBadge({ state }: { state: ReleaseOpportunityTargetViewModel["safetyState"] }) {
  const label = state === "clear" ? "Route verified" : state === "caution" ? "Needs checking" : "Not recommended";
  return <span className="rounded-full bg-foreground/[0.055] px-2 py-1 text-[9px] font-semibold text-muted-foreground">{label}</span>;
}
''')

write('src/record-servicing-opportunity-ui.test.tsx', '''import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpportunityArtifact } from "./features/manager/OpportunityArtifact";
import type { ReleaseOpportunityArtifactViewModel, ReleaseOpportunityTargetViewModel } from "./types/cleanProduction";

afterEach(() => cleanup());

function target(id: string, overrides: Partial<ReleaseOpportunityTargetViewModel> = {}): ReleaseOpportunityTargetViewModel {
  return {
    id,
    targetName: `Target ${id}`,
    platform: "Independent playlist",
    sourceUrl: `https://example.com/${id}`,
    publicContact: { kind: "email", value: "info@examplemusiccompany.com", sourceUrl: "https://example.com/contact", verifiedAt: "2026-08-15T12:00:00.000Z" },
    fit: { songCriteria: ["late-night Afro-R&B"], targetCriteria: ["actively features emerging Afro-R&B releases"], explanation: "Strong sonic fit, active curation, and a verified public submission route." },
    sourceEvidence: [{ source: "Playlist page", ref: `https://example.com/${id}` }],
    confidence: "high",
    limitations: [],
    requirements: [],
    safetyState: "clear",
    status: "shortlisted",
    package: { selectedFiles: ["Artwork", "Track link"], pitchBody: "A short recipient-specific pitch." },
    ...overrides,
  };
}

function artifact(overrides: Partial<ReleaseOpportunityArtifactViewModel> = {}): ReleaseOpportunityArtifactViewModel {
  return {
    id: "playlist-artifact",
    musicItemId: "song-1",
    missionId: "mission-1",
    opportunityType: "playlist",
    subject: { title: "Down Below", itemType: "song" },
    shortlist: [target("one"), target("two")],
    watch: [target("watch", { safetyState: "caution", status: "watch", publicContact: undefined })],
    excluded: [target("skip", { safetyState: "excluded", status: "skipped", publicContact: undefined })],
    ...overrides,
  };
}

function renderArtifact(value = artifact()) {
  return render(<OpportunityArtifact artifact={value} onPreparePitch={vi.fn()} onRecordOutcome={vi.fn()} onOpenFiles={vi.fn()} onOpenMission={vi.fn()} onRetry={vi.fn()} />);
}

describe("record servicing opportunity presentation", () => {
  it("shows the answer and useful targets immediately without dashboard counters", () => {
    renderArtifact();
    expect(screen.getByRole("heading", { name: "2 targets are ready to pitch" })).toBeInTheDocument();
    expect(screen.getByText("Playlist opportunities")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Target one" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Target watch" })).toBeInTheDocument();
    expect(screen.queryByText("PITCH NOW")).not.toBeInTheDocument();
    expect(screen.queryByText("Prepared")).not.toBeInTheDocument();
    expect(screen.queryByText("Preparation only — no outreach is sent.")).not.toBeInTheDocument();
  });

  it("keeps verified contact literal when a target is inspected", () => {
    renderArtifact();
    fireEvent.click(screen.getByRole("button", { name: "Open Target one" }));
    const email = screen.getByRole("link", { name: "info@examplemusiccompany.com" });
    expect(email).toHaveAttribute("href", "mailto:info@examplemusiccompany.com");
    expect(screen.getByText("· verified 2026-08-15")).toBeInTheDocument();
  });

  it("uses plain language when nothing is ready to pitch", () => {
    renderArtifact(artifact({ shortlist: [], watch: [target("watch", { safetyState: "caution", status: "watch", publicContact: undefined })], excluded: [] }));
    expect(screen.getByRole("heading", { name: "1 target is worth watching" })).toBeInTheDocument();
    expect(screen.getByText("None are ready to pitch yet. You can still inspect what Manager found and what is missing.")).toBeInTheDocument();
    expect(screen.queryByText("WATCH")).not.toBeInTheDocument();
  });
});
''')

write('src/manager-premium-phase-1.test.tsx', '''import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationWorkspace, ManagerOfficeScreen } from "./features/manager/ManagerScreens";
import { ManagerComposer } from "./features/manager/ManagerComposer";

afterEach(() => cleanup());

describe("Manager premium phase 1", () => {
  it("keeps Manager Office as a top-level surface without a nested back button", () => {
    render(<ManagerOfficeScreen {...({ conversations: [], missionGenesisResult: null, missionGenesisAnswers: {}, missionGenesisPending: false, missionGenesisError: null, onMissionGenesisAnswerChange: vi.fn(), onSubmitMissionGenesisAnswers: vi.fn(), onOpenCreatedMission: vi.fn(), onBack: vi.fn(), onConversation: vi.fn(), onAskManager: vi.fn(), askManagerPending: false, askManagerError: null } as any)} />);
    expect(screen.getByRole("heading", { name: "Manager" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Back to Desk/i })).not.toBeInTheDocument();
    expect(screen.getByText("No conversations yet. Ask Manager something to start.")).toBeInTheDocument();
  });

  it("renders an intentional conversation loading state instead of an incomplete thread", () => {
    render(<ConversationWorkspace {...({ conversation: { id: "conversation-1", topic: "Dance — song workspace", prompt: "", messages: [] }, onBack: vi.fn(), onOpenCreatedWork: vi.fn(), onSendMessage: vi.fn(), onSendContextAnswers: vi.fn(), sendPending: false, sendError: null, detailPending: true } as any)} />);
    expect(screen.getByTestId("manager-conversation-loading")).toBeInTheDocument();
    expect(screen.getByText("Loading conversation...")).toBeInTheDocument();
  });

  it("does not show a permanent verification disclaimer under normal chat", () => {
    render(<ManagerComposer draft="" onDraftChange={vi.fn()} onSend={vi.fn()} sendPending={false} />);
    expect(screen.queryByText("Verify important decisions before acting.")).not.toBeInTheDocument();
  });
});
''')

print('Manager premium phase 1 patch prepared.')
