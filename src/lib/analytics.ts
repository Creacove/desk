import posthog, { isPostHogConfigured } from "./posthog";

export type AnalyticsEventMap = {
  "user signed up": {
    signup_method: "email" | "google" | "other";
    is_test_user: boolean;
  };
  "artist selected": {
    artist_id: string;
    selection_source: string;
    is_test_user: boolean;
  };
  "manager memory generated": {
    artist_id: string;
    generation_time_seconds: number;
    is_test_user: boolean;
  };
  "first brief viewed": {
    brief_id: string;
    artist_id: string;
    is_test_user: boolean;
  };
  "mission created": {
    mission_id: string;
    mission_type: "mission_genesis";
    is_test_user: boolean;
  };
  "chat message sent": {
    agent_type: "manager";
    is_test_user: boolean;
  };
  "workspace activated": {
    artist_workspace_id: string;
    activation_source: "subscription" | "existing";
    is_test_user: boolean;
  };
  "onboarding completed": {
    artist_id: string;
    setup_mode: "setup-map";
    is_test_user: boolean;
  };
  "brief generated": {
    brief_id: string;
    artist_id: string;
    generation_mode: "operating" | "setup-map";
    state: "fresh" | "limited" | "fallback" | "failed";
    confidence: "high" | "medium" | "low" | "limited" | "unknown";
    is_test_user: boolean;
  };
  "mission task completed": {
    mission_id: string;
    task_id: string;
    is_test_user: boolean;
  };
};

type AnalyticsUser = {
  id: string;
  email?: string;
};

const DEDUPE_PREFIX = "ordersounds:analytics:";

export function isTestUserEmail(email?: string): boolean {
  return email?.toLowerCase().includes("+test") ?? false;
}

export function identifyAnalyticsUser(user: AnalyticsUser): void {
  if (!isPostHogConfigured) return;

  try {
    posthog.identify(user.id, { is_test_user: isTestUserEmail(user.email) });
  } catch (error) {
    console.error("Analytics identity failed.", error);
  }
}

export function resetAnalyticsUser(): void {
  if (!isPostHogConfigured) return;

  try {
    posthog.reset();
  } catch (error) {
    console.error("Analytics identity reset failed.", error);
  }
}

export function trackEvent<EventName extends keyof AnalyticsEventMap>(
  eventName: EventName,
  properties: AnalyticsEventMap[EventName],
): void {
  captureEvent(eventName, properties);
}

export function trackEventOnce<EventName extends keyof AnalyticsEventMap>(
  eventName: EventName,
  properties: AnalyticsEventMap[EventName],
  scopeKey: string,
): void {
  if (!isPostHogConfigured) return;

  const storageKey = `${DEDUPE_PREFIX}${eventName}:${scopeKey}`;
  try {
    if (window.localStorage.getItem(storageKey)) return;
  } catch {
    // Storage restrictions must not block capture.
  }

  if (!captureEvent(eventName, properties)) return;

  try {
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // Storage restrictions must not affect the product.
  }
}

function captureEvent<EventName extends keyof AnalyticsEventMap>(
  eventName: EventName,
  properties: AnalyticsEventMap[EventName],
): boolean {
  if (!isPostHogConfigured) return false;

  try {
    posthog.capture(eventName, properties);
    return true;
  } catch (error) {
    console.error(`Analytics event failed: ${eventName}`, error);
    return false;
  }
}
