import { describe, expect, it } from "vitest";
import type { ConversationViewModel } from "../../types/cleanProduction";
import { prepareManagerConversationForPresentation } from "./ManagerScreens";

function conversation(overrides: Partial<ConversationViewModel> = {}): ConversationViewModel {
  return {
    id: "conversation-1",
    topic: "Tarara post-release direction",
    status: "Manager responded",
    summary: "Summary",
    prompt: "Create playlist pitches",
    musicSubject: { type: "music_item", id: "song-1", title: "Tarara", lifecycleStage: "released" },
    messages: [
      { id: "artist-1", speaker: "artist", label: "You", body: "Create playlist pitches for Everjamz and Afrobeats Central" },
      { id: "manager-1", speaker: "manager", label: "Manager", body: "I prepared the drafts.", createdWork: [] },
    ],
    createdWork: [],
    releaseSuccessArtifacts: [{
      id: "release-success-1",
      musicItemId: "song-1",
      state: "failed",
      subject: { title: "Tarara", itemType: "song" },
      error: { message: "Release review failed", retryable: true },
    }],
    releaseOpportunityArtifacts: [{
      id: "opportunity-1",
      musicItemId: "song-1",
      opportunityType: "playlist",
      state: "ready",
      title: "Playlist targets",
      summary: "Targets found",
      shortlist: [],
    }],
    decisionPackage: {
      id: "package-1",
      title: "Old package",
      summary: "Old decision package",
      recommendation: "Old recommendation",
      confidence: "medium",
      classification: "legacy",
      actionPolicy: "create_decision_package",
      evidenceIds: [],
      limitations: [],
      createdWork: [],
      proposedActions: [],
      contextQuestions: [],
    },
    ...overrides,
  };
}

describe("premium Manager artifact experience", () => {
  it("never leaks pre-release review or an old decision package into a released-song document turn", () => {
    const projected = prepareManagerConversationForPresentation(conversation());
    expect(projected.releaseSuccessArtifacts).toEqual([]);
    expect(projected.releaseOpportunityArtifacts).toEqual([]);
    expect(projected.decisionPackage).toBeUndefined();
  });

  it("shows opportunity work for playlist discovery but still suppresses released-song release review", () => {
    const source = conversation({
      messages: [
        { id: "artist-1", speaker: "artist", label: "You", body: "Find playlist opportunities for Tarara" },
        { id: "manager-1", speaker: "manager", label: "Manager", body: "I found targets." },
      ],
    });
    const projected = prepareManagerConversationForPresentation(source);
    expect(projected.releaseOpportunityArtifacts).toHaveLength(1);
    expect(projected.releaseSuccessArtifacts).toEqual([]);
  });

  it("never attaches historical conversation artifacts underneath a failed Manager turn", () => {
    const source = conversation({
      messages: [
        { id: "artist-1", speaker: "artist", label: "You", body: "Find playlist opportunities for Tarara" },
        {
          id: "manager-1",
          speaker: "manager",
          label: "Manager",
          body: "Manager is briefly busy. Please try again in a moment.",
          status: "failed",
        },
      ],
    });

    const projected = prepareManagerConversationForPresentation(source);
    expect(projected.releaseOpportunityArtifacts).toEqual([]);
    expect(projected.releaseSuccessArtifacts).toEqual([]);
    expect(projected.decisionPackage).toBeUndefined();
  });

  it("only exposes a decision package when the user explicitly asked for a decision package", () => {
    const source = conversation({
      messages: [
        { id: "artist-1", speaker: "artist", label: "You", body: "Create a decision package for this campaign" },
        { id: "manager-1", speaker: "manager", label: "Manager", body: "Prepared." },
      ],
    });
    expect(prepareManagerConversationForPresentation(source).decisionPackage?.id).toBe("package-1");
  });

  it("upgrades historical fake Song ready document receipts and hides internal Release narrative scaffolding", () => {
    const source = conversation({
      messages: [
        { id: "artist-1", speaker: "artist", label: "You", body: "Create playlist pitches" },
        {
          id: "manager-1",
          speaker: "manager",
          label: "Manager",
          body: "Prepared.",
          createdWork: [
            { type: "music_item", id: "song-1", title: "Release narrative", body: "Song Workspace created. Release document saved to Files." },
            { type: "music_item", id: "song-1", title: "Tarara — Everjamz playlist submission draft", body: "Song Workspace created. Release document saved to Files." },
          ],
        },
      ],
    });
    const work = prepareManagerConversationForPresentation(source).messages[1].createdWork ?? [];
    expect(work).toHaveLength(1);
    expect(work[0]).toMatchObject({
      artifactKind: "song_document",
      documentType: "playlist_pitch",
      musicItemId: "song-1",
    });
    expect(work[0].title).toContain("Everjamz");
  });
});
