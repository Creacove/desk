import { captureAppError } from "./appError.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_HEADER = "x-request-id";
const ERROR_EVENT_ID_HEADER = "x-error-event-id";
const CAPTURED_HEADER = "x-error-captured";

export function withAppErrorCapture(
  functionName: string,
  handler: (request: Request) => Promise<Response> | Response,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
    const startedAt = Date.now();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(REQUEST_ID_HEADER, requestId);
    const correlatedRequest = new Request(request, { headers: requestHeaders });

    try {
      const response = await handler(correlatedRequest);
      let errorEventId = response.headers.get(ERROR_EVENT_ID_HEADER);
      const wasCaptured = response.headers.get(CAPTURED_HEADER) === "1";

      if (response.status >= 500 && !wasCaptured) {
        const publicMessage = await readPublicMessage(response.clone());
        errorEventId = await captureAppError(new Error(publicMessage), {
          functionName,
          operation: "request",
          source: "edge",
          publicMessage,
          route: safeRoute(request.url),
          requestId,
          httpStatus: response.status,
          latencyMs: Date.now() - startedAt,
          context: { method: request.method, capturedAtBoundary: true },
        });
      }

      return decorateResponse(response, requestId, errorEventId);
    } catch (error) {
      const publicMessage = "The request could not be completed.";
      const errorEventId = await captureAppError(error, {
        functionName,
        operation: "request",
        source: "edge",
        publicMessage,
        route: safeRoute(request.url),
        requestId,
        httpStatus: 500,
        latencyMs: Date.now() - startedAt,
        context: { method: request.method, unhandled: true },
      });
      return decorateResponse(new Response(JSON.stringify({
        error: publicMessage,
        errorEventId,
      }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }), requestId, errorEventId);
    }
  };
}

function decorateResponse(response: Response, requestId: string, errorEventId: string | null): Response {
  const headers = new Headers(response.headers);
  headers.delete(CAPTURED_HEADER);
  headers.set(REQUEST_ID_HEADER, requestId);
  appendHeaderValue(headers, "Access-Control-Allow-Headers", REQUEST_ID_HEADER);
  appendHeaderValue(headers, "Access-Control-Expose-Headers", REQUEST_ID_HEADER);
  appendHeaderValue(headers, "Access-Control-Expose-Headers", ERROR_EVENT_ID_HEADER);
  if (errorEventId) headers.set(ERROR_EVENT_ID_HEADER, errorEventId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function appendHeaderValue(headers: Headers, name: string, value: string) {
  const current = headers.get(name)?.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean) ?? [];
  if (!current.includes(value.toLowerCase())) current.push(value);
  headers.set(name, current.join(", "));
}

async function readPublicMessage(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get("Content-Type") ?? "";
    if (/application\/json/i.test(contentType)) {
      const body = await response.json() as { error?: unknown; message?: unknown };
      const message = typeof body.error === "string" ? body.error : typeof body.message === "string" ? body.message : "";
      if (message.trim()) return message.trim().slice(0, 8_192);
    } else {
      const text = (await response.text()).trim();
      if (text) return text.slice(0, 8_192);
    }
  } catch {
    // The status and request correlation still provide a useful boundary event.
  }
  return `Request failed with status ${response.status}.`;
}

function resolveRequestId(value: string | null): string {
  if (value && UUID_PATTERN.test(value)) return value;
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeRoute(url: string): string {
  try {
    return new URL(url).pathname.slice(0, 1_024);
  } catch {
    return "";
  }
}
