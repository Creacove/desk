import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import type { ConversationMessageViewModel, ConversationViewModel, MusicObjectViewModel, SongMaterialViewModel } from "../../types/cleanProduction";
import { DecisionPackageScreen, InvestigationScreen, ManagerOfficeScreen as LegacyManagerOfficeScreen } from "./ManagerScreensLegacy";
import { ConversationWorkspace as UnifiedConversationWorkspace, type ManagerConversationV2Props } from "./ManagerConversationV2";
import { WorkspaceHeader, WorkspaceShell } from "../../design-system/components";
import { Button, ManagerComposer, SkeletonBlock, Timestamp } from "../../design-system/desktopPrimitives";
import { SongDocumentEditor } from "../music/SongDocumentEditor";
import { ManagerKnowledgeAttachmentTray, ManagerKnowledgeUploadButton, useManagerKnowledgeUploads } from "./ManagerKnowledgeUpload";

export { DecisionPackageScreen, InvestigationScreen };

type ManagerOfficeScreenProps = Omit<ComponentProps<typeof LegacyManagerOfficeScreen>, "onAskManager"> & {
  onAskManager: (body: string, attachmentIds?: string[]) => void;
  managerRepository?: import("../../types/cleanProduction").CleanProductionRepositories["manager"];
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
  managerRepository,
}: ManagerOfficeScreenProps) {
  const [askText, setAskText] = useState("");
  const knowledge = useManagerKnowledgeUploads(managerRepository);
  const candidateMissionIds = useMemo(() => missionGenesisResult?.candidateMissionIds?.length
    ? missionGenesisResult.candidateMissionIds
    : missionGenesisResult?.candidateMissionId ? [missionGenesisResult.candidateMissionId] : [],
  [missionGenesisResult?.candidateMissionId, missionGenesisResult?.candidateMissionIds?.join("|")]);
  const candidateMissionKey = candidateMissionIds.join("|");
  const [selectedCandidateMissionId, setSelectedCandidateMissionId] = useState<string | undefined>(candidateMissionIds[0]);

  useEffect(() => {
    setSelectedCandidateMissionId((current) => current && candidateMissionIds.includes(current) ? current : candidateMissionIds[0]);
  }, [candidateMissionKey]);

  function submitWork() {
    const body = askText.trim() || (knowledge.attachmentIds.length ? "Review these files and tell me what matters for the artist and the business." : "");
    if (!body || askManagerPending || knowledge.busy) return;
    onAskManager(body, knowledge.attachmentIds);
    setAskText("");
    knowledge.clear();
  }

  return (
    <section className="app-workspace app-workspace-reveal pb-12">
      <div className="os-room-rail">
        <WorkspaceHeader title="Manager's Office" />
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
          <section aria-label="Work with Manager" className="pb-7">
            <div className="os-form-measure">
              <ManagerKnowledgeAttachmentTray items={knowledge.items} onRemove={(id) => void knowledge.remove(id)} onRetry={(item) => void knowledge.retry(item)} />
              <ManagerComposer value={askText} onChange={setAskText} onSubmit={submitWork} pending={askManagerPending || knowledge.busy} disabled={knowledge.busy} allowEmptySubmit={knowledge.attachmentIds.length > 0} leadingAction={<ManagerKnowledgeUploadButton onFiles={knowledge.addFiles} disabled={askManagerPending || knowledge.busy} />} ariaLabel="Work with Manager" placeholder="What do you want to work on?" />
            </div>
            {askManagerError ? <p role="alert" className="mt-3 text-[12px] font-medium text-destructive">{askManagerError}</p> : null}
          </section>
        </main>

        <aside className="min-w-0 border-t border-foreground/8 pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <div className="flex items-center justify-between gap-3"><h2 className="text-[14px] font-semibold text-foreground">Conversations</h2>{conversations.length ? <span className="text-[12px] tabular-nums text-muted-foreground/55">{conversations.length}</span> : null}</div>
          {conversationsPending && !conversations.length ? (
            <div data-testid="manager-office-conversations-loading" className="mt-3 divide-y divide-foreground/7" aria-label="Loading conversations">{[0,1,2,3].map((index) => <div key={index} className="grid min-h-[50px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><SkeletonBlock className="h-3.5 w-[min(82%,13rem)]" /><SkeletonBlock className="h-3 w-12" /></div>)}</div>
          ) : conversationsError ? (
            <div className="mt-4 border-l-2 border-destructive pl-3"><p className="text-[12px] font-medium leading-relaxed text-destructive">Conversations could not load.</p>{onRetryConversations ? <Button type="button" variant="secondary" size="sm" onClick={onRetryConversations} className="mt-3">Try again</Button> : null}</div>
          ) : conversations.length ? (
            <div className="os-list-frame mt-3 divide-y divide-foreground/7">{conversations.map((conversation) => <button key={conversation.id} type="button" aria-label={conversation.topic} onClick={() => onConversation(conversation)} className="os-list-row group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left outline-none transition-colors duration-150 hover:bg-foreground/[0.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/20"><p className="os-list-title truncate text-foreground/92">{conversation.topic}</p>{conversation.lastUpdate ? <Timestamp value={conversation.lastUpdate} context="rail" className="os-list-meta text-muted-foreground/58" /> : null}</button>)}</div>
          ) : <p className="mt-4 text-[12px] font-medium leading-relaxed text-muted-foreground">No conversations yet. Start working with Manager.</p>}
        </aside>
        </div>
      </div>
    </section>
  );
}

function ManagerMissionContext({ result, answers, pending, error, candidateMissionIds, selectedCandidateMissionId, onSelectCandidate, onAnswerChange, onSubmit, onOpenCreatedMission }: {
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
      {result ? <><p className="text-[12px] font-medium text-muted-foreground">Manager needs a little more context</p><h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.02em] text-foreground">{result.title}</h2>{result.body ? <p className="os-reading-measure mt-2 text-[14px] font-medium leading-[1.6] text-muted-foreground">{result.body}</p> : null}</> : null}
      {candidateMissionIds.length > 1 ? <div className="mt-4 flex flex-wrap gap-2" aria-label="Mission options">{candidateMissionIds.map((id,index) => <button key={id} type="button" aria-pressed={selectedCandidateMissionId === id} onClick={() => onSelectCandidate(id)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${selectedCandidateMissionId === id ? "bg-brand-accent/10 text-brand-accent" : "bg-foreground/[0.045] text-muted-foreground"}`}>Option {index+1}</button>)}</div> : null}
      {result?.questions.length ? <div className="mt-5 grid gap-4">{result.questions.map((question) => <label key={question.key} className="grid gap-2"><span className="text-[13px] font-semibold leading-snug text-foreground">{question.question}</span>{question.answerKind === "single_select" ? <select aria-label={question.question} value={answers[question.key] ?? ""} onChange={(event) => onAnswerChange(question.key,event.target.value)} disabled={pending} className="h-11 rounded-[10px] border border-foreground/10 bg-background px-3 text-[14px] font-medium text-foreground"><option value="">Select answer</option>{[...(question.options ?? []).filter((option) => !/^something else/i.test(option)), "Something else…"].map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input aria-label={question.question} value={answers[question.key] ?? ""} onChange={(event) => onAnswerChange(question.key,event.target.value)} disabled={pending} className="h-11 rounded-[10px] border border-foreground/10 bg-background px-3 text-[14px] font-medium text-foreground" />}</label>)}<div><Button onClick={onSubmit} pending={pending}>Continue mission setup</Button></div></div> : null}
      {error ? <div role="alert" className="mt-4 border-l-2 border-destructive pl-3"><p className="text-[12px] font-medium leading-relaxed text-destructive">{error}</p><Button type="button" variant="secondary" size="sm" onClick={onSubmit} disabled={pending} className="mt-3">Try again</Button></div> : null}
      {result?.activatedMissionId || result?.activatedMissionIds?.length ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/8 pt-4"><div><p className="text-[13px] font-semibold text-foreground">Mission ready</p><p className="mt-0.5 text-[12px] font-medium text-muted-foreground">The work is now available in Missions.</p></div><Button variant="secondary" onClick={onOpenCreatedMission}>View mission</Button></div> : null}
    </section>
  );
}

type ConversationWorkspaceProps = ManagerConversationV2Props & { detailPending?: boolean; detailError?: string | null; onRetryDetail?: () => void };
type CreatedWork = NonNullable<ConversationMessageViewModel["createdWork"]>[number];
type TurnPresentation = { version: 1; surfaces: Array<"release_success" | "release_opportunities" | "decision_package" | "release_share_package">; visibleArtifactIds: string[]; decisionPackageId?: string };
type PresentationCreatedWork = CreatedWork & { presentationRole?: "deliverable" | "internal_support" | "compatibility"; visibility?: "user" | "internal" };
type DocumentPreviewTarget = { song: MusicObjectViewModel; document: Extract<SongMaterialViewModel, { kind: "document" }> };

const RELEASED_STAGES = new Set(["released", "catalog", "catalogued", "archived"]);
const RELEASE_MANAGEMENT_INTENT = /\b(release date|release readiness|release[- ]ready|ready (?:to|for) release|release plan|launch date|get (?:this |the )?song ready|check (?:the )?release|release(?:-| )success review|retry release(?:-| )success|move (?:the )?release|delay (?:the )?release|postpone|reschedule|keep (?:the )?date|recovery plan)\b/i;
const OPPORTUNITY_DISCOVERY_INTENT = /\b(playlisting|playlist opportunities?|playlist targets?|curators?|press targets?|publicity targets?|media targets?|record servicing|service this (?:song|release)|research (?:playlist|press)|find (?:playlist|playlists|press|media|curators?)|help (?:me )?with playlisting)\b/i;
const DECISION_PACKAGE_INTENT = /\bdecision package\b/i;
const DOCUMENT_TITLE_HINT = /\b(epk|electronic press kit|playlist (?:pitch|submission)|spotify editorial pitch|press (?:pitch|release|brief)|one[- ]sheet|bio(?:graphy)?|content plan|release calendar|distributor notes|credits|lyrics)\b/i;

export function prepareManagerConversationForPresentation(conversation: ConversationViewModel): ConversationViewModel {
  const messages = conversation.messages ?? [];
  const lastManagerIndex = messages.reduce((last,message,index) => message.speaker === "manager" ? index : last,-1);
  const latestManagerFailed = lastManagerIndex >= 0 && messages[lastManagerIndex]?.status === "failed";
  const triggeringArtistMessage = lastManagerIndex >= 0 ? [...messages.slice(0,lastManagerIndex)].reverse().find((message) => message.speaker === "artist") : [...messages].reverse().find((message) => message.speaker === "artist");
  const directive = triggeringArtistMessage?.body ?? conversation.prompt ?? "";
  const lifecycleStage = conversation.musicSubject?.lifecycleStage?.trim().toLowerCase() ?? "";
  const isReleased = RELEASED_STAGES.has(lifecycleStage);
  const subject = conversation.musicSubject;
  const latestManagerPresentation = lastManagerIndex >= 0 ? (messages[lastManagerIndex] as (ConversationMessageViewModel & { presentation?: TurnPresentation }) | undefined)?.presentation : undefined;
  const hasTurnContract = latestManagerPresentation?.version === 1;
  const hasSurface = (surface: "release_success" | "release_opportunities" | "decision_package") => Boolean(latestManagerPresentation?.surfaces.includes(surface));

  const projectedMessages = messages.map((message): ConversationMessageViewModel => ({
    ...message,
    // Preserve all contextQuestions. The V2 conversation renderer separates genuine
    // questions from historical workspace_action compatibility entries and renders
    // actions inline instead of hijacking the composer.
    ...(message.createdWork !== undefined ? { createdWork: (message.createdWork ?? []).flatMap((item) => {
      const presentationItem = item as PresentationCreatedWork;
      if (presentationItem.visibility === "internal" || presentationItem.presentationRole === "internal_support" || presentationItem.presentationRole === "compatibility") return [];
      const normalized = normalizeHistoricalDocumentWork(item,message.id,subject);
      return normalized ? [normalized] : [];
    }) } : {}),
  }));

  return {
    ...conversation,
    releaseSuccessArtifacts: !latestManagerFailed && (hasTurnContract ? hasSurface("release_success") : !isReleased && RELEASE_MANAGEMENT_INTENT.test(directive)) ? conversation.releaseSuccessArtifacts : [],
    releaseOpportunityArtifacts: !latestManagerFailed && (hasTurnContract ? hasSurface("release_opportunities") : OPPORTUNITY_DISCOVERY_INTENT.test(directive)) ? conversation.releaseOpportunityArtifacts : [],
    decisionPackage: !latestManagerFailed && (hasTurnContract ? hasSurface("decision_package") && (!latestManagerPresentation?.decisionPackageId || latestManagerPresentation.decisionPackageId === conversation.decisionPackage?.id) : DECISION_PACKAGE_INTENT.test(directive)) ? conversation.decisionPackage : undefined,
    messages: projectedMessages,
  };
}

function normalizeHistoricalDocumentWork(item: CreatedWork, messageId: string, subject: ConversationViewModel["musicSubject"]): CreatedWork | null {
  const title = item.title.trim();
  const documentType = item.documentType?.trim().toLowerCase();
  if (documentType === "release_narrative" || title.toLowerCase() === "release narrative") return null;
  if (item.artifactKind === "song_document") return item;
  const isSongDocumentReceipt = subject?.type === "music_item" && item.type === "music_item" && title.toLowerCase() !== subject.title.trim().toLowerCase() && DOCUMENT_TITLE_HINT.test(title);
  if (!isSongDocumentReceipt) return item;
  return { ...item, id: item.id || `legacy-document:${messageId}:${slug(title)}`, musicItemId: subject.id, artifactKind: "song_document", documentType: inferDocumentType(title), readiness: item.status === "failed" ? "save_failed" : "needs_review", body: item.status === "failed" ? "Draft created, but it could not be saved to Files." : "Draft ready to review in Files." };
}
function inferDocumentType(title: string) { const value = title.toLowerCase(); if (/\bepk\b|electronic press kit/.test(value)) return "epk"; if (/spotify.*editorial/.test(value)) return "spotify_editorial_pitch"; if (/playlist/.test(value)) return "playlist_pitch"; if (/press release/.test(value)) return "press_release"; if (/press pitch/.test(value)) return "press_pitch"; if (/press brief/.test(value)) return "press_target_brief"; if (/one[- ]sheet/.test(value)) return "one_sheet"; if (/bio/.test(value)) return "artist_biography"; if (/content plan/.test(value)) return "content_plan"; if (/release calendar/.test(value)) return "release_calendar"; if (/credits/.test(value)) return "credits"; if (/lyrics/.test(value)) return "lyrics"; if (/distributor notes/.test(value)) return "distributor_notes"; return "document"; }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,72) || "document"; }

export function ConversationWorkspace(props: ConversationWorkspaceProps) {
  const { conversation, onOpenCreatedWork, musicRepository, detailPending = false, detailError, onRetryDetail } = props;
  const [documentPreviewTarget,setDocumentPreviewTarget] = useState<DocumentPreviewTarget | null>(null);

  async function openCreatedWorkInContext(type: "music_item" | "mission" | "task", id?: string, destination?: "files", artifactId?: string) {
    if (type === "music_item" && destination === "files" && id && artifactId && musicRepository) {
      try {
        const song = await musicRepository.loadMusicObject(id,"music_item");
        const document = (song?.materials ?? []).find((material): material is Extract<SongMaterialViewModel,{kind:"document"}> => material.kind === "document" && material.id === artifactId);
        if (song && document) { setDocumentPreviewTarget({ song,document }); return; }
      } catch { /* preserve Files fallback */ }
    }
    return onOpenCreatedWork(type,id,destination,artifactId);
  }

  if (detailError) return <WorkspaceShell eyebrow="Manager conversation" title={conversation.topic} onBack={props.onBack} punctuateTitle={false} variant="conversation" backLabel="Back to Manager's Office"><div data-testid="manager-conversation-load-error" className="os-reading-measure mx-auto px-1 py-8 sm:px-2"><p className="text-[13px] font-semibold text-foreground">Couldn't load this conversation</p><p className="mt-2 max-w-md text-[12px] font-medium leading-relaxed text-muted-foreground">{detailError}</p>{onRetryDetail ? <div className="mt-4"><Button variant="secondary" onClick={onRetryDetail}>Try again</Button></div> : null}</div></WorkspaceShell>;
  if (detailPending && !conversation.messages?.length) return <WorkspaceShell eyebrow="Manager conversation" title={conversation.topic} onBack={props.onBack} punctuateTitle={false} variant="conversation" backLabel="Back to Manager's Office"><div data-testid="manager-conversation-loading" aria-label="Loading conversation" className="os-reading-measure mx-auto px-1 pb-28 pt-7 sm:px-2"><SkeletonBlock className="h-3 w-28" /><SkeletonBlock className="mt-4 h-4 w-5/6" /><SkeletonBlock className="mt-2 h-4 w-2/3" /><SkeletonBlock className="mt-8 ml-auto h-10 w-2/3 rounded-[18px]" /></div></WorkspaceShell>;

  const presented = prepareManagerConversationForPresentation(conversation);
  return <>
    <UnifiedConversationWorkspace {...props} conversation={presented} onOpenCreatedWork={openCreatedWorkInContext} />
    {documentPreviewTarget ? <SongDocumentEditor document={documentPreviewTarget.document} pending={false} onCancel={() => setDocumentPreviewTarget(null)} onSave={() => undefined} previewOnly contextNote={`Saved to ${documentPreviewTarget.song.title} → Files. You can find this document there anytime.`} onOpenFiles={() => { const target=documentPreviewTarget; setDocumentPreviewTarget(null); void onOpenCreatedWork("music_item",target.song.id,"files",target.document.id); }} /> : null}
  </>;
}
