import { describe, expect, it } from "vitest";
import { createChartmetricClient } from "../supabase/functions/_shared/chartmetricClient";

describe("Chartmetric client", () => {
  it("exchanges the refresh token for a bearer token before API requests", async () => {
    const calls: FetchCall[] = [];
    const client = createChartmetricClient({
      refreshToken: "refresh-token-1",
      fetch: createFetchStub(calls, [
        jsonResponse({ token: "access-token-1", expires_in: 3600 }),
        jsonResponse({ obj: { id: 123, name: "Sable Day" } }, { "X-RateLimit-Remaining": "99" }),
      ]),
    });

    const response = await client.requestJson<{ obj: { id: number; name: string } }>("/api/artist/123");

    expect(response.data.obj).toEqual({ id: 123, name: "Sable Day" });
    expect(response.rateLimit.remaining).toBe("99");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      url: "https://api.chartmetric.com/api/token",
      method: "POST",
      body: JSON.stringify({ refreshtoken: "refresh-token-1" }),
    });
    expect(calls[1]).toMatchObject({
      url: "https://api.chartmetric.com/api/artist/123",
      method: "GET",
    });
    expect(calls[1].headers.authorization).toBe("Bearer access-token-1");
  });

  it("reuses an unexpired access token inside one function invocation", async () => {
    const calls: FetchCall[] = [];
    const client = createChartmetricClient({
      refreshToken: "refresh-token-1",
      now: () => 1_000,
      fetch: createFetchStub(calls, [
        jsonResponse({ token: "access-token-1", expires_in: 3600 }),
        jsonResponse({ obj: { id: 1 } }),
        jsonResponse({ obj: { id: 2 } }),
      ]),
    });

    await client.requestJson("/api/artist/1");
    await client.requestJson("/api/artist/2");

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.chartmetric.com/api/token",
      "https://api.chartmetric.com/api/artist/1",
      "https://api.chartmetric.com/api/artist/2",
    ]);
  });

  it("refreshes the access token once and retries when Chartmetric returns 401", async () => {
    const calls: FetchCall[] = [];
    const client = createChartmetricClient({
      refreshToken: "refresh-token-1",
      fetch: createFetchStub(calls, [
        jsonResponse({ token: "access-token-1", expires_in: 3600 }),
        jsonResponse({ error: "expired" }, {}, 401),
        jsonResponse({ token: "access-token-2", expires_in: 3600 }),
        jsonResponse({ obj: { id: 123, name: "Sable Day" } }),
      ]),
    });

    const response = await client.requestJson<{ obj: { id: number; name: string } }>("/api/artist/123");

    expect(response.data.obj.id).toBe(123);
    expect(calls.map((call) => call.headers.authorization).filter(Boolean)).toEqual([
      "Bearer access-token-1",
      "Bearer access-token-2",
    ]);
    expect(calls.filter((call) => call.url.endsWith("/api/token"))).toHaveLength(2);
  });

  it("throws a safe configuration error when the refresh token is missing", () => {
    expect(() => createChartmetricClient({ refreshToken: " " })).toThrow("Chartmetric refresh token is not configured.");
  });

  it("preserves rate limit metadata from Chartmetric responses", async () => {
    const client = createChartmetricClient({
      refreshToken: "refresh-token-1",
      fetch: createFetchStub([], [
        jsonResponse({ token: "access-token-1", expires_in: 3600 }),
        jsonResponse(
          { obj: { id: 123 } },
          {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "42",
            "X-RateLimit-Reset": "1710000000",
          },
        ),
      ]),
    });

    const response = await client.requestJson("/api/artist/123");

    expect(response.rateLimit).toEqual({
      limit: "100",
      remaining: "42",
      reset: "1710000000",
    });
  });
});

type FetchCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

function createFetchStub(calls: FetchCall[], responses: Response[]) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: input.toString(),
      method: init?.method ?? "GET",
      headers: normalizeHeaders(init?.headers),
      body: typeof init?.body === "string" ? init.body : undefined,
    });

    const response = responses.shift();
    if (!response) {
      throw new Error("Unexpected fetch call.");
    }
    return response;
  };
}

function jsonResponse(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function normalizeHeaders(headers: HeadersInit | undefined) {
  if (!headers) return {};
  return Object.fromEntries(new Headers(headers).entries());
}
