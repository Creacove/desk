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

function document(materialType: string): SongMaterialViewModel {
  return {
    id: `document-${materialType}`,
    kind: "document",
    group: "Documents",
    materialType: materialType as Extract<SongMaterialViewModel, { kind: "document" }>["materialType"],
    title: materialType,
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

  it("reveals Campaign for a released song after Manager is linked", () => {
    expect(deriveSongCampaignState(song({ managerConversationId: "conversation-1" }), [])).toEqual(expect.objectContaining({
      visible: true,
      phase: "post_release",
      managerStarted: true,
    }));
  });

  it("reveals Campaign for an unreleased song with active release work", () => {
    const state = deriveSongCampaignState(song({ lifecycle: "Ready", lifecycleStage: "ready" }), [mission()]);
    expect(state.visible).toBe(true);
    expect(state.phase).toBe("pre_release");
    expect(state.mission?.id).toBe("mission-1");
  });

  it("reveals Campaign when a durable campaign document exists", () => {
    const state = deriveSongCampaignState(song({ materials: [document("epk")] }), []);
    expect(state.visible).toBe(true);
    expect(state.documents).toHaveLength(1);
    expect(state.nextMove).toBe("continue_campaign");
  });

  it("does not reveal Campaign for ordinary song documents alone", () => {
    const state = deriveSongCampaignState(song({ materials: [document("lyrics"), document("credits")] }), []);
    expect(state.visible).toBe(false);
    expect(state.documents).toEqual([]);
  });

  it("prefers active work over a completed mission", () => {
    const completed = mission({ id: "mission-complete", status: "complete" });
    const active = mission({ id: "mission-active", status: "active" });
    expect(deriveSongCampaignState(song(), [completed, active]).mission?.id).toBe("mission-active");
  });
});
