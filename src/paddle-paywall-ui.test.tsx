import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaywallPreviewScreen } from "./features/onboarding/OnboardingScreens";
import { PaywallPreviewScreen as FrontDoorPaywallPreviewScreen } from "./features/onboarding/FrontDoorScreens";

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

  it("does not expose a provider switch for a legacy Nigerian Paystack preview", () => {
    render(<PaywallPreviewScreen preview={{
      checkoutSessionId: "checkout-ng", reference: "ors_ng", provider: "paystack", status: "initialized",
      artist, interval: "monthly", amount: 32_000, amountMinor: 3_200_000, currency: "NGN",
    }} onSubscribe={() => undefined} onBack={() => undefined} />);

    expect(screen.queryByRole("button", { name: "Pay in USD with an international card" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay in USD" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay in NGN" })).not.toBeInTheDocument();
  });

  it("does not expose a provider switch in the production front-door paywall", () => {
    render(<FrontDoorPaywallPreviewScreen preview={{
      checkoutSessionId: "checkout-ng", reference: "ors_ng", provider: "paystack", status: "initialized",
      artist, interval: "monthly", amount: 32_000, amountMinor: 3_200_000, currency: "NGN",
    }} onSubscribe={() => undefined} onBack={() => undefined} />);

    expect(screen.queryByRole("button", { name: "Pay in USD" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay in USD with an international card" })).not.toBeInTheDocument();
  });

  it("does not show the USD provider choice on Paddle previews", () => {
    render(<PaywallPreviewScreen preview={{
      checkoutSessionId: "checkout-usd", reference: "checkout-usd", provider: "paddle", status: "open",
      artist, interval: "monthly", formattedTotal: "$20.00", priceId: "pri_month",
    }} onSubscribe={() => undefined} onBack={() => undefined} />);

    expect(screen.queryByRole("button", { name: "Pay in USD with an international card" })).not.toBeInTheDocument();
  });
});
