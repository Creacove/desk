import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTodaysBriefInstructions, parseTodaysBriefOutput } from "../supabase/functions/_shared/openaiTodaysBrief";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "generate-todays-brief", "index.ts"), "utf8");
const promptSource = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "openaiTodaysBrief.ts"), "utf8");

const bannedVisibleTerms = ["Chartmetric", "provider", "API", "normalized", "database", "evidence row", "third-party"];

describe("OpenAI Today's Brief generation function", () => {
  it("authenticates users and builds the packet from all saved artist and music intelligence", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("Authorization");
    expect(functionSource).toContain("isServiceRoleInvocation");
    expect(functionSource).toContain('readBearerJwtRole(authHeader) === "service_role"');
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");
    expect(functionSource).toContain("if (!isServiceRoleInvocation)");
    expect(functionSource).toContain("buildArtistBriefPacket");
    expect(functionSource).toContain('from("artist_profiles")');
    expect(functionSource).toContain('from("music_items")');
    expect(functionSource).toContain('from("music_projects")');
    expect(functionSource).toContain('from("evidence_items")');
    expect(functionSource).toContain('from("source_sync_jobs")');
    expect(functionSource).toContain("buildIntelligenceSnapshotInputs");
    expect(functionSource).toContain("deriveInsightComparisons");
    expect(functionSource).toContain("working catalog in view");
    expect(functionSource).not.toContain("input.evidence");
    expect(functionSource).not.toContain("input.facts");
    expect(functionSource).not.toContain("input.brief");
  });

  it("uses structured output, stores provenance, and validates visible Manager language", () => {
    expect(functionSource).toContain("/v1/responses");
    expect(functionSource).toContain("json_schema");
    expect(functionSource).toContain("todaysBriefJsonSchema");
    expect(functionSource).toContain("manager_synthesis_runs");
    expect(functionSource).toContain("ai_run_usage_events");
    expect(functionSource).toContain("operating_events");
    expect(functionSource).toContain('classification: "setup_todays_brief_v1"');
    expect(functionSource).toContain("claimAudit");
    expect(functionSource).not.toContain("assertNoBannedVisibleTerms(completed)");
    expect(functionSource).toContain("assertSignalsHaveEvidenceIds");
  });

  it("keeps OpenAI output usable instead of hard-failing missing audit evidence IDs", () => {
    expect(promptSource).not.toContain("evidenceIds: { type: \"array\", minItems: 1");
    expect(promptSource).toContain("use the evidenceIds supplied in the packet");
    expect(promptSource).not.toContain("leave evidenceIds empty");
  });

  it("persists the consolidated Manager Intelligence packet and visible output rows", () => {
    expect(functionSource).toContain("buildManagerIntelligencePacket");
    expect(functionSource).toContain("persistManagerIntelligencePacket");
    expect(functionSource).toContain("persistManagerOutput");
    expect(functionSource).not.toContain("fallbackBriefFromManagerPacket");
    expect(functionSource).not.toContain("persistFallbackManagerOutput");
    expect(functionSource).toContain("persistManagerPacketEvidenceLinks");
    expect(functionSource).toContain("persistManagerPacketMemorySeeds");
    expect(functionSource).toContain('from("manager_intelligence_packets")');
    expect(functionSource).toContain('from("memory_entries")');
    expect(functionSource).toContain('source_type: "manager_intelligence_packet"');
    expect(functionSource).toContain("domain_reads_json");
    expect(functionSource).toContain("public_context_json");
    expect(functionSource).toContain("open_decisions_json");
    expect(functionSource).toContain("do_not_do_json");
    expect(functionSource).toContain('from("manager_outputs")');
    expect(functionSource).toContain('from("evidence_links")');
    expect(functionSource).toContain("source_packet_id");
    expect(functionSource).toContain("output_type");
    expect(functionSource).toContain("setup_first_manager_read");
    expect(functionSource).toContain("recurring_todays_brief");
    expect(functionSource).toContain("manager_outputs");
    expect(functionSource).toContain("retireCurrentManagerOutput");
    expect(functionSource).toContain("is_current: false");
  });

  it("retries OpenAI rate limits without creating a local packet fallback", () => {
    expect(functionSource).toContain("callOpenAITodaysBriefWithRetry");
    expect(functionSource).toContain("isRetryableOpenAIError");
    expect(functionSource).toContain("await delay(openAiRetryDelayMs(attempt))");
    expect(functionSource).toContain("OpenAI Today's Brief request failed with status 429");
    expect(functionSource).not.toContain("fallbackBriefFromManagerPacket");
    expect(functionSource).not.toContain("completed_with_fallback");
  });

  it("selects separate setup-map and operating prompt modes", () => {
    expect(functionSource).toContain('generationMode?: "operating" | "setup-map"');
    expect(functionSource).toContain("readGenerationMode(input)");
    expect(functionSource).toContain("buildTodaysBriefModelPacket(packet, managerIntelligencePacket)");
    expect(functionSource).toContain("appendManagerEvidenceReads(output, managerIntelligencePacket)");

    const setupMapPrompt = buildTodaysBriefInstructions("setup-map");
    const operatingPrompt = buildTodaysBriefInstructions("operating");

    expect(setupMapPrompt).toContain("Artist Operating Map");
    expect(setupMapPrompt).toContain("highly personal");
    expect(setupMapPrompt).toContain("not a rigid template");
    expect(setupMapPrompt).toContain("first sentence");
    expect(setupMapPrompt).toContain("catalog, projects, tracks, audience geography, platform behavior");
    expect(setupMapPrompt).toContain("intelligenceSnapshot metrics must support the specific thesis of this artist");
    expect(operatingPrompt).toContain("End the Manager's Read with one useful thing to do today");
    expect(operatingPrompt).not.toContain("Artist Operating Map");
  });

  it("returns setup music read targets and dispatches their Manager Reads after the setup-map packet", () => {
    expect(functionSource).toContain("setupMusicReadTargets");
    expect(functionSource).toContain("selectSetupMusicReadTargets");
    expect(functionSource).toContain("selectChartmetricEnrichedMusicItemIds");
    expect(functionSource).not.toContain("musicItems.slice(0, 5).map((item)");
    expect(functionSource).toContain("dispatchSetupMusicReadsConcurrently");
    expect(functionSource).toContain("Promise.allSettled");
    expect(functionSource).not.toContain("dispatchSetupMusicReadsSequentially");
    expect(functionSource).toContain("EdgeRuntime.waitUntil");
    expect(functionSource).toContain("dispatchSetupMusicReadsConcurrently(supabaseUrl, serviceRoleKey");
    expect(functionSource).not.toContain("dispatchSetupMusicReadsConcurrently(supabaseUrl, anonKey");
    expect(functionSource).toContain("finalizeSetupMusicReadWave");
    expect(functionSource).toContain('status: failures.length ? "completed_with_limits" : "completed"');
    expect(functionSource).toContain("generate-music-summary");
    expect(functionSource).toContain('subjectType: "music_project"');
    expect(functionSource).toContain('subjectType: "music_item"');
  });

  it("uses low reasoning effort for the latency-sensitive setup brief", () => {
    expect(functionSource).toContain('reasoning: { effort: "low" }');
  });

  it("dispatches one staggered music-read wave only from the context-aware setup phase", () => {
    expect(functionSource).toContain("dispatchMusicReads?: boolean");
    expect(functionSource).toContain("input.dispatchMusicReads !== false");
    expect(functionSource).toContain("index * 500");

    const discoverySource = readFileSync(
      join(process.cwd(), "supabase", "functions", "manager-artist-discovery", "index.ts"),
      "utf8",
    );
    const setupSource = readFileSync(
      join(process.cwd(), "supabase", "functions", "paid-workspace-setup", "index.ts"),
      "utf8",
    );
    expect(discoverySource).not.toContain("generate-todays-brief");
    expect(discoverySource).not.toContain("dispatchMusicReads:");
    expect(setupSource).toContain("dispatchMusicReads: true");
  });

  it("uses stable packet evidence IDs for setup metadata metrics", () => {
    expect(functionSource).toContain('evidenceIds: ["working-catalog-scope"]');
    expect(functionSource).toContain('evidenceIds: ["latest-project-in-view"]');
    expect(functionSource).toContain('evidenceIds: ["recent-focus-records"]');
    expect(promptSource).toContain("setup metadata and catalog scope use stable packet IDs");
    expect(functionSource).not.toContain("available_evidence");
  });

  it("allows complete Today's Brief copy instead of forcing short character caps", () => {
    expect(promptSource).toContain("3-5 short paragraphs separated by blank lines");
    expect(promptSource).toContain("complete sentences");
    expect(promptSource).toContain("Do not stop mid-sentence");
    expect(promptSource).toContain("Metric value must be the atomic number or short fact only");
    expect(promptSource).toContain("Do not put parenthetical explanations in metric value");
    expect(promptSource).toContain("Use managerEvidenceReads to explain what the visible evidence means");
    expect(promptSource).toContain("Do not interpret only KPI scores");
    expect(promptSource).not.toContain('headlineRead: { type: "string", maxLength: 180 }');
    expect(promptSource).not.toContain('snapshotSummary: { type: "string", maxLength: 280 }');
    expect(promptSource).not.toContain('managerRead: { type: "string", maxLength: 1800 }');
  });

  it("sanitizes style-policy terms without hard-failing a usable brief", () => {
    const output = parseTodaysBriefOutput({
      headlineRead: "Nova Vale has a clear campaign starting point.",
      intelligenceSnapshot: [
        {
          title: "Artist Intelligence",
          insight: "The campaign read is centered on London.",
          metrics: [
            { label: "Campaign signal", value: "1.2M", context: "campaign context", evidenceIds: ["ev-1"] },
          ],
        },
      ],
      snapshotSummary: "The first campaign read has a usable shape.",
      managerRead: "The campaign should start with London because the artist already has public pull there.",
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
      claimAudit: [{ claim: "London is the lead signal.", evidenceIds: ["ev-1"], limitation: "Public signal only." }],
    });

    const visibleCopy = [
      output.headlineRead,
      output.snapshotSummary,
      output.managerRead,
      output.sourceLine,
      ...output.intelligenceSnapshot.flatMap((group) => [
        group.title,
        group.insight,
        ...group.metrics.flatMap((metric) => [metric.label, metric.value, metric.context ?? ""]),
      ]),
    ].join(" ");

    expect(visibleCopy).not.toMatch(/\bcampaign\b/i);
    expect(output.managerRead).toContain("London");
    expect(output.intelligenceSnapshot[0].metrics[0].evidenceIds).toEqual(["ev-1"]);
  });

  it("normalizes metric numbers and replaces duplicate numeric labels before persistence", () => {
    const output = parseTodaysBriefOutput({
      headlineRead: "Nova Vale has a measurable audience center.",
      intelligenceSnapshot: [
        {
          title: "Audience Scale",
          insight: "The audience metrics establish the current scale.",
          metrics: [
            { label: "2.1M", value: "2.1456789M", context: "Monthly listeners", evidenceIds: ["ev-listeners"] },
            { label: "Artist score", value: "97.8864321", context: "score", evidenceIds: ["ev-score"] },
            { label: "Playlist reach", value: "2,451.873", context: "reach", evidenceIds: ["ev-playlists"] },
          ],
        },
      ],
      snapshotSummary: "The current audience scale is usable.",
      managerRead: "Artist Intelligence: Nova Vale has a measurable public audience.\n\nAudience Scale: Monthly listeners lead the read.\n\nDiscovery: Playlist reach adds a second signal.\n\nToday: Review the strongest audience lane.",
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
      claimAudit: [{ claim: "Audience scale is measurable.", evidenceIds: ["ev-listeners"], limitation: "Public signal only." }],
    });

    expect(output.intelligenceSnapshot[0].metrics).toEqual([
      { label: "Monthly listeners", value: "2.1M", context: "Monthly listeners", evidenceIds: ["ev-listeners"] },
      { label: "Artist score", value: "98", context: "score", evidenceIds: ["ev-score"] },
      { label: "Playlist reach", value: "2,452", context: "reach", evidenceIds: ["ev-playlists"] },
    ]);
  });

  it("keeps evidence IDs out of visible Today's Brief prose while preserving audit IDs", () => {
    const uuid = "54dcf7c5-93b8-4e83-a389-4bdaa6854ca2";
    const output = parseTodaysBriefOutput({
      headlineRead: `Nova Vale has a London signal (${uuid}) that should guide today's read.`,
      intelligenceSnapshot: [
        {
          title: "Audience Map",
          insight: `London is the lead market; evidence: ${uuid}.`,
          metrics: [
            { label: `London listeners ${uuid}`, value: "42K", context: `public signal ${uuid}`, evidenceIds: [uuid] },
          ],
        },
      ],
      snapshotSummary: `The source ids ${uuid} should not be displayed to the artist.`,
      managerRead: `London is the power center (evidence: ${uuid}). Keep the ID in audit only.`,
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
      claimAudit: [{ claim: `London leads. ${uuid}`, evidenceIds: [uuid], limitation: `Public signal only. ${uuid}` }],
    });

    const visibleCopy = [
      output.headlineRead,
      output.snapshotSummary,
      output.managerRead,
      ...output.intelligenceSnapshot.flatMap((group) => [
        group.title,
        group.insight,
        ...group.metrics.flatMap((metric) => [metric.label, metric.value, metric.context ?? ""]),
      ]),
    ].join(" ");

    expect(visibleCopy).not.toContain(uuid);
    expect(output.claimAudit[0].evidenceIds).toEqual([uuid]);
  });

  it("keeps a strong brief when a profile-only claim audit item has no evidence IDs", () => {
    const output = parseTodaysBriefOutput({
      headlineRead: "Olamide's operating map starts with Lagos scale and Formation as the current release lever.",
      intelligenceSnapshot: [
        {
          title: "Audience Map",
          insight: "Lagos is the power center, while the release evidence points to Formation as the track to manage first.",
          metrics: [
            { label: "Lagos listeners", value: "1.3M", context: "lead city audience", evidenceIds: ["ev-lagos"] },
          ],
        },
        {
          title: "Current Music",
          insight: "Formation carries the strongest current project signal.",
          metrics: [
            { label: "Playlist reach", value: "4M", context: "Formation discovery surface", evidenceIds: ["ev-formation"] },
          ],
        },
      ],
      snapshotSummary: "The map is Lagos-first, but Formation is the current release lever.",
      managerRead:
        "Olamide's first management read is not just scale; it is the combination of Lagos depth and a current record that can still move. Lagos gives the base, Formation gives the active handle, and the desk should manage from that center.",
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
      claimAudit: [
        { claim: "Lagos is the lead audience market.", evidenceIds: ["ev-lagos"], limitation: "Public audience signal only." },
        { claim: "The artist profile identifies Olamide as the workspace artist.", evidenceIds: [], limitation: "Profile/setup context, not an evidence row." },
      ],
    });

    expect(output.managerRead).toContain("Formation");
    expect(output.claimAudit).toHaveLength(2);
    expect(output.claimAudit[1].evidenceIds).toEqual([]);
  });

  it("keeps a strong OpenAI brief when one metric omits evidence IDs", () => {
    const output = parseTodaysBriefOutput({
      headlineRead: "BEEJAY should manage from Cough (Odo) before widening spend.",
      intelligenceSnapshot: [
        {
          title: "Current Music",
          insight: "Cough (Odo) is the active record to manage first.",
          metrics: [
            { label: "Working catalog", value: "Latest project + 11 songs", context: "setup focus", evidenceIds: [] },
          ],
        },
        {
          title: "Market Heat",
          insight: "Lagos is the first market lane to test.",
          metrics: [
            { label: "Lagos listeners", value: "221", context: "lead city", evidenceIds: ["ev-lagos"] },
          ],
        },
      ],
      snapshotSummary: "Cough (Odo) is the first management lever.",
      managerRead: "BEEJAY has enough signal around Cough (Odo) to start with a focused management read instead of broad activity.",
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
      claimAudit: [{ claim: "Lagos is the first market lane.", evidenceIds: ["ev-lagos"], limitation: "Public signal only." }],
    });

    expect(output.managerRead).toContain("Cough (Odo)");
    expect(output.intelligenceSnapshot[0].metrics[0].evidenceIds).toEqual([]);
  });

  it("treats broad artist goals as ambition context, not the object of today's work", () => {
    const operatingPrompt = buildTodaysBriefInstructions("operating");
    expect(operatingPrompt).toContain("Artist goal or artist direction is ambition context");
    expect(operatingPrompt).toContain("Do not quote broad goals like");
    expect(operatingPrompt).toContain("do-this / do-not-do");
  });

  it("defines the premium intelligence brief fields and hides vendor/backend language from visible copy", () => {
    for (const field of [
      "headlineRead",
      "intelligenceSnapshot",
      "metrics",
      "insight",
      "managerRead",
      "sourceLine",
      "claimAudit",
    ]) {
      expect(promptSource).toContain(field);
    }

    expect(promptSource).toContain("Write as the artist's senior Manager");
    expect(promptSource).toContain("Do not name backend sources or data vendors");
    expect(promptSource).toContain("If a sentence could be said to another artist, delete it");
    expect(promptSource).toContain("This is the first setup brief after onboarding");
    expect(promptSource).toContain("Do not pretend a campaign, mission, rollout, or release plan already exists");
    expect(promptSource).toContain("Do not explain that the working catalog is not the full discography");
    expect(promptSource).toContain("Do not lead with missing data");
    expect(promptSource).toContain("derive ratios, contrasts, and ranking insights");
    expect(promptSource).toContain("Current Music In View");
    expect(promptSource).toContain("do not infer full discography size from the workspace catalog");
    expect(promptSource).not.toContain("Still missing");
    expect(promptSource).not.toContain("private saves, repeat listeners");

    for (const term of bannedVisibleTerms) {
      expect(promptSource).toContain(term);
    }
  });
});
