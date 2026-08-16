import { describe, expect, it } from "vitest";

import {
  assessStructuredSongDocument,
  documentStandardSummary,
  renderStructuredSongDocument,
  type StructuredSongDocument,
} from "../supabase/functions/_shared/songDocumentStandards";

function section(key: string, title: string, content?: string) {
  return {
    key,
    title,
    content: content ?? `${title} grounded in specific verified artist and release facts rather than generic campaign language.`,
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

function complete(documentType: Parameters<typeof documentStandardSummary>[0]): StructuredSongDocument {
  const standard = documentStandardSummary(documentType);
  return {
    purpose: "Internal grounding note that should never appear in the recipient-facing artifact.",
    audience: "Internal intended-recipient metadata that should never appear in public copy.",
    coreNarrative: "Internal campaign spine retained for consistency but never serialized into a recipient-facing artifact.",
    sections: standard.requiredSections.map(({ key, title }) => section(key, title)),
    claims: [{
      text: "Public artist context was checked before drafting.",
      basis: "public_source",
      sourceRef: "https://example.com/artist-source",
      confidence: "medium",
    }],
    missingInputs: [],
  };
}

describe("label-grade song document standards", () => {
  it("keeps the release narrative as an explicitly internal campaign spine", () => {
    const quality = assessStructuredSongDocument("release_narrative", releaseNarrative());
    const body = renderStructuredSongDocument("release_narrative", "Release narrative", releaseNarrative());

    expect(quality.blockers).toEqual([]);
    expect(quality.readiness).toBe("ready");
    expect(body).toContain("Internal campaign strategy");
    expect(body).toContain("**Core narrative:**");
    expect(body).toContain("## Campaign thesis");
  });

  it("never serializes Desk planning or verification metadata into recipient-facing documents", () => {
    const structure = complete("epk");
    structure.missingInputs = ["Approved press contact", "High-resolution press photo"];
    const body = renderStructuredSongDocument("epk", "Artist EPK", structure);

    expect(body).toContain("# Artist EPK");
    expect(body).toContain("## Artist");
    expect(body).not.toMatch(/Purpose:/i);
    expect(body).not.toMatch(/Audience:/i);
    expect(body).not.toMatch(/Core narrative:/i);
    expect(body).not.toMatch(/Needs verification/i);
    expect(body).not.toMatch(/Approved press contact/i);
    expect(body).not.toMatch(/High-resolution press photo/i);
  });

  it("uses newsroom form for a press release instead of generic report headings", () => {
    const structure = complete("press_release");
    structure.sections = [
      section("headline", "Headline", "Artist Announces New Single ‘Night Drive’"),
      section("dek", "Subheadline", "The new single arrives September 4 across streaming platforms."),
      section("dateline_lede", "Dateline and lead", "LAGOS, Nigeria — Artist will release ‘Night Drive’ on September 4, pairing a restrained vocal with late-night Afropop production."),
      section("body", "Body", "The release follows a focused run of new music and extends the artist's current creative direction."),
      section("release_details", "Release details", "‘Night Drive’ will be available on major streaming services from September 4."),
      section("about_artist", "About the artist", "Artist is a Nigerian recording artist working across Afropop and R&B."),
      section("press_contact", "Media contact", "press@example.com"),
    ];
    const body = renderStructuredSongDocument("press_release", "Night Drive press release", structure);

    expect(body).toMatch(/^# Artist Announces New Single/);
    expect(body).toContain("_The new single arrives");
    expect(body).toContain("## About the artist");
    expect(body).toContain("## Media contact");
    expect(body).not.toContain("## Headline");
    expect(body).not.toContain("Purpose:");
  });

  it("rejects placeholders instead of exporting them", () => {
    const structure = complete("press_release");
    structure.sections[0].content = "TBD headline for the release once someone fills this in later.";

    const quality = assessStructuredSongDocument("press_release", structure);
    expect(quality.blockers.join(" ")).toMatch(/Remove placeholders/i);
  });

  it("rejects Desk operational state inside an artist biography", () => {
    const structure = complete("artist_biography");
    structure.sections = [
      section("short_bio", "Short biography", "Victony is preparing Dance in the current workspace while its ISRC and distributor evidence remain unresolved."),
      section("full_bio", "Full biography", "Victony is a recording artist whose release metadata and delivery confirmation are still being prepared in the workspace."),
    ];

    const quality = assessStructuredSongDocument("artist_biography", structure);
    expect(quality.blockers.join(" ")).toMatch(/Artist biography must describe the artist/i);
  });

  it("defines credits as a credit sheet and distributor notes as a delivery sheet", () => {
    const credits = documentStandardSummary("credits");
    const delivery = documentStandardSummary("distributor_notes");

    expect(credits.label).toBe("Credit sheet");
    expect(credits.presentation).toBe("table");
    expect(credits.requiredSections.map((item) => item.key)).toEqual(expect.arrayContaining([
      "songwriting_publishing",
      "production_engineering",
      "performers",
      "recording_details",
      "identifiers",
    ]));
    expect(delivery.label).toBe("Distribution delivery sheet");
    expect(delivery.requiredSections.map((item) => item.key)).toEqual(expect.arrayContaining([
      "release_metadata",
      "track_metadata",
      "rights_credits",
      "assets",
      "delivery",
    ]));
  });

  it("requires current public research for audience-facing campaign documents", () => {
    expect(documentStandardSummary("epk").requiresPublicResearch).toBe(true);
    expect(documentStandardSummary("artist_biography").requiresPublicResearch).toBe(true);
    expect(documentStandardSummary("one_sheet").requiresPublicResearch).toBe(true);
    expect(documentStandardSummary("press_release").requiresPublicResearch).toBe(true);
    expect(documentStandardSummary("spotify_editorial_pitch").requiresPublicResearch).toBe(true);
    expect(documentStandardSummary("content_plan").requiresPublicResearch).toBe(true);
    expect(documentStandardSummary("credits").requiresPublicResearch).toBe(false);
  });
});
