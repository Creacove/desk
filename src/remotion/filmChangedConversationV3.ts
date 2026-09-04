import type { ConversationViewModel } from "../types/cleanProduction";
import { odaeshiConversation } from "./filmFixturesV3";

export const odaeshiChangedConversation: ConversationViewModel = {
  ...odaeshiConversation,
  id: "conversation-odaeshi-changed",
  messages: [
    ...odaeshiConversation.messages,
    {
      id: "msg-artist-change",
      speaker: "artist",
      label: "You",
      body: "I can’t shoot today. Move it to Sunday.",
      status: "sent",
    },
    {
      id: "msg-manager-adapt",
      speaker: "manager",
      label: "Desk",
      body: "Moved. I kept the press work running, shifted the content dependency, and Sunday is now the next human date. You don’t need to rebuild the plan.",
      status: "sent",
    },
  ],
};
