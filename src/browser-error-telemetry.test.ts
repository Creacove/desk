import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { installBrowserErrorTelemetry, reportBrowserServiceError } from "./lib/errorTelemetry";

describe("browser error telemetry", () => {
  it("captures window errors and unhandled rejections without throwing", async () => {
    const capture = vi.fn().mockRejectedValue(new Error("telemetry unavailable"));
    const dispose = installBrowserErrorTelemetry({ capture, dedupeWindowMs: 10_000 });

    window.dispatchEvent(new ErrorEvent("error", {
      message: "render exploded",
      error: Object.assign(new Error("render exploded"), { token: "secret" }),
      filename: "https://desk.example/assets/app.js",
      lineno: 42,
      colno: 8,
    }));
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), {
      promise: Promise.resolve(),
      reason: new Error("request exploded"),
    }));
    await Promise.resolve();

    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({
      operation: "window_error",
      message: "render exploded",
      context: expect.objectContaining({ line: 42, column: 8 }),
    }));
    expect(JSON.stringify(capture.mock.calls)).not.toContain("secret");
    dispose();
  });

  it("coalesces the same fingerprint during the dedupe window", () => {
    const capture = vi.fn().mockResolvedValue(undefined);
    const dispose = installBrowserErrorTelemetry({ capture, dedupeWindowMs: 10_000 });
    const event = () => window.dispatchEvent(new ErrorEvent("error", { message: "same", error: new Error("same") }));

    event();
    event();

    expect(capture).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("captures handled release workflow failures with a stage and safe identifiers", () => {
    const capture = vi.fn().mockResolvedValue(undefined);
    const dispose = installBrowserErrorTelemetry({ capture });
    reportBrowserServiceError(new Error("refresh failed"), {
      stage: "realtime_refresh",
      musicItemId: "song-1",
      requestId: "request-1",
      prompt: "private prompt",
    });
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({
      operation: "service_call_failed",
      message: "refresh failed",
      context: expect.objectContaining({ stage: "realtime_refresh", musicItemId: "song-1", requestId: "request-1" }),
    }));
    expect(JSON.stringify(capture.mock.calls)).not.toContain("private prompt");
    dispose();
  });

  it("uses an authenticated, bounded endpoint that derives identity server-side", () => {
    const source = readFileSync(join(process.cwd(), "supabase/functions/capture-browser-error/index.ts"), "utf8");
    expect(source).toContain('auth.getUser()');
    expect(source).toContain('operation: input.operation');
    expect(source).toContain('source: "client"');
    expect(source).toContain('accountEmail: user.email');
    expect(source).toContain('withAppErrorCapture("capture-browser-error"');
    expect(source).not.toMatch(/input\.(?:userId|accountEmail)/);
    expect(source).toContain("MAX_MESSAGE_LENGTH");
    expect(source).toContain("ALLOWED_OPERATIONS");
  });

  it("installs only for the private production application", () => {
    const source = readFileSync(join(process.cwd(), "src/main.tsx"), "utf8");
    expect(source).toContain("installBrowserErrorTelemetry");
    expect(source).toContain('import.meta.env.PROD');
    expect(source).toContain("!splitConfirmationToken && !publicShareToken");
    expect(source).toContain('functions.invoke("capture-browser-error"');
  });
});
