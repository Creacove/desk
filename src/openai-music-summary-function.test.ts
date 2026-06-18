import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBannedVisibleMusicTerms, checkSourceLine, parseManagerReadOutput, stripBannedVisibleMusicTerms } from "../supabase/functions/_shared/openaiManagerRead";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "generate-music-summary", "index.ts"), "utf8");
const promptSource = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "openaiManagerRead.ts"), "utf8");

describe("OpenAI music Manager Read generation function", () => {
  it("authenticates the Supabase user and checks account membership before model calls", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("Authorization");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");

    const authIndex = functionSource.indexOf("auth.getUser()");
    const openAiIndex = functionSource.indexOf("callOpenAIManagerRead");
    expect(authIndex).toBeGreaterThan(-1);
    expect(openAiIndex).toBeGreaterThan(authIndex);
  });

  it("allows exact service-role invocations for controlled backfills", () => {
    expect(functionSource).toContain("isServiceRoleInvocation");
    expect(functionSource).toContain("X-Chartmetric-Backfill-Token");
    expect(functionSource).toContain('Deno.env.get("CHARTMETRIC_BACKFILL_TOKEN")');
    expect(functionSource).toContain('requireEnv("SUPABASE_SERVICE_ROLE_KEY")');
    expect(functionSource).toContain("if (!isServiceRoleInvocation)");
  });

  it("builds the read packet from saved Music and evidence records instead of client-supplied facts", () => {
    expect(functionSource).toContain('from("music_items")');
    expect(functionSource).toContain('from("music_projects")');
    expect(functionSource).toContain('from("music_project_items")');
    expect(functionSource).toContain('from("music_identifiers")');
    expect(functionSource).toContain('from("evidence_items")');
    expect(functionSource).toContain(".limit(150)");
    expect(functionSource).toContain("buildManagerReadPacket");
    expect(functionSource).toContain("loadArtistProfile");
    expect(functionSource).toContain("loadRelatedRecordContext");
    expect(functionSource).toContain("deriveRecordInsights");
    expect(functionSource).toContain("relatedRecords");
    expect(functionSource).toContain("derivedInsights");
    expect(functionSource).not.toContain("input.facts");
    expect(functionSource).not.toContain("input.evidence");
    expect(functionSource).not.toContain("input.managerRead");
  });

  it("uses Responses API structured output and persists the generated read with provenance", () => {
    expect(functionSource).toContain("/v1/responses");
    expect(functionSource).toContain("json_schema");
    expect(functionSource).toContain("manager_synthesis_runs");
    expect(functionSource).toContain("ai_run_usage_events");
    expect(functionSource).toContain('trigger_type: "evidence_triggered"');
    expect(functionSource).toContain('workflow_key: "music_readiness_run"');
    expect(functionSource).toContain('run_type: "manager_synthesis"');
    expect(functionSource).toContain('status: "succeeded"');
    expect(functionSource).toContain("failure_reason");
    expect(functionSource).toContain("operating_events");
    expect(functionSource).toContain("persistGeneratedRead");
    expect(functionSource).toContain("manager_read");
    expect(promptSource).toContain("situationLine");
    expect(promptSource).toContain("watchNext");
    expect(promptSource).toContain("generationState");
  });

  it("uses a valid operating-event actor and does not fail a completed read when telemetry fails", () => {
    expect(functionSource).toContain('actor_type: "manager"');
    expect(functionSource).not.toContain('actor_type: "manager_ai"');
    expect(functionSource).toContain("writeOperatingEventSafe");
  });

  it("prompts as a human Manager while keeping provider attribution out of the main read", () => {
    expect(promptSource).toContain("You are the artist's senior manager");
    expect(promptSource).toContain("Write in first person as the Manager");
    expect(promptSource).toContain("180 to 260 words");
    expect(promptSource).toContain("managerRead: { type: \"string\", maxLength: 1800 }");
    expect(promptSource).toContain("36 words maximum");
    expect(promptSource).toContain("Do not say I will demand");
    expect(promptSource).toContain("Do not dump credits, copyright notices, label text");
    expect(promptSource).toContain("Do not say Chartmetric found");
    expect(promptSource).toContain("Do not say Spotify confirms");
    expect(promptSource).toContain("Do not call the whole packet catalog-only");
    expect(promptSource).toContain("Do not use the words ChatGPT");
    expect(promptSource).toContain("Rank by commercial usefulness");
    expect(promptSource).toContain("Never expose raw names like provider_window");
    expect(promptSource).toContain("not just a request for more data");
    expect(promptSource).toContain("Do not say movement, signal, activity, or momentum unless");
    expect(promptSource).toContain("Provider names belong in the internal audit fields");
    expect(promptSource).toContain("exact numbers, names, dates, placements, ranks, and trends");
    expect(promptSource).toContain("basic English");
    expect(promptSource).toContain("what happened, why it matters, and what to do next");
    expect(promptSource).toContain("Do not use analytics jargon");
    expect(promptSource).toContain("Record Intelligence");
    expect(promptSource).toContain("record role");
    expect(promptSource).toContain("Do not lead with missing data");
    expect(promptSource).toContain("If a sentence could be said to another record");
    expect(promptSource).toContain("The final sentence of the Manager Read must be today's practical move");
    expect(promptSource).toContain('MANAGER_READ_SOURCE_LINE = "Prepared from the record details and audience signals I can already see."');
    expect(promptSource).toContain("The sourceLine must be exactly:");
    expect(promptSource).toContain("Do not put missing proof, unavailable private documents, source limits, or vendor names into Record Intelligence.");
    expect(promptSource).toContain("Record Intelligence metric values are table cells, not sentences");
    expect(promptSource).not.toContain("third-party intelligence shows attention");
  });

  it("prompts project briefs as release-level reads with tracklist and focus-track judgment", () => {
    expect(promptSource).toContain("For music_project subjects");
    expect(promptSource).toContain("release-level brief");
    expect(promptSource).toContain("tracklist");
    expect(promptSource).toContain("focus track");
    expect(promptSource).toContain("release readiness");
    expect(promptSource).toContain("Project Intelligence");
  });

  it("flags backend, vendor, and missing-proof language from visible song brief fields", () => {
    const payload = {
      situationLine: "ChatGPT says the track has private conversion data missing.",
      headline: "Chartmetric track report",
      managerRead: "Chartmetric third-party provider data says private saves and source-of-stream are still missing.",
      nextMove: "Check conversion proof.",
      watchNext: "Wait for API evidence.",
      generationState: "fresh",
      whatMatters: [],
      doNotDoYet: [],
      missingProof: [],
      confidence: "medium",
      evidenceIdsUsed: ["evidence-1"],
      sourcePanelNote: "Technical source note.",
      intelligenceSnapshot: [
        {
          title: "Record Intelligence",
          insight: "Provider data shows movement.",
          metrics: [{ label: "Streams", value: "6.2M", context: "third-party metric", evidenceIds: ["evidence-1"] }],
        },
      ],
      snapshotSummary: "API-backed attention summary.",
      claimAudit: [{ claim: "The record has public reach.", evidenceIds: ["evidence-1"], limitation: "Public attention only." }],
      sourceLine: "Based on saved track metadata, public attention signals, and source limits.",
    };

    const output = parseManagerReadOutput(payload);

    expect(checkBannedVisibleMusicTerms(output)).toBe("ChatGPT");
  });

  it("does not block generation when provider language only appears in non-visible legacy fields", () => {
    const payload = {
      situationLine: "Jam is the current public-pressure record.",
      headline: "Jam has the clearest public-pressure read.",
      managerRead:
        "Jam is the record with the clearest public pressure right now: 19M views on the top TikTok clip, 8.1M YouTube views, and 4.8M playlist reach all point to the same song. Today, I would make Jam the first record to inspect and decide whether short-form discovery or playlist support should lead the next team action.",
      nextMove: "Make Jam the first record to inspect and compare short-form discovery against playlist support.",
      watchNext: "Watch whether TikTok and YouTube keep pointing to the same record.",
      generationState: "fresh",
      whatMatters: ["Provider details are available in the audit panel."],
      doNotDoYet: ["Do not expose provider names in the main read."],
      missingProof: ["Provider-side private proof is not connected."],
      confidence: "medium",
      evidenceIdsUsed: ["evidence-1"],
      sourcePanelNote: "Provider names and limitations are available for audit.",
      intelligenceSnapshot: [
        {
          title: "Record Intelligence",
          insight: "Jam has public pressure across short-form, video, and playlist behavior.",
          metrics: [{ label: "Top TikTok clip", value: "19M", context: "views on the top public clip", evidenceIds: ["evidence-1"] }],
        },
      ],
      snapshotSummary: "Jam has public pressure across short-form, video, and playlist behavior.",
      claimAudit: [{ claim: "Jam has public pressure.", evidenceIds: ["evidence-1"], limitation: "Public attention only." }],
      sourceLine: "Prepared from the record details and audience signals I can already see.",
    };

    const output = parseManagerReadOutput(payload);

    expect(checkBannedVisibleMusicTerms(output)).toBeNull();
    expect(checkSourceLine(output)).toBe(true);
  });

  it("repairs empty Record Intelligence evidence IDs to the saved source packet instead of failing generation", () => {
    const payload = {
      situationLine: "IMMORTAL is a released EP with the tracklist ready for a focus-track read.",
      headline: "IMMORTAL needs a focus-track decision.",
      managerRead:
        "IMMORTAL is useful as a release frame because the mapped tracklist gives the team enough shape to choose a focus track before treating all songs equally. The practical read is that the EP should organize attention around the song with the clearest present behavior, then use the rest of the project as support instead of asking every track to carry the same campaign.",
      nextMove: "Use IMMORTAL as the release frame, then choose the first focus track from the mapped tracklist.",
      watchNext: "Watch which mapped song keeps carrying the release read.",
      generationState: "fresh",
      whatMatters: [],
      doNotDoYet: [],
      missingProof: [],
      confidence: "medium",
      evidenceIdsUsed: [],
      sourcePanelNote: "Prepared from saved source packet context.",
      intelligenceSnapshot: [
        {
          title: "Project Intelligence",
          insight: "The mapped tracklist is enough to force a focus-track decision.",
          metrics: [{ label: "Mapped songs", value: "6", context: "songs in the release frame", evidenceIds: [] }],
        },
      ],
      snapshotSummary: "IMMORTAL has a release frame and needs the first focus-track choice.",
      claimAudit: [{ claim: "IMMORTAL has a mapped release frame.", evidenceIds: [], limitation: "Source packet context, not private account proof." }],
      sourceLine: "Prepared from the record details and audience signals I can already see.",
    };

    const output = parseManagerReadOutput(payload);

    expect(output.evidenceIdsUsed).toEqual(["source-packet"]);
    expect(output.intelligenceSnapshot[0]?.metrics[0]?.evidenceIds).toEqual(["source-packet"]);
    expect(output.claimAudit[0]?.evidenceIds).toEqual(["source-packet"]);
  });

  it("requires the song brief source line to sound manager-owned instead of source-mechanical", () => {
    const validPayload = {
      situationLine: "Jam is the current public-pressure record.",
      headline: "Jam has the clearest public-pressure read.",
      managerRead:
        "Jam is the record with the clearest public pressure right now: 19M views on the top TikTok clip and 8.1M YouTube views point to the same song. I would make Jam the first record to inspect and decide whether short-form discovery or video demand should lead the next team action.",
      nextMove: "Make Jam the first record to inspect and compare short-form discovery against video demand.",
      watchNext: "Watch whether TikTok and YouTube keep pointing to the same record.",
      generationState: "fresh",
      whatMatters: [],
      doNotDoYet: [],
      missingProof: [],
      confidence: "medium",
      evidenceIdsUsed: ["evidence-1"],
      sourcePanelNote: "Technical source note.",
      intelligenceSnapshot: [
        {
          title: "Record Intelligence",
          insight: "Jam has public pressure across short-form and video behavior.",
          metrics: [{ label: "Top TikTok clip", value: "19M", context: "views on the top public clip", evidenceIds: ["evidence-1"] }],
        },
      ],
      snapshotSummary: "Jam has public pressure across short-form and video behavior.",
      claimAudit: [{ claim: "Jam has public pressure.", evidenceIds: ["evidence-1"], limitation: "Public attention only." }],
      sourceLine: "Prepared from the record details and audience signals I can already see.",
    };
    const mechanicalPayload = {
      ...validPayload,
      sourceLine: "Based on saved track details, public attention signals, and source limits.",
    };

    expect(checkSourceLine(parseManagerReadOutput(validPayload))).toBe(true);
    expect(checkSourceLine(parseManagerReadOutput(mechanicalPayload))).toBe(false);
  });

  it("strips visible vendor wording into manager-safe language without showing removal placeholders", () => {
    const payload = {
      situationLine: "Chartmetric says Jam has third-party reach.",
      headline: "Provider read for Jam",
      managerRead: "Chartmetric provider data says Jam has 19M TikTok views, but private saves are still missing.",
      nextMove: "Use the API read.",
      watchNext: "Check source-of-stream later.",
      generationState: "fresh",
      whatMatters: [],
      doNotDoYet: [],
      missingProof: [],
      confidence: "medium",
      evidenceIdsUsed: ["evidence-1"],
      sourcePanelNote: "Technical source note.",
      intelligenceSnapshot: [
        {
          title: "Record Intelligence",
          insight: "Third-party data shows movement.",
          metrics: [{ label: "Provider metric", value: "19M", context: "Chartmetric public metric", evidenceIds: ["evidence-1"] }],
        },
      ],
      snapshotSummary: "API-backed attention summary.",
      claimAudit: [{ claim: "Jam has public reach.", evidenceIds: ["evidence-1"], limitation: "Public attention only." }],
      sourceLine: "Prepared from the record details and audience signals I can already see.",
    };

    const stripped = stripBannedVisibleMusicTerms(parseManagerReadOutput(payload));
    const visible = JSON.stringify({
      situationLine: stripped.situationLine,
      headline: stripped.headline,
      managerRead: stripped.managerRead,
      nextMove: stripped.nextMove,
      watchNext: stripped.watchNext,
      intelligenceSnapshot: stripped.intelligenceSnapshot,
      snapshotSummary: stripped.snapshotSummary,
      sourceLine: stripped.sourceLine,
    });

    expect(checkBannedVisibleMusicTerms(stripped)).toBeNull();
    expect(visible).not.toContain("[removed]");
  });
});
