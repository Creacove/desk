import type { ComponentProps } from "react";
import { useMemo } from "react";
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

  const conversationalConversation = useMemo(() => ({
    ...conversation,
    messages: conversation.messages.map((message) => {
      if (!message.contextQuestions?.length) return message;
      const contextQuestions = message.contextQuestions.filter((question) => !parseManagerWorkspaceAction(question));
      if (contextQuestions.length === message.contextQuestions.length) return message;
      return {
        ...message,
        contextQuestions,
        contextRequestId: contextQuestions.length ? message.contextRequestId : undefined,
      };
    }),
  }), [conversation]);

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
