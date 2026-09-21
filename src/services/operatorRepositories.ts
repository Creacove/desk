import type { CleanProductionRepositories, MusicRepository } from "../types/cleanProduction";

export const OPERATOR_WRITE_BLOCKED = "Operator Desk access is read-only.";

function blocked<T extends (...args: any[]) => any>(): T {
  return (async () => {
    throw new Error(OPERATOR_WRITE_BLOCKED);
  }) as T;
}

/** Keep one explicit read-only seam instead of relying on UI controls alone. */
export function createOperatorReadOnlyRepositories(base: CleanProductionRepositories): CleanProductionRepositories {
  const music: MusicRepository = {
    ...base.music,
    startManagerRead: undefined,
    searchSpotifyCatalog: undefined,
    importSpotifySelection: undefined,
    createSong: undefined,
    createSongWorkspace: undefined,
    createProject: undefined,
    updateLifecycleStage: blocked(),
    saveDetail: blocked(),
    saveCredit: blocked(),
    createSongDocument: undefined,
    updateSongDocument: undefined,
    approveSongDocument: blocked(),
    saveIdentifier: blocked(),
    saveSplitContributor: blocked(),
    removeSplitContributor: blocked(),
    sendSplitConfirmationLinks: blocked(),
    submitSplitConfirmation: blocked(),
    uploadAsset: undefined,
    createShareLink: undefined,
    sendShareLink: undefined,
    revokeShareLink: undefined,
  };

  return {
    desk: {
      ...base.desk,
      generateTodaysBrief: undefined,
      refreshPublicContext: undefined,
    },
    staff: base.staff,
    music,
    manager: {
      ...base.manager,
      uploadKnowledge: undefined,
      revokeKnowledge: undefined,
      sendMessage: undefined,
      sendMessageStream: undefined,
      proposeReleaseDateChange: undefined,
      approveReleaseDateChange: undefined,
    },
    missions: {
      ...base.missions,
      approveTask: blocked(),
      uploadTaskDeliverable: undefined,
      completeTask: blocked(),
    },
    missionGenesis: {
      ...base.missionGenesis,
      runMissionGenesis: blocked(),
      answerMissionGenesisContext: undefined,
    },
    artistProfile: base.artistProfile,
    evidence: base.evidence,
  };
}
