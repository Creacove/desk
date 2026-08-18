import { describe, expect, it } from "vitest";
import { parseManagerWorkspaceAction } from "./ManagerComposer";
import { assessReleaseSuccess } from "../../../supabase/functions/_shared/release-success/readiness";
import type { ReleaseSuccessPacket } from "../../../supabase/functions/_shared/release-success/types";
import { deriveSongRightsState } from "../music/songRights";
import type { MusicObjectViewModel } from "../../types/cleanProduction";

function packet(overrides: Partial<ReleaseSuccessPacket> = {}): ReleaseSuccessPacket {
  return {
    musicItemId: "song-1",
    releasePlanRevision: 0,
    lifecycleStage: "production",
    plannedReleaseDate: null,
    releasedAt: null,
    assets: {},
    metadata: { state: "missing", source: "test" },
    credits: { state: "missing", source: "test" },
    splits: { state: "missing", source: "test" },
    clearances: { state: "missing", source: "test" },
    identifiers: { state: "missing", source: "test" },
    distributor: { state: "missing", source: "test" },
    campaign: {},
    campaignFacts: {},
    ...overrides,
  };
}

describe("Manager Song System V2 policy", () => {
  it("does not block a production-stage song for ISRC, artwork, release date, or distributor delivery", () => {
    const assessment = assessReleaseSuccess(packet());
    const byKey = Object.fromEntries(assessment.foundation.gates.map((gate) => [gate.key, gate]));
    expect(byKey.identifiers.state).toBe("not_applicable");
    expect(byKey.artwork.state).toBe("not_applicable");
    expect(byKey.operational_release_date.state).toBe("not_applicable");
    expect(byKey.distributor_delivery.state).toBe("not_applicable");
  });

  it("treats an uploaded designated master as present rather than at risk", () => {
    const assessment = assessReleaseSuccess(packet({
      lifecycleStage: "ready",
      plannedReleaseDate: "2026-09-18",
      assets: { finalMaster: { state: "uploaded", source: "music_assets" }, artwork: { state: "uploaded", source: "music_assets" } },
      metadata: { state: "confirmed", source: "music_items" },
      credits: { state: "confirmed", source: "music_credits" },
      splits: { state: "confirmed", source: "music_splits" },
      clearances: { state: "confirmed", source: "music_items" },
    }));
    const master = assessment.foundation.gates.find((gate) => gate.key === "final_master");
    expect(master?.state).toBe("confirmed");
  });

  it("uses the canonical song date when a separate operational plan date is absent", () => {
    const assessment = assessReleaseSuccess(packet({
      lifecycleStage: "ready",
      plannedReleaseDate: "2026-09-18",
      approvedReleaseDate: null,
    }));
    const dateGate = assessment.foundation.gates.find((gate) => gate.key === "operational_release_date");
    expect(dateGate?.state).toBe("confirmed");
    expect(dateGate?.evidence[0]?.source).toBe("music_items");
  });

  it("keeps historical workspace-action questions distinguishable from genuine questions", () => {
    const action = parseManagerWorkspaceAction({
      key: "workspace_action:rights:review_splits",
      question: "One split still needs confirmation.",
      answerKind: "single_select",
      options: [],
      recommendedAnswer: "Review rights",
      reason: "Confirm the ownership allocation before delivery.",
    } as any);
    expect(action).toMatchObject({ target: "rights", action: "review_splits", actionLabel: "Review rights" });
  });

  it("does not count a zero-share technical credit as an ownership participant", () => {
    const song = {
      title: "Dance",
      splits: {
        status: "draft",
        contributors: [
          { name: "Bola", role: "Mixing engineer", publishingShare: "0%", masterShare: "0%", approval: "draft" },
          { name: "Tobi", role: "Songwriter", publishingShare: "100%", masterShare: "100%", approval: "confirmed" },
        ],
      },
      fileAssets: [],
    } as unknown as MusicObjectViewModel;
    const rights = deriveSongRightsState(song);
    expect(rights.contributorCount).toBe(2);
    expect(rights.rightsParticipantCount).toBe(1);
    expect(rights.confirmedCount).toBe(1);
    expect(rights.state).toBe("ready");
  });
});
