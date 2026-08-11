import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureAppError = vi.fn();

vi.mock("../supabase/functions/_shared/appError", () => ({ captureAppError }));

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => {
  captureAppError.mockReset();
  captureAppError.mockResolvedValue("22222222-2222-4222-8222-222222222222");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Edge application error boundary", () => {
  it("captures handled 5xx responses and returns request correlation headers", async () => {
    const { withAppErrorCapture } = await import("../supabase/functions/_shared/appFunction");
    const wrapped = withAppErrorCapture(
      "example",
      async () => new Response(JSON.stringify({ error: "Public failure" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await wrapped(new Request("https://example.test/functions/v1/example", { method: "POST" }));

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
    expect(response.headers.get("x-error-event-id")).toBe("22222222-2222-4222-8222-222222222222");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("x-error-event-id");
    expect(captureAppError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Public failure" }),
      expect.objectContaining({
        functionName: "example",
        operation: "request",
        httpStatus: 500,
        publicMessage: "Public failure",
      }),
    );
  });

  it("accepts a valid inbound request ID and makes it available to the handler", async () => {
    const { withAppErrorCapture } = await import("../supabase/functions/_shared/appFunction");
    let observedRequestId: string | null = null;
    const wrapped = withAppErrorCapture("example", async (request) => {
      observedRequestId = request.headers.get("x-request-id");
      return new Response(null, { status: 204 });
    });

    const response = await wrapped(new Request("https://example.test/functions/v1/example", {
      headers: { "x-request-id": "11111111-1111-4111-8111-111111111111" },
    }));

    expect(observedRequestId).toBe("11111111-1111-4111-8111-111111111111");
    expect(response.headers.get("x-request-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(captureAppError).not.toHaveBeenCalled();
  });

  it("replaces invalid request IDs and decorates preflight headers", async () => {
    const { withAppErrorCapture } = await import("../supabase/functions/_shared/appFunction");
    const wrapped = withAppErrorCapture("example", async () => new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Headers": "authorization, content-type" },
    }));

    const response = await wrapped(new Request("https://example.test/functions/v1/example", {
      method: "OPTIONS",
      headers: { "x-request-id": "not-a-uuid" },
    }));

    expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
    expect(response.headers.get("x-request-id")).not.toBe("not-a-uuid");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("x-request-id");
  });

  it("captures unhandled exceptions and returns a safe JSON failure", async () => {
    const { withAppErrorCapture } = await import("../supabase/functions/_shared/appFunction");
    const wrapped = withAppErrorCapture("example", async () => {
      throw new Error("database password leaked internally");
    });

    const response = await wrapped(new Request("https://example.test/functions/v1/example"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "The request could not be completed.",
      errorEventId: "22222222-2222-4222-8222-222222222222",
    });
    expect(JSON.stringify(body)).not.toContain("password leaked");
    expect(captureAppError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "database password leaked internally" }),
      expect.objectContaining({ functionName: "example", operation: "request" }),
    );
  });

  it("does not duplicate explicitly captured failures or record expected 4xx responses", async () => {
    const { withAppErrorCapture } = await import("../supabase/functions/_shared/appFunction");
    const captured = withAppErrorCapture("example", async () => new Response("failure", {
      status: 500,
      headers: { "x-error-captured": "1", "x-error-event-id": "33333333-3333-4333-8333-333333333333" },
    }));
    const expected = withAppErrorCapture("example", async () => new Response("unauthorized", { status: 401 }));

    const capturedResponse = await captured(new Request("https://example.test/functions/v1/example"));
    await expected(new Request("https://example.test/functions/v1/example"));

    expect(captureAppError).not.toHaveBeenCalled();
    expect(capturedResponse.headers.get("x-error-captured")).toBeNull();
    expect(capturedResponse.headers.get("x-error-event-id")).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("marks an explicit high-fidelity error response so the boundary does not duplicate it", async () => {
    const { markErrorCaptured, withAppErrorCapture } = await import("../supabase/functions/_shared/appFunction");
    const wrapped = withAppErrorCapture("example", async () => markErrorCaptured(
      new Response(JSON.stringify({ error: "Safe message" }), { status: 500 }),
      "44444444-4444-4444-8444-444444444444",
    ));

    const response = await wrapped(new Request("https://example.test/functions/v1/example"));

    expect(captureAppError).not.toHaveBeenCalled();
    expect(response.headers.get("x-error-captured")).toBeNull();
    expect(response.headers.get("x-error-event-id")).toBe("44444444-4444-4444-8444-444444444444");
  });
});
