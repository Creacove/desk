import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaywallPreviewScreen } from "./features/onboarding/OnboardingScreens";

const artist = {
  spotifyArtistId: "artist-1",
  name: "Sable Day",
  spotifyUrl: "https://open.spotify.com/artist/artist-1",
  genres: [],
};

afterEach(cleanup);

describe("provider-aware paywall", () => {
  it("shows Paddle's formatted total unchanged and labels the selected interval", () => {
    render(<PaywallPreviewScreen preview={{
      checkoutSessionId: "checkout-1", reference: "checkout-1", provider: "paddle", status: "open",
      artist, interval: "yearly", formattedTotal: "£160.00", priceId: "pri_year",
    }} onSubscribe={() => undefined} onBack={() => undefined} />);

    const checkout = screen.getByLabelText("Subscription checkout");
    expect(within(checkout).getByText("£160.00/year")).toBeInTheDocument();
    expect(within(checkout).getByRole("button", { name: "Yearly billing" })).toHaveAttribute("aria-pressed", "true");
  });

  it("requests the chosen interval and disables subscription while pricing refreshes", () => {
    const onIntervalChange = vi.fn();
    render(<PaywallPreviewScreen preview={{
      checkoutSessionId: "checkout-1", reference: "checkout-1", provider: "paddle", status: "open",
      artist, interval: "monthly", formattedTotal: "€18.00", priceId: "pri_month",
    }} pending onIntervalChange={onIntervalChange} onSubscribe={() => undefined} onBack={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Yearly billing" }));
    expect(onIntervalChange).toHaveBeenCalledWith("yearly");
    expect(screen.getByRole("button", { name: /opening secure checkout/i })).toBeDisabled();
  });
});
