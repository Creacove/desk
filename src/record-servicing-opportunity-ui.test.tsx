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
    publicContact: { kind: "email", value: "info@examplemusiccompany.com", sourceUrl: "https://example.com/contact", verifiedAt: "2026-08-15T12:00:00.000Z" },
    fit: { songCriteria: ["late-night Afro-R&B"], targetCriteria: ["actively features emerging Afro-R&B releases"], explanation: "Strong sonic fit, active curation, and a verified public submission route." },
    sourceEvidence: [{ source: "Playlist page", ref: `https://example.com/${id}` }],
    confidence: "high",
    limitations: [],
    requirements: [],
    safetyState: "clear",
    status: "shortlisted",
    package: { selectedFiles: ["Artwork", "Track link"], pitchBody: "A short recipient-specific pitch." },
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
  return render(<OpportunityArtifact artifact={value} onPreparePitch={vi.fn()} onRecordOutcome={vi.fn()} onOpenFiles={vi.fn()} onOpenMission={vi.fn()} onRetry={vi.fn()} />);
}

describe("record servicing opportunity presentation", () => {
  it("shows the answer and useful targets immediately without dashboard counters", () => {
    renderArtifact();
    expect(screen.getByRole("heading", { name: "2 targets are ready to pitch" })).toBeInTheDocument();
    expect(screen.getByText("Playlist opportunities")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Target one" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Target watch" })).toBeInTheDocument();
    expect(screen.queryByText("PITCH NOW")).not.toBeInTheDocument();
    expect(screen.queryByText("Prepared")).not.toBeInTheDocument();
    expect(screen.queryByText("Preparation only — no outreach is sent.")).not.toBeInTheDocument();
  });

  it("keeps verified contact literal when a target is inspected", () => {
    renderArtifact();
    fireEvent.click(screen.getByRole("button", { name: "Open Target one" }));
    const email = screen.getByRole("link", { name: "info@examplemusiccompany.com" });
    expect(email).toHaveAttribute("href", "mailto:info@examplemusiccompany.com");
    expect(screen.getByText("· verified 2026-08-15")).toBeInTheDocument();
  });

  it("uses plain language when nothing is ready to pitch", () => {
    renderArtifact(artifact({ shortlist: [], watch: [target("watch", { safetyState: "caution", status: "watch", publicContact: undefined })], excluded: [] }));
    expect(screen.getByRole("heading", { name: "1 target is worth watching" })).toBeInTheDocument();
    expect(screen.getByText("None are ready to pitch yet. You can still inspect what Manager found and what is missing.")).toBeInTheDocument();
    expect(screen.queryByText("WATCH")).not.toBeInTheDocument();
  });
});
