import type { ComponentProps } from "react";
import { useMemo } from "react";
import type { ConversationMessageViewModel, ConversationViewModel } from "../../types/cleanProduction";
import {
  ConversationWorkspace as LegacyConversationWorkspace,
  DecisionPackageScreen,
  InvestigationScreen,
  ManagerOfficeScreen,
} from "./ManagerScreensLegacy";
import {
  ManagerWorkspaceActions,
  parseManagerWorkspaceAction,
  type ManagerWorkspaceAction,
} from "./ManagerComposer";

export { DecisionPackageScreen, InvestigationScreen, ManagerOfficeScreen };

type ConversationWorkspaceProps = ComponentProps<typeof LegacyConversationWorkspace>;
type CreatedWork = NonNullable<ConversationMessageViewModel["createdWork"]>[number];
type TurnPresentation = { version: 1; surfaces: Array<"release_success" | "release_opportunities" | "decision_package" | "release_share_package">; visibleArtifactIds: string[]; decisionPackageId?: string };
type PresentationCreatedWork = CreatedWork & { presentationRole?: "deliverable" | "internal_support" | "compatibility"; visibility?: "user" | "internal" };

const RELEASED_STAGES = new Set(["released", "catalog", "catalogued", "archived"]);
const RELEASE_MANAGEMENT_INTENT = /\b(release date|release readiness|release[- ]ready|ready (?:to|for) release|release plan|launch date|get (?:this |the )?song ready|check (?:the )?release|release(?:-| )success review|retry release(?:-| )success|move (?:the )?release|delay (?:the )?release|postpone|reschedule|keep (?:the )?date|recovery plan)\b/i;
const OPPORTUNITY_DISCOVERY_INTENT = /\b(playlisting|playlist opportunities?|playlist targets?|curators?|press targets?|publicity targets?|media targets?|record servicing|service this (?:song|release)|research (?:playlist|press)|find (?:playlist|playlists|press|media|curators?)|help (?:me )?with playlisting)\b/i;
const DECISION_PACKAGE_INTENT = /\bdecision package\b/i;
const DOCUMENT_TITLE_HINT = /\b(epk|electronic press kit|playlist (?:pitch|submission)|spotify editorial pitch|press (?:pitch|release|brief)|one[- ]sheet|bio(?:graphy)?|content plan|release calendar|distributor notes|credits|lyrics)\b/i;

export function prepareManagerConversationForPresentation(conversation: ConversationViewModel): ConversationViewModel {
  const messages = conversation.messages ?? [];
  const lastManagerIndex = messages.reduce((last, message, index) => message.speaker === "manager" ? index : last, -1);
  const latestManagerFailed = lastManagerIndex >= 0 && messages[lastManagerIndex]?.status === "failed";
  const triggeringArtistMessage = lastManagerIndex >= 0
    ? [...messages.slice(0, lastManagerIndex)].reverse().find((message) => message.speaker === "artist")
    : [...messages].reverse().find((message) => message.speaker === "artist");
  const directive = triggeringArtistMessage?.body ?? conversation.prompt ?? "";
  const lifecycleStage = conversation.musicSubject?.lifecycleStage?.trim().toLowerCase() ?? "";
  const isReleased = RELEASED_STAGES.has(lifecycleStage);
  const subject = conversation.musicSubject;
  const latestManagerPresentation = lastManagerIndex >= 0
    ? (messages[lastManagerIndex] as (ConversationMessageViewModel & { presentation?: TurnPresentation }) | undefined)?.presentation
    : undefined;
  const hasTurnContract = latestManagerPresentation?.version === 1;
  const hasSurface = (surface: "release_success" | "release_opportunities" | "decision_package") =>
    Boolean(latestManagerPresentation?.surfaces.includes(surface));

  const projectedMessages: ConversationMessageViewModel[] = messages.map((message): ConversationMessageViewModel => {
    const contextQuestions = message.contextQuestions?.filter((question) => !parseManagerWorkspaceAction(question));
    const createdWork = (message.createdWork ?? []).flatMap((item) => {
      const presentationItem = item as PresentationCreatedWork;
      if (presentationItem.visibility === "internal" || presentationItem.presentationRole === "internal_support" || presentationItem.presentationRole === "compatibility") return [];
      const normalized = normalizeHistoricalDocumentWork(item, message.id, subject);
      return normalized ? [normalized] : [];
    });
    return {
      ...message,
      ...(message.contextQuestions?.length ? {
        contextQuestions,
        contextRequestId: contextQuestions?.length ? message.contextRequestId : undefined,
      } : {}),
      ...(message.createdWork !== undefined ? { createdWork } : {}),
    };
  });

  return {
    ...conversation,
    // Conversation-level artifacts are legacy storage projections. Only expose them
    // when the current successful user turn actually asked for that operating surface.
    // A failed Manager turn must never inherit stale work from an earlier response.
    releaseSuccessArtifacts: !latestManagerFailed && (hasTurnContract
      ? hasSurface("release_success")
      : !isReleased && RELEASE_MANAGEMENT_INTENT.test(directive))
      ? conversation.releaseSuccessArtifacts
      : [],
    releaseOpportunityArtifacts: !latestManagerFailed && (hasTurnContract
      ? hasSurface("release_opportunities")
      : OPPORTUNITY_DISCOVERY_INTENT.test(directive))
      ? conversation.releaseOpportunityArtifacts
      : [],
    decisionPackage: !latestManagerFailed && (hasTurnContract
      ? hasSurface("decision_package")
        && (!latestManagerPresentation?.decisionPackageId || latestManagerPresentation.decisionPackageId === conversation.decisionPackage?.id)
      : DECISION_PACKAGE_INTENT.test(directive))
      ? conversation.decisionPackage
      : undefined,
    messages: projectedMessages,
  };
}

function normalizeHistoricalDocumentWork(
  item: CreatedWork,
  messageId: string,
  subject: ConversationViewModel["musicSubject"],
): CreatedWork | null {
  const title = item.title.trim();
  const documentType = item.documentType?.trim().toLowerCase();
  if (documentType === "release_narrative" || title.toLowerCase() === "release narrative") return null;
  if (item.artifactKind === "song_document") return item;

  // Older/current compatibility payloads can represent a generated canonical document
  // as type=music_item while using either the song id OR the actual document id. Title
  // and focused-song context identify the work product; never downgrade it to "Song ready".
  const isSongDocumentReceipt = subject?.type === "music_item"
    && item.type === "music_item"
    && title.toLowerCase() !== subject.title.trim().toLowerCase()
    && DOCUMENT_TITLE_HINT.test(title);
  if (!isSongDocumentReceipt) return item;

  return {
    ...item,
    id: item.id || `legacy-document:${messageId}:${slug(title)}`,
    musicItemId: subject.id,
    artifactKind: "song_document",
    documentType: inferDocumentType(title),
    readiness: item.status === "failed" ? "save_failed" : "needs_review",
    body: item.status === "failed" ? "Draft created, but it could not be saved to Files." : "Draft ready to review in Files.",
  };
}

function inferDocumentType(title: string) {
  const value = title.toLowerCase();
  if (/\bepk\b|electronic press kit/.test(value)) return "epk";
  if (/spotify.*editorial/.test(value)) return "spotify_editorial_pitch";
  if (/playlist/.test(value)) return "playlist_pitch";
  if (/press release/.test(value)) return "press_release";
  if (/press pitch/.test(value)) return "press_pitch";
  if (/press brief/.test(value)) return "press_target_brief";
  if (/one[- ]sheet/.test(value)) return "one_sheet";
  if (/bio/.test(value)) return "artist_biography";
  if (/content plan/.test(value)) return "content_plan";
  if (/release calendar/.test(value)) return "release_calendar";
  if (/credits/.test(value)) return "credits";
  if (/lyrics/.test(value)) return "lyrics";
  if (/distributor notes/.test(value)) return "distributor_notes";
  return "document";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "document";
}

export function ConversationWorkspace(props: ConversationWorkspaceProps) {
  const { conversation, onOpenCreatedWork, onOpenMusicSubject, sendPending } = props;

  const activeWorkspaceActions = useMemo(() => {
    const messages = conversation.messages ?? [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.speaker !== "manager" || !message.contextQuestions?.length) continue;
      const actions = message.contextQuestions
        .map(parseManagerWorkspaceAction)
        .filter((action): action is ManagerWorkspaceAction => Boolean(action));
      if (!actions.length) continue;
      const answeredAfterward = messages.slice(index + 1).some((candidate) => candidate.speaker === "artist");
      return answeredAfterward ? [] : actions;
    }
    return [];
  }, [conversation.messages]);

  const conversationalConversation = useMemo(
    () => prepareManagerConversationForPresentation(conversation),
    [conversation],
  );

  function openWorkspaceAction(action: ManagerWorkspaceAction) {
    const subject = conversation.musicSubject;
    if (!subject) return;
    if (subject.type === "music_item" && action.target === "files") {
      void onOpenCreatedWork("music_item", subject.id, "files");
      return;
    }
    onOpenMusicSubject?.(subject);
  }

  return (
    <>
      <LegacyConversationWorkspace {...props} conversation={conversationalConversation} />
      {activeWorkspaceActions.length ? (
        <div className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-[45] px-4 sm:px-6 lg:left-[13.5rem]">
          <div className="pointer-events-auto mx-auto w-full max-w-[48rem]">
            <ManagerWorkspaceActions
              actions={activeWorkspaceActions}
              onOpen={openWorkspaceAction}
              disabled={sendPending}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
