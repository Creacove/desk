import posthog from "posthog-js";

const projectToken = import.meta.env.VITE_POSTHOG_KEY;
const apiHost = import.meta.env.VITE_POSTHOG_HOST;

export const isPostHogConfigured = Boolean(projectToken && apiHost);

if (isPostHogConfigured) {
  try {
    posthog.init(projectToken, {
      api_host: apiHost,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      person_profiles: "identified_only",
      disable_session_recording: true,
    });
  } catch (error) {
    console.error("PostHog initialization failed.", error);
  }
} else if (import.meta.env.DEV) {
  console.info("PostHog is not configured. Add VITE_POSTHOG_KEY and VITE_POSTHOG_HOST.");
}

export default posthog;
