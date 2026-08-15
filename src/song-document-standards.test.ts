import { describe, expect, it } from "vitest";

import {
  assessStructuredSongDocument,
  documentStandardSummary,
  renderStructuredSongDocument,
  type StructuredSongDocument,
} from "../supabase/functions/_shared/songDocumentStandards";

function section(key: string, title: string, words = 36) {
  return {
    key,
    title,
    content: Array.from({ length: words }, (_, index) => `${key}${index + 1}`).join(" "),
    evidenceRefs: [`workspace:${key}`],
  };
}

function releaseNarrative(): StructuredSongDocument {
  return {
    purpose: "Establish one specific strategic story for every asset and outreach decision in this release campaign.",
    audience: "The artist team and Manager preparing the release.",
    coreNarrative: "Down Below turns a private late-night tension into a controlled Afro-R&B release story built around intimacy, restraint and the audience already responding to the record.",
    sections: [
      section("positioning", "Positioning"),
      section("story", "Release story"),
      section("audience", "Audience"),
      section("campaign_thesis", "Campaign thesis"),
      section("proof", "Proof and signals"),
      section("creative_world", "Creative world"),
      section("language_guardrails", "Language guardrails"),
    ],
    claims: [{
      text: "The current audience response is strongest around the song's late-night positioning.",
      basis: "workspace",
      sourceRef: "workspace:manager-read",
      confidence: "medium",
    }],
    missingInputs: [],
  };
}

describe("premium song document standards", () => {
  it("accepts a complete release narrative with one campaign spine", () => {
    const quality = assessStructuredSongDocument("release_narrative", releaseNarrative());

    expect(quality.blockers).toEqual([]);
    expect(quality.score).toBeGreaterThanOrEqual(82);
    expect(quality.readiness).toBe("ready");
    expect(quality.requiredSections).toContain("campaign_thesis");
  });

  it("rejects an EPK that is only generic prose with missing required sections", () => {
    const weak: StructuredSongDocument = {
      purpose: "Promote music.",
      audience: "Press.",
      coreNarrative: "A rising star with a unique sound is making waves and is poised to take the world by storm.",
      sections: [section("artist_snapshot", "Artist snapshot", 6)],
      claims: [],
      missingInputs: [],
    };

    const quality = assessStructuredSongDocument("epk", weak);
    expect(quality.readiness).toBe("needs_review");
    expect(quality.blockers.length).toBeGreaterThan(0);
    expect(quality.warnings.join(" ")).toMatch(/generic music-marketing language/i);
  });

  it("never permits placeholders to masquerade as a finished press release", () => {
    const standard = documentStandardSummary("press_release");
    const structure: StructuredSongDocument = {
      purpose: "Give music editors a factual release announcement they can understand and use quickly.",
      audience: "Music editors and culture writers.",
      coreNarrative: "A focused release story grounded in the song's verified context, the artist's own quote and the campaign's current evidence.",
      sections: standard.requiredSections.map(({ key, title }) => section(key, title, 44)),
      claims: [],
      missingInputs: [],
    };
    structure.sections[0].content = "TBD headline for the release once someone fills this in later.";

    const quality = assessStructuredSongDocument("press_release", structure);
    expect(quality.blockers.join(" ")).toMatch(/Remove placeholders/i);
  });

  it("renders the structured artifact into readable canonical markdown", () => {
    const body = renderStructuredSongDocument("release_narrative", "Release narrative", releaseNarrative());

    expect(body).toContain("# Release narrative");
    expect(body).toContain("Internal campaign strategy");
    expect(body).toContain("**Core narrative:**");
    expect(body).toContain("## Campaign thesis");
    expect(body).not.toContain("sourceRef");
  });
});
