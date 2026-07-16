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

  it("switches interval pricing immediately without entering a checkout loading state", () => {
    const onIntervalChange = vi.fn(() => new Promise<void>(() => undefined));
    render(<PaywallPreviewScreen preview={{
      checkoutSessionId: "checkout-1", reference: "checkout-1", provider: "paddle", status: "open",
      artist, interval: "monthly", formattedTotal: "€18.00", priceId: "pri_month",
      intervalOptions: {
        monthly: { formattedTotal: "€18.00", priceId: "pri_month" },
        yearly: { formattedTotal: "€180.00", priceId: "pri_year" },
      },
    }} onIntervalChange={onIntervalChange} onSubscribe={() => undefined} onBack={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Yearly billing" }));
    expect(onIntervalChange).toHaveBeenCalledWith("yearly");
    expect(screen.getByRole("button", { name: "Yearly billing" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("€180.00/year")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe €180.00/year" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /opening secure checkout/i })).not.toBeInTheDocument();
  });

  it("offers Nigerian Paystack customers an explicit USD Paddle choice", () => {
    const onProviderChange = vi.fn();
    render(<PaywallPreviewScreen preview={{
      checkoutSessionId: "checkout-ng", reference: "ors_ng", provider: "paystack", status: "initialized",
      artist, interval: "monthly", amount: 32_000, amountMinor: 3_200_000, currency: "NGN",
    }} onProviderChange={onProviderChange} onSubscribe={() => undefined} onBack={() => undefined} />);

    const usdAction = screen.getByRole("button", { name: "Pay in USD with an international card" });
    fireEvent.click(usdAction);
    expect(onProviderChange).toHaveBeenCalledWith("paddle", "monthly");
  });

  it("does not show the USD provider choice on Paddle previews", () => {
    render(<PaywallPreviewScreen preview={{
      checkoutSessionId: "checkout-usd", reference: "checkout-usd", provider: "paddle", status: "open",
      artist, interval: "monthly", formattedTotal: "$20.00", priceId: "pri_month",
    }} onProviderChange={() => undefined} onSubscribe={() => undefined} onBack={() => undefined} />);

    expect(screen.queryByRole("button", { name: "Pay in USD with an international card" })).not.toBeInTheDocument();
  });
});
