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
  it("offers Solo by default and exposes the Team promise when plan selection is enabled", () => {
    const onPlanChange = vi.fn();
    render(<FrontDoorPaywallPreviewScreen
      preview={{
        checkoutSessionId: "checkout-1", reference: "checkout-1", provider: "paddle", status: "open",
        artist, interval: "monthly", formattedTotal: "$24", priceId: "pri_month", planKey: "solo",
      }}
      onPlanChange={onPlanChange}
      onSubscribe={() => undefined}
      onBack={() => undefined}
    />);

    const planSelector = screen.getByRole("group", { name: "Desk plan" });
    expect(within(planSelector).getByRole("button", { name: "Solo plan" })).toHaveAttribute("aria-pressed", "true");
    expect(within(planSelector).getByRole("button", { name: "Team plan" })).toBeInTheDocument();
    expect(screen.queryByText("Up to 6 people. One shared artist Desk.")).not.toBeInTheDocument();

    fireEvent.click(within(planSelector).getByRole("button", { name: "Team plan" }));
    expect(onPlanChange).toHaveBeenCalledWith("team_6");
  });

  it("shows the Team promise after Team pricing is selected", () => {
    render(<FrontDoorPaywallPreviewScreen
      preview={{
        checkoutSessionId: "checkout-team", reference: "checkout-team", provider: "paddle", status: "open",
        artist, interval: "monthly", formattedTotal: "$99", priceId: "pri_team_month", planKey: "team_6",
        intervalOptions: {
          monthly: { formattedTotal: "$99", priceId: "pri_team_month" },
          yearly: { formattedTotal: "$1,000", priceId: "pri_team_year" },
        },
      }}
      onPlanChange={() => undefined}
      onSubscribe={() => undefined}
      onBack={() => undefined}
    />);

    expect(screen.getByText("Up to 6 people. One shared artist Desk.")).toBeInTheDocument();
    expect(screen.getByText("$99")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(screen.getByText("$1,000")).toBeInTheDocument();
  });

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
