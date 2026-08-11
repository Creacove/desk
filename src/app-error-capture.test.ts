import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureAppError,
  normalizeAppError,
} from "../supabase/functions/_shared/appError";

const requestId = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("central application error normalization", () => {
  it("preserves nested provider diagnostics and explicit account identity", () => {
    const error = new Error("OpenAI failed", {
      cause: {
        status: 429,
        code: "insufficient_quota",
        request_id: "req_123",
        message: "You exceeded your current quota.",
      },
    });

    const row = normalizeAppError(error, {
      functionName: "manager-conversation",
      operation: "generate_reply",
      accountEmail: "artist@example.com",
      requestId,
      provider: "openai",
      context: { conversationId: "conversation-1" },
    });

    expect(row.error_message).toBe("OpenAI failed");
    expect(row.error_details).toMatchObject({
      cause: expect.objectContaining({
        code: "insufficient_quota",
        message: "You exceeded your current quota.",
      }),
    });
    expect(row.provider_request_id).toBe("req_123");
    expect(row.provider_status).toBe(429);
    expect(row.account_email).toBe("artist@example.com");
    expect(row.request_id).toBe(requestId);
  });

  it("keeps Supabase fields while scrubbing credentials and high-risk bodies", () => {
    const row = normalizeAppError({
      name: "PostgrestError",
      code: "23505",
      message: "duplicate key value violates unique constraint",
      details: "Key (dedupe_key) already exists.",
      hint: "Use a unique request ID.",
      authorization: "Bearer secret-token",
      request_body: { password: "hunter2", prompt: "private full prompt" },
    }, {
      functionName: "paid-workspace-setup",
      operation: "persist_stage",
      context: {
        safeId: "setup-1",
        apiKey: "sk-secret",
        signedUrl: "https://storage.example/file?token=secret&expires=123",
      },
    });

    expect(row.error_code).toBe("23505");
    expect(row.error_details).toMatchObject({
      code: "23505",
      details: "Key (dedupe_key) already exists.",
      hint: "Use a unique request ID.",
    });
    expect(row.context).toMatchObject({ safeId: "setup-1" });
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("private full prompt");
    expect(serialized).not.toContain("sk-secret");
    expect(serialized).not.toContain("token=secret");
    expect(serialized).toContain("[REDACTED]");
  });

  it("bounds oversized diagnostics and records truncation metadata", () => {
    const row = normalizeAppError(new Error("x".repeat(20_000)), {
      functionName: "mission-genesis",
      operation: "generate_mission",
      context: { oversized: "y".repeat(40_000) },
    });

    expect(new TextEncoder().encode(String(row.error_message)).length).toBeLessThanOrEqual(8_192);
    expect(row.context).toMatchObject({
      __truncated: true,
      originalBytes: expect.any(Number),
    });
  });

  it("produces a stable fingerprint without crashing on circular values", () => {
    const circular: Record<string, unknown> = { code: "boom" };
    circular.self = circular;
    const first = normalizeAppError(circular, {
      functionName: "workflow-recovery",
      operation: "claim_setup",
    });
    const second = normalizeAppError(circular, {
      functionName: "workflow-recovery",
      operation: "claim_setup",
    });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.error_details).toMatchObject({ self: "[Circular]" });
  });
});

describe("central application error persistence", () => {
  it("persists through the service-role REST boundary and returns the event ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{ id: "22222222-2222-4222-8222-222222222222" }]),
      { status: 201, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Deno", {
      env: {
        get: (name: string) => ({
          SUPABASE_URL: "https://project.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-secret",
          APP_ENVIRONMENT: "production",
          APP_RELEASE: "release-1",
        })[name],
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const id = await captureAppError(new Error("database unavailable"), {
      functionName: "manager-conversation",
      operation: "load_context",
      requestId,
    });

    expect(id).toBe("22222222-2222-4222-8222-222222222222");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/app_error_events",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "service-secret",
          Authorization: "Bearer service-secret",
          Prefer: "return=representation",
        }),
      }),
    );
  });

  it("never masks the original failure when persistence is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    vi.stubGlobal("Deno", {
      env: { get: (name: string) => name === "SUPABASE_URL" ? "https://project.supabase.co" : "service-secret" },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(captureAppError(new Error("original failure"), {
      functionName: "manager-conversation",
      operation: "generate_reply",
    })).resolves.toBeNull();

    expect(consoleError).toHaveBeenCalledWith(
      "app_error_event",
      expect.objectContaining({ error_message: "original failure" }),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "app_error_persistence_failed",
      expect.objectContaining({ persistenceError: "network down" }),
    );
  });
});
