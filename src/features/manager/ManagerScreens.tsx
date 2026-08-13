import { ArrowRight, Check, ChevronDown, ChevronRight, ClipboardCheck, FileAudio, FileImage, FileText, Loader2, Music2, Plus, Route, X } from "lucide-react";
import { ProductButton, WorkspaceShell } from "../../design-system/components";
import { AppThinkingOrb } from "../../design-system/AppThinkingOrb";
import type {
  CleanProductionView,
  ConversationViewModel,
  ManagerConversationContextAnswer,
  ManagerConversationAttachmentViewModel,
  ManagerMissionContextQuestion,
  MissionGenesisResultViewModel,
  MusicRepository,
  MissionTaskViewModel,
  ReleaseDateChangeRequestViewModel,
  ReleaseOpportunityArtifactViewModel,
  ReleaseOpportunityTargetViewModel,
  ReleaseSuccessArtifactViewModel,
} from "../../types/cleanProduction";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { OrbState } from "thinking-orbs";
import { SongContextAttachment } from "../music/SongRoomAttachments";
import { OpportunityArtifact } from "./OpportunityArtifact";
import { ReleaseSuccessArtifact } from "./ReleaseSuccessArtifact";
import { GuidedContextQuestion, ManagerComposer } from "./ManagerComposer";
import { buildManagerTurns, type ManagerWorkGroup } from "./managerPresentation";

// ---------------------------------------------------------------------------
// ChatGPT-style typewriter hook
function useTypewriter(target: string | undefined | null, streaming: boolean): string {
  const safeTarget = typeof target === "string" ? target : "";
  const [displayed, setDisplayed] = useState(safeTarget);
  const frameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const displayedRef = useRef<string>(safeTarget);
  const hasStreamedRef = useRef(false);

  if (streaming) {
    hasStreamedRef.current = true;
  }

  useEffect(() => {
    if (!hasStreamedRef.current) {
      // Historical or non-streamed message - snap immediately
      displayedRef.current = safeTarget;
      setDisplayed(safeTarget);
      return;
    }

    const CHAR_INTERVAL_MS = 14; // ~71 chars/sec — smooth ChatGPT-style flow
    const MAX_CHARS_PER_FRAME = 3;

    const tick = (now: number) => {
      const elapsed = now - lastTickRef.current;
      if (elapsed >= CHAR_INTERVAL_MS) {
        const currentLen = displayedRef.current.length;
        if (currentLen < safeTarget.length) {
          const charsToAdd = Math.min(
            MAX_CHARS_PER_FRAME,
            Math.max(1, Math.floor(elapsed / CHAR_INTERVAL_MS)),
          );
          const next = safeTarget.slice(0, currentLen + charsToAdd);
          displayedRef.current = next;
          setDisplayed(next);
          lastTickRef.current = now;
        } else {
          // Fully caught up to target, terminate animation frame loop
          if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
          }
          return;
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
  }, [safeTarget]);

  return (displayed ?? "").length <= safeTarget.length ? (displayed ?? "") : safeTarget;
}

const CHAT_SCROLL_NEAR_BOTTOM_PX = 160;

function isNearConversationTail() {
  if (typeof window === "undefined" || typeof document === "undefined") return true;
  return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - CHAT_SCROLL_NEAR_BOTTOM_PX;
}

function useConversationScroll({
  conversationId,
  messageCount,
  streamedTextLength,
  stepCount,
  hasStreamingMessage,
}: {
  conversationId: string;
  messageCount: number;
  streamedTextLength: number;
  stepCount: number;
  hasStreamingMessage: boolean;
}) {
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingBehaviorRef = useRef<ScrollBehavior>("auto");
  const followTailRef = useRef(true);
  const previousScrollYRef = useRef(typeof window === "undefined" ? 0 : window.scrollY);
  const ignoreInitialScrollRef = useRef(true);
  const previousConversationIdRef = useRef(conversationId);
  const previousMessageCountRef = useRef(messageCount);
  const previousStreamingRef = useRef(hasStreamingMessage);
  const mountedRef = useRef(false);

  const scrollToTail = useCallback((behavior: ScrollBehavior) => {
    if (typeof scrollAnchorRef.current?.scrollIntoView !== "function") return;
    const reducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollAnchorRef.current.scrollIntoView({ block: "end", behavior: reducedMotion ? "auto" : behavior });
  }, []);

  const scheduleTailScroll = useCallback((behavior: ScrollBehavior = "auto") => {
    if (!followTailRef.current) return;
    if (behavior === "smooth") pendingBehaviorRef.current = "smooth";
    if (frameRef.current !== null) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const nextBehavior = pendingBehaviorRef.current;
      pendingBehaviorRef.current = "auto";
      if (followTailRef.current) scrollToTail(nextBehavior);
    });
  }, [scrollToTail]);

  const resumeFollowing = useCallback(() => {
    followTailRef.current = true;
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const movingUp = currentScrollY < previousScrollYRef.current - 2;
      if (ignoreInitialScrollRef.current) {
        previousScrollYRef.current = currentScrollY;
        return;
      }
      if (movingUp) {
        followTailRef.current = false;
      } else if (isNearConversationTail()) {
        followTailRef.current = true;
      }
      previousScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    const initialFrame = requestAnimationFrame(() => {
      ignoreInitialScrollRef.current = false;
    });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(initialFrame);
    };
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !messageListRef.current) return;
    const observer = new ResizeObserver(() => scheduleTailScroll("auto"));
    observer.observe(messageListRef.current);
    return () => observer.disconnect();
  }, [scheduleTailScroll]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  useLayoutEffect(() => {
    const isNewConversation = !mountedRef.current || previousConversationIdRef.current !== conversationId;
    const isNewMessage = messageCount > previousMessageCountRef.current;
    const startedStreaming = hasStreamingMessage && !previousStreamingRef.current;
    mountedRef.current = true;
    previousConversationIdRef.current = conversationId;
    previousMessageCountRef.current = messageCount;
    previousStreamingRef.current = hasStreamingMessage;

    if (isNewConversation) {
      followTailRef.current = true;
      scrollToTail("auto");
      return;
    }
    if (!followTailRef.current) return;

    if (startedStreaming) {
      scheduleTailScroll("smooth");
    } else if (isNewMessage) {
      scrollToTail("auto");
    } else if (hasStreamingMessage || streamedTextLength > 0 || stepCount > 0) {
      scheduleTailScroll("auto");
    }
  }, [conversationId, hasStreamingMessage, messageCount, scheduleTailScroll, scrollToTail, stepCount, streamedTextLength]);

  return { messageListRef, scrollAnchorRef, resumeFollowing };
}

// ---------------------------------------------------------------------------
// Conversation timestamp formatting
// Backend values are ISO timestamps; fixtures/tests already pass
// human-readable strings ("Just now", "14h ago") — parse fails gracefully.
// ---------------------------------------------------------------------------
function formatConversationTimestamp(value: string | undefined | null): string {
  if (!value) return "";
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
    <WorkspaceShell eyebrow="Manager" title="Manager's Office" onBack={onBack} variant="conversation" backLabel="Back to Desk HQ">
      <div data-testid="manager-office-content" className="mx-auto w-full max-w-[48rem] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-0">
        <MissionGenesisManagerPanel
          result={missionGenesisResult}
          answers={missionGenesisAnswers}
          pending={missionGenesisPending}
          error={missionGenesisError}
          onAnswerChange={onMissionGenesisAnswerChange}
          onSubmit={onSubmitMissionGenesisAnswers}
          onOpenCreatedMission={onOpenCreatedMission}
        />
        <section>
              <div>
                <h2 className="text-[14px] font-semibold text-foreground">What do you want to work on?</h2>
                <div className="relative mt-3 overflow-hidden rounded-[1.5rem] border border-foreground/12 bg-background shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                  <textarea
                    value={askText}
                    onChange={(event) => setAskText(event.target.value)}
                    placeholder="Ask the Manager for a directive or review..."
                    aria-label="Ask the Manager"
                    className="min-h-[118px] w-full resize-none bg-transparent p-4 pr-16 font-ui text-[15px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:bg-background sm:p-5"
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
                    className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/85 disabled:opacity-25 sm:bottom-4 sm:right-4"
                  >
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                {askManagerError ? <p role="alert" className="mt-3 text-[12px] font-semibold text-red-700">{askManagerError}</p> : null}
                {askManagerPending ? <p className="mt-3 text-[12px] text-muted-foreground">Manager is reading your workspace.</p> : null}
              </div>
        </section>

        {conversations.length > 0 ? <section className="mt-10">
              <h2 className="mb-2 px-2 text-[13px] font-semibold text-foreground">Conversations</h2>
              <div className="flex flex-col">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    aria-label={conversation.topic}
                    className="group flex min-h-12 items-center gap-4 rounded-xl px-2 py-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/35"
                    onClick={() => onConversation(conversation)}
                  >
                    <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">{conversation.topic}</p>
                    {conversation.lastUpdate ? <span className="shrink-0 text-[12px] text-muted-foreground/65">{formatConversationTimestamp(conversation.lastUpdate)}</span> : null}
                  </button>
                ))}
              </div>
        </section> : null}
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
  const candidateMissionIds = useMemo(() => (
    result?.candidateMissionIds?.length
      ? result.candidateMissionIds
      : result?.candidateMissionId
        ? [result.candidateMissionId]
        : []
  ), [result?.candidateMissionId, result?.candidateMissionIds?.join("|")]);
  const candidateMissionKey = candidateMissionIds.join("|");
  const [selectedCandidateMissionId, setSelectedCandidateMissionId] = useState<string | undefined>(candidateMissionIds[0]);

  useEffect(() => {
    setSelectedCandidateMissionId((current) => (
      current && candidateMissionIds.includes(current)
        ? current
        : candidateMissionIds[0]
    ));
  }, [candidateMissionKey, candidateMissionIds]);

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
type ComposerAttachment = {
  id: string;
  file: File;
  fileName: string;
  assetType: string;
  status: "uploading" | "uploaded" | "failed";
  percent: number;
  attachment?: ManagerConversationAttachmentViewModel;
  error?: string;
};

const managerAttachmentCategories = [
  { label: "Audio", icon: FileAudio, accept: "audio/*", types: [["Final master", "final_master"], ["Rough mix", "rough_mix"], ["Demo", "demo"], ["Stems", "stems"]] },
  { label: "Artwork & images", icon: FileImage, accept: "image/*", types: [["Cover artwork", "cover_art"], ["Press photo", "press_photo"], ["Alternate artwork", "alternate_artwork"]] },
  { label: "Document", icon: FileText, accept: "application/pdf,.doc,.docx,.txt", types: [["Split sheet", "split_sheet"], ["Rights document", "rights_document"], ["Lyrics", "lyrics"], ["Other document", "other"]] },
] as const;

export function ConversationWorkspace({
  conversation,
  onBack,
  onOpenCreatedWork,
  onOpenMusicSubject,
  musicRepository,
  onSendMessage,
  onSendContextAnswers,
  onRetryLastMessage,
  onOpenDecisionPackage,
  onApproveReleaseDateChange,
  onKeepReleaseDate,
  onReviewReleaseSuccess,
  onRetryReleaseSuccess,
  onPrepareOpportunityPitch,
  onRecordOpportunityOutcome,
  onRetryOpportunityResearch,
  taskContext,
  onBackToTask,
  sendPending,
  sendError,
}: {
  conversation: ConversationViewModel;
  onBack: () => void;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
  onOpenMusicSubject?: (subject: NonNullable<ConversationViewModel["musicSubject"]>) => void;
  musicRepository?: MusicRepository;
  onOpenDecisionPackage?: () => void;
  onApproveReleaseDateChange?: (request: ReleaseDateChangeRequestViewModel) => Promise<void>;
  onKeepReleaseDate?: (artifact: ReleaseSuccessArtifactViewModel) => void;
  onReviewReleaseSuccess?: (artifact: ReleaseSuccessArtifactViewModel) => void;
  onRetryReleaseSuccess?: (artifact: ReleaseSuccessArtifactViewModel) => Promise<void>;
  onPrepareOpportunityPitch?: (artifact: ReleaseOpportunityArtifactViewModel, target: ReleaseOpportunityTargetViewModel) => void | Promise<void>;
  onRecordOpportunityOutcome?: (
    artifact: ReleaseOpportunityArtifactViewModel,
    target: ReleaseOpportunityTargetViewModel,
    input: { status: ReleaseOpportunityTargetViewModel["status"]; manualOutcome: string },
  ) => void | Promise<void>;
  onRetryOpportunityResearch?: (artifact: ReleaseOpportunityArtifactViewModel) => void | Promise<void>;
  taskContext?: MissionTaskViewModel;
  onBackToTask?: () => void;
  onSendMessage: (body: string, conversationId: string, attachmentIds?: string[]) => void;
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
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachmentCategory, setAttachmentCategory] = useState<(typeof managerAttachmentCategories)[number] | null>(null);
  const [selectedAssetType, setSelectedAssetType] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const managerTurns = useMemo(() => buildManagerTurns(conversation), [conversation]);
  const releaseSuccessArtifact = conversation.releaseSuccessArtifacts?.[0];
  const opportunityArtifacts = conversation.releaseOpportunityArtifacts ?? [];
  const lastManagerMessageId = [...conversation.messages].reverse().find((message) => message.speaker === "manager")?.id;
  const resolvedContextRequestIds = new Set(conversation.messages.flatMap((message) =>
    message.speaker === "artist" && message.contextRequestId && message.contextAnswers?.length
      ? [message.contextRequestId]
      : [],
  ));
  const [guidedContextRequestId, setGuidedContextRequestId] = useState<string | null>(null);
  const [guidedContextStep, setGuidedContextStep] = useState(0);
  const [guidedContextAnswers, setGuidedContextAnswers] = useState<Record<string, string>>({});
  const [submittedContextRequestIds, setSubmittedContextRequestIds] = useState<string[]>([]);
  const [editingContextRequestId, setEditingContextRequestId] = useState<string | null>(null);
  const activeContextMessage = [...conversation.messages]
    .reverse()
    .find((message) => {
      const requestId = message.contextRequestId;
      return Boolean(
        message.speaker === "manager"
          && requestId
          && message.contextQuestions?.length
          && (
            editingContextRequestId === requestId
              || (!resolvedContextRequestIds.has(requestId) && !submittedContextRequestIds.includes(requestId))
          ),
      );
    });
  const activeContextRequestId = activeContextMessage?.contextRequestId ?? null;
  const activeContextQuestions = activeContextMessage?.contextQuestions ?? [];
  const activeContextQuestion = activeContextQuestions[Math.min(guidedContextStep, Math.max(activeContextQuestions.length - 1, 0))];
  const activeRun = conversation.activeRun;
  const isManagerThinking = sendPending || activeRun?.status === "running";
  const hasStreamingMessage = conversation.messages.some((message) => message.status === "streaming");
  const hasFailedManagerMessage = conversation.messages.some((message) => message.speaker === "manager" && message.status === "failed");

  useEffect(() => {
    if (activeContextRequestId === guidedContextRequestId) return;
    setGuidedContextRequestId(activeContextRequestId);
    setGuidedContextStep(0);
    setGuidedContextAnswers({});
  }, [activeContextRequestId, guidedContextRequestId]);
  const { messageListRef, scrollAnchorRef, resumeFollowing } = useConversationScroll({
    conversationId: conversation.id,
    messageCount: conversation.messages.length,
    streamedTextLength: activeRun?.streamedText?.length ?? 0,
    stepCount: activeRun?.steps.length ?? 0,
    hasStreamingMessage,
  });

  useEffect(() => {
    if (!activeContextQuestion) return;
    const frame = window.requestAnimationFrame(() => {
      const anchor = scrollAnchorRef.current;
      if (anchor && typeof anchor.scrollIntoView === "function") anchor.scrollIntoView({ block: "end", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeContextRequestId, guidedContextStep, activeContextQuestion, scrollAnchorRef]);

  const canAttachToSong = Boolean(musicRepository && conversation.musicSubject?.type === "music_item");
  const uploadingAttachments = composerAttachments.some((attachment) => attachment.status === "uploading");
  const uploadedAttachmentIds = composerAttachments.flatMap((attachment) => attachment.attachment?.id ? [attachment.attachment.id] : []);

  const uploadComposerAttachment = async (id: string, file: File, assetType: string) => {
    const musicItemId = conversation.musicSubject?.type === "music_item" ? conversation.musicSubject.id : null;
    if (!musicRepository || !musicItemId) return;
    setComposerAttachments((current) => current.map((item) => item.id === id ? { ...item, status: "uploading", percent: 0, error: undefined } : item));
      try {
        const uploaded = await musicRepository.uploadAsset(musicItemId, {
          assetType,
          title: file.name,
          file,
          onProgress: (progress) => setComposerAttachments((current) => current.map((attachment) => attachment.id === id
            ? { ...attachment, percent: progress.percent }
            : attachment)),
        });
        setComposerAttachments((current) => current.map((attachment) => attachment.id === id
          ? {
              ...attachment,
              status: "uploaded",
              percent: 100,
              attachment: {
                id: uploaded.id,
                musicItemId: uploaded.musicItemId,
                title: uploaded.label,
                assetType: uploaded.assetType,
                status: uploaded.status,
              },
            }
          : attachment));
      } catch (error) {
        setComposerAttachments((current) => current.map((attachment) => attachment.id === id
          ? { ...attachment, status: "failed", error: error instanceof Error ? error.message : "Upload failed." }
          : attachment));
      }
  };

  const handleAttachmentFiles = async (files: FileList | null) => {
    if (!selectedAssetType || !files?.length) return;
    const pending = Array.from(files).map((file, index) => ({
      id: `composer-attachment-${Date.now()}-${index}`,
      file,
      fileName: file.name,
      assetType: selectedAssetType,
      status: "uploading" as const,
      percent: 0,
    }));
    setComposerAttachments((current) => [...current, ...pending]);
    setAttachmentMenuOpen(false);
    setAttachmentCategory(null);
    setSelectedAssetType(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    await Promise.all(pending.map((item) => uploadComposerAttachment(item.id, item.file, item.assetType)));
  };

  const handleSend = () => {
    const body = draft.trim();
    const messageBody = body || (uploadedAttachmentIds.length ? "Review the attached files and tell me what matters for this song." : "");
    if (!messageBody || sendPending || uploadingAttachments) return;
    resumeFollowing();
    onSendMessage(messageBody, conversation.id, uploadedAttachmentIds);
    setDraft("");
    setComposerAttachments([]);
  };

  const handleGuidedContextAnswer = (answerOverride?: string) => {
    if (!activeContextMessage || !activeContextRequestId || !activeContextQuestion || sendPending) return;
    const currentAnswer = (answerOverride ?? guidedContextAnswers[activeContextQuestion.key] ?? "").trim();
    if (!currentAnswer) return;

    const nextAnswers = { ...guidedContextAnswers, [activeContextQuestion.key]: currentAnswer };
    setGuidedContextAnswers(nextAnswers);

    if (guidedContextStep < activeContextQuestions.length - 1) {
      setGuidedContextStep((step) => step + 1);
      return;
    }

    const answers = activeContextQuestions.map((question) => ({
      questionKey: question.key,
      answer: nextAnswers[question.key]?.trim() ?? "",
    }));
    if (answers.some((answer) => !answer.answer)) return;
    setSubmittedContextRequestIds((current) => current.includes(activeContextRequestId) ? current : [...current, activeContextRequestId]);
    setEditingContextRequestId(null);
    resumeFollowing();
    onSendContextAnswers(
      "Context answers for Manager mission decision.",
      conversation.id,
      activeContextRequestId,
      answers,
    );
  };

  const handleEditContext = (requestId: string) => {
    const previousAnswers = conversation.messages.find((message) =>
      message.speaker === "artist" && message.contextRequestId === requestId,
    )?.contextAnswers ?? [];
    setGuidedContextRequestId(requestId);
    setGuidedContextStep(0);
    setGuidedContextAnswers(Object.fromEntries(previousAnswers.map((answer) => [answer.questionKey, answer.answer])));
    setEditingContextRequestId(requestId);
  };

  return (
    <WorkspaceShell eyebrow="Manager conversation" title={conversation.topic} onBack={onBack} punctuateTitle={false} variant="conversation" backLabel="Back to Manager's Office">
      {/*
        ChatGPT layout pattern:
        — A centered, width-constrained reading column gives the breathing room.
        — Manager text fills the column naturally (no bubble border).
        — User message is a right-aligned soft pill within the same column.
        — Side whitespace is the product of the column constraint, not padding hacks.
      */}
      <div data-testid="manager-conversation-column" className="mx-auto w-full max-w-[48rem] px-1 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-3 sm:px-2 sm:pt-5 lg:px-0">
        {conversation.musicSubject?.type === "music_item" ? (
          <div data-testid="conversation-song-context" className="mb-5">
            <SongContextAttachment
              title={conversation.musicSubject.title}
              stage={conversation.musicSubject.lifecycleStage}
              onOpenSong={() => onOpenMusicSubject?.(conversation.musicSubject!)}
            />
          </div>
        ) : conversation.musicSubject ? (
          <section data-testid="conversation-music-subject" className="mb-5 flex items-center justify-between gap-4 rounded-[16px] border border-foreground/10 bg-background/92 p-4 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-foreground/[0.055] text-muted-foreground">
                <Music2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/75">
                  About this project
                </p>
                <p className="mt-1 truncate text-[13px] font-semibold text-foreground">{conversation.musicSubject.title}</p>
                {conversation.musicSubject.lifecycleStage ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{conversation.musicSubject.lifecycleStage}</p>
                ) : null}
              </div>
            </div>
            {onOpenMusicSubject ? (
              <button
                type="button"
                aria-label="Open project room"
                onClick={() => onOpenMusicSubject(conversation.musicSubject!)}
                className="shrink-0 rounded-lg border border-foreground/10 bg-background px-3 py-2 text-[11px] font-bold text-foreground transition-colors hover:bg-foreground/[0.04]"
              >
                Open
              </button>
            ) : null}
          </section>
        ) : null}
        {taskContext ? (
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-foreground/8 pb-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground">Working on task</p>
              <p className="mt-1 text-[14px] font-semibold text-foreground">{taskContext.title}</p>
              {taskContext.completionExpectation ? (
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-muted-foreground">{taskContext.completionExpectation}</p>
              ) : null}
            </div>
            {onBackToTask ? (
              <button type="button" onClick={onBackToTask} className="shrink-0 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline">
                Back to task
              </button>
            ) : null}
          </div>
        ) : null}
        <div ref={messageListRef} className="flex flex-col gap-8">
           {managerTurns.map((turn) => (
             <MessageRow
               key={turn.message.id}
               message={turn.message}
               work={turn.work}
               activeRun={activeRun}
               prompt={conversation.prompt}
               onRetryLastMessage={onRetryLastMessage ? () => {
                 resumeFollowing();
                 onRetryLastMessage();
              } : undefined}
              sendPending={sendPending}
               onOpenCreatedWork={onOpenCreatedWork}
               suppressMissionArtifacts={Boolean(taskContext)}
                contextResolved={Boolean(turn.message.contextRequestId && resolvedContextRequestIds.has(turn.message.contextRequestId) && editingContextRequestId !== turn.message.contextRequestId)}
                onChangeContext={turn.message.contextRequestId ? () => handleEditContext(turn.message.contextRequestId!) : undefined}
                releaseSuccessArtifact={turn.message.id === lastManagerMessageId ? releaseSuccessArtifact : undefined}
                opportunityArtifacts={turn.message.id === lastManagerMessageId ? opportunityArtifacts : []}
                decisionPackage={turn.message.id === lastManagerMessageId ? conversation.decisionPackage : undefined}
                onOpenDecisionPackage={onOpenDecisionPackage}
                onApproveReleaseDateChange={onApproveReleaseDateChange}
                onKeepReleaseDate={onKeepReleaseDate}
                onReviewReleaseSuccess={onReviewReleaseSuccess}
                onRetryReleaseSuccess={onRetryReleaseSuccess}
                onPrepareOpportunityPitch={onPrepareOpportunityPitch}
                onRecordOpportunityOutcome={onRecordOpportunityOutcome}
                onRetryOpportunityResearch={onRetryOpportunityResearch}
                conversationId={conversation.id}
              />
           ))}

          {/* Thinking indicator — only shown when no streaming message exists yet */}
           {isManagerThinking && !hasStreamingMessage ? (
             <ManagerActivity activeRun={activeRun} prompt={conversation.prompt} />
          ) : null}

          <div data-testid="manager-chat-tail" ref={scrollAnchorRef} className="h-32 shrink-0" aria-hidden="true" />
        </div>

      </div>

      <ManagerComposer
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        sendPending={sendPending}
        canSend={!activeContextQuestion && !uploadingAttachments && (Boolean(draft.trim()) || uploadedAttachmentIds.length > 0)}
        sendError={sendError && !hasFailedManagerMessage ? sendError : null}
        attachments={composerAttachments.length ? (
          <ManagerAttachmentTray
            attachments={composerAttachments}
            onRemove={(id) => setComposerAttachments((current) => current.filter((attachment) => attachment.id !== id))}
            onRetry={(id) => {
              const item = composerAttachments.find((attachment) => attachment.id === id);
              if (item) void uploadComposerAttachment(item.id, item.file, item.assetType);
            }}
          />
        ) : undefined}
        leadingAction={canAttachToSong && !activeContextQuestion ? (
          <div className="relative">
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              accept={attachmentCategory?.accept}
              aria-hidden="true"
              tabIndex={-1}
              className="sr-only"
              onChange={(event) => void handleAttachmentFiles(event.target.files)}
            />
            <button
              type="button"
              aria-label={`Add files to ${conversation.musicSubject.title}`}
              aria-expanded={attachmentMenuOpen}
              onClick={() => {
                setAttachmentMenuOpen((open) => !open);
                setAttachmentCategory(null);
              }}
              disabled={sendPending || uploadingAttachments}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
            {attachmentMenuOpen ? (
              <div className="absolute bottom-12 left-0 z-50 w-64 overflow-hidden rounded-2xl border border-foreground/10 bg-background p-2 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  {attachmentCategory ? <button type="button" onClick={() => setAttachmentCategory(null)} className="text-[12px] text-muted-foreground hover:text-foreground">Back</button> : null}
                  <p className="truncate text-[13px] font-semibold text-foreground">Add to {conversation.musicSubject.title}</p>
                </div>
                <div className="mt-1 grid gap-0.5">
                  {(attachmentCategory ? attachmentCategory.types : managerAttachmentCategories).map((item) => {
                    const isCategory = "label" in item;
                    const label = isCategory ? item.label : item[0];
                    const Icon = isCategory ? item.icon : FileText;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          if (isCategory) {
                            setAttachmentCategory(item);
                            return;
                          }
                          setSelectedAssetType(item[1]);
                          window.setTimeout(() => attachmentInputRef.current?.click(), 0);
                        }}
                        className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-foreground/[0.05]"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : undefined}
        guidedQuestion={activeContextQuestion ? (
          <GuidedContextQuestion
            question={activeContextQuestion}
            position={guidedContextStep}
            total={activeContextQuestions.length}
            value={guidedContextAnswers[activeContextQuestion.key] ?? ""}
            onChange={(value) => setGuidedContextAnswers((current) => ({ ...current, [activeContextQuestion.key]: value }))}
            onUseRecommendation={() => setGuidedContextAnswers((current) => ({
              ...current,
              [activeContextQuestion.key]: activeContextQuestion.recommendedAnswer ?? "",
            }))}
            onBack={() => setGuidedContextStep((step) => Math.max(0, step - 1))}
            onSubmit={handleGuidedContextAnswer}
            sendPending={sendPending}
          />
        ) : undefined}
      />
    </WorkspaceShell>
  );
}

// ---------------------------------------------------------------------------
// Individual message row
// ---------------------------------------------------------------------------
function MessageRow({
  message,
  work,
  activeRun,
  onRetryLastMessage,
  sendPending,
  onOpenCreatedWork,
  suppressMissionArtifacts,
  contextResolved = false,
  onChangeContext,
  prompt,
  releaseSuccessArtifact,
  opportunityArtifacts,
  decisionPackage,
  onOpenDecisionPackage,
  onApproveReleaseDateChange,
  onKeepReleaseDate,
  onReviewReleaseSuccess,
  onRetryReleaseSuccess,
  onPrepareOpportunityPitch,
  onRecordOpportunityOutcome,
  onRetryOpportunityResearch,
  conversationId,
}: {
  message: ConversationViewModel["messages"][number];
  work: ManagerWorkGroup[];
  activeRun: ConversationViewModel["activeRun"];
  onRetryLastMessage?: () => void;
  sendPending: boolean;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
  suppressMissionArtifacts?: boolean;
  contextResolved?: boolean;
  onChangeContext?: () => void;
  prompt?: string;
  releaseSuccessArtifact?: ReleaseSuccessArtifactViewModel;
  opportunityArtifacts: ReleaseOpportunityArtifactViewModel[];
  decisionPackage?: ConversationViewModel["decisionPackage"];
  onOpenDecisionPackage?: () => void;
  onApproveReleaseDateChange?: (request: ReleaseDateChangeRequestViewModel) => Promise<void>;
  onKeepReleaseDate?: (artifact: ReleaseSuccessArtifactViewModel) => void;
  onReviewReleaseSuccess?: (artifact: ReleaseSuccessArtifactViewModel) => void;
  onRetryReleaseSuccess?: (artifact: ReleaseSuccessArtifactViewModel) => Promise<void>;
  onPrepareOpportunityPitch?: (artifact: ReleaseOpportunityArtifactViewModel, target: ReleaseOpportunityTargetViewModel) => void | Promise<void>;
  onRecordOpportunityOutcome?: (artifact: ReleaseOpportunityArtifactViewModel, target: ReleaseOpportunityTargetViewModel, input: { status: ReleaseOpportunityTargetViewModel["status"]; manualOutcome: string }) => void | Promise<void>;
  onRetryOpportunityResearch?: (artifact: ReleaseOpportunityArtifactViewModel) => void | Promise<void>;
  conversationId: string;
}) {
  const isArtist = message.speaker === "artist";
  const isStreaming = message.status === "streaming";
  const hidesDocumentBody = !isArtist && work.some((group) => {
    if (group.kind !== "draft" || !group.item.content) return false;
    const body = normalizeManagerBody(message.body);
    const content = normalizeManagerBody(group.item.content);
    return content.length >= 40 && (body === content || body.includes(content));
  });
  const visibleWork = suppressMissionArtifacts
    ? work.filter((group) => group.kind !== "mission" && group.kind !== "workspace")
    : work;

  return (
    <article data-testid={`manager-message-${isArtist ? "artist" : "manager"}`} className={`flex flex-col ${isArtist ? "items-end" : "items-start"}`}>
      {isArtist ? (
        // User message — subtle pill, no dark fill
        <div className="max-w-[85%] rounded-[1.25rem] bg-foreground/[0.06] px-4 py-2.5 text-foreground sm:max-w-[75%]">
          <p className="text-[15px] leading-[1.65]">{message.body}</p>
          {message.attachments?.length ? <ConversationAttachmentList attachments={message.attachments} /> : null}
        </div>
      ) : (
        // Manager message — full width, no card border
        <div className="w-full">
          {hidesDocumentBody ? (
            <p className="text-[15px] leading-[1.65] text-foreground">The draft is saved to the task and ready to review.</p>
          ) : (
            <RichMessageBody body={message.body} streaming={isStreaming} failed={message.status === "failed"} />
          )}

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

           {message.contextQuestions?.length && contextResolved ? (
             <ContextAnswerSummary answers={message.contextAnswers ?? []} onChange={onChangeContext} />
           ) : null}

           {!isStreaming && visibleWork.length ? (
             <ManagerResultGroup groups={visibleWork} onOpenCreatedWork={onOpenCreatedWork} />
           ) : null}
           {!isStreaming && releaseSuccessArtifact ? (
             <ReleaseSuccessArtifact artifact={releaseSuccessArtifact} onApprove={onApproveReleaseDateChange ?? (async () => undefined)} onKeepDate={onKeepReleaseDate ?? (() => undefined)} onReviewAll={onReviewReleaseSuccess ?? (() => undefined)} onOpenSong={(id) => void onOpenCreatedWork("music_item", id)} onOpenMission={(id) => void onOpenCreatedWork("mission", id)} onRetry={onRetryReleaseSuccess ?? (async () => undefined)} />
           ) : null}
           {!isStreaming ? opportunityArtifacts.map((artifact) => (
             <OpportunityArtifact key={artifact.id} artifact={artifact} onPreparePitch={(target) => onPrepareOpportunityPitch ? onPrepareOpportunityPitch(artifact, target) : undefined} onRecordOutcome={(target, input) => onRecordOpportunityOutcome ? onRecordOpportunityOutcome(artifact, target, input) : undefined} onOpenFiles={(id) => onOpenCreatedWork("music_item", id, "files")} onOpenMission={(id) => onOpenCreatedWork("mission", id)} onRetry={(failed) => onRetryOpportunityResearch ? onRetryOpportunityResearch(failed) : undefined} />
           )) : null}
           {!isStreaming && decisionPackage ? (
             <section className="mt-5 border-l-2 border-foreground/12 pl-4">
               <p className="text-[14px] font-semibold text-foreground">{decisionPackage.title}</p>
               <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{decisionPackage.summary}</p>
               {onOpenDecisionPackage ? <div className="mt-2"><ResultAction onClick={onOpenDecisionPackage}>Open package</ResultAction></div> : null}
             </section>
           ) : null}
        </div>
      )}
    </article>
  );
}

function normalizeManagerBody(value: string | undefined | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function ManagerResultGroup({
  groups,
  onOpenCreatedWork,
}: {
  groups: ManagerWorkGroup[];
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
}) {
  return (
    <div data-testid="manager-result-group" className="mt-5 grid gap-2.5">
      {groups.map((group, index) => {
        if (group.kind === "workspace") {
          return <WorkspaceResultCard key={`workspace-${index}`} group={group} onOpenCreatedWork={onOpenCreatedWork} />;
        }
        if (group.kind === "draft") {
          return <DocumentResultCard key={`draft-${group.item.id ?? group.item.title}-${index}`} item={group.item} onOpenCreatedWork={onOpenCreatedWork} />;
        }
        if (group.kind === "mission") {
          return <CompactMissionResult key={`mission-${group.mission.id ?? group.mission.title}-${index}`} group={group} onOpenCreatedWork={onOpenCreatedWork} />;
        }
        if (group.kind === "tasks") {
          return <CompactTasksResult key={`tasks-${index}`} group={group} onOpenCreatedWork={onOpenCreatedWork} />;
        }
        return <CompactMusicResult key={`music-${group.item.id ?? group.item.title}-${index}`} item={group.item} onOpenCreatedWork={onOpenCreatedWork} />;
      })}
    </div>
  );
}

function ResultAction({ children, onClick, pendingLabel = "Opening…" }: { children: ReactNode; onClick?: () => void | Promise<void>; pendingLabel?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!onClick || pending) return;
        setPending(true);
        try { await onClick(); } finally { setPending(false); }
      }}
      disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-foreground/72 transition-colors hover:bg-foreground/[0.05] hover:text-foreground disabled:opacity-60"
    >
      {pending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{pendingLabel}</> : children}
    </button>
  );
}

function WorkspaceResultCard({
  group,
  onOpenCreatedWork,
}: {
  group: Extract<ManagerWorkGroup, { kind: "workspace" }>;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
}) {
  const title = group.musicItem?.title ?? group.mission?.title ?? "Release workspace";
  return (
    <article data-testid="manager-workspace-result" className="border-l-2 border-foreground/12 py-1 pl-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground"><Check className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />Release workspace created</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{title} · Mission and first task ready</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {group.musicItem?.id ? (
          <ResultAction pendingLabel="Opening Files…" onClick={() => onOpenCreatedWork("music_item", group.musicItem?.id, "files")}>Add release files</ResultAction>
        ) : null}
        {group.mission?.id ? (
          <ResultAction onClick={() => onOpenCreatedWork("mission", group.mission?.id)}>
            View mission
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </ResultAction>
        ) : null}
      </div>
    </article>
  );
}

function DocumentResultCard({
  item,
  onOpenCreatedWork,
}: {
  item: WorkItem;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
}) {
  return (
    <article data-testid="manager-document-result" className="flex items-center gap-3 border-l-2 border-foreground/12 py-1 pl-4">
      <span className="hidden">
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted-foreground">Draft saved</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{item.title}</p>
      </div>
      {item.id ? <ResultAction onClick={() => onOpenCreatedWork("task", item.id)}>Open draft</ResultAction> : null}
    </article>
  );
}

function CompactMissionResult({
  group,
  onOpenCreatedWork,
}: {
  group: Extract<ManagerWorkGroup, { kind: "mission" }>;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
}) {
  return (
    <article className="flex items-center gap-3 border-l-2 border-foreground/12 py-1 pl-4">
      <span className="hidden">
        <Route className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted-foreground">Mission {group.mission.status === "updated" ? "updated" : "ready"}</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{group.mission.title}</p>
        {group.tasks.length ? <p className="mt-0.5 text-[11px] text-muted-foreground">{group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}</p> : null}
      </div>
      {group.mission.id ? <ResultAction onClick={() => onOpenCreatedWork("mission", group.mission.id)}>View mission</ResultAction> : null}
    </article>
  );
}

function CompactTasksResult({
  group,
  onOpenCreatedWork,
}: {
  group: Extract<ManagerWorkGroup, { kind: "tasks" }>;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
}) {
  const firstTask = group.tasks[0];
  return (
    <article className="flex items-center gap-3 border-l-2 border-foreground/12 py-1 pl-4">
      <span className="hidden">
        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted-foreground">{group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"} ready</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{firstTask?.title}</p>
      </div>
      {firstTask?.id ? <ResultAction onClick={() => onOpenCreatedWork("task", firstTask.id)}>View task</ResultAction> : null}
    </article>
  );
}

function CompactMusicResult({
  item,
  onOpenCreatedWork,
}: {
  item: WorkItem;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
}) {
  return (
    <article className="flex items-center gap-3 border-l-2 border-foreground/12 py-1 pl-4">
      <span className="hidden">
        <Music2 className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted-foreground">Song ready</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{item.title}</p>
      </div>
      {item.id ? <ResultAction onClick={() => onOpenCreatedWork("music_item", item.id)}>Open song</ResultAction> : null}
    </article>
  );
}

function mapLabelToOrbState(label: string, prompt?: string): OrbState {
  const clean = label.toLowerCase();
  const query = prompt ? prompt.toLowerCase() : "";
  if (clean.includes("searching") || clean.includes("catalog") || clean.includes("signals") || clean.includes("spotify") || clean.includes("chartmetric") || query.includes("search")) {
    return "searching";
  }
  if (clean.includes("calculating") || clean.includes("planning") || clean.includes("strategy") || clean.includes("decisions")) {
    return "solving";
  }
  if (clean.includes("reviewing") || clean.includes("memory") || clean.includes("context") || clean.includes("accessing")) {
    return "listening";
  }
  if (clean.includes("formulating") || clean.includes("structuring") || clean.includes("recommendations")) {
    return "composing";
  }
  if (clean.includes("coordinating") || clean.includes("shaping") || clean.includes("updating")) {
    return "shaping";
  }
  return "working";
}

// ---------------------------------------------------------------------------
// Thinking indicator — replaces the old dual-line card
// ---------------------------------------------------------------------------
function ManagerActivity({ activeRun, prompt }: { activeRun: ConversationViewModel["activeRun"]; prompt?: string }) {
  const latestStep = activeRun?.steps.length ? activeRun.steps.at(-1) : null;
  const label = latestStep ? activityStatusLine(latestStep.label, prompt) : "Reading your workspace…";
  const orbState = mapLabelToOrbState(label, prompt);

  return (
    <div data-testid="manager-activity" role="status" aria-live="polite" className="manager-conversation-motion flex items-center gap-2.5 py-2 text-[12px] text-muted-foreground animate-in fade-in duration-300">
      <AppThinkingOrb state={orbState} size={18} />
      <span key={label} className="animate-in fade-in duration-300">{label}</span>
    </div>
  );
}

// Keep background work legible without exposing internal tool names.
function activityStatusLine(label: string | undefined | null, prompt?: string) {
  const cleanLabel = (label ?? "").trim().toLowerCase();
  const query = prompt ? prompt.toLowerCase() : "";
  const has = (...keys: string[]) => keys.some(key => query.includes(key));

  if (cleanLabel.includes("reading workspace packet")) {
    if (has("budget", "cost", "spend", "financial", "money")) return "Reviewing budget context…";
    if (has("market", "audience", "fan", "listener", "spotify", "chartmetric")) return "Analyzing audience signals…";
    if (has("record", "song", "track", "release", "drop", "single")) return "Reviewing track catalog…";
    if (has("mission", "task", "goal", "objective")) return "Reviewing active missions…";
    return "Reviewing workspace context…";
  }

  if (cleanLabel.includes("matching missions and evidence")) {
    if (has("feature", "artist", "singer", "vocalist", "collaboration", "collab")) return "Analyzing potential features…";
    if (has("budget", "cost", "spend", "financial", "money")) return "Calculating budget options…";
    if (has("market", "audience", "fan", "listener", "spotify", "chartmetric")) return "Reviewing market positioning…";
    if (has("record", "song", "track", "release", "drop", "single")) return "Formulating release strategy…";
    if (has("mission", "task", "goal", "objective")) return "Planning next steps…";
    if (has("today", "hello", "hi ", "how are you", "doing today")) return "Formulating response…";

    // Question check
    const isQuestion = /^(who|what|where|why|how|should|can|is|are|do|does|think|will|would|could|may|whom|whose|which|if)\b/i.test(query) || query.endsWith("?");
    if (isQuestion) return "Formulating recommendations…";

    return "Planning next steps…";
  }

  if (cleanLabel.includes("preparing your answer") || cleanLabel.includes("preparing manager answer")) {
    return "Structuring thoughts…";
  }

  if (cleanLabel.includes("checking evidence")) return "Reviewing signals…";
  if (cleanLabel.includes("reviewing mission state")) return "Coordinating active missions…";
  if (cleanLabel.includes("checking catalog")) return "Looking through catalog…";
  if (cleanLabel.includes("reading manager memory")) return "Accessing memory…";
  if (cleanLabel.includes("reviewing prior decisions")) return "Reviewing past decisions…";
  if (cleanLabel.includes("searching the web")) return "Searching the web…";
  if (cleanLabel.includes("using manager tool")) return "Thinking…";

  return `${label.replace(/\.+$/, "")}…`;
}

// ---------------------------------------------------------------------------
// RichMessageBody — ChatGPT-style typewriter during streaming
// ---------------------------------------------------------------------------
function RichMessageBody({ body, streaming, failed }: { body: string | undefined | null; streaming?: boolean; failed?: boolean }) {
  const displayed = useTypewriter(body ?? "", !!streaming);

  // ---- Line-by-line markdown parsing ----
  type ParsedNode =
    | { kind: "heading"; level: number; text: string }
    | { kind: "paragraph"; text: string }
    | { kind: "ordered-list"; items: string[] }
    | { kind: "unordered-list"; items: string[] };

  const rawLines = (displayed ?? "").split("\n");
  const nodes: ParsedNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const trimmed = rawLines[i].trim();

    // Skip blank lines
    if (!trimmed) { i++; continue; }

    // Heading: # through ####
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      nodes.push({ kind: "heading", level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    // Ordered list items: 1. 2. 3. …
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < rawLines.length) {
        const itemLine = rawLines[i].trim();
        if (!itemLine) { i++; break; }              // blank line ends the list
        const itemMatch = itemLine.match(/^\d+\.\s+(.+)$/);
        if (itemMatch) { items.push(itemMatch[1]); i++; }
        else break;
      }
      if (items.length) nodes.push({ kind: "ordered-list", items });
      continue;
    }

    // Unordered list items: - or *
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < rawLines.length) {
        const itemLine = rawLines[i].trim();
        if (!itemLine) { i++; break; }
        const itemMatch = itemLine.match(/^[-*]\s+(.+)$/);
        if (itemMatch) { items.push(itemMatch[1]); i++; }
        else break;
      }
      if (items.length) nodes.push({ kind: "unordered-list", items });
      continue;
    }

    // Plain text paragraph — accumulate consecutive non-special lines
    const pLines: string[] = [];
    while (i < rawLines.length) {
      const pLine = rawLines[i].trim();
      if (!pLine) { i++; break; }
      if (/^#{1,4}\s+/.test(pLine) || /^\d+\.\s+/.test(pLine) || /^[-*]\s+/.test(pLine)) break;
      pLines.push(pLine);
      i++;
    }
    if (pLines.length) nodes.push({ kind: "paragraph", text: pLines.join(" ") });
  }

  // Fallback for empty / whitespace-only content
  if (!nodes.length) {
    return (
      <p className="text-[15px] leading-[1.65] text-current">
        {streaming ? <BlinkingCursor /> : displayed}
      </p>
    );
  }

  return (
    <div className={`space-y-4 text-[15px] leading-[1.65] text-foreground ${failed ? "text-red-700" : ""}`}>
      {nodes.map((node, nodeIndex) => {
        const isLast = nodeIndex === nodes.length - 1;
        const cursor = streaming && isLast ? <BlinkingCursor /> : null;

        if (node.kind === "heading") {
          const cls =
            node.level === 1
              ? "text-[18px] font-bold text-foreground mt-3"
              : node.level === 2
                ? "text-[16px] font-semibold text-foreground mt-2"
                : node.level === 3
                  ? "text-[15px] font-semibold text-foreground mt-1.5"
                  : "text-[14px] font-semibold text-foreground/90 mt-1";
          return (
            <p key={`h-${nodeIndex}`} className={cls} role="heading" aria-level={node.level}>
              <InlineMarkdown text={node.text} />
              {cursor}
            </p>
          );
        }

        if (node.kind === "ordered-list") {
          return (
            <ol key={`ol-${nodeIndex}`} className="list-decimal space-y-2 pl-6 marker:text-foreground/50 marker:font-semibold">
              {node.items.map((item, itemIndex) => (
                <li key={`${nodeIndex}-${itemIndex}`} className="text-foreground/90 pl-1">
                  <InlineMarkdown text={item} />
                  {cursor && itemIndex === node.items.length - 1 ? cursor : null}
                </li>
              ))}
            </ol>
          );
        }

        if (node.kind === "unordered-list") {
          return (
            <ul key={`ul-${nodeIndex}`} className="list-disc space-y-1.5 pl-5">
              {node.items.map((item, itemIndex) => (
                <li key={`${nodeIndex}-${itemIndex}`} className="text-foreground/90">
                  <InlineMarkdown text={item} />
                  {cursor && itemIndex === node.items.length - 1 ? cursor : null}
                </li>
              ))}
            </ul>
          );
        }

        // paragraph
        return (
          <p key={`p-${nodeIndex}`} className="text-foreground/90">
            <InlineMarkdown text={node.text} />
            {cursor}
          </p>
        );
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        const strong = part.match(/^\*\*([^*]+)\*\*$/);
        if (strong) return <strong key={`${part}-${index}`} className="font-semibold text-foreground">{strong[1]}</strong>;
        const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
        if (link) {
          return (
            <a key={`${part}-${index}`} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:decoration-brand-accent">
              {link[1]}
            </a>
          );
        }
        return part;
      })}
    </>
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

function ContextAnswerSummary({ answers, onChange }: { answers: ManagerConversationContextAnswer[]; onChange?: () => void }) {
  const firstAnswer = answers.find((answer) => answer.answer.trim());
  const label = firstAnswer?.questionKey
    ? firstAnswer.questionKey.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase())
    : "Context";
  const remainingAnswerCount = Math.max(0, answers.filter((answer) => answer.answer.trim()).length - 1);
  return (
    <div data-testid="manager-context-answer-summary" className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-muted-foreground">
      <span className="font-semibold text-foreground/80">{label} confirmed:</span>
      {firstAnswer ? <span className="truncate">{firstAnswer.answer}</span> : null}
      {remainingAnswerCount ? <span>+{remainingAnswerCount} more</span> : null}
      <button type="button" onClick={onChange} className="font-semibold text-foreground/70 underline decoration-foreground/20 underline-offset-2 hover:text-foreground">
        Change
      </button>
    </div>
  );
}

function ManagerAttachmentTray({
  attachments,
  onRemove,
  onRetry,
}: {
  attachments: ComposerAttachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  return (
    <div data-testid="manager-attachment-tray" className="flex flex-wrap gap-2 pb-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.035] px-2.5 py-1.5 text-[11px]">
          {attachment.status === "uploading" ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
          {attachment.status === "uploaded" ? <Check className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          {attachment.status === "failed" ? <X className="h-3 w-3 shrink-0 text-red-600" aria-hidden="true" /> : null}
          <span className="min-w-0 truncate font-medium text-foreground/80">
            {attachment.status === "uploading" ? `Uploading ${attachment.fileName} ${Math.round(attachment.percent)}%` : attachment.fileName}
          </span>
          {attachment.status === "failed" ? <span className="max-w-[12rem] truncate text-red-600">{attachment.error}</span> : null}
          {attachment.status === "failed" ? <button type="button" onClick={() => onRetry(attachment.id)} className="font-semibold text-foreground hover:underline">Retry</button> : null}
          {attachment.status !== "uploading" ? (
            <button
              type="button"
              aria-label={`Remove ${attachment.fileName}`}
              onClick={() => onRemove(attachment.id)}
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ConversationAttachmentList({ attachments }: { attachments: ManagerConversationAttachmentViewModel[] }) {
  return (
    <div data-testid="conversation-message-attachments" className="mt-3 flex flex-wrap gap-1.5 border-t border-foreground/10 pt-2.5">
      {attachments.map((attachment) => (
        <span key={attachment.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-foreground/10 bg-background/60 px-2.5 py-1 text-[10px] font-medium text-foreground/75">
          <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="max-w-[12rem] truncate">{attachment.title}</span>
        </span>
      ))}
    </div>
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
            {question.recommendedAnswer ? (
              <span className="rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] p-3">
                <span className="block text-[11px] font-bold text-brand-accent">Manager recommendation</span>
                <span className="mt-1 block text-[12px] font-medium text-foreground">{question.recommendedAnswer}</span>
                {question.recommendationReason ? (
                  <span className="mt-1 block text-[11px] font-medium text-muted-foreground">{question.recommendationReason}</span>
                ) : null}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setAnswers((current) => ({ ...current, [question.key]: question.recommendedAnswer ?? "" }))}
                  className="mt-2 text-[11px] font-bold text-brand-accent hover:underline"
                >
                  Use recommendation
                </button>
              </span>
            ) : null}
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
            <button
              type="button"
              disabled={disabled}
              onClick={() => setAnswers((current) => ({ ...current, [question.key]: "I'm not sure — use your best recommendation and state the assumption." }))}
              className="w-fit text-[11px] font-bold text-muted-foreground hover:text-foreground hover:underline"
            >
              I’m not sure
            </button>
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
type CreatedWorkDestination = "files";

function WorkArtifactGroup({
  items,
  onOpenCreatedWork,
}: {
  items: WorkItem[];
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
}) {
  const draftArtifacts = items.filter((w) => w.artifactKind === "task_draft");
  const missions = items.filter((w) => w.type === "mission");
  const tasks = items.filter((w) => w.type === "task" && w.artifactKind !== "task_draft");
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
      {draftArtifacts.map((item) => (
        <TaskDraftArtifactCard key={`task-draft-${item.managerOutputId ?? item.id ?? item.title}`} item={item} onOpenCreatedWork={onOpenCreatedWork} />
      ))}
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

function TaskDraftArtifactCard({
  item,
  onOpenCreatedWork,
}: {
  item: WorkItem;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const content = item.content?.trim() || item.body;
  const preview = content
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 190);

  return (
    <article
      className="mt-6 overflow-hidden rounded-[16px] border border-foreground/14 bg-background"
      data-manager-output-id={item.managerOutputId}
    >
      <div className="flex items-center gap-3 border-b border-foreground/8 bg-foreground/[0.025] px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-foreground/10 bg-background text-foreground/70">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-ui text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Working draft</p>
          <h3 className="mt-0.5 truncate text-[14px] font-semibold text-foreground">{item.title}</h3>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/[0.09] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-success">
          <Check className="h-3 w-3" aria-hidden="true" />
          Saved
        </span>
      </div>

      {expanded ? (
        <div className="border-b border-foreground/8 bg-foreground/[0.012] px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-[590px] rounded-[10px] border border-foreground/8 bg-background px-5 py-6 sm:px-7">
            <RichMessageBody body={content} />
          </div>
        </div>
      ) : (
        <p className="line-clamp-2 px-4 py-4 text-[12.5px] leading-relaxed text-muted-foreground/80">
          {preview}{content.length > preview.length ? "…" : ""}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Close" : "Open"} draft: ${item.title}`}
          onClick={() => setExpanded((current) => !current)}
          className="flex items-center gap-2 text-[12px] font-semibold text-foreground transition-colors hover:text-brand-accent"
        >
          {expanded ? "Close document" : "Open document"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {item.id ? (
          <button
            type="button"
            onClick={() => void onOpenCreatedWork("task", item.id)}
            className="text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Open task
          </button>
        ) : null}
      </div>
    </article>
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
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
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
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
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
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;
}) {
  const statusLabel = item.status ? item.status.replace(/_/g, " ") : "created";
  const isSongWorkspace = item.body.includes("Song Workspace created.");
  return (
    <div
      data-testid={isSongWorkspace ? "song-workspace-artifact" : undefined}
      className="flex items-center gap-3 rounded-[14px] border border-foreground/10 bg-background px-4 py-3.5 shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-px hover:shadow-md"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-brand-accent/10 text-brand-accent">
        <Music2 className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ui text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          {isSongWorkspace ? "Song Workspace ready" : `Music item ${statusLabel}`}
        </p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{item.title}</p>
        {isSongWorkspace ? <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/75">Files, rights, and release planning are connected here.</p> : null}
      </div>
      <button
        type="button"
        onClick={() => void onOpenCreatedWork(item.type, item.id, isSongWorkspace ? "files" : undefined)}
        aria-label={`Open music item: ${item.title}`}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground/[0.045] px-3 py-1.5 text-[11px] font-semibold text-foreground/75 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
      >
        {isSongWorkspace ? "Add files" : "Open"}
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
