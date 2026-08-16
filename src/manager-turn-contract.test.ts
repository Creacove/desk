import { describe, expect, it } from "vitest";
import {
  buildManagerTurnPresentation,
  enforceExplicitDecisionPackagePolicy,
  explicitlyRequestsDecisionPackage,
  reconcileManagerCreatedWork,
} from "../supabase/functions/_shared/manager-conversation/turnContract";
import { prepareManagerConversationForPresentation } from "./features/manager/ManagerScreens";
import type { ConversationViewModel } from "./types/cleanProduction";

function baseConversation(): ConversationViewModel {
  return {
    id: "conversation-1",
    topic: "Release work",
    status: "Manager responded",
    summary: "summary",
    prompt: "",
    musicSubject: { type: "music_item", id: "song-1", title: "Song", lifecycleStage: "released" },
    createdWork: [],
    messages: [],
  };
}

describe("Manager turn contract", () => {
  it("never creates a decision package just because the user asked for a durable artifact", () => {
    const output = { actionPolicy: "create_decision_package", responseBody: "EPK ready" };
    enforceExplicitDecisionPackagePolicy(output, { body: "Create an EPK for this song" });
    expect(output.actionPolicy).toBe("answer_only");
    expect(explicitlyRequestsDecisionPackage({ body: "Create a decision package for this release date call" })).toBe(true);
    expect(explicitlyRequestsDecisionPackage({ body: "Prepare a press package and EPK" })).toBe(false);
  });

  it("hides internal support and compatibility receipts and dedupes canonical documents", () => {
    const work = reconcileManagerCreatedWork([
      { type: "music_item", id: "narrative-1", musicItemId: "song-1", artifactKind: "song_document", documentType: "release_narrative", title: "Release narrative", presentationRole: "internal_support", visibility: "internal" },
      { type: "music_item", id: "epk-1", musicItemId: "song-1", artifactKind: "song_document", documentType: "epk", title: "Song EPK", presentationRole: "deliverable", visibility: "user" },
      { type: "music_item", id: "song-1", title: "Song EPK", presentationRole: "compatibility", visibility: "user" },
      { type: "music_item", id: "epk-1", musicItemId: "song-1", artifactKind: "song_document", documentType: "epk", title: "Song EPK", presentationRole: "deliverable", visibility: "user" },
    ]);
    expect(work).toHaveLength(1);
    expect(work[0]?.id).toBe("epk-1");
  });

  it("derives specialized UI surfaces from completed tools, not chat wording", () => {
    const presentation = buildManagerTurnPresentation({
      createdWork: [],
      toolNames: ["query_focused_release_opportunities", "save_focused_release_opportunities"],
    });
    expect(presentation.surfaces).toEqual(["release_opportunities"]);
  });

  it("uses structured surfaces as authoritative even when the artist wording does not match frontend regexes", () => {
    const conversation = baseConversation();
    conversation.releaseOpportunityArtifacts = [{
      id: "opportunity-set",
      musicItemId: "song-1",
      subjectTitle: "Song",
      opportunityType: "playlist",
      state: "ready",
      targets: [],
    } as any];
    conversation.messages = [
      { id: "u1", speaker: "artist", label: "You", body: "What can we do now to get more ears on this?" },
      { id: "m1", speaker: "manager", label: "Manager", body: "I found a shortlist.", presentation: { version: 1, surfaces: ["release_opportunities"], visibleArtifactIds: [] } },
    ];
    expect(prepareManagerConversationForPresentation(conversation).releaseOpportunityArtifacts).toHaveLength(1);
  });

  it("does not attach stale conversation-wide decision packages to a newer non-package turn", () => {
    const conversation = baseConversation();
    conversation.decisionPackage = {
      id: "old-package",
      title: "Old decision",
      summary: "old",
      recommendation: "old",
      confidence: "high",
      actionPolicy: "create_decision_package",
      evidenceIds: [],
      limitations: [],
      createdWork: [],
      proposedActions: [],
    };
    conversation.messages = [
      { id: "u1", speaker: "artist", label: "You", body: "Create the press release" },
      { id: "m1", speaker: "manager", label: "Manager", body: "Press release ready.", presentation: { version: 1, surfaces: [], visibleArtifactIds: ["press-1"] }, createdWork: [
        { type: "music_item", id: "press-1", musicItemId: "song-1", artifactKind: "song_document", documentType: "press_release", title: "Song press release", body: "Draft saved", presentationRole: "deliverable", visibility: "user" },
        { type: "music_item", id: "internal-1", musicItemId: "song-1", artifactKind: "song_document", documentType: "release_narrative", title: "Release narrative", body: "internal", presentationRole: "internal_support", visibility: "internal" },
      ] },
    ];
    const projected = prepareManagerConversationForPresentation(conversation);
    expect(projected.decisionPackage).toBeUndefined();
    expect(projected.messages[1]?.createdWork).toHaveLength(1);
    expect(projected.messages[1]?.createdWork?.[0]?.id).toBe("press-1");
  });

  it("shows a decision package only when the server bound that package to the turn", () => {
    const conversation = baseConversation();
    conversation.decisionPackage = {
      id: "package-1",
      title: "Release strategy decision",
      summary: "basis",
      recommendation: "recommendation",
      confidence: "high",
      actionPolicy: "create_decision_package",
      evidenceIds: [],
      limitations: [],
      createdWork: [],
      proposedActions: [],
    };
    conversation.messages = [
      { id: "u1", speaker: "artist", label: "You", body: "Put your recommendation into something I can take to the team" },
      { id: "m1", speaker: "manager", label: "Manager", body: "Done.", presentation: { version: 1, surfaces: ["decision_package"], visibleArtifactIds: [], decisionPackageId: "package-1" } },
    ];
    expect(prepareManagerConversationForPresentation(conversation).decisionPackage?.id).toBe("package-1");
  });
});
