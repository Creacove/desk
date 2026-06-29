import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPublicWebContextInstructions,
  buildPublicWebContextRequest,
  normalizePublicWebContextOutput,
} from "../supabase/functions/_shared/manager-intelligence/publicWebContext";

const edgeFunctionPath = join(process.cwd(), "supabase", "functions", "refresh-public-context", "index.ts");

describe("public web career context", () => {
  it("builds an OpenAI web-search request that requires sourced public career context", () => {
    const request = buildPublicWebContextRequest({
      artistName: "Sable Day",
      homeMarket: "London",
      genres: ["alt-pop"],
      socialHandles: { instagram: "@sableday" },
    });

    expect(request.tools).toEqual([{ type: "web_search" }]);
    expect(request.include).toEqual(["web_search_call.action.sources"]);
    expect(request.input).toMatch(/Sable Day/);
    expect(request.input).toMatch(/press|interviews|live dates|brand|sync|public risk/i);
    expect(request.input).toMatch(/Do not infer private analytics/i);
  });

  it("asks web search for management strategy rather than recent-news summaries", () => {
    const instructions = buildPublicWebContextInstructions();
    const request = buildPublicWebContextRequest({
      artistName: "Blaqbonez",
      homeMarket: "Nigeria",
      genres: ["rap", "afrobeats"],
      socialHandles: {},
    });

    expect(instructions).toMatch(/changes management strategy/i);
    expect(instructions).toMatch(/public narrative|project reception|artist identity|collaborators|fan discourse|mission implications/i);
    expect(request.input).toMatch(/artist_identity_clues|collaboration_clues|market_clues|risk_clues|mission_implications/i);
    expect(request.input).not.toMatch(/summarize recent news/i);
  });

  it("normalizes public web results into low-confidence evidence candidates with URL provenance and source limits", () => {
    const result = normalizePublicWebContextOutput({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      artistName: "Sable Day",
      output: {
        findings: [
          {
            title: "Sable Day announces Blue Room live dates",
            url: "https://example.com/sable-day-blue-room-live",
            sourceDomain: "example.com",
            publishedAt: "2026-06-20",
            contextType: "live_dates",
            claim: "Sable Day announced a short London live run tied to Blue Room.",
            managementUse: "Can inform live-market readiness and team capacity questions.",
          },
          {
            title: "Unsourced rumor",
            url: "",
            sourceDomain: "",
            publishedAt: "",
            contextType: "rumor",
            claim: "Sable Day signed a deal.",
            managementUse: "Should be ignored because it has no URL.",
          },
        ],
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      account_id: "account-1",
      artist_workspace_id: "workspace-1",
      artist_id: "artist-1",
      source: "public_web",
      source_kind: "public_web",
      evidence_type: "public_career_context",
      subject_type: "artist",
      subject_label: "Sable Day",
      metric_name: "public_context_live_dates",
      lens: "public_context live_dates",
      confidence: "low",
      raw_ref: "https://example.com/sable-day-blue-room-live",
      provenance: "example.com",
      limitation: expect.stringMatching(/public web context/i),
    });
    expect(result[0].metric_value).toBeNull();
  });

  it("preserves strategy fields from web culture research in evidence metadata", () => {
    const result = normalizePublicWebContextOutput({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      artistName: "Blaqbonez",
      output: {
        findings: [
          {
            title: "Blaqbonez profile",
            url: "https://example.com/blaqbonez-profile",
            sourceDomain: "example.com",
            publishedAt: "2026-06-20",
            contextType: "artist_identity",
            claim: "Blaqbonez is framed through humor, confidence, versatility, and rap roots.",
            managementUse: "Use Chanel as a feature-leverage moment without letting personality attention outrun music attachment.",
            strategyFields: {
              publicNarrative: "Rap-rooted, humorous, internet-native mainstream challenger.",
              artistIdentityClues: ["humor", "confidence", "rap-rooted"],
              collaborationClues: ["Asake can raise mainstream perception but may overshadow Blaqbonez"],
              marketClues: ["Nigeria first, then UK/diaspora bridge"],
              riskClues: ["feature overshadowing risk"],
              missionImplications: ["Turn the Asake feature into Blaqbonez-owned leverage"],
            },
          },
        ],
      },
    });

    expect(result[0].metadata).toMatchObject({
      public_narrative: "Rap-rooted, humorous, internet-native mainstream challenger.",
      artist_identity_clues: ["humor", "confidence", "rap-rooted"],
      collaboration_clues: ["Asake can raise mainstream perception but may overshadow Blaqbonez"],
      market_clues: ["Nigeria first, then UK/diaspora bridge"],
      risk_clues: ["feature overshadowing risk"],
      mission_implications: ["Turn the Asake feature into Blaqbonez-owned leverage"],
    });
  });

  it("keeps web context away from unsupported private, legal, revenue, ROI, and conversion claims", () => {
    const instructions = buildPublicWebContextInstructions();

    expect(instructions).toMatch(/public career context/i);
    expect(instructions).toMatch(/never treat/i);
    expect(instructions).toMatch(/private analytics|legal proof|revenue|ROI|conversion/i);
    expect(instructions).toMatch(/URL/i);
  });

  it("exposes a server-side refresh function that writes sourced public web context as evidence", () => {
    expect(existsSync(edgeFunctionPath)).toBe(true);
    const source = readFileSync(edgeFunctionPath, "utf8");

    expect(source).toContain("buildPublicWebContextRequest");
    expect(source).toContain("normalizePublicWebContextOutput");
    expect(source).toContain("/v1/responses");
    expect(source).toContain('from("evidence_items")');
    expect(source).toContain('source_type: "public_web_context_refresh"');
    expect(source).toContain("manager_synthesis_runs");
    expect(source).toContain("ai_run_usage_events");
  });
});
