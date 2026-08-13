import { describe, expect, it } from "vitest";
import { assessReleaseSuccess } from "../supabase/functions/_shared/release-success/readiness";
import type { ReleaseSuccessPacket } from "../supabase/functions/_shared/release-success/types";

const fact = (state: "confirmed" | "missing" | "pending" = "confirmed") => ({
  state,
  source: "test-fixture",
  observedAt: "2026-08-12T00:00:00.000Z",
});

const completePacket: ReleaseSuccessPacket = {
  musicItemId: "song-1",
  releasePlanId: "plan-1",
  releasePlanRevision: 2,
  lifecycleStage: "scheduled",
  approvedReleaseDate: "2026-09-09",
  today: "2026-08-01",
  assets: { finalMaster: fact(), artwork: fact() },
  metadata: fact(),
  credits: fact(),
  splits: fact(),
  clearances: fact(),
  identifiers: fact(),
  distributor: fact(),
  campaign: {
    spotifyEditorialEnabled: true,
    independentPlaylistsEnabled: true,
    pressEnabled: true,
    contentEnabled: true,
    postReleaseMeasurementEnabled: true,
  },
  campaignFacts: {
    spotifyEditorialPitch: fact(),
    independentPlaylistTargets: fact(),
    pressPackage: fact(),
    contentPlan: fact(),
    postReleaseMeasurement: fact(),
  },
};

describe("release success readiness", () => {
  it("confirms a complete upcoming release", () => {
    const result = assessReleaseSuccess(completePacket);
    expect(result.foundation.status).toBe("confirmed");
    expect(result.campaign.status).toBe("confirmed");
  });

  it("keeps missing evidence explicit and blocks pending rights", () => {
    const result = assessReleaseSuccess({
      ...completePacket,
      distributor: undefined,
      splits: fact("pending"),
    });
    expect(result.foundation.gates).toContainEqual(expect.objectContaining({ key: "distributor_delivery", state: "unknown" }));
    expect(result.foundation.gates).toContainEqual(expect.objectContaining({ key: "splits", state: "blocked" }));
  });

  it("marks strategy-disabled campaign work not applicable", () => {
    const result = assessReleaseSuccess({
      ...completePacket,
      campaign: { pressEnabled: false },
    });
    expect(result.campaign.gates).toContainEqual(expect.objectContaining({ key: "press_package", state: "not_applicable" }));
  });

  it("does not reopen pre-release gates for catalog music", () => {
    const result = assessReleaseSuccess({ ...completePacket, lifecycleStage: "catalog", releasedAt: "2026-08-01T00:00:00.000Z" });
    expect(result.foundation.gates).toEqual([]);
    expect(result.campaign.gates).toEqual([]);
  });

  it("recommends moving a materially underprepared release with fourteen days remaining", () => {
    const result = assessReleaseSuccess({
      ...completePacket,
      today: "2026-08-26",
      approvedReleaseDate: "2026-09-09",
      distributor: undefined,
      campaignFacts: { ...completePacket.campaignFacts, pressPackage: fact("missing") },
    });
    expect(result.recommendation.kind).toBe("move");
    expect(result.recommendation.proposedDate).toBe("2026-09-23");
  });

  it("includes evidence and next action on every active gate", () => {
    const result = assessReleaseSuccess(completePacket);
    for (const gate of [...result.foundation.gates, ...result.campaign.gates]) {
      if (gate.state === "not_applicable") continue;
      expect(gate.evidence).toBeDefined();
      expect(gate.freshness).toBeTruthy();
      expect(gate.limitation).toBeTruthy();
      expect(gate.nextAction).toBeTruthy();
    }
  });
});
