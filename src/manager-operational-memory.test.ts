import { describe, expect, it } from "vitest";
import { qualifyManagerMemoryCandidates } from "../supabase/functions/_shared/manager-conversation/memory";

describe("Manager operational memory", () => {
  it("remembers resources that change future execution", () => {
    const result = qualifyManagerMemoryCandidates([
      "The artist has access to a friend's car for content shoots.",
    ], []);

    expect(result[0]).toMatchObject({ kind: "fact", category: "operational_fact", scope: "artist" });
  });

  it("remembers blockers and execution outcomes rather than leaving them in chat history", () => {
    const result = qualifyManagerMemoryCandidates([
      "Daniel is unavailable and the shoot is blocked until Sunday.",
      "The personal resilience video outperformed the performance clip on shares.",
    ], [], { missionId: "mission-odaeshi" });

    expect(result.map((item) => item.kind)).toEqual(["blocker", "outcome_note"]);
    expect(result.every((item) => item.scope === "mission")).toBe(true);
  });
});
