export type ActiveRunFallback = {
  start(): void;
  resume(): void;
  stop(): void;
};

export type ActiveRunFallbackInput = {
  delaysMs: readonly number[];
  deadlineMs: number;
  isVisible(): boolean;
  isOnline(): boolean;
  check(): Promise<"active" | "terminal">;
  onTerminal(): void;
  onError?(error: unknown): void;
  onDeadline?(): void;
};

export function createActiveRunFallback(input: ActiveRunFallbackInput): ActiveRunFallback {
  if (!input.delaysMs.length || input.delaysMs.some((delay) => !Number.isFinite(delay) || delay <= 0)) {
    throw new Error("Active run fallback delays must be positive finite numbers.");
  }
  if (!Number.isFinite(input.deadlineMs) || input.deadlineMs <= 0) {
    throw new Error("Active run fallback deadline must be a positive finite number.");
  }

  let started = false;
  let stopped = true;
  let checking = false;
  let terminalNotified = false;
  let deadlineNotified = false;
  let startedAt = 0;
  let nextDelayIndex = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const deadlineRemaining = () => input.deadlineMs - (Date.now() - startedAt);

  const stopAtDeadline = () => {
    clearTimer();
    stopped = true;
    if (!deadlineNotified) {
      deadlineNotified = true;
      input.onDeadline?.();
    }
  };

  const schedule = (delayMs: number) => {
    if (stopped || checking) return;
    clearTimer();
    const remaining = deadlineRemaining();
    if (remaining <= 0) {
      stopAtDeadline();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      if (deadlineRemaining() <= 0) {
        stopAtDeadline();
        return;
      }
      void runCheck();
    }, Math.min(delayMs, remaining));
  };

  const scheduleNext = () => {
    const index = Math.min(nextDelayIndex, input.delaysMs.length - 1);
    const delay = input.delaysMs[index];
    nextDelayIndex += 1;
    schedule(delay);
  };

  const runCheck = async () => {
    if (stopped || checking) return;
    if (deadlineRemaining() <= 0) {
      stopAtDeadline();
      return;
    }
    if (!input.isVisible() || !input.isOnline()) {
      scheduleNext();
      return;
    }

    checking = true;
    try {
      const result = await input.check();
      if (stopped) return;
      if (result === "terminal") {
        stopped = true;
        clearTimer();
        if (!terminalNotified) {
          terminalNotified = true;
          input.onTerminal();
        }
        return;
      }
    } catch (error) {
      if (!stopped) input.onError?.(error);
    } finally {
      checking = false;
    }

    if (!stopped) scheduleNext();
  };

  return {
    start() {
      if (started) return;
      started = true;
      stopped = false;
      startedAt = Date.now();
      scheduleNext();
    },
    resume() {
      if (!started || stopped || checking || !input.isVisible() || !input.isOnline()) return;
      clearTimer();
      void runCheck();
    },
    stop() {
      stopped = true;
      clearTimer();
    },
  };
}
