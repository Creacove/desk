import { describe, expect, it } from "vitest";
import {
  MusicManagerReadFailure,
  publicMusicManagerReadFailure,
  toPublicMusicManagerReadFailure,
} from "../supabase/functions/_shared/musicManagerReadErrors";

describe("Music Manager Read safe failures", () => {
  it("maps provider throttling and outages to one stable retryable message", () => {
    expect(publicMusicManagerReadFailure("openai_http", 429)).toEqual({
      code: "manager_read_temporarily_unavailable",
      message: "Manager Read is temporarily unavailable. Try again shortly.",
    });
    expect(publicMusicManagerReadFailure("openai_http", 503)).toEqual({
      code: "manager_read_temporarily_unavailable",
      message: "Manager Read is temporarily unavailable. Try again shortly.",
    });
  });

  it("uses a reliability-specific message for invalid model output", () => {
    expect(publicMusicManagerReadFailure("invalid_output")).toEqual({
      code: "manager_read_invalid_response",
      message: "Manager Read could not produce a reliable result. Try again.",
    });
  });

  it("does not expose raw provider or database diagnostics", () => {
    const failure = new MusicManagerReadFailure("openai_http", {
      providerStatus: 400,
      diagnostic: "raw provider request body with internal database identifiers",
    });
    const safe = toPublicMusicManagerReadFailure(failure);
    expect(safe).toEqual({
      code: "manager_read_request_failed",
      message: "Manager Read could not be completed. Try again.",
    });
    expect(JSON.stringify(safe)).not.toMatch(/provider request body|database identifiers/i);
  });

  it("maps unknown failures to the stable internal message", () => {
    expect(toPublicMusicManagerReadFailure(new Error("SUPABASE_SERVICE_ROLE_KEY missing"))).toEqual({
      code: "manager_read_failed",
      message: "Manager Read could not be completed. Try again.",
    });
  });
});
