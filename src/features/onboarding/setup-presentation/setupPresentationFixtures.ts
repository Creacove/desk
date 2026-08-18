import type { SetupPresentationSnapshot } from "../../../types/setupPresentation";

const base: SetupPresentationSnapshot = {
  version: 1,
  observedAt: "2026-08-18T08:02:00.000Z",
  setup: {
    status: "running",
    phase: "discovery",
    startedAt: "2026-08-18T08:00:00.000Z",
    phaseStartedAt: "2026-08-18T08:01:20.000Z",
    updatedAt: "2026-08-18T08:01:58.000Z",
  },
  artist: {
    name: "Teni",
    imageUrl: "https://i.scdn.co/image/ab6761610000e5eb0abbb24bc84319885638bbd5",
    genres: ["Afrobeats", "Afropop"],
  },
  catalogue: {
    state: "complete",
    trackCount: 28,
    releaseCount: 9,
    covers: [
      { title: "No Days Off" },
      { title: "Maitama" },
      { title: "TEARS OF THE SUN" },
      { title: "WONDALAND" },
    ],
  },
  activity: { kind: "focus_music", state: "working", label: "Reading your current music", occurredAt: "2026-08-18T08:01:56.000Z" },
  intelligence: {
    primaryMetric: { label: "Monthly listeners", value: "4.8M" },
    markets: ["Lagos", "London", "Accra"],
    publicSources: [{ name: "Billboard", domain: "billboard.com" }, { name: "Music Business Worldwide", domain: "musicbusinessworldwide.com" }],
    focusMusic: { title: "No Days Off" },
  },
  manager: { state: "waiting" },
};

export const setupPresentationFixtures: Record<string, SetupPresentationSnapshot> = {
  identity: {
    ...base,
    setup: { ...base.setup, phase: "catalogue", phaseStartedAt: "2026-08-18T08:00:08.000Z" },
    catalogue: undefined,
    activity: { kind: "catalogue", state: "working", label: "Bringing in your music" },
    intelligence: undefined,
  },
  catalogue: {
    ...base,
    setup: { ...base.setup, phase: "catalogue", phaseStartedAt: "2026-08-18T08:00:08.000Z" },
    activity: { kind: "catalogue", state: "complete", label: "Your catalogue is connected" },
    intelligence: undefined,
  },
  discovery: base,
  research: {
    ...base,
    activity: { kind: "public_context", state: "working", label: "Understanding your story" },
  },
  synthesis: {
    ...base,
    setup: { ...base.setup, phase: "synthesis", phaseStartedAt: "2026-08-18T08:01:48.000Z" },
    activity: { kind: "manager", state: "working", label: "Your Manager is putting it together" },
    manager: { state: "working" },
  },
  extended: {
    ...base,
    setup: { ...base.setup, phase: "discovery", phaseStartedAt: "2026-08-18T07:59:00.000Z" },
  },
  ready: {
    ...base,
    setup: { ...base.setup, status: "completed", phase: "ready" },
    activity: { kind: "manager", state: "complete", label: "Your Manager is ready" },
    manager: { state: "ready", insight: "Your latest release is carrying the strongest cross-market momentum; protect that signal before widening the release path." },
    musicReads: { target: 3, completed: 1, running: 2, failed: 0 },
  },
};

export function readDevelopmentSetupFixture(): SetupPresentationSnapshot | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const key = new URLSearchParams(window.location.search).get("setupFixture");
  return key ? setupPresentationFixtures[key] ?? null : null;
}
