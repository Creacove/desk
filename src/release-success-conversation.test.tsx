import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadableStream } from "node:stream/web";
import { ReleaseSuccessArtifact } from "./features/manager/ReleaseSuccessArtifact";
import {
  hydrateReleaseSuccessArtifacts,
  mergeReleaseSuccessArtifacts,
  normalizeReleaseSuccessArtifact,
  releaseSuccessProgressLabel,
} from "./services/managerConversationStream";
import { parseManagerConversationEventStream } from "./services/managerConversationStream";
import type {
  ReleaseDateChangeRequestViewModel,
  ReleaseSuccessArtifactViewModel,
  ReleaseSuccessAssessmentViewModel,
} from "./types/cleanProduction";

const states: ReleaseSuccessArtifactViewModel["state"][] = [
  "investigating",
  "assessed",
  "proposed",
  "awaiting_approval",
  "applying",
  "applied",
  "failed",
];

afterEach(() => cleanup());

function artifact(state: ReleaseSuccessArtifactViewModel["state"], overrides: Record<string, unknown> = {}): ReleaseSuccessArtifactViewModel {
  return {
    id: "release-artifact-1",
    musicItemId: "song-1",
    missionId: "mission-1",
    state,
    subject: { title: "After Midnight", itemType: "song", approvedReleaseDate: "2026-08-26" },
    ...overrides,
  };
}

type VideoOneArtifact = ReleaseSuccessArtifactViewModel & { request?: ReleaseDateChangeRequestViewModel };

const videoOneRequest: ReleaseDateChangeRequestViewModel = {
  requestId: "request-1",
  releasePlanId: "plan-1",
  musicItemId: "song-1",
  missionId: "mission-1",
  fromDate: "2026-08-26",
  proposedDate: "2026-09-09",
  status: "pending",
  expectedPlanRevision: 2,
  previewHash: "a".repeat(64),
  preview: {
    fromDate: "2026-08-26",
    proposedDate: "2026-09-09",
    expectedRevision: 2,
    changes: [
      { taskId: "task-playlist", title: "Playlist pitch", from: "2026-08-20", to: "2026-09-03", offsetDays: -6 },
    ],
    preserved: [
      { taskId: "task-artwork", title: "Artwork lock", deadline: "2026-08-18", reason: "fixed" },
    ],
    previewHash: "a".repeat(64),
  },
  expiresAt: "2026-08-12T23:59:00.000Z",
};

const videoOneAssessment: ReleaseSuccessAssessmentViewModel = {
  musicItemId: "song-1",
  releasePlanRevision: 2,
  assessedAt: "2026-08-12T10:00:00.000Z",
  foundation: {
    status: "blocked",
    gates: [
      {
        key: "metadata",
        label: "Metadata",
        group: "foundation",
        state: "blocked",
        evidence: [],
        freshness: "current",
        limitation: "Metadata is incomplete.",
        nextAction: "Finish the release metadata.",
      },
      {
        key: "credits",
        label: "Credits",
        group: "foundation",
        state: "unknown",
        evidence: [],
        freshness: "unknown",
        limitation: "Credits have not been confirmed.",
        nextAction: "Confirm the credits.",
      },
      {
        key: "artwork",
        label: "Artwork",
        group: "foundation",
        state: "confirmed",
        evidence: [],
        freshness: "current",
        limitation: "",
        nextAction: "None.",
      },
    ],
    confirmedCount: 1,
    blockedCount: 1,
    atRiskCount: 0,
    unknownCount: 1,
  },
  campaign: {
    status: "at_risk",
    gates: [
      {
        key: "playlist",
        label: "Playlist targets",
        group: "campaign",
        state: "at_risk",
        evidence: [],
        freshness: "current",
        limitation: "Targets are not ready.",
        nextAction: "Research playlist targets.",
      },
      {
        key: "press",
        label: "Press angle",
        group: "campaign",
        state: "unknown",
        evidence: [],
        freshness: "unknown",
        limitation: "Press targets are unknown.",
        nextAction: "Find suitable press targets.",
      },
    ],
    confirmedCount: 0,
    blockedCount: 0,
    atRiskCount: 1,
    unknownCount: 1,
  },
  unknownCount: 2,
  recommendation: {
    kind: "move",
    proposedDate: "2026-09-09",
    reason: "Move the release to create a clean campaign runway.",
  },
};

function videoOneArtifact(
  state: ReleaseSuccessArtifactViewModel["state"] = "awaiting_approval",
  overrides: Partial<VideoOneArtifact> = {},
): VideoOneArtifact {
  return {
    id: "release-artifact-1",
    musicItemId: "song-1",
    missionId: "mission-1",
    requestId: videoOneRequest.requestId,
    state,
    subject: { title: "After Midnight", itemType: "song", approvedReleaseDate: "2026-08-26" },
    assessment: videoOneAssessment,
    preview: videoOneRequest.preview,
    request: videoOneRequest,
    ...overrides,
  };
}

describe("release success conversation artifact", () => {
  it("renders one decision-first Video One artifact with attached song, gate counts, blockers, and deadline impact", () => {
    const onOpenSong = vi.fn();
    const onOpenMission = vi.fn();
    const onReviewAll = vi.fn();
    render(
      <ReleaseSuccessArtifact
        artifact={videoOneArtifact()}
        onApprove={vi.fn(async () => undefined)}
        onKeepDate={vi.fn()}
        onReviewAll={onReviewAll}
        onOpenSong={onOpenSong}
        onOpenMission={onOpenMission}
        onRetry={vi.fn(async () => undefined)}
      />,
    );

    const card = screen.getByTestId("release-success-artifact");
    expect(card).toHaveTextContent("After Midnight");
    expect(card).toHaveTextContent("Attached song");
    expect(screen.getByRole("heading", { name: "Release success review" })).toBeInTheDocument();
    expect(screen.getByText("Move the release to create a clean campaign runway.")).toBeInTheDocument();
    expect(screen.getByText("Foundation · 1 blocker")).toBeInTheDocument();
    expect(screen.getByText("Campaign · 1 at risk")).toBeInTheDocument();
    expect(screen.getByText("Unknown · 2")).toBeInTheDocument();
    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.queryByText("Press angle")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all blockers" }));
    expect(onReviewAll).toHaveBeenCalledWith(expect.objectContaining({ id: "release-artifact-1" }));
    expect(screen.getByText("Press angle")).toBeInTheDocument();
    expect(screen.getByText("Moved deadlines")).toBeInTheDocument();
    expect(screen.getByText("Playlist pitch")).toBeInTheDocument();
    expect(screen.getByText("Preserved deadlines")).toBeInTheDocument();
    expect(screen.getByText("Artwork lock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve release date change" })).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Open song After Midnight" }));
    expect(onOpenSong).toHaveBeenCalledWith("song-1");
    fireEvent.click(within(card).getByRole("button", { name: "Open mission" }));
    expect(onOpenMission).toHaveBeenCalledWith("mission-1");
  });

  it("keeps approval pending without optimistic success, exposes keyboard state, and supports keep-date recovery", async () => {
    let resolveApproval: (() => void) | undefined;
    const onApprove = vi.fn(() => new Promise<void>((resolve) => {
      resolveApproval = resolve;
    }));
    const onKeepDate = vi.fn();
    render(
      <ReleaseSuccessArtifact
        artifact={videoOneArtifact()}
        onApprove={onApprove}
        onKeepDate={onKeepDate}
        onReviewAll={vi.fn()}
        onOpenSong={vi.fn()}
        onOpenMission={vi.fn()}
        onRetry={vi.fn(async () => undefined)}
      />,
    );

    const approve = screen.getByRole("button", { name: "Approve release date change" });
    fireEvent.click(approve);
    expect(onApprove).toHaveBeenCalledWith(videoOneRequest);
    expect(approve).toBeDisabled();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveTextContent("Applying release date change");
    expect(screen.queryByText("Release date updated")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep August 26 and show recovery plan" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep August 26 and show recovery plan" }));
    expect(onKeepDate).toHaveBeenCalledWith(expect.objectContaining({ id: "release-artifact-1" }));
    resolveApproval?.();
    await waitFor(() => expect(onApprove).toHaveBeenCalledTimes(1));
  });

  it("renders the persisted receipt and distinguishes a refresh warning from transaction success", () => {
    const receiptArtifact = videoOneArtifact("applied", {
      receipt: {
        requestId: "request-1",
        releasePlanId: "plan-1",
        musicItemId: "song-1",
        missionId: "mission-1",
        fromDate: "2026-08-26",
        approvedDate: "2026-09-09",
        previousRevision: 2,
        revision: 3,
        moved: [{ taskId: "task-playlist", title: "Playlist pitch", from: "2026-08-20", to: "2026-09-03" }],
        preserved: [{ taskId: "task-artwork", reason: "fixed" }],
        nextDeadline: { taskId: "task-playlist", title: "Playlist pitch", deadline: "2026-09-03" },
        operatingEventId: "event-1",
      },
      error: { message: "Receipt saved, but the workspace refresh needs a retry.", reference: "refresh-1", retryable: true },
    });
    render(
      <ReleaseSuccessArtifact
        artifact={receiptArtifact}
        onApprove={vi.fn(async () => undefined)}
        onKeepDate={vi.fn()}
        onReviewAll={vi.fn()}
        onOpenSong={vi.fn()}
        onOpenMission={vi.fn()}
        onRetry={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Release date updated");
    expect(screen.getByText("2026-09-09")).toBeInTheDocument();
    expect(screen.getByText("Receipt saved, but the workspace refresh needs a retry.")).toBeInTheDocument();
    expect(screen.getByText("Operating event: event-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve release date change" })).not.toBeInTheDocument();
  });

  it("renders stale-preview and transaction failures without success copy and keeps retry available", async () => {
    const onRetry = vi.fn(async () => undefined);
    render(
      <ReleaseSuccessArtifact
        artifact={videoOneArtifact("failed", {
          error: { message: "This release preview is stale. Refresh the release review before applying.", reference: "error-event-1", retryable: true },
        })}
        onApprove={vi.fn(async () => undefined)}
        onKeepDate={vi.fn()}
        onReviewAll={vi.fn()}
        onOpenSong={vi.fn()}
        onOpenMission={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Release review needs attention");
    expect(screen.getByText("This release preview is stale. Refresh the release review before applying.")).toBeInTheDocument();
    expect(screen.getByText("Reference: error-event-1")).toBeInTheDocument();
    expect(screen.queryByText("Release date updated")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry release-success review" }));
    await waitFor(() => expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ state: "failed" })));
  });

  it("accepts every explicit state and replaces one evolving artifact by id", async () => {
    const blocks = states.map((state, index) => `id: event-${index}\ndata: ${JSON.stringify({
      type: "release_success.changed",
      artifact: artifact(state),
    })}\n\n`).join("");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(blocks));
        controller.close();
      },
    });

    const events = await parseManagerConversationEventStream(stream);
    const merged = mergeReleaseSuccessArtifacts([], events
      .filter((event) => event.type === "release_success.changed")
      .map((event) => event.artifact));

    expect(events.filter((event) => event.type === "release_success.changed")).toHaveLength(states.length);
    expect(merged).toHaveLength(1);
    expect(merged[0].state).toBe("failed");
  });

  it("uses human-safe progress labels and never exposes reasoning text", () => {
    expect(releaseSuccessProgressLabel("read_focused_release_success")).toBe("Release materials checked");
    expect(releaseSuccessProgressLabel("propose_focused_release_date_change")).toBe("Release date impact preview ready");
    expect(releaseSuccessProgressLabel("read_focused_release_success")).not.toMatch(/chain|thought|reasoning/i);
  });

  it("hydrates only the latest valid artifact state and safely ignores malformed legacy values", () => {
    const hydrated = hydrateReleaseSuccessArtifacts([
      { id: "output-old", created_at: "2026-08-12T10:00:00.000Z", render_json: artifact("assessed") },
      { id: "output-new", created_at: "2026-08-12T11:00:00.000Z", render_json: artifact("applied", { receipt: { requestId: "request-1" } }) },
      { id: "output-invalid", created_at: "2026-08-12T12:00:00.000Z", render_json: { state: "prototype" } },
    ]);

    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]).toMatchObject({ id: "release-artifact-1", state: "applied", receipt: { requestId: "request-1" } });
    expect(normalizeReleaseSuccessArtifact({ id: "legacy", state: "assessed" })).toBeNull();
  });
});
