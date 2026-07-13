import { beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  identify: vi.fn(),
  init: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  window.localStorage.clear();
});

describe("PostHog initialization", () => {
  it("does not initialize when either environment variable is missing", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    vi.stubEnv("VITE_POSTHOG_HOST", "");

    const { isPostHogConfigured } = await import("./lib/posthog");

    expect(isPostHogConfigured).toBe(false);
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("initializes once with privacy-safe capture settings", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_project_token");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");

    const { isPostHogConfigured } = await import("./lib/posthog");

    expect(isPostHogConfigured).toBe(true);
    expect(posthogMock.init).toHaveBeenCalledTimes(1);
    expect(posthogMock.init).toHaveBeenCalledWith("phc_test_project_token", {
      api_host: "https://eu.i.posthog.com",
      autocapture: false,
      capture_pageleave: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
    });
  });

  it("does not prevent the app from loading when initialization fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_project_token");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
    posthogMock.init.mockImplementationOnce(() => {
      throw new Error("blocked by browser policy");
    });

    await expect(import("./lib/posthog")).resolves.toMatchObject({ isPostHogConfigured: true });
  });
});

describe("analytics helpers", () => {
  async function configuredAnalytics() {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_project_token");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
    return import("./lib/analytics");
  }

  it("marks only plus-test email aliases as test users", async () => {
    const { isTestUserEmail } = await configuredAnalytics();

    expect(isTestUserEmail("temitope+test@example.com")).toBe(true);
    expect(isTestUserEmail("TEMITOPE+TEST@example.com")).toBe(true);
    expect(isTestUserEmail("temitope@example.com")).toBe(false);
    expect(isTestUserEmail(undefined)).toBe(false);
  });

  it("identifies people by Supabase UUID without sending their email", async () => {
    const { identifyAnalyticsUser } = await configuredAnalytics();

    identifyAnalyticsUser({ id: "supabase-user-1", email: "person+test@example.com" });

    expect(posthogMock.identify).toHaveBeenCalledWith("supabase-user-1", { is_test_user: true });
  });

  it("captures only the typed event properties supplied by the caller", async () => {
    const { trackEvent } = await configuredAnalytics();

    trackEvent("chat message sent", { agent_type: "manager", is_test_user: true });

    expect(posthogMock.capture).toHaveBeenCalledWith("chat message sent", {
      agent_type: "manager",
      is_test_user: true,
    });
  });

  it("deduplicates one-time events using a durable scoped key", async () => {
    const { trackEventOnce } = await configuredAnalytics();
    const properties = { brief_id: "brief-1", artist_id: "artist-1", is_test_user: true };

    trackEventOnce("first brief viewed", properties, "user-1:workspace-1:brief-1");
    trackEventOnce("first brief viewed", properties, "user-1:workspace-1:brief-1");

    expect(posthogMock.capture).toHaveBeenCalledTimes(1);
  });

  it("never lets capture failures interrupt the product", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { trackEvent } = await configuredAnalytics();
    posthogMock.capture.mockImplementationOnce(() => {
      throw new Error("network failed");
    });

    expect(() => trackEvent("chat message sent", { agent_type: "manager", is_test_user: false })).not.toThrow();
  });

  it("resets the analytics identity on logout", async () => {
    const { resetAnalyticsUser } = await configuredAnalytics();

    resetAnalyticsUser();

    expect(posthogMock.reset).toHaveBeenCalledTimes(1);
  });
});
