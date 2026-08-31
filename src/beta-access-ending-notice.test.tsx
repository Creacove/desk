import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BetaAccessEndingNotice, shouldShowBetaAccessEndingNotice } from "./features/billing/BetaAccessEndingNotice";
import type { ProductionWorkspace } from "./types/productionApp";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("beta access ending notice", () => {
  it("only appears during the final seven active days", () => {
    const now = Date.parse("2026-08-31T12:00:00.000Z");
    expect(shouldShowBetaAccessEndingNotice(workspace("2026-09-05T12:00:00.000Z"), now)).toBe(true);
    expect(shouldShowBetaAccessEndingNotice(workspace("2026-09-10T12:00:00.000Z"), now)).toBe(false);
    expect(shouldShowBetaAccessEndingNotice({ ...workspace("2026-09-05T12:00:00.000Z"), accessStatus: "expired", entitlementActive: false }, now)).toBe(false);
  });

  it("opens plan selection without starting checkout", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
    const onChoosePlan = vi.fn();
    render(<BetaAccessEndingNotice
      workspace={workspace("2026-09-05T12:00:00.000Z")}
      onChoosePlan={onChoosePlan}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Choose a plan" }));
    expect(onChoosePlan).toHaveBeenCalledTimes(1);
  });
});

function workspace(accessEndsAt: string): ProductionWorkspace {
  return {
    accountId: "account-1", artistWorkspaceId: "workspace-1", artistId: "artist-1",
    artistName: "Sable Day", workspaceName: "Sable Day Desk", status: "active",
    spotifyConnected: true, spotifyArtistId: "spotify-1", spotifyArtistUrl: "https://open.spotify.com/artist/spotify-1",
    contextComplete: true, entitlementActive: true, accessType: "private_beta", accessStatus: "active", accessEndsAt,
  };
}
