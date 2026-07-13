import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectArtistScreen, SetupScreen } from "./features/onboarding/OnboardingScreens";
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
    expect(screen.getByLabelText("Search Spotify artist")).toBeInTheDocument();

    const result = screen.getByRole("button", { name: `Select Spotify artist ${longName}` });
    expect(result).toHaveClass("min-w-0", "overflow-hidden");
    expect(within(result).getByText(longName)).toHaveClass("truncate");
  });

  it("keeps only direction, budget, and the primary action in the mobile Manager Basics path", () => {
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
    const tips = screen.getByTestId("setup-onboarding-tips");
    const skip = screen.getByRole("button", { name: "Skip" });
    const action = screen.getByRole("button", { name: "Enter Desk HQ" });

    expect(screen.getByTestId("setup-mobile-identity")).toHaveClass("lg:hidden");
    expect(identityFields).toHaveClass("hidden", "lg:grid");
    expect(tips).toHaveClass("hidden", "lg:block");
    expect(skip).toHaveClass("hidden", "sm:inline-flex");
    expect(screen.getByLabelText("Artist Direction")).toBeInTheDocument();
    expect(screen.getByLabelText("Monthly budget")).toBeInTheDocument();
    expect(action).toHaveClass("w-full", "sm:w-auto");

    fireEvent.click(action);
    expect(onContinue).toHaveBeenCalledWith(profile);
  });
});
