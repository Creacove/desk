import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const appSource = source("src/app/ProductionApp.tsx");
const serviceSource = source("src/services/productionSupabase.ts");
const musicSource = source("src/features/music/MusicScreens.tsx");
const rightsSource = source("src/features/music/songRights.ts");
const staffSource = source("src/features/staff/StaffScreens.tsx");
const liveSyncSource = source("src/services/workspaceLiveSync.ts");
const shareSource = source("supabase/functions/music-share-links/index.ts");
const publicShareSource = source("supabase/functions/public-music-share/index.ts");
const opportunitySource = source("src/features/manager/OpportunityArtifact.tsx");
const conversationalWorkspaceMigration = source("supabase/migrations/20260808000100_conversational_song_workspace.sql");
const releaseFoundationMigration = source("supabase/migrations/20260812000100_release_success_foundation.sql");

describe("release-success cross-Hub regression contracts", () => {
  it.each([
    ["authentication and account setup", appSource, ["createSupabaseAuthAdapter", "createSupabaseWorkspaceLoader", "setupStatus"]],
    ["Spotify catalog import and provider dates", serviceSource, ["createSupabaseSpotifyArtistAdapter", "spotify-catalog", "released_at"]],
    ["manual and conversational song creation idempotency", conversationalWorkspaceMigration, ["create_conversational_song_workspace_v2", "create_manual_song_workspace_v1", "on conflict"]],
    ["Music list/detail hydration", serviceSource, ["loadMusicList", "loadMusicObject", "releaseOpportunityArtifacts"]],
    ["project, EP, and album screens", musicSource, ["projectDetail", '"ep"', '"album"']],
    ["audio and artwork uploads", serviceSource, ["uploadAsset", "MUSIC_UPLOADS_BUCKET", "cover_art"]],
    ["credit editing", serviceSource, ["saveCredit", "music_credits"]],
    ["split allocation and confirmation locking", musicSource, ["Set up splits", "Send split confirmation links", "approvalLog"]],
    ["mission list/detail and task completion", appSource, ["loadMissions", "completeMissionTask", "missionsWorkspace"]],
    ["Today's Brief", appSource, ["todayBrief", "activeTodayBriefRun", "brief generated"]],
    ["artist discovery and Manager Read", serviceSource, ["previewCatalog", "managerReadStatus", "managerReadSummary"]],
    ["document editing", musicSource, ["updateSongDocument", "DocumentEditor"]],
    ["public share access and immutable manifests", `${shareSource}\n${publicShareSource}`, ["information_manifest", "document_versions", "record_music_share_link_access"]],
    ["billing and entitlements", appSource, ["billingService", "entitlementActive", "openCustomerPortal"]],
    ["specialist agent lock states", staffSource, ["LockedAgentWorkspace", "locked"]],
    ["live-sync deduplication", `${liveSyncSource}\n${appSource}`, ["mergeWorkspaceInvalidations", "pendingInvalidations", "useWorkspaceLiveSync"]],
  ] as const)("preserves %s", (_name, fileSource, markers) => {
    for (const marker of markers) expect(fileSource).toContain(marker);
  });

  it("keeps release opportunity rendering additive and inside the existing song conversation", () => {
    expect(appSource).toContain("onPrepareOpportunityPitch");
    expect(appSource).toContain("onRecordOpportunityOutcome");
    expect(appSource).not.toContain('navigate("opportunitiesWorkspace")');
    expect(opportunitySource).toContain("Open Files to create share link");
    expect(opportunitySource).not.toMatch(/sendEmail|sendOutreach|submitTo/i);
    expect(opportunitySource).toContain("rel=\"noreferrer\"");
  });

  it("does not give release-success work authority to mutate provider release dates", () => {
    expect(serviceSource).not.toMatch(/\.update\(\{[^}]*planned_release_date/i);
    expect(serviceSource).not.toMatch(/\.insert\(\{[^}]*planned_release_date/i);
    expect(releaseFoundationMigration).toContain("planned_release_date");
    expect(releaseFoundationMigration).toContain("music_release_plans");
  });
});
