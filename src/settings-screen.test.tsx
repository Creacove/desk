import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsScreen } from "./features/settings/SettingsScreen";
import type { ArtistProfileViewModel } from "./types/cleanProduction";

describe("SettingsScreen", () => {
  afterEach(() => cleanup());

  it("renders normalized Chartmetric artist intelligence when available", () => {
    render(
      <SettingsScreen
        profile={profileWithArtistIntelligence()}
        onChange={vi.fn()}
        onBack={vi.fn()}
        themeMode="system"
        resolvedThemeMode="dark"
        onThemeModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Artist intelligence")).toBeTruthy();
    expect(screen.getByText("Chartmetric shows Burna Boy has strong verified artist context.")).toBeTruthy();
    expect(screen.getByText("Country rank Nigeria: #1; Lagos: 1,344,811 listeners")).toBeTruthy();
    expect(screen.getByText("Spotify monthly listeners: 33,095,448 listeners")).toBeTruthy();
    expect(screen.getByText("TikTok track posts: 15,763,624 posts")).toBeTruthy();
    expect(screen.getByText("Attention signal, not conversion proof.")).toBeTruthy();
  });

  it("renders a premium appearance control that can override system mode", () => {
    const onThemeModeChange = vi.fn();

    render(
      <SettingsScreen
        profile={profileWithArtistIntelligence()}
        onChange={vi.fn()}
        onBack={vi.fn()}
        themeMode="system"
        resolvedThemeMode="dark"
        onThemeModeChange={onThemeModeChange}
      />,
    );

    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByText("Following system: Dark")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use system appearance" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Use dark appearance" }));

    expect(onThemeModeChange).toHaveBeenCalledWith("dark");
  });
});

function profileWithArtistIntelligence(): ArtistProfileViewModel {
  return {
    name: "Burna Boy",
    spotify: "Burna Boy - Spotify public catalog",
    genre: "afrobeats",
    market: "Lagos",
    release: "No Sign of Weakness",
    goal: "Manage global release decisions from verified evidence.",
    budget: "$50,000",
    stage: "Superstar",
    tiktok: "",
    instagram: "",
    youtube: "",
    x: "",
    artistIntelligence: {
      headline: "Chartmetric shows Burna Boy has strong verified artist context.",
      marketRead: "Country rank Nigeria: #1; Lagos: 1,344,811 listeners",
      platformRead: "Spotify monthly listeners: 33,095,448 listeners",
      socialRead: "TikTok track posts: 15,763,624 posts",
      limitations: ["Attention signal, not conversion proof."],
    },
  };
}
