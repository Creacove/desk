import { describe, expect, it } from "vitest";

import { deriveSongCampaignState } from "./features/music/songCampaign";
import type { MissionViewModel, MusicObjectViewModel, SongMaterialViewModel } from "./types/cleanProduction";

function song(overrides: Partial<MusicObjectViewModel> = {}): MusicObjectViewModel {
  return {
    id: "song-1",
    kind: "song",
    title: "Down Below",
    lifecycle: "Catalog",
    lifecycleStage: "released",
    blocker: "None",
    sourceLimit: "Spotify catalog metadata only",
    managerReadStatus: "unknown",
    linkedMissionIds: [],
    linkedTaskCount: 0,
    ...overrides,
  };
}

function mission(overrides: Partial<MissionViewModel> = {}): MissionViewModel {
  return {
    id: "mission-1",
    title: "Release Down Below",
    status: "active",
    progress: 20,
    review: "",
    summary: "Prepare the campaign.",
    recommendation: "Build the release kit.",
    musicSubject: "Down Below",
    subjectType: "music_item",
    subjectId: "song-1",
    nextTask: "Build the release kit",
    ...overrides,
  };
}

function document(materialType: string, title = materialType): SongMaterialViewModel {
  return {
    id: `document-${materialType}-${title}`,
    kind: "document",
    group: "Documents",
    materialType: materialType as Extract<SongMaterialViewModel, { kind: "document" }>["materialType"],
    title,
    status: "draft",
    origin: "manager_generated",
    body: "Draft body",
  };
}

describe("deriveSongCampaignState", () => {
  it("keeps a fresh imported released song simple until campaign work starts", () => {
    expect(deriveSongCampaignState(song(), [])).toEqual(expect.objectContaining({
      visible: false,
      phase: "post_release",
      managerStarted: false,
      nextMove: "build_release_kit",
    }));
  });

  it("reveals Campaign for a released song after campaign-shaped Manager work is linked", () => {
    expect(deriveSongCampaignState(song({
      managerConversationId: "conversation-1",
      managerConversation: {
        id: "conversation-1",
        topic: "Push Down Below further",
        summary: "Research playlist and press opportunities for this record.",
        status: "active",
      },
    }), [])).toEqual(expect.objectContaining({
      visible: true,
      phase: "post_release",
      managerStarted: true,
    }));
  });

  it("does not reveal Campaign for unrelated Manager work", () => {
    const state = deriveSongCampaignState(song({
      managerConversationId: "conversation-rights",
      managerConversation: {
        id: "conversation-rights",
        topic: "Check the ISRC",
        summary: "Confirm the identifier and rights metadata for this song.",
        status: "active",
      },
    }), []);
    expect(state.visible).toBe(false);
    expect(state.managerStarted).toBe(false);
  });

  it("reveals Campaign for an unreleased song with active release work", () => {
    const state = deriveSongCampaignState(song({ lifecycle: "Ready", lifecycleStage: "ready" }), [mission()]);
    expect(state.visible).toBe(true);
    expect(state.phase).toBe("pre_release");
    expect(state.mission?.id).toBe("mission-1");
  });

  it("does not reveal Campaign for an unrelated linked mission", () => {
    const state = deriveSongCampaignState(song(), [mission({
      title: "Confirm song ownership",
      summary: "Resolve rights records.",
      recommendation: "Confirm contributor shares.",
      nextTask: "Check split sheet",
    })]);
    expect(state.visible).toBe(false);
    expect(state.mission).toBeUndefined();
  });

  it("keeps an isolated campaign artifact in build mode until the narrative spine exists", () => {
    const state = deriveSongCampaignState(song({ materials: [document("epk")] }), []);
    expect(state.visible).toBe(true);
    expect(state.documents).toHaveLength(1);
    expect(state.narrative).toBeUndefined();
    expect(state.nextMove).toBe("build_release_kit");
  });

  it("continues the campaign only after a release narrative and external artifact both exist", () => {
    const narrative = document("other", "Release narrative");
    const state = deriveSongCampaignState(song({ materials: [narrative, document("epk")] }), []);
    expect(state.narrative?.title).toBe("Release narrative");
    expect(state.documents).toHaveLength(1);
    expect(state.nextMove).toBe("continue_campaign");
  });

  it("does not reveal Campaign for ordinary song documents alone", () => {
    const state = deriveSongCampaignState(song({ materials: [document("lyrics"), document("credits")] }), []);
    expect(state.visible).toBe(false);
    expect(state.documents).toEqual([]);
  });

  it("prefers active campaign work over a completed campaign mission", () => {
    const completed = mission({ id: "mission-complete", status: "complete" });
    const active = mission({ id: "mission-active", status: "active" });
    expect(deriveSongCampaignState(song(), [completed, active]).mission?.id).toBe("mission-active");
  });
});
