import { describe, expect, it } from "vitest";
import {
  buildManagerConversationModelContext,
  classifyManagerConversationError,
} from "../supabase/functions/_shared/manager-conversation/context";

const input = {
  accountId: "account-1",
  artistWorkspaceId: "workspace-1",
  artistId: "artist-1",
  taskId: "task-1",
  body: "Help me tighten this release plan.",
  contextRequestId: "request-1",
  contextAnswers: [{ questionKey: "budget", answer: "Keep it under $2,000." }],
};

const oversizedPacket = {
  artist: { id: "artist-1", name: "Artist", goals: ["Build a durable audience"], budgetContext: "Lean" },
  evidence: Array.from({ length: 20 }, (_, index) => ({ id: `evidence-${index}`, label: "Listener signal", value: "x".repeat(4_000) })),
  music: { items: Array.from({ length: 20 }, (_, index) => ({ id: `song-${index}`, title: `Song ${index}`, metadata: "x".repeat(4_000) })), projects: [] },
  memory: Array.from({ length: 20 }, (_, index) => ({ id: `memory-${index}`, content: "x".repeat(4_000) })),
  existingMissions: Array.from({ length: 20 }, (_, index) => ({ id: `mission-${index}`, title: `Mission ${index}`, objective: "x".repeat(4_000) })),
  taskContext: { id: "task-1", title: "Tighten plan", purpose: "x".repeat(4_000) },
  conversationHistory: Array.from({ length: 12 }, (_, index) => ({ id: `message-${index}`, speaker: "artist", body: "x".repeat(10_000), metadata: { secret: "must not be copied" } })),
  latestManagerIntelligencePacket: { strategic_diagnosis_json: { document: "x".repeat(100_000) } },
  missionPatternRegistry: { internal: "x".repeat(100_000) },
  recommendedMissionPatterns: Array.from({ length: 10 }, (_, index) => ({ key: `pattern-${index}`, body: "x".repeat(10_000) })),
  managerOutput: { render_json: { content: "x".repeat(100_000) } },
  activePlaybookKeys: ["cultural_expansion"],
  focusedMusicSubject: {
    type: "music_item",
    id: "song-focused",
    title: "Night Bus",
    kind: "single",
    lifecycleStage: "mastering",
    releasedAt: "",
    sourceKind: "manual",
    sourceLimit: "No delivery confirmation yet.",
    metadata: { lyrics: "This should stay bounded." },
    assets: [{ id: "asset-master", assetType: "final_master", title: "Final master", status: "uploaded" }],
    rights: { status: "pending_confirmation", publishingTotal: 100, masterTotal: 100 },
    analysis: [{ metric: "tempo_bpm", value: 102, unit: "bpm", confidence: "medium" }],
    recentActivity: [{ eventType: "music_asset_uploaded", summary: "Uploaded Final master.", createdAt: "2026-08-09T00:00:00Z" }],
  },
};

describe("Manager conversation context boundary", () => {
  it("builds a bounded opening brief without raw packets, documents, or message metadata", () => {
    const context = buildManagerConversationModelContext(input, oversizedPacket, "conversation-1", "");
    const serialized = JSON.stringify(context);

    expect(context).toHaveProperty("openingBrief");
    expect(context).toHaveProperty("scope", expect.objectContaining({ conversationId: "conversation-1", taskId: "task-1" }));
    expect(context).not.toHaveProperty("latestManagerIntelligencePacket");
    expect(context).not.toHaveProperty("missionPatternRegistry");
    expect(context.openingBrief).toMatchObject({
      focusedMusicSubject: {
        type: "music_item",
        id: "song-focused",
        title: "Night Bus",
        lifecycleStage: "mastering",
        assets: [{ id: "asset-master", assetType: "final_master", title: "Final master", status: "uploaded" }],
        rights: { status: "pending_confirmation", publishingTotal: 100, masterTotal: 100 },
        analysis: [{ metric: "tempo_bpm", value: 102, unit: "bpm", confidence: "medium" }],
        recentActivity: [{ eventType: "music_asset_uploaded", summary: "Uploaded Final master.", createdAt: "2026-08-09T00:00:00Z" }],
      },
    });
    expect(serialized).not.toContain("render_json");
    expect(serialized).not.toContain("must not be copied");
    expect((context.openingBrief as { conversationHistory: unknown[] }).conversationHistory).toHaveLength(6);
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThan(90_000);
  });

  it("sends a small scope pointer after a persisted Responses turn", () => {
    const context = buildManagerConversationModelContext(input, oversizedPacket, "conversation-1", "resp-prior");

    expect(context).toMatchObject({
      scope: { accountId: "account-1", artistWorkspaceId: "workspace-1", artistId: "artist-1", conversationId: "conversation-1", taskId: "task-1" },
      userMessage: input.body,
      contextAnswers: input.contextAnswers,
    });
    expect(context).not.toHaveProperty("openingBrief");
    expect(JSON.stringify(context)).not.toContain("conversationHistory");
    expect(JSON.stringify(context)).not.toContain("latestManagerIntelligencePacket");
  });

  it("maps provider diagnostics to safe user messages while retaining internal diagnostics", () => {
    const cases = [
      ["Manager agent request failed with status 429: Request too large for gpt-5.6-luna request_id=req_123", "This Manager session is larger than it can safely process right now. Start a focused follow-up or try again after the workspace refreshes."],
      ["Manager agent request failed with status 429: rate limited by provider", "Manager is briefly busy. Please try again in a moment."],
      ["Manager agent request failed with status 500: provider crashed request_id=req_456", "Manager could not complete that request. Your conversation and drafts are safe; try again."],
    ] as const;

    for (const [errorMessage, expectedPublicMessage] of cases) {
      const failure = classifyManagerConversationError(new Error(errorMessage));
      expect(failure.publicMessage).toBe(expectedPublicMessage);
      expect(failure.publicMessage).not.toMatch(/gpt-|openai|request_id|provider/i);
      expect(failure.internalMessage).toContain(errorMessage);
    }
  });
});
