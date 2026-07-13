import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsScreen } from "./features/settings/SettingsScreen";
import type { ArtistProfileViewModel } from "./types/cleanProduction";

describe("SettingsScreen", () => {
  afterEach(() => cleanup());

  it("defaults to Profile and removes artist intelligence from settings", () => {
    const onChange = vi.fn();
    render(
      <SettingsScreen
        profile={profileWithArtistIntelligence()}
        onChange={onChange}
        onBack={vi.fn()}
        themeMode="system"
        resolvedThemeMode="dark"
        onThemeModeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Settings." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Artist profile." })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Access" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByLabelText("Artist name")).toBeInTheDocument();
    expect(screen.queryByText("Artist intelligence")).not.toBeInTheDocument();
    expect(screen.queryByText("Chartmetric shows Burna Boy has strong verified artist context.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Artist name"), { target: { value: "Burna" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Burna", market: "Lagos", budget: "$50,000" }));
  });

  it("isolates appearance in Account and can override system mode", () => {
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

    expect(screen.queryByText("Appearance")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Account" }));
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByText("Following system: Dark")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use system appearance" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Use dark appearance" }));

    expect(onThemeModeChange).toHaveBeenCalledWith("dark");
  });

  it("separates access details from account security", async () => {
    const onUpdatePassword = vi.fn().mockResolvedValue(undefined);
    const onSignOut = vi.fn();
    render(
      <SettingsScreen
        profile={profileWithArtistIntelligence()}
        onChange={vi.fn()}
        onBack={vi.fn()}
        workspace={{
          accountId: "account-1",
          artistWorkspaceId: "workspace-1",
          artistId: "artist-1",
          artistName: "Burna Boy",
          workspaceName: "Burna Boy Desk",
          status: "active",
          spotifyConnected: true,
          contextComplete: true,
          entitlementActive: true,
          accessType: "private_beta",
          accessStatus: "active",
          accessStartsAt: "2026-07-13T00:00:00.000Z",
          accessEndsAt: "2026-08-12T00:00:00.000Z",
        }}
        onUpdatePassword={onUpdatePassword}
        onSignOut={onSignOut}
      />,
    );

    expect(screen.queryByText("Private beta")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Access" }));
    expect(screen.getByText("Private beta")).toBeTruthy();
    expect(screen.getByText("Aug 12, 2026")).toBeTruthy();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Account" }));
    expect(screen.queryByText("Private beta")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await vi.waitFor(() => expect(onUpdatePassword).toHaveBeenCalledWith({ password: "new-password-123" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("labels an entitled workspace without billing metadata as active access", () => {
    render(
      <SettingsScreen
        profile={profileWithArtistIntelligence()}
        onChange={vi.fn()}
        onBack={vi.fn()}
        workspace={{
          accountId: "account-1",
          artistWorkspaceId: "workspace-1",
          artistId: "artist-1",
          artistName: "Burna Boy",
          workspaceName: "Burna Boy Desk",
          status: "active",
          spotifyConnected: true,
          contextComplete: true,
          entitlementActive: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Access" }));
    expect(screen.getByRole("heading", { name: "Active workspace access" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No active access" })).not.toBeInTheDocument();
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
