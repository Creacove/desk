import { describe, expect, it } from "vitest";

import { buildSplitRecord, deriveSongRightsState } from "./features/music/songRights";
import type { MusicObjectViewModel } from "./types/cleanProduction";

function song(overrides: Partial<MusicObjectViewModel> = {}): MusicObjectViewModel {
  return {
    id: "song-1",
    kind: "song",
    title: "North Star",
    lifecycle: "unreleased",
    lifecycleStage: "mastering",
    blocker: "None",
    sourceLimit: "Private song data",
    managerReadStatus: "not_generated",
    linkedMissionIds: [],
    linkedTaskCount: 0,
    ...overrides,
  };
}

describe("song rights state", () => {
  it("separates 100% allocations from collaborator confirmation progress", () => {
    const state = deriveSongRightsState(song({
      splits: {
        status: "partially_confirmed",
        summary: "Waiting for one collaborator.",
        publishingTotal: "100%",
        masterTotal: "100%",
        contributors: [
          { id: "a", name: "David", role: "Artist / writer", email: "d@example.com", publishingShare: "50%", masterShare: "50%", approval: "Pending" },
          { id: "b", name: "Mureni", role: "Artist / writer", email: "m@example.com", publishingShare: "50%", masterShare: "50%", approval: "Confirmed" },
        ],
      },
    }));

    expect(state).toMatchObject({
      state: "partially_confirmed",
      publishingAllocated: 100,
      masterAllocated: 100,
      confirmedCount: 1,
      contributorCount: 2,
      headline: "1 of 2 collaborators confirmed",
    });
  });

  it.each([
    ["missing", "not_managed"],
    ["draft", "draft"],
    ["ready", "ready"],
    ["pending_confirmation", "awaiting"],
    ["partially_confirmed", "partially_confirmed"],
    ["disputed", "disputed"],
    ["cleared", "confirmed"],
  ] as const)("maps %s to %s", (status, expected) => {
    const state = deriveSongRightsState(song({
      splits: { status, summary: "", contributors: [] },
    }));
    expect(state.state).toBe(expected);
  });

  it("treats an uploaded split sheet as an external document, not verified rights", () => {
    const state = deriveSongRightsState(song({
      sourceKind: "spotify_public_catalog",
      lifecycleStage: "released",
      fileAssets: [{ assetId: "split-file", group: "Documents", label: "Signed split sheet.pdf", status: "Uploaded", action: "Open", assetType: "split_sheet" }],
    }));
    expect(state).toMatchObject({ state: "document_on_file", externalRecordId: "split-file" });
    expect(state.description).toContain("not independently verified");
  });

  it("exports a portable record without claiming qualified legal execution", () => {
    const record = buildSplitRecord(song({
      splits: {
        status: "cleared",
        summary: "All confirmed",
        contributors: [{ id: "a", name: "Mara", role: "Producer / writer", publishingShare: "40%", masterShare: "30%", approval: "Confirmed" }],
      },
    }), "2026-08-09T12:00:00.000Z");
    expect(record).toContain("North Star");
    expect(record).toContain("Mara");
    expect(record).toContain("Publishing: 40%");
    expect(record).toContain("not legal advice or a qualified electronic-signature certificate");
  });
});
