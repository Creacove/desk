import { describe, expect, it } from "vitest";
import { shouldAutomaticallyRefreshMusicRead } from "../supabase/functions/_shared/music-manager-read/refreshPolicy";

describe("music Manager Read refresh policy", () => {
  it("refreshes an unreleased song after material release work changes", () => {
    expect(shouldAutomaticallyRefreshMusicRead({ mode: "pre_release", eventType: "music_asset_uploaded" })).toBe(true);
    expect(shouldAutomaticallyRefreshMusicRead({ mode: "pre_release", eventType: "music_audio_analysis_completed" })).toBe(true);
    expect(shouldAutomaticallyRefreshMusicRead({ mode: "release_window", eventType: "music_split_confirmation_sent" })).toBe(true);
  });

  it("does not reopen released catalog readiness for pre-release-only events", () => {
    expect(shouldAutomaticallyRefreshMusicRead({ mode: "post_release", eventType: "music_split_confirmation_sent" })).toBe(false);
    expect(shouldAutomaticallyRefreshMusicRead({ mode: "post_release", eventType: "music_metadata_updated" })).toBe(true);
    expect(shouldAutomaticallyRefreshMusicRead({ mode: "post_release", eventType: "music_audio_analysis_completed" })).toBe(true);
  });

  it("never schedules a Manager Read from its own completion or unrelated activity", () => {
    expect(shouldAutomaticallyRefreshMusicRead({ mode: "pre_release", eventType: "music_manager_read_generated" })).toBe(false);
    expect(shouldAutomaticallyRefreshMusicRead({ mode: "pre_release", eventType: "music_share_link_created" })).toBe(false);
  });
});
