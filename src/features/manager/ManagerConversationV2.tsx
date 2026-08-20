import { FileAudio, FileImage, FileText, Paperclip, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceShell } from "../../design-system/components";
import { Button } from "../../design-system/desktopPrimitives";
import type {
  ConversationViewModel,
  ManagerConversationAttachmentViewModel,
  ManagerConversationContextAnswer,
  MissionTaskViewModel,
  MusicRepository,
  ReleaseDateChangeRequestViewModel,
  ReleaseOpportunityArtifactViewModel,
  ReleaseOpportunityTargetViewModel,
  ReleaseSuccessArtifactViewModel,
} from "../../types/cleanProduction";
import { SongContextAttachment } from "../music/SongRoomAttachments";
import { GuidedContextQuestion, ManagerComposer, ManagerWorkspaceActions, parseManagerWorkspaceAction, type ManagerWorkspaceAction } from "./ManagerComposer";
import { OpportunityArtifact } from "./OpportunityArtifact";
import { ReleaseSuccessArtifact } from "./ReleaseSuccessArtifact";
import { buildManagerTurns, type ManagerWorkGroup } from "./managerPresentation";

export type CreatedWorkDestination = "files";
export type ManagerConversationV2Props = {
  conversation: ConversationViewModel;
  onBack: () => void;
  onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination, artifactId?: string) => void | Promise<void>;
  onOpenMusicSubject?: (subject: NonNullable<ConversationViewModel["musicSubject"]>) => void;
  musicRepository?: MusicRepository;
  onRefreshMusicObject?: (musicItemId: string) => Promise<void> | void;
  onOpenDecisionPackage?: () => void;
  onApproveReleaseDateChange?: (request: ReleaseDateChangeRequestViewModel) => Promise<void>;
  onKeepReleaseDate?: (artifact: ReleaseSuccessArtifactViewModel) => void;
  onReviewReleaseSuccess?: (artifact: ReleaseSuccessArtifactViewModel) => void;
  onRetryReleaseSuccess?: (artifact: ReleaseSuccessArtifactViewModel) => Promise<void>;
  onPrepareOpportunityPitch?: (artifact: ReleaseOpportunityArtifactViewModel, target: ReleaseOpportunityTargetViewModel) => void | Promise<void>;
  onRecordOpportunityOutcome?: (artifact: ReleaseOpportunityArtifactViewModel, target: ReleaseOpportunityTargetViewModel, input: { status: ReleaseOpportunityTargetViewModel["status"]; manualOutcome: string }) => void | Promise<void>;
  onRetryOpportunityResearch?: (artifact: ReleaseOpportunityArtifactViewModel) => void | Promise<void>;
  taskContext?: MissionTaskViewModel;
  onBackToTask?: () => void;
  onSendMessage: (body: string, conversationId: string, attachmentIds?: string[]) => void;
  onSendContextAnswers: (body: string, conversationId: string, contextRequestId: string, contextAnswers: ManagerConversationContextAnswer[]) => void;
  onRetryLastMessage?: () => void;
  sendPending: boolean;
  sendError: string | null;
};

type ManagerWorkItem = NonNullable<ConversationViewModel["createdWork"]>[number];

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

const ATTACHMENT_CATEGORIES = [
  { label: "Audio", icon: FileAudio, accept: "audio/*", types: [["Final master", "final_master"], ["Rough mix", "rough_mix"], ["Demo", "demo"], ["Stems", "stems"]] as const },
  { label: "Artwork & images", icon: FileImage, accept: "image/*", types: [["Cover artwork", "cover_art"], ["Press photo", "press_photo"], ["Alternate artwork", "alternate_artwork"]] as const },
  { label: "Document", icon: FileText, accept: "application/pdf,.doc,.docx,.txt", types: [["Split sheet", "split_sheet"], ["Rights document", "rights_document"], ["Lyrics", "lyrics"], ["Other document", "other"]] as const },
] as const;

export function ConversationWorkspace(props: ManagerConversationV2Props) {
  const {
    conversation,
    onBack,
    onOpenCreatedWork,
    onOpenMusicSubject,
    musicRepository,
    onRefreshMusicObject,
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
  } = props;

  const [draft, setDraft] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachmentCategoryIndex, setAttachmentCategoryIndex] = useState<number | null>(null);
  const [selectedAssetType, setSelectedAssetType] = useState<string | null>(null);
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedAnswers, setGuidedAnswers] = useState<Record<string, string>>({});
  const [dismissedContextRequests, setDismissedContextRequests] = useState<string[]>([]);
  const [submittedContextRequests, setSubmittedContextRequests] = useState<string[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const tailRef = useRef<HTMLDivElement | null>(null);

  const turns = useMemo(() => buildManagerTurns(conversation), [conversation]);
  const releaseSuccessArtifact = conversation.releaseSuccessArtifacts?.[0];
  const opportunityArtifacts = conversation.releaseOpportunityArtifacts ?? [];
  const lastManagerMessageId = [...conversation.messages].reverse().find((message) => message.speaker === "manager")?.id;
  const hasFailedManagerMessage = conversation.messages.some((message) => message.speaker === "manager" && message.status === "failed");

  const resolvedRequestIds = useMemo(() => new Set(conversation.messages.flatMap((message) =>
    message.speaker === "artist" && message.contextRequestId && message.contextAnswers?.length ? [message.contextRequestId] : [],
  )), [conversation.messages]);

  const activeQuestionMessage = [...conversation.messages].reverse().find((message) => {
    if (message.speaker !== "manager" || !message.contextRequestId || resolvedRequestIds.has(message.contextRequestId) || submittedContextRequests.includes(message.contextRequestId) || dismissedContextRequests.includes(message.contextRequestId)) return false;
    return genuineQuestions(message).length > 0;
  });
  const activeRequestId = activeQuestionMessage?.contextRequestId ?? null;
  const activeQuestions = activeQuestionMessage ? genuineQuestions(activeQuestionMessage) : [];
  const activeQuestion = activeQuestions[Math.min(guidedStep, Math.max(0, activeQuestions.length - 1))];

  useEffect(() => {
    setGuidedStep(0);
    setGuidedAnswers({});
  }, [activeRequestId]);

  useEffect(() => {
    if (!sendPending) return;
    tailRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
    const frame = requestAnimationFrame(() => tailRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [sendPending, conversation.messages.length]);

  const canAttach = Boolean(musicRepository && conversation.musicSubject?.type === "music_item");
  const uploading = composerAttachments.some((item) => item.status === "uploading");
  const attachmentIds = composerAttachments.flatMap((item) => item.attachment?.id ? [item.attachment.id] : []);

  async function uploadAttachment(id: string, file: File, assetType: string) {
    const musicItemId = conversation.musicSubject?.type === "music_item" ? conversation.musicSubject.id : null;
    if (!musicRepository || !musicItemId) return;
    setComposerAttachments((current) => current.map((item) => item.id === id ? { ...item, status: "uploading", percent: 0, error: undefined } : item));
    try {
      const uploaded = await musicRepository.uploadAsset(musicItemId, {
        assetType,
        title: file.name,
        file,
        onProgress: (progress) => setComposerAttachments((current) => current.map((item) => item.id === id ? { ...item, percent: progress.percent } : item)),
      });
      setComposerAttachments((current) => current.map((item) => item.id === id ? {
        ...item,
        status: "uploaded",
        percent: 100,
        attachment: { id: uploaded.id, musicItemId: uploaded.musicItemId, title: uploaded.label, assetType: uploaded.assetType, status: uploaded.status },
      } : item));
      await onRefreshMusicObject?.(uploaded.musicItemId);
    } catch (error) {
      setComposerAttachments((current) => current.map((item) => item.id === id ? { ...item, status: "failed", error: error instanceof Error ? error.message : "Upload failed." } : item));
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !selectedAssetType) return;
    const next = Array.from(files).map((file, index) => ({
      id: `manager-file-${Date.now()}-${index}`,
      file,
      fileName: file.name,
      assetType: selectedAssetType,
      status: "uploading" as const,
      percent: 0,
    }));
    setComposerAttachments((current) => [...current, ...next]);
    setAttachmentMenuOpen(false);
    setAttachmentCategoryIndex(null);
    setSelectedAssetType(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    await Promise.all(next.map((item) => uploadAttachment(item.id, item.file, item.assetType)));
  }

  function send() {
    const body = draft.trim() || (attachmentIds.length ? "Review the attached files and tell me what matters for this song." : "");
    if (!body || sendPending || uploading) return;
    onSendMessage(body, conversation.id, attachmentIds);
    setDraft("");
    setComposerAttachments([]);
  }

  function submitGuided(answerOverride?: string) {
    if (!activeRequestId || !activeQuestion || sendPending) return;
    const answer = (answerOverride ?? guidedAnswers[activeQuestion.key] ?? "").trim();
    if (!answer) return;
    const next = { ...guidedAnswers, [activeQuestion.key]: answer };
    setGuidedAnswers(next);
    if (guidedStep < activeQuestions.length - 1) {
      setGuidedStep((step) => step + 1);
      return;
    }
    const answers = activeQuestions.map((question) => ({ questionKey: question.key, answer: next[question.key]?.trim() ?? "" }));
    if (answers.some((item) => !item.answer)) return;
    setSubmittedContextRequests((current) => [...new Set([...current, activeRequestId])]);
    onSendContextAnswers("Context answers for Manager.", conversation.id, activeRequestId, answers);
  }

  function openWorkspaceAction(action: ManagerWorkspaceAction) {
    const subject = conversation.musicSubject;
    if (!subject) return;
    if (subject.type === "music_item") {
      const destination = action.target === "files" ? "files" : undefined;
      // Until Song Room exposes section-level destination keys to this callback,
      // preserve the subject navigation for Rights/Details. ManagerScreens maps the
      // richer V2 navigation contract as those routes are introduced.
      if (destination) void onOpenCreatedWork("music_item", subject.id, destination);
      else onOpenMusicSubject?.(subject);
      return;
    }
    onOpenMusicSubject?.(subject);
  }

  return (
    <WorkspaceShell eyebrow="Manager conversation" title={conversation.topic} onBack={onBack} punctuateTitle={false} variant="conversation" backLabel="Back to Manager's Office">
      <div data-testid="manager-conversation-v2" className="mx-auto w-full max-w-[48rem] px-1 pb-[calc(12rem+env(safe-area-inset-bottom))] pt-3 sm:px-2 sm:pt-5 lg:px-0">
        {conversation.musicSubject?.type === "music_item" ? (
          <div data-testid="conversation-song-context" className="mb-5"><SongContextAttachment title={conversation.musicSubject.title} stage={conversation.musicSubject.lifecycleStage} onOpenSong={() => onOpenMusicSubject?.(conversation.musicSubject!)} /></div>
        ) : null}
        {taskContext ? (
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-foreground/8 pb-4">
            <div><p className="text-[11px] font-semibold text-muted-foreground">Working on task</p><p className="mt-1 text-[14px] font-semibold text-foreground">{taskContext.title}</p></div>
            {onBackToTask ? <button type="button" onClick={onBackToTask} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">Back to task</button> : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-8">
          {turns.map((turn) => {
            const message = turn.message;
            const isArtist = message.speaker === "artist";
            const actions = message.speaker === "manager" ? workspaceActions(message) : [];
            const isLastManager = message.id === lastManagerMessageId;
            return (
              <article key={message.id} data-testid={`manager-message-${isArtist ? "artist" : "manager"}`} className={`flex flex-col ${isArtist ? "items-end" : "items-start"}`}>
                {isArtist ? (
                  <div className="max-w-[85%] rounded-[1.25rem] bg-foreground/[0.06] px-4 py-2.5 text-foreground sm:max-w-[75%]">
                    <p className="os-body-copy whitespace-pre-wrap">{message.body}</p>
                    {message.attachments?.length ? <AttachmentList attachments={message.attachments} /> : null}
                  </div>
                ) : (
                  <div className="w-full">
                    <ManagerText body={message.body} failed={message.status === "failed"} />
                    {message.status === "failed" && onRetryLastMessage ? <button type="button" onClick={onRetryLastMessage} className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /> Retry Manager message</button> : null}
                    {actions.length ? <ManagerWorkspaceActions actions={actions} onOpen={openWorkspaceAction} disabled={sendPending} /> : null}
                    {turn.work.length ? <WorkGroup groups={turn.work} onOpen={onOpenCreatedWork} /> : null}
                    {isLastManager && releaseSuccessArtifact ? <ReleaseSuccessArtifact musicItemTitle={conversation.musicSubject?.type === "music_item" ? conversation.musicSubject.title : undefined} artifact={releaseSuccessArtifact} onApprove={onApproveReleaseDateChange ?? (async () => undefined)} onKeepDate={onKeepReleaseDate ?? (() => undefined)} onReviewAll={onReviewReleaseSuccess ?? (() => undefined)} onOpenSong={(id) => void onOpenCreatedWork("music_item", id)} onOpenMission={(id) => void onOpenCreatedWork("mission", id)} onRetry={onRetryReleaseSuccess ?? (async () => undefined)} /> : null}
                    {isLastManager ? opportunityArtifacts.map((artifact) => <OpportunityArtifact key={artifact.id} artifact={artifact} onPreparePitch={(target) => onPrepareOpportunityPitch?.(artifact, target)} onRecordOutcome={(target, input) => onRecordOpportunityOutcome?.(artifact, target, input)} onOpenFiles={(id) => onOpenCreatedWork("music_item", id, "files")} onOpenMission={(id) => onOpenCreatedWork("mission", id)} onRetry={(failed) => onRetryOpportunityResearch?.(failed)} />) : null}
                    {isLastManager && conversation.decisionPackage && onOpenDecisionPackage ? <button type="button" onClick={onOpenDecisionPackage} className="mt-4 text-[11px] font-semibold text-muted-foreground hover:text-foreground">View decision package</button> : null}
                  </div>
                )}
              </article>
            );
          })}
          {sendPending && !conversation.messages.some((message) => message.status === "streaming") ? <p className="text-[12px] font-medium text-muted-foreground">Manager is working…</p> : null}
          <div data-testid="manager-chat-tail" ref={tailRef} className="h-32 shrink-0" aria-hidden="true" />
        </div>
      </div>

      <ManagerComposer
        draft={draft}
        onDraftChange={setDraft}
        onSend={send}
        sendPending={sendPending}
        canSend={!activeQuestion && !uploading && (Boolean(draft.trim()) || attachmentIds.length > 0)}
        sendError={hasFailedManagerMessage ? null : sendError}
        attachments={composerAttachments.length ? <AttachmentTray attachments={composerAttachments} onRemove={(id) => setComposerAttachments((current) => current.filter((item) => item.id !== id))} onRetry={(item) => void uploadAttachment(item.id, item.file, item.assetType)} /> : undefined}
        leadingAction={canAttach && !activeQuestion ? (
          <AttachmentButton
            menuOpen={attachmentMenuOpen}
            setMenuOpen={setAttachmentMenuOpen}
            categoryIndex={attachmentCategoryIndex}
            setCategoryIndex={setAttachmentCategoryIndex}
            selectedAssetType={selectedAssetType}
            setSelectedAssetType={setSelectedAssetType}
            inputRef={attachmentInputRef}
            disabled={sendPending || uploading}
            onFiles={handleFiles}
          />
        ) : undefined}
        guidedQuestion={activeQuestion ? <GuidedContextQuestion
          question={activeQuestion}
          position={guidedStep}
          total={activeQuestions.length}
          value={guidedAnswers[activeQuestion.key] ?? ""}
          onChange={(value) => setGuidedAnswers((current) => ({ ...current, [activeQuestion.key]: value }))}
          onUseRecommendation={() => setGuidedAnswers((current) => ({ ...current, [activeQuestion.key]: activeQuestion.recommendedAnswer ?? "" }))}
          onBack={() => setGuidedStep((step) => Math.max(0, step - 1))}
          onAnswerLater={() => activeRequestId && setDismissedContextRequests((current) => [...new Set([...current, activeRequestId])])}
          onSubmit={submitGuided}
          sendPending={sendPending}
        /> : undefined}
      />
    </WorkspaceShell>
  );
}

function genuineQuestions(message: ConversationViewModel["messages"][number]) {
  return (message.contextQuestions ?? []).filter((question) => !parseManagerWorkspaceAction(question));
}
function workspaceActions(message: ConversationViewModel["messages"][number]) {
  return (message.contextQuestions ?? []).map(parseManagerWorkspaceAction).filter((action): action is ManagerWorkspaceAction => Boolean(action));
}

function ManagerText({ body, failed }: { body: string; failed?: boolean }) {
  const paragraphs = body.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);
  return <div className={`os-body-copy grid gap-3 ${failed ? "text-destructive" : "text-foreground"}`}>{paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 18)}`} className="whitespace-pre-wrap">{renderManagerInlineMarkdown(paragraph)}</p>)}</div>;
}

function renderManagerInlineMarkdown(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    const strong = part.match(/^\*\*([^*]+)\*\*$/);
    if (strong) return <strong key={`strong-${index}`} className="font-semibold text-foreground">{strong[1]}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a key={`link-${index}`} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:decoration-brand-accent">{link[1]}</a>;
    return <span key={`text-${index}`}>{part}</span>;
  });
}

function WorkGroup({ groups, onOpen }: { groups: ManagerWorkGroup[]; onOpen: ManagerConversationV2Props["onOpenCreatedWork"] }) {
  if (!groups.length) return null;

  function openItem(item: ManagerWorkItem, destination?: "files") {
    const type = item.type === "task" || item.type === "mission" ? item.type : "music_item";
    const id = item.musicItemId ?? item.id;
    const artifactId = item.artifactKind === "song_document" ? item.id : undefined;
    void onOpen(type, id, destination, artifactId);
  }

  return (
    <div data-testid="manager-result-group" className="mt-4 grid gap-3">
      {groups.map((group, index) => {
        if (group.kind === "draft") {
          return <article key={`draft-${index}`} data-testid="manager-document-result" className="grid gap-2 rounded-[14px] border border-foreground/8 bg-foreground/[0.012] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
            <div className="min-w-0"><p className="os-list-meta font-semibold text-muted-foreground">Draft saved</p><p className="os-list-title mt-0.5 truncate text-foreground">{group.item.title}</p></div>
            {group.item.id ? <button type="button" onClick={() => openItem(group.item, "files")} className="text-left text-[11px] font-semibold text-muted-foreground hover:text-foreground sm:text-right">Open draft</button> : null}
          </article>;
        }

        if (group.kind === "workspace") {
          const song = group.musicItem;
          const mission = group.mission;
          return <section key={`workspace-${index}`} data-testid="manager-workspace-result" className="rounded-[14px] border border-foreground/8 bg-foreground/[0.012] px-3 py-3 sm:px-3.5">
            <p className="os-list-meta font-semibold text-muted-foreground">Song ready</p>
            {song ? <p className="os-list-title mt-0.5 text-foreground">{song.title}</p> : null}
            {mission ? <p className="os-list-meta mt-1 font-medium text-muted-foreground">{mission.body || `${group.tasks.length} task${group.tasks.length === 1 ? "" : "s"} ready for the mission.`}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              {song ? <button type="button" onClick={() => openItem(song)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">Open song</button> : null}
              {mission?.id ? <button type="button" onClick={() => openItem(mission)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">View mission</button> : null}
            </div>
          </section>;
        }

        if (group.kind === "mission") {
          return <section key={`mission-${index}`} className="grid gap-1 rounded-[14px] border border-foreground/8 bg-foreground/[0.012] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-3.5">
            <div className="min-w-0"><p className="os-list-title text-foreground">{group.mission.title}</p><p className="os-list-meta mt-0.5 font-medium text-muted-foreground">{group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}</p></div>
            {group.mission.id ? <button type="button" onClick={() => openItem(group.mission)} className="text-left text-[11px] font-semibold text-muted-foreground hover:text-foreground sm:text-right">View mission</button> : null}
          </section>;
        }

        if (group.kind === "tasks") {
          const task = group.tasks[0];
          return <section key={`tasks-${index}`} className="grid gap-1 rounded-[14px] border border-foreground/8 bg-foreground/[0.012] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-3.5">
            <div className="min-w-0"><p className="os-list-meta font-semibold text-muted-foreground">{group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"} ready</p>{task ? <p className="os-list-title mt-0.5 truncate text-foreground">{task.title}</p> : null}</div>
            {task?.id ? <button type="button" onClick={() => openItem(task)} className="text-left text-[11px] font-semibold text-muted-foreground hover:text-foreground sm:text-right">View task</button> : null}
          </section>;
        }

        const item = group.item;
        return <section key={`${group.kind}-${index}`} className="grid gap-1 rounded-[14px] border border-foreground/8 bg-foreground/[0.012] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-3.5">
          <div className="min-w-0"><p className="os-list-meta font-semibold text-muted-foreground">{group.kind === "music" ? "Song ready" : "Work ready"}</p><p className="os-list-title mt-0.5 truncate text-foreground">{item.title}</p>{item.body ? <p className="os-list-meta mt-1 line-clamp-1 font-medium text-muted-foreground">{item.body}</p> : null}</div>
          <button type="button" onClick={() => openItem(item)} className="text-left text-[11px] font-semibold text-muted-foreground hover:text-foreground sm:text-right">{group.kind === "music" ? "Open song" : "Open"}</button>
        </section>;
      })}
    </div>
  );
}

function AttachmentList({ attachments }: { attachments: ManagerConversationAttachmentViewModel[] }) {
  return <div className="mt-2 grid gap-1">{attachments.map((item) => <div key={item.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Paperclip className="h-3 w-3" />{item.title}</div>)}</div>;
}

function AttachmentTray({ attachments, onRemove, onRetry }: { attachments: ComposerAttachment[]; onRemove(id: string): void; onRetry(item: ComposerAttachment): void }) {
  return <div className="mb-1 grid gap-1">{attachments.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-lg bg-foreground/[0.035] px-2.5 py-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{item.fileName}</span><span className="text-[10px] text-muted-foreground">{item.status === "uploading" ? `${item.percent}%` : item.status}</span>{item.status === "failed" ? <button type="button" onClick={() => onRetry(item)} className="text-[10px] font-semibold">Retry</button> : null}<button type="button" aria-label={`Remove ${item.fileName}`} onClick={() => onRemove(item.id)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button></div>)}</div>;
}

function AttachmentButton({ menuOpen, setMenuOpen, categoryIndex, setCategoryIndex, selectedAssetType, setSelectedAssetType, inputRef, disabled, onFiles }: {
  menuOpen: boolean;
  setMenuOpen(value: boolean): void;
  categoryIndex: number | null;
  setCategoryIndex(value: number | null): void;
  selectedAssetType: string | null;
  setSelectedAssetType(value: string | null): void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onFiles(files: FileList | null): void | Promise<void>;
}) {
  const category = categoryIndex == null ? null : ATTACHMENT_CATEGORIES[categoryIndex];
  return <div className="relative">
    <input ref={inputRef} type="file" multiple accept={category?.accept} className="sr-only" tabIndex={-1} onChange={(event) => void onFiles(event.target.files)} />
    <button type="button" aria-label="Add files" aria-expanded={menuOpen} onClick={() => { setMenuOpen(!menuOpen); setCategoryIndex(null); }} disabled={disabled} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30"><Plus className="h-4 w-4" /></button>
    {menuOpen ? <div className="absolute bottom-12 left-0 z-50 w-64 rounded-2xl border border-foreground/10 bg-background p-2 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
      {category ? <button type="button" onClick={() => setCategoryIndex(null)} className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">Back</button> : null}
      <div className="grid gap-0.5">{category ? category.types.map(([label, value]) => <button key={value} type="button" onClick={() => { setSelectedAssetType(value); setTimeout(() => inputRef.current?.click(), 0); }} className="min-h-10 rounded-xl px-3 text-left text-[12px] font-semibold hover:bg-foreground/[0.05]">{label}</button>) : ATTACHMENT_CATEGORIES.map((item, index) => { const Icon = item.icon; return <button key={item.label} type="button" onClick={() => setCategoryIndex(index)} className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-[12px] font-semibold hover:bg-foreground/[0.05]"><Icon className="h-4 w-4 text-muted-foreground" />{item.label}</button>; })}</div>
    </div> : null}
  </div>;
}
