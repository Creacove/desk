export type BrowserErrorOperation =
  | "window_error"
  | "unhandled_rejection"
  | "react_error_boundary"
  | "service_call_failed";

export type BrowserErrorPayload = {
  operation: BrowserErrorOperation;
  message: string;
  stack?: string;
  route: string;
  context: Record<string, unknown>;
};

type BrowserErrorTelemetryOptions = {
  capture: (payload: BrowserErrorPayload) => Promise<unknown>;
  dedupeWindowMs?: number;
};

const MAX_MESSAGE_LENGTH = 8_192;
const MAX_STACK_LENGTH = 32_768;
const SENSITIVE_KEY = /authorization|cookie|password|secret|token|api[_-]?key|card|cvv|body|prompt|lyrics|document|content/i;
let activeSubmit: ((payload: BrowserErrorPayload) => void) | undefined;

export function installBrowserErrorTelemetry({
  capture,
  dedupeWindowMs = 10_000,
}: BrowserErrorTelemetryOptions) {
  const recentlySent = new Map<string, number>();

  const submit = (payload: BrowserErrorPayload) => {
    const fingerprint = `${payload.operation}|${payload.message}|${payload.stack?.split("\n")[1] ?? ""}`;
    const now = Date.now();
    if ((recentlySent.get(fingerprint) ?? 0) > now - dedupeWindowMs) return;
    recentlySent.set(fingerprint, now);
    for (const [key, sentAt] of recentlySent) {
      if (sentAt <= now - dedupeWindowMs) recentlySent.delete(key);
    }
    void Promise.resolve(capture(payload)).catch(() => undefined);
  };
  activeSubmit = submit;

  const onError = (event: ErrorEvent) => {
    const error = event.error instanceof Error ? event.error : null;
    submit({
      operation: "window_error",
      message: bounded(error?.message || event.message || "Uncaught browser error", MAX_MESSAGE_LENGTH),
      stack: error?.stack ? bounded(error.stack, MAX_STACK_LENGTH) : undefined,
      route: bounded(window.location.pathname, 1_024),
      context: sanitizeContext({
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      }),
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : null;
    submit({
      operation: "unhandled_rejection",
      message: bounded(error?.message || safeMessage(reason), MAX_MESSAGE_LENGTH),
      stack: error?.stack ? bounded(error.stack, MAX_STACK_LENGTH) : undefined,
      route: bounded(window.location.pathname, 1_024),
      context: {},
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    recentlySent.clear();
    if (activeSubmit === submit) activeSubmit = undefined;
  };
}

export function reportBrowserServiceError(error: unknown, context: Record<string, unknown> = {}) {
  if (!activeSubmit) return;
  const normalized = error instanceof Error ? error : new Error(safeMessage(error));
  activeSubmit({
    operation: "service_call_failed",
    message: bounded(normalized.message || "Browser service call failed", MAX_MESSAGE_LENGTH),
    stack: normalized.stack ? bounded(normalized.stack, MAX_STACK_LENGTH) : undefined,
    route: bounded(window.location.pathname, 1_024),
    context: sanitizeContext(context),
  });
}

function sanitizeContext(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SENSITIVE_KEY.test(key))
    .slice(0, 40)
    .map(([key, nested]) => [key, typeof nested === "string" ? bounded(nested, 1_024) : nested]));
}

function safeMessage(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message;
  return "Unhandled promise rejection";
}

function bounded(value: string, maximum: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, maximum);
}
