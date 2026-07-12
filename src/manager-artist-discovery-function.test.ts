import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeDiscoveryMemoryScope,
  readChartmetricEntityId,
} from "../supabase/functions/_shared/manager-agent/discoveryTools";

const discoveryFunctionSource = readFileSync(join(process.cwd(), "supabase", "functions", "manager-artist-discovery", "index.ts"), "utf8");
const discoveryToolsSource = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "manager-agent", "discoveryTools.ts"), "utf8");
const spotifyBootstrapSource = readFileSync(join(process.cwd(), "supabase", "functions", "spotify-catalog-bootstrap", "index.ts"), "utf8");

function readToolBlock(toolName: string) {
  const start = discoveryFunctionSource.indexOf(`name: "${toolName}"`);
  expect(start).toBeGreaterThan(-1);
  const nextTool = discoveryFunctionSource.indexOf("\n  {\n    type: \"function\"", start + toolName.length);
  const end = nextTool > start ? nextTool : discoveryFunctionSource.indexOf("\n];", start);
  return discoveryFunctionSource.slice(start, end);
}

describe("Manager artist discovery edge function", () => {
  it("replaces the deprecated Chartmetric setup enrichment function", () => {
    expect(existsSync(join(process.cwd(), "supabase", "functions", "chartmetric-setup-enrichment", "index.ts"))).toBe(false);
    expect(spotifyBootstrapSource).toContain("dispatchManagerArtistDiscovery");
    expect(spotifyBootstrapSource).toContain("manager-artist-discovery");
    expect(spotifyBootstrapSource).not.toContain("chartmetric-setup-enrichment");
  });

  it("authenticates and checks account membership before running autonomous discovery", () => {
    expect(discoveryFunctionSource).toContain("Deno.serve");
    expect(discoveryFunctionSource).toContain("Authorization");
    expect(discoveryFunctionSource).toContain("auth.getUser()");
    expect(discoveryFunctionSource).toContain("is_account_member");

    const authIndex = discoveryFunctionSource.indexOf("auth.getUser()");
    const membershipIndex = discoveryFunctionSource.indexOf("is_account_member");
    const loopIndex = discoveryFunctionSource.indexOf("const result = await runManagerAgentLoop");
    expect(authIndex).toBeGreaterThan(-1);
    expect(membershipIndex).toBeGreaterThan(authIndex);
    expect(loopIndex).toBeGreaterThan(membershipIndex);
  });

  it("runs a bounded manager agent loop with discovery tools and final structured output", () => {
    expect(discoveryFunctionSource).toContain("runManagerAgentLoop");
    expect(discoveryFunctionSource).toContain("manager_discovery_complete");
    expect(discoveryFunctionSource).toContain("chartmetric_artist_enrich");
    expect(discoveryFunctionSource).toContain("chartmetric_track_enrich");
    expect(discoveryFunctionSource).toContain("chartmetric_project_enrich");
    expect(discoveryFunctionSource).toContain("write_strategic_memory");
    expect(discoveryFunctionSource).toContain("save_public_evidence");
    expect(discoveryFunctionSource).toContain('type: "web_search"');
  });

  it("uses strict discovery tool schemas that force internal catalog IDs for paid asset enrichment", () => {
    const trackToolBlock = readToolBlock("chartmetric_track_enrich");
    const projectToolBlock = readToolBlock("chartmetric_project_enrich");

    expect(trackToolBlock).toContain("strict: true");
    expect(trackToolBlock).toContain('required: ["musicItemId"]');
    expect(trackToolBlock).not.toContain("spotifyTrackId");
    expect(trackToolBlock).not.toContain("isrc");

    expect(projectToolBlock).toContain("strict: true");
    expect(projectToolBlock).toContain('required: ["musicProjectId"]');
    expect(projectToolBlock).not.toContain("spotifyAlbumId");
    expect(projectToolBlock).not.toContain("upc");
  });

  it("keeps every strict discovery function schema compatible with OpenAI required-property validation", () => {
    for (const toolName of [
      "chartmetric_artist_enrich",
      "chartmetric_track_enrich",
      "chartmetric_project_enrich",
      "write_strategic_memory",
      "save_public_evidence",
    ]) {
      const toolBlock = readToolBlock(toolName);
      const requiredMatch = toolBlock.match(/required: \[([^\]]*)\]/);
      const propertiesBlock = toolBlock.match(/properties: \{([\s\S]*?)\n      \}/)?.[1] ?? "";
      const required = new Set((requiredMatch?.[1] ?? "").match(/"[^"]+"/g)?.map((value) => value.replaceAll('"', "")) ?? []);
      const properties = [...propertiesBlock.matchAll(/^\s{8}([a-zA-Z0-9_]+):/gm)].map((match) => match[1]);

      expect(properties.length, `${toolName} should declare testable parameters`).toBeGreaterThan(0);
      expect([...required].sort(), `${toolName} must require every declared property`).toEqual([...properties].sort());
    }
  });

  it("sets a setup-specific tool budget high enough for artist, web evidence, focus assets, memories, and finalization", () => {
    expect(discoveryFunctionSource).toContain("MAX_DISCOVERY_TOOL_CALLS");
    expect(discoveryFunctionSource).toContain("maxToolCalls: MAX_DISCOVERY_TOOL_CALLS");
  });

  it("fails required discovery when artist or focus-asset intelligence is incomplete", () => {
    expect(discoveryFunctionSource).toContain("manager_discovery_completed_with_limits");
    expect(discoveryFunctionSource).toContain("tool_failures");
    expect(discoveryFunctionSource).toContain("assertRequiredDiscoveryCompleted");
    expect(discoveryFunctionSource).toContain('status === "unresolved"');
    expect(discoveryFunctionSource).toContain("Required artist intelligence failed");

    const failedToolsIndex = discoveryFunctionSource.indexOf("const failedTools = result.toolTrace.filter");
    const completionIndex = discoveryFunctionSource.indexOf("completeDiscoverySetupStage");
    expect(failedToolsIndex).toBeGreaterThan(-1);
    expect(completionIndex).toBeGreaterThan(failedToolsIndex);
  });

  it("persists discovery completion before dispatching the context-aware setup phase", () => {
    expect(discoveryFunctionSource).toContain("manager_discovery_started");
    expect(discoveryFunctionSource).toContain("manager_discovery_tool_");
    expect(discoveryFunctionSource).toContain("manager_discovery_completed");
    expect(discoveryFunctionSource).not.toContain("manager_discovery_generating_brief");
    expect(discoveryFunctionSource).not.toContain("manager_discovery_brief_generated");
    expect(discoveryFunctionSource).not.toContain("generate-todays-brief");

    const completionIndex = discoveryFunctionSource.indexOf("await completeDiscoverySetupStage");
    const contextualizeIndex = discoveryFunctionSource.indexOf("scheduleBackgroundTask(dispatchContextualizePhase");
    expect(completionIndex).toBeGreaterThan(-1);
    expect(contextualizeIndex).toBeGreaterThan(completionIndex);
  });

  it("loads Spotify catalog context from the stored metadata shape before selecting focus assets", () => {
    expect(discoveryFunctionSource).toContain('metadata?.spotify?.track_id');
    expect(discoveryFunctionSource).toContain('metadata?.spotify?.isrc');
    expect(discoveryFunctionSource).toContain('metadata?.spotify?.album_id');
    expect(discoveryFunctionSource).toContain('metadata?.spotify?.upc');
  });
});

describe("Manager discovery shared tools", () => {
  it("parses every Chartmetric get-ids response shape used by the old reliable enrichment functions", () => {
    expect(readChartmetricEntityId({ obj: [{ cm_track: 12345 }] })).toBe("12345");
    expect(readChartmetricEntityId({ obj: [{ cm_album: "45678" }] })).toBe("45678");
    expect(readChartmetricEntityId({ obj: [{ chartmetric_ids: [98765] }] })).toBe("98765");
    expect(readChartmetricEntityId({ obj: [{ chartmetric_id: "24680" }] })).toBe("24680");
    expect(readChartmetricEntityId({ obj: [{ id: 13579 }] })).toBe("13579");
    expect(readChartmetricEntityId({ cm_artist: 11223 })).toBe("11223");
  });

  it("uses DB-valid manager memory scopes instead of prompt-only labels", () => {
    expect(normalizeDiscoveryMemoryScope(undefined)).toBe("artist");
    expect(normalizeDiscoveryMemoryScope("strategic")).toBe("artist");
    expect(normalizeDiscoveryMemoryScope("general")).toBe("artist");
    expect(normalizeDiscoveryMemoryScope("music_item")).toBe("music_item");
    expect(normalizeDiscoveryMemoryScope("music_project")).toBe("music_project");
  });

  it("resolves internal focus asset IDs through stored music identifiers before paid Chartmetric lookups", () => {
    expect(discoveryToolsSource).toContain('from("music_identifiers")');
    expect(discoveryToolsSource).toContain('eq("music_item_id", musicItemId)');
    expect(discoveryToolsSource).toContain('eq("music_project_id", musicProjectId)');
    expect(discoveryToolsSource).toContain('"spotify_track_id"');
    expect(discoveryToolsSource).toContain('"spotify_album_id"');
    expect(discoveryToolsSource).toContain('"isrc"');
    expect(discoveryToolsSource).toContain('"upc"');
  });

  it("falls back to Spotify identifiers in catalog metadata when normalized identifier rows are missing", () => {
    expect(discoveryToolsSource).toContain("loadMusicItemIdentity");
    expect(discoveryToolsSource).toContain('readNestedString(musicItem?.metadata, ["spotify", "track_id"])');
    expect(discoveryToolsSource).toContain('readNestedString(musicItem?.metadata, ["external_ids", "isrc"])');
    expect(discoveryToolsSource).toContain("loadMusicProjectIdentity");
    expect(discoveryToolsSource).toContain('readNestedString(musicProject?.metadata, ["spotify", "album_id"])');
    expect(discoveryToolsSource).toContain('readNestedString(musicProject?.metadata, ["external_ids", "upc"])');
  });

  it("does not write track or project evidence against the artist when the internal subject ID is missing", () => {
    expect(discoveryToolsSource).toContain("resolveTrackDiscoveryIdentifiers");
    expect(discoveryToolsSource).toContain("resolveProjectDiscoveryIdentifiers");
    expect(discoveryToolsSource).toContain('throw new Error("chartmetric_track_enrich requires musicItemId');
    expect(discoveryToolsSource).toContain('throw new Error("chartmetric_project_enrich requires musicProjectId');
  });

  it("uses cached source snapshots before making Chartmetric requests", () => {
    expect(discoveryToolsSource).toContain("checkCachedSnapshot");
    expect(discoveryToolsSource).toContain("metadataMatch");
    expect(discoveryToolsSource).toContain('.contains("metadata", metadataMatch)');
    expect(discoveryToolsSource).toContain("24 * 60 * 60 * 1000");
    expect(discoveryToolsSource).toContain('snapshot_type", snapshotType');
    expect(discoveryToolsSource).toContain("getCachedEvidenceItems");

    const cacheIndex = discoveryToolsSource.indexOf("const cached = await checkCachedSnapshot");
    const clientIndex = discoveryToolsSource.indexOf("const chartmetric = createChartmetricClient");
    expect(cacheIndex).toBeGreaterThan(-1);
    expect(clientIndex).toBeGreaterThan(cacheIndex);
  });

  it("preserves Chartmetric provider errors instead of converting them into unresolved IDs", () => {
    expect(discoveryToolsSource).not.toContain("get-ids`).catch(() => null)");
    expect(discoveryToolsSource).toContain("Chartmetric artist ID lookup failed");
    expect(discoveryToolsSource).toContain("Chartmetric track ID lookup failed");
    expect(discoveryToolsSource).toContain("Chartmetric project ID lookup failed");
  });

  it("writes durable manager memory and public evidence through dedicated tools", () => {
    expect(discoveryToolsSource).toContain("writeStrategicMemory");
    expect(discoveryToolsSource).toContain('from("memory_entries")');
    expect(discoveryToolsSource).toContain('source_type: "manager_reasoning"');
    expect(discoveryToolsSource).toContain("savePublicEvidence");
    expect(discoveryToolsSource).toContain('source_kind: "public_web"');
    expect(discoveryToolsSource).toContain("public_career_context");
  });

  it("uses the old enrichment functions' supplemental Chartmetric reads inside the agentic tools", () => {
    expect(discoveryToolsSource).toContain("fetchTrackDiscoverySupplementals");
    expect(discoveryToolsSource).toContain("spotify/stats/highest-playcounts");
    expect(discoveryToolsSource).toContain("tiktok/stats/most-history");
    expect(discoveryToolsSource).toContain("spotify/playlists/snapshot");
    expect(discoveryToolsSource).toContain("fetchProjectDiscoverySupplementals");
    expect(discoveryToolsSource).toContain("spotify/current/playlists");
    expect(discoveryToolsSource).toContain("/tracks");
  });
});
