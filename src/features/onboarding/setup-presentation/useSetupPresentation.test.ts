import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetupPresentationSnapshot } from "../../../types/setupPresentation";
import { useSetupPresentation } from "./useSetupPresentation";

const completedSnapshot: SetupPresentationSnapshot = {
  version: 1,
  observedAt: "2026-08-24T10:00:10.000Z",
  setup: {
    status: "completed",
    phase: "ready",
    startedAt: "2026-08-24T10:00:00.000Z",
    updatedAt: "2026-08-24T10:00:10.000Z",
  },
  artist: { name: "Teni", genres: ["Afrobeats"] },
};

describe("useSetupPresentation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hands a completed backend snapshot to Desk without rendering a completed presentation", async () => {
    const onCompleted = vi.fn();
    const loadSnapshot = vi.fn().mockResolvedValue(completedSnapshot);
    const rendered = renderHook(() => useSetupPresentation({
      artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
      setupRunId: "11111111-1111-4111-8111-111111111111",
      enabled: true,
      loadSnapshot,
      onCompleted,
    }));

    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(completedSnapshot));
    expect(rendered.result.current.snapshot).toBeNull();
  });
});
