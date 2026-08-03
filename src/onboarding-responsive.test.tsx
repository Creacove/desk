import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectArtistScreen, SetupScreen } from "./features/onboarding/OnboardingScreens";
import { SetupActivityScreen } from "./features/onboarding/SetupActivityScreen";
import type { ArtistProfileViewModel } from "./types/cleanProduction";

afterEach(() => cleanup());

const profile: ArtistProfileViewModel = {
  name: "Sable Day",
  spotify: "Sable Day — Spotify public catalog",
  genre: "alt-pop",
  market: "Lagos",
  release: "Midnight Signals",
  goal: "Build a focused release plan for the next single.",
  budget: "$2,000",
  stage: "Developing",
  tiktok: "",
  instagram: "",
  youtube: "",
  x: "",
  imageUrl: "https://i.scdn.co/image/artist",
};

describe("mobile-first onboarding", () => {
  it("puts artist search first on mobile and contains long candidate content", () => {
    const longName = "A".repeat(140);
    render(
      <ConnectArtistScreen
        query="A"
        candidates={[{
          spotifyArtistId: "artist-1",
          name: longName,
          spotifyUrl: "https://open.spotify.com/artist/artist-1",
          spotifyUri: "spotify:artist:artist-1",
          followers: 1200,
          genres: ["alternative pop with an exceptionally long genre label"],
        }]}
        onQueryChange={vi.fn()}
        onSelectCandidate={vi.fn()}
      />,
    );

    expect(screen.getByTestId("connect-mobile-intro")).toHaveClass("lg:hidden");
    expect(within(screen.getByTestId("connect-mobile-intro")).getByRole("heading", { name: "Choose your artist" })).toBeInTheDocument();
    expect(screen.getByTestId("connect-desktop-intro")).toHaveClass("hidden", "lg:block");
    expect(screen.getByLabelText("Search artists")).toBeInTheDocument();

    const result = screen.getByRole("button", { name: `Select artist ${longName}` });
    expect(result).toHaveClass("min-w-0", "overflow-hidden");
    expect(within(result).getByText(longName)).toHaveClass("truncate");
  });

  it("keeps Manager Basics focused on artist goals, budget, and one primary action", () => {
    const onContinue = vi.fn();
    render(
      <SetupScreen
        profile={profile}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onContinue={onContinue}
      />,
    );

    const identityFields = screen.getByTestId("setup-identity-fields");
    const action = screen.getByRole("button", { name: "Enter Desk HQ" });

    expect(screen.getByTestId("setup-mobile-identity")).toHaveClass("lg:hidden");
    expect(identityFields).toHaveClass("hidden", "lg:grid");
    expect(screen.queryByTestId("setup-onboarding-tips")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Artist goals")).toBeInTheDocument();
    expect(screen.getByLabelText("Monthly budget")).toBeInTheDocument();
    expect(action).toHaveClass("w-full", "sm:w-auto");
    expect(screen.queryByText(/human inputs|human constraints|enrichment|infer stage|artist direction and monthly budget/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/spotify/i)).not.toBeInTheDocument();

    fireEvent.click(action);
    expect(onContinue).toHaveBeenCalledWith(profile);
  });

  it.each([
    ["queued", "spotify_connected", {}, "Connecting your music"],
    ["running", "manager_discovery", {}, "Learning about your artist profile"],
    ["running", "setup_brief", { manager_discovery: { status: "completed_with_limits" } }, "Writing your first Manager brief"],
  ] as const)("renders persisted %s setup at %s without interpreting event prose", (status, stage, stageStatus, expectedStage) => {
    const { container } = render(
      <SetupActivityScreen status={status} stage={stage} stageStatus={stageStatus} onRetry={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "Preparing your workspace" })).toBeInTheDocument();
    expect(screen.queryByText(/Manager is reviewing|close this page/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId("setup-stage-row").some((row) => row.textContent === expectedStage)).toBe(true);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(container.textContent).not.toMatch(/Desk HQ|Chartmetric|OpenAI|GPT|edge function|%/i);
    expect(container.innerHTML).not.toContain("Ã¢");
    for (const row of screen.getAllByTestId("setup-stage-row")) {
      expect(row.querySelectorAll('[data-testid="setup-stage-icon"]')).toHaveLength(1);
    }
  });

  it("shows persisted failure and a retry without implying completed work was lost", () => {
    render(
      <SetupActivityScreen
        status="failed"
        stage="setup_brief"
        stageStatus={{ setup_brief: { status: "failed" } }}
        error="The first brief could not be prepared."
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Setup paused" })).toBeInTheDocument();
    expect(screen.getByText("Setup paused while preparing your workspace. Your completed work is safe.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry setup" })).toBeInTheDocument();
  });

  it.each([
    [{ music_reads: { status: "running" } }, "Your workspace is ready. Some music insights are still being prepared."],
    [{ music_reads: { status: "completed" } }, "Your workspace is ready."],
  ] as const)("shows brief-ready setup truthfully", (stageStatus, expectedCopy) => {
    render(<SetupActivityScreen status="completed" stage="music_reads" stageStatus={stageStatus} onRetry={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Your workspace is ready" })).toBeInTheDocument();
    expect(screen.getAllByText(expectedCopy).length).toBeGreaterThan(0);
    expect(screen.getByTestId("setup-activity-panel")).toHaveClass("motion-reduce:transition-none");
  });
});
