import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaywallPreviewScreen } from "./features/onboarding/FrontDoorScreens";

const preview = {
  checkoutSessionId: "checkout-1",
  reference: "checkout-1",
  provider: "paddle" as const,
  status: "open" as const,
  artist: {
    spotifyArtistId: "artist-1",
    name: "Sable Day",
    spotifyUrl: "https://open.spotify.com/artist/artist-1",
    imageUrl: undefined,
  },
  interval: "monthly" as const,
  formattedTotal: "$20.00",
  priceId: "pri_month",
};

afterEach(cleanup);

describe("active paywall responsive surface", () => {
  it("renders actual locked copy instead of empty blur bars", () => {
    render(<PaywallPreviewScreen preview={preview} onSubscribe={() => undefined} onBack={() => undefined} />);

    const audience = screen.getByLabelText("Audience intelligence preview locked");
    const managerRead = screen.getByLabelText("Manager's read preview locked");

    expect(within(audience).getByTestId("paywall-locked-insight-copy-Audience-intelligence")).toHaveTextContent(/listener|discovery|signal/i);
    expect(within(managerRead).getByTestId("paywall-locked-insight-copy-Managers-read")).toHaveTextContent(/priority|timing|recommendation/i);
    expect(within(audience).getByTestId("paywall-locked-insight-copy-Audience-intelligence")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the mobile checkout above an inert preview without outer-page scrolling", () => {
    render(<PaywallPreviewScreen preview={preview} onSubscribe={() => undefined} onBack={() => undefined} />);

    expect(screen.getByTestId("paywall-preview-layer")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("paywall-preview-layer")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("paywall-mobile-veil")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("paywall-checkout-card")).toHaveClass("fixed", "top-32", "bottom-[max(0.75rem,env(safe-area-inset-bottom))]", "overflow-y-auto", "overscroll-contain");
    expect(screen.getByLabelText("Desk preview")).toHaveClass("overflow-hidden");
    expect(screen.getByRole("heading", { name: /Open Sable Day.?s Desk/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start my Desk" })).toBeInTheDocument();
  });

  it("keeps the desktop checkout in the right-hand layout", () => {
    render(<PaywallPreviewScreen preview={preview} onSubscribe={() => undefined} onBack={() => undefined} />);

    expect(screen.getByTestId("paywall-checkout-card")).toHaveClass("lg:sticky", "lg:top-7");
    expect(screen.getByTestId("paywall-preview-layer")).toHaveClass("lg:grid");
  });
});
