import { describe, expect, it } from "vitest";
import { buildManagerConversationModelContext } from "../supabase/functions/_shared/manager-conversation/context";

describe("Manager approved release decision integrity", () => {
  it("does not expose provider metadata as the current approved release date", () => {
    const result = openingBrief({
      focusedMusicSubject: {
        type: "music_item",
        id: "11111111-1111-4111-8111-111111111111",
        title: "Odaeshi",
        metadata: { planned_release_date: "2026-09-05", release_date: "2026-09-05" },
      },
    });
    expect(result.focusedMusicSubject.plannedReleaseDate).toBe("");
    expect(result.focusedMusicSubject.providerReleaseDate).toBe("2026-09-05");
    expect(result.focusedMusicSubject.releaseTiming).toMatchObject({ effectiveReleaseDate: "", providerReleaseDate: "2026-09-05", provenance: "provider_metadata_only", canonicalOperationalStateLoaded: false });
    expect(result.truthPriority.join(" ")).toContain("approved operational release plan is canonical");
    expect(result.truthPriority.join(" ")).toContain("read the focused Release Success state");
  });

  it("uses an approved operational release plan ahead of the provider date", () => {
    const result = openingBrief({
      focusedMusicSubject: {
        type: "music_item",
        id: "11111111-1111-4111-8111-111111111111",
        title: "Odaeshi",
        metadata: { planned_release_date: "2026-09-05" },
        releasePlan: {
          effectiveReleaseDate: "2026-09-26",
          approvedReleaseDate: "2026-09-26",
          providerReleaseDate: "2026-09-05",
          provenance: "approved_release_plan",
          releasePlanId: "22222222-2222-4222-8222-222222222222",
          releasePlanStatus: "approved",
          releasePlanRevision: 3,
          missionId: "33333333-3333-4333-8333-333333333333",
        },
      },
    });
    expect(result.focusedMusicSubject.plannedReleaseDate).toBe("2026-09-26");
    expect(result.focusedMusicSubject.providerReleaseDate).toBe("2026-09-05");
    expect(result.focusedMusicSubject.releaseTiming).toMatchObject({ effectiveReleaseDate: "2026-09-26", approvedReleaseDate: "2026-09-26", providerReleaseDate: "2026-09-05", provenance: "approved_release_plan", releasePlanRevision: 3, canonicalOperationalStateLoaded: true });
  });

  it("carries the approved date into an ordinary what-next turn through the canonical projection", () => {
    const result = openingBrief({
      focusedMusicSubject: {
        type: "music_item", id: "11111111-1111-4111-8111-111111111111", title: "Odaeshi", metadata: { planned_release_date: "2026-09-05" },
      },
      memory: [{
        id: "44444444-4444-4444-8444-444444444444", scope: "music_item", kind: "fact", source_type: "canonical_release_plan", confidence: "high",
        content: JSON.stringify({ projectionVersion: "canonical_release_plan_v1", musicItemId: "11111111-1111-4111-8111-111111111111", missionId: "33333333-3333-4333-8333-333333333333", releasePlanId: "22222222-2222-4222-8222-222222222222", releasePlanStatus: "approved", releasePlanRevision: 3, approvedReleaseDate: "2026-09-26", effectiveReleaseDate: "2026-09-26", provenance: "approved_release_plan" }),
      }],
    });
    expect(result.focusedMusicSubject.plannedReleaseDate).toBe("2026-09-26");
    expect(result.focusedMusicSubject.providerReleaseDate).toBe("2026-09-05");
    expect(result.focusedMusicSubject.releaseTiming).toMatchObject({ effectiveReleaseDate: "2026-09-26", approvedReleaseDate: "2026-09-26", provenance: "approved_release_plan", releasePlanRevision: 3, canonicalOperationalStateLoaded: true });
    expect(result.durableMemory).toEqual([]);
    expect(result.truthPriority.join(" ")).toContain("not as a suggestion");
  });

  it("ignores a canonical projection for a different song", () => {
    const result = openingBrief({
      focusedMusicSubject: { type: "music_item", id: "11111111-1111-4111-8111-111111111111", title: "Odaeshi", metadata: { planned_release_date: "2026-09-05" } },
      memory: [{ id: "44444444-4444-4444-8444-444444444444", scope: "music_item", kind: "fact", source_type: "canonical_release_plan", confidence: "high", content: JSON.stringify({ projectionVersion: "canonical_release_plan_v1", musicItemId: "99999999-9999-4999-8999-999999999999", effectiveReleaseDate: "2026-10-03", approvedReleaseDate: "2026-10-03", provenance: "approved_release_plan" }) }],
    });
    expect(result.focusedMusicSubject.plannedReleaseDate).toBe("");
    expect(result.focusedMusicSubject.providerReleaseDate).toBe("2026-09-05");
    expect(result.focusedMusicSubject.releaseTiming.canonicalOperationalStateLoaded).toBe(false);
  });

  it("labels catalog dates as provider dates instead of silently calling them current plans", () => {
    const result = openingBrief({ music: { items: [{ id: "11111111-1111-4111-8111-111111111111", title: "Odaeshi", item_type: "single", planned_release_date: "2026-09-05" }] } });
    expect(result.music.items[0]).toMatchObject({ title: "Odaeshi", providerReleaseDate: "2026-09-05" });
    expect(result.music.items[0]).not.toHaveProperty("plannedReleaseDate");
  });
});

function openingBrief(packet: Record<string, unknown>) {
  const result = buildManagerConversationModelContext({
    accountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    artistWorkspaceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    artistId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    body: "What should we do next?",
  }, packet, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  return (result as { openingBrief: any }).openingBrief;
}
