import { describe, expect, it } from "vitest";
import { buildManagerConversationModelContext } from "../supabase/functions/_shared/manager-conversation/context";

describe("Manager approved release decision integrity", () => {
  it("does not expose provider metadata as the current approved release date", () => {
    const result = openingBrief({
      focusedMusicSubject: {
        type: "music_item",
        id: "11111111-1111-4111-8111-111111111111",
        title: "Odaeshi",
        metadata: {
          planned_release_date: "2026-09-05",
          release_date: "2026-09-05",
        },
      },
    });

    expect(result.focusedMusicSubject.plannedReleaseDate).toBe("");
    expect(result.focusedMusicSubject.providerReleaseDate).toBe("2026-09-05");
    expect(result.focusedMusicSubject.releaseTiming).toMatchObject({
      effectiveReleaseDate: "",
      providerReleaseDate: "2026-09-05",
      provenance: "provider_metadata_only",
      canonicalOperationalStateLoaded: false,
    });
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
    expect(result.focusedMusicSubject.releaseTiming).toMatchObject({
      effectiveReleaseDate: "2026-09-26",
      approvedReleaseDate: "2026-09-26",
      providerReleaseDate: "2026-09-05",
      provenance: "approved_release_plan",
      releasePlanRevision: 3,
      canonicalOperationalStateLoaded: true,
    });
  });

  it("labels catalog dates as provider dates instead of silently calling them current plans", () => {
    const result = openingBrief({
      music: {
        items: [{
          id: "11111111-1111-4111-8111-111111111111",
          title: "Odaeshi",
          item_type: "single",
          planned_release_date: "2026-09-05",
        }],
      },
    });

    expect(result.music.items[0]).toMatchObject({
      title: "Odaeshi",
      providerReleaseDate: "2026-09-05",
    });
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
