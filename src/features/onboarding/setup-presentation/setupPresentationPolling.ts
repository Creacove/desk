import type { SetupPresentationSnapshot } from "../../../types/setupPresentation";

const EARLY_POLL_MS = 3_000;
const SETTLED_POLL_MS = 5_000;
const EXTENDED_POLL_MS = 8_000;

export function setupPresentationPollDelay(snapshot: SetupPresentationSnapshot, nowMs = Date.now()) {
  const startedAt = snapshot.setup.phaseStartedAt ?? (snapshot.setup.phase === "catalogue" ? snapshot.setup.startedAt : undefined);
  const startedAtMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  if (!Number.isFinite(startedAtMs)) return EARLY_POLL_MS;
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  if (elapsedMs >= 120_000) return EXTENDED_POLL_MS;
  if (elapsedMs >= 60_000) return SETTLED_POLL_MS;
  return EARLY_POLL_MS;
}
