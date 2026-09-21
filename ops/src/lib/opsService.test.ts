import { describe, expect, it } from "vitest";
import { buildMusicPath, getNextAction, validateCaseDraft } from "./opsService";

describe("Ops service contracts", () => {
  it("requires one primary contact and one music source before submission", () => {
    expect(validateCaseDraft({
      display_name: "", source: "", release_timing: "upcoming",
      primary_contact_email: "", primary_contact_handle: "",
      music_url: "", music_file: null,
    })).toContain("project name");

    expect(validateCaseDraft({
      display_name: "Nova", source: "Instagram", release_timing: "upcoming",
      primary_contact_email: "", primary_contact_handle: "@nova",
      music_url: "", music_file: null,
    })).toContain("music link or upload");

    expect(validateCaseDraft({
      display_name: "Nova", source: "Instagram", release_timing: "upcoming",
      primary_contact_email: "nova@example.com", primary_contact_handle: "",
      music_url: "https://example.com/song", music_file: null,
    })).toBeNull();
  });

  it("creates a stable private storage path scoped to the case", () => {
    expect(buildMusicPath("1f2e3d4c-1111-2222-3333-444455556666", "demo mix.wav"))
      .toBe("1f2e3d4c-1111-2222-3333-444455556666/demo-mix.wav");
  });

  it("maps today items to an explicit action without hiding failures", () => {
    expect(getNextAction({ kind: "failed_processing", action: "Retry" }).label).toBe("Retry");
    expect(getNextAction({ kind: "transcript_ready", action: "Process in Desk" }).tone).toBe("accent");
    expect(getNextAction({ kind: "desk_link_missing", action: "Link Desk" }).label).toBe("Link Desk");
  });
});
