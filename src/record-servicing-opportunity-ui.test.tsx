import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpportunityArtifact } from "./features/manager/OpportunityArtifact";
import type { ReleaseOpportunityArtifactViewModel, ReleaseOpportunityTargetViewModel } from "./types/cleanProduction";

afterEach(() => cleanup());

function target(id: string, overrides: Partial<ReleaseOpportunityTargetViewModel> = {}): ReleaseOpportunityTargetViewModel {
  return {
    id,
    targetName: `Target ${id}`,
    platform: "Independent playlist",
    sourceUrl: `https://example.com/${id}`,
    publicContact: {
      kind: "email",
      value: "info@examplemusiccompany.com",
      sourceUrl: "https://example.com/contact",
      verifiedAt: "2026-08-15T12:00:00.000Z",
    },
    fit: {
      songCriteria: ["late-night Afro-R&B"],
      targetCriteria: ["actively features emerging Afro-R&B releases"],
      explanation: "Strong sonic fit, active curation, and a verified public submission route.",
    },
    sourceEvidence: [{ source: "Playlist page", ref: `https://example.com/${id}` }],
    confidence: "high",
    limitations: [],
    requirements: [],
    safetyState: "clear",
    status: "shortlisted",
    package: {
      selectedFiles: ["Artwork", "Track link"],
      pitchBody: "A short recipient-specific pitch.",
    },
    ...overrides,
  };
}

function artifact(overrides: Partial<ReleaseOpportunityArtifactViewModel> = {}): ReleaseOpportunityArtifactViewModel {
  return {
    id: "playlist-artifact",
    musicItemId: "song-1",
    missionId: "mission-1",
    opportunityType: "playlist",
    subject: { title: "Down Below", itemType: "song" },
    shortlist: [target("one"), target("two")],
    watch: [target("watch", { safetyState: "caution", status: "watch", publicContact: undefined })],
    excluded: [target("skip", { safetyState: "excluded", status: "skipped", publicContact: undefined })],
    ...overrides,
  };
}

function renderArtifact(value = artifact()) {
  return render(
    <OpportunityArtifact
      artifact={value}
      onPreparePitch={vi.fn()}
      onRecordOutcome={vi.fn()}
      onOpenFiles={vi.fn()}
      onOpenMission={vi.fn()}
      onRetry={vi.fn()}
    />,
  );
}

describe("record servicing opportunity presentation", () => {
  it("leads with the decision instead of a collapsed best-match teaser", () => {
    renderArtifact();

    expect(screen.getByText("PITCH NOW")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2 playlist opportunities worth pitching now" })).toBeInTheDocument();
    expect(screen.getByText("Strong sonic fit, active curation, and a verified public submission route.")).toBeInTheDocument();
    expect(screen.getByText("Pitch now")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.getByText("Skip")).toBeInTheDocument();
    expect(screen.getByText("Prepared")).toBeInTheDocument();
    expect(screen.getByText("Preparation only — no outreach is sent.")).toBeInTheDocument();
    expect(screen.queryByText(/Best match/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Target one")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review targets" })).toBeInTheDocument();
  });

  it("keeps verified contact literal when target details are opened", () => {
    renderArtifact();

    fireEvent.click(screen.getByRole("button", { name: "Review targets" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Target one" }));

    const email = screen.getByRole("link", { name: "info@examplemusiccompany.com" });
    expect(email).toHaveAttribute("href", "mailto:info@examplemusiccompany.com");
    expect(screen.getByText("verified 2026-08-15")).toBeInTheDocument();
  });

  it("returns a watch decision when no target is safe enough to pitch", () => {
    renderArtifact(artifact({
      shortlist: [],
      watch: [target("watch", { safetyState: "caution", status: "watch", publicContact: undefined })],
      excluded: [],
    }));

    expect(screen.getByText("WATCH")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No playlist target is ready to pitch yet" })).toBeInTheDocument();
  });
});
