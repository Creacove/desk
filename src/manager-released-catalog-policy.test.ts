import { describe, expect, it } from "vitest";
import {
  assertReleasedCatalogManagerPolicy,
  isReleasedCatalogSubject,
} from "../supabase/functions/_shared/managerReleasedCatalogPolicy";

function output(overrides: Record<string, unknown> = {}) {
  return {
    responseBody: "Use the release response to choose the next campaign move.",
    missionGraphDecisions: [],
    contextQuestions: [],
    ...overrides,
  } as never;
}

const released = { lifecycleStage: "released", releasedAt: "2026-03-18T00:00:00.000Z", sourceKind: "spotify" };

describe("released/catalog Manager admission policy", () => {
  it("recognizes provider catalog evidence as released state", () => {
    expect(isReleasedCatalogSubject(released)).toBe(true);
    expect(isReleasedCatalogSubject({ lifecycleStage: "catalogued" })).toBe(true);
    expect(isReleasedCatalogSubject({ lifecycleStage: "production", releasedAt: "" })).toBe(false);
  });

  it("rejects generic post-release asset collection work", () => {
    expect(() => assertReleasedCatalogManagerPolicy(output({
      missionGraphDecisions: [{
        tasks: [{
          title: "Add current working audio",
          purpose: "Upload the song audio and artwork so Desk can compare the released track.",
          steps: ["Open Files.", "Add the audio and artwork."],
          evidenceNeeded: ["Audio", "Artwork"],
          completionExpectation: "Files are uploaded.",
        }],
      }],
    }), released, "What should we do next?"))
      .toThrow(/released\/catalog policy/i);
  });

  it("rejects a generic Files interruption for a released song", () => {
    expect(() => assertReleasedCatalogManagerPolicy(output({
      contextQuestions: [{
        key: "workspace_action:files:add_assets",
        question: "Add the song audio and artwork",
        reason: "Desk needs the release package.",
        recommendedAnswer: "Open Files",
      }],
    }), released, "How do we push this song further?"))
      .toThrow(/released\/catalog policy/i);
  });

  it("allows an explicit artist-requested correction", () => {
    expect(() => assertReleasedCatalogManagerPolicy(output({
      contextQuestions: [{
        key: "workspace_action:files:replace_artwork",
        question: "Replace the incorrect artwork",
        reason: "You asked to correct the artwork saved for this release.",
        recommendedAnswer: "Open Files",
      }],
    }), released, "I need to replace the wrong artwork on this release."))
      .not.toThrow();
  });

  it("allows a named licensing dependency without treating it as release readiness", () => {
    expect(() => assertReleasedCatalogManagerPolicy(output({
      missionGraphDecisions: [{
        tasks: [{
          title: "Provide the clean master for the confirmed sync brief",
          purpose: "The named sync licensing delivery requires a clean master.",
          steps: ["Locate the clean master.", "Attach it to the confirmed sync delivery."],
          evidenceNeeded: ["Clean master"],
          completionExpectation: "The sync delivery has its required master.",
        }],
      }],
    }), released, "Prepare the song for this confirmed sync brief."))
      .not.toThrow();
  });
});
