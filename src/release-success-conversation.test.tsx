import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadableStream } from "node:stream/web";
import { ReleaseSuccessArtifact } from "./features/manager/ReleaseSuccessArtifact";
import { OpportunityArtifact } from "./features/manager/OpportunityArtifact";
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
  idempotencyKey: "manager:song-1:2:2026-09-09:proposal-hash:reason-hash",
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
    previewHash: videoOneRequest.previewHash,
    idempotencyKey: videoOneRequest.idempotencyKey,
    state,
    subject: { title: "After Midnight", itemType: "song", approvedReleaseDate: "2026-08-26" },
    assessment: videoOneAssessment,
    preview: videoOneRequest.preview,
    request: videoOneRequest,
    ...overrides,
  };
}

describe("release success conversation artifact", () => {
  it("renders one decision-first release result with the consequential date impact", () => {
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
    expect(screen.getByRole("heading", { name: "Release date impact preview ready" })).toBeInTheDocument();
    expect(screen.getByText("Move the release to create a clean campaign runway.")).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/â|Â|Ã|�/);
    expect(screen.queryByText("Press angle")).not.toBeInTheDocument();
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

  it("hydrates persisted proposal identity and reuses its immutable key when approval is clicked", async () => {
    const onApprove = vi.fn(async () => undefined);
    const { request: _request, ...persistedArtifact } = videoOneArtifact();
    const [hydrated] = hydrateReleaseSuccessArtifacts([{
      id: "output-proposal",
      created_at: "2026-08-12T11:00:00.000Z",
      render_json: {
        ...persistedArtifact,
        previewHash: videoOneRequest.previewHash,
        idempotencyKey: videoOneRequest.idempotencyKey,
      },
    }]);

    render(
      <ReleaseSuccessArtifact
        artifact={hydrated}
        onApprove={onApprove}
        onKeepDate={vi.fn()}
        onReviewAll={vi.fn()}
        onOpenSong={vi.fn()}
        onOpenMission={vi.fn()}
        onRetry={vi.fn(async () => undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve release date change" }));
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({
      requestId: videoOneRequest.requestId,
      previewHash: videoOneRequest.previewHash,
      idempotencyKey: videoOneRequest.idempotencyKey,
    })));
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

describe("playlist and press opportunity artifacts", () => {
  const playlistArtifact = {
    id: "opportunities:song-1:playlist",
    musicItemId: "song-1",
    missionId: "mission-1",
    opportunityType: "playlist",
    subject: { title: "After Midnight", itemType: "song" },
    shortlist: [
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `playlist-${index + 1}`,
        targetName: `Night Drive ${index + 1}`,
        platform: "Independent playlist",
        sourceUrl: `https://playlist.example.com/target-${index + 1}`,
        targetUrl: `https://playlist.example.com/target-${index + 1}/submit`,
        publicContact: { kind: "submission_form", value: `https://playlist.example.com/target-${index + 1}/submit`, sourceUrl: `https://playlist.example.com/target-${index + 1}/contact`, verifiedAt: "2026-08-12T10:00:00.000Z" },
        fit: { songCriteria: ["Late-night alt-R&B"], targetCriteria: ["Accepts emerging artists"], explanation: "The song's nocturnal hook matches the playlist's stated lane." },
        sourceEvidence: [{ source: "Playlist public submission page", ref: `https://playlist.example.com/target-${index + 1}` }],
        confidence: "high",
        limitations: ["Public route only; placement is not guaranteed."],
        requirements: ["Include a private listen link."],
        safetyState: "clear",
        status: "shortlisted",
      })),
    ],
    watch: [{
      id: "playlist-watch",
      targetName: "Watchlist target",
      platform: "Independent playlist",
      sourceUrl: "https://playlist.example.com/watch",
      fit: { songCriteria: ["Adjacent mood"], targetCriteria: ["Public page found"], explanation: "The fit is plausible, but no verified public contact route is available." },
      sourceEvidence: [{ source: "Playlist public profile", ref: "https://playlist.example.com/watch" }],
      confidence: "unknown",
      limitations: ["Contact route is not verified."],
      requirements: [],
      safetyState: "caution",
      status: "watch",
    }],
    excluded: [{
      id: "playlist-excluded",
      targetName: "Guaranteed placement service",
      platform: "Paid playlist",
      sourceUrl: "https://playlist.example.com/paid",
      fit: { songCriteria: ["Emerging artist"], targetCriteria: ["Paid placement"], explanation: "The page claims guaranteed placement for payment." },
      sourceEvidence: [{ source: "Paid placement terms", ref: "https://playlist.example.com/paid" }],
      confidence: "high",
      limitations: ["Paid or guaranteed placement is excluded."],
      requirements: [],
      safetyState: "excluded",
      status: "skipped",
    }],
  } as any;

  it("renders playlist opportunities as a direct, inspectable result with manual outcome", () => {
    const onPreparePitch = vi.fn();
    const onRecordOutcome = vi.fn();
    const onOpenFiles = vi.fn();
    render(<OpportunityArtifact artifact={playlistArtifact} onPreparePitch={onPreparePitch} onRecordOutcome={onRecordOutcome} onOpenFiles={onOpenFiles} onRetry={vi.fn()} />);

    const card = screen.getByTestId("release-opportunity-artifact");
    expect(screen.getByRole("heading", { name: "6 targets are ready to pitch" })).toBeInTheDocument();
    expect(card).toHaveTextContent("Night Drive 1");
    expect(card).toHaveTextContent("Watchlist target");
    expect(card).not.toHaveTextContent("PITCH NOW");
    expect(screen.queryByRole("button", { name: "Review targets" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Night Drive 1" }));
    expect(card).toHaveTextContent("The song's nocturnal hook matches the playlist's stated lane.");
    expect(card).toHaveTextContent("high confidence");
    expect(card).toHaveTextContent("Public route only; placement is not guaranteed.");
    expect(screen.getByRole("link", { name: "View source" })).toHaveAttribute("rel", "noreferrer");

    fireEvent.click(screen.getByRole("button", { name: "Prepare pitch" }));
    expect(onPreparePitch).toHaveBeenCalledWith(expect.objectContaining({ id: "playlist-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Record outcome" }));
    fireEvent.change(screen.getByPlaceholderText("Add a short note"), { target: { value: "Artist submitted manually." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onRecordOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: "playlist-1" }), expect.objectContaining({ manualOutcome: "Artist submitted manually." }));
    expect(onOpenFiles).not.toHaveBeenCalled();
  });

  it("keeps the Spotify editorial opportunity separate and never exposes editor email", () => {
    const spotifyArtifact = {
      ...playlistArtifact,
      id: "opportunities:song-1:spotify",
      shortlist: [{
        ...playlistArtifact.shortlist[0],
        id: "spotify-editorial",
        targetName: "Spotify Editorial Playlist",
        platform: "Spotify editorial",
        targetUrl: "https://artists.spotify.com/c/artist/submit",
        publicContact: undefined,
      }],
      watch: [],
      excluded: [],
    };
    render(<OpportunityArtifact artifact={spotifyArtifact} onPreparePitch={vi.fn()} onRecordOutcome={vi.fn()} onOpenFiles={vi.fn()} onRetry={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Spotify Editorial Playlist" }));
    expect(screen.getByText("Spotify editorial pitches go through Spotify for Artists. Manager will prepare the pitch, not submit it for you.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open submission route" })).toHaveAttribute("href", "https://artists.spotify.com/c/artist/submit");
    expect(screen.queryByText(/editor@|spotify editor email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send/i })).not.toBeInTheDocument();
  });

  it("renders a target package with selected Files, copyable pitch, share link, and retry for partial failure", () => {
    const targetPackageArtifact = {
      ...playlistArtifact,
      failure: { stage: "contact_verification", message: "One contact route still needs verification.", retryable: true },
      shortlist: [{
        ...playlistArtifact.shortlist[0],
        package: { selectedFiles: ["EPK", "Personalized press pitch"], pitchBody: "A copyable song-specific pitch.", shareUrl: "https://desk.ordersounds.com/share/package-1" },
      }],
    };
    const onRetry = vi.fn();
    render(<OpportunityArtifact artifact={targetPackageArtifact} onPreparePitch={vi.fn()} onRecordOutcome={vi.fn()} onOpenFiles={vi.fn()} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Night Drive 1" }));
    expect(screen.getByText("Pitch draft")).toBeInTheDocument();
    expect(screen.getByText("A copyable song-specific pitch.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open share link" })).toHaveAttribute("href", "https://desk.ordersounds.com/share/package-1");
    expect(screen.getByText("One contact route still needs verification.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ id: "opportunities:song-1:playlist" }));
    expect(screen.queryByRole("button", { name: /Send/i })).not.toBeInTheDocument();
  });
});
