import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductionApp } from "./app/ProductionApp";
import { createFixtureRepositories } from "./services/fixtureRepositories";
import type { WorkspaceTeamService } from "./services/workspaceTeamService";
import type { ProductionAuthAdapter, ProductionWorkspace } from "./types/productionApp";
import type { WorkspaceRoster, WorkspaceScope, WorkspaceTeamCapability } from "./types/workspaceTeam";

const scope: WorkspaceScope = {
  accountId: "account-1",
  artistWorkspaceId: "workspace-1",
  artistId: "artist-1",
};

const workspace: ProductionWorkspace = {
  ...scope,
  artistName: "Nova Vale",
  workspaceName: "Nova Vale Desk",
  status: "active",
  spotifyConnected: true,
  entitlementActive: true,
  contextComplete: true,
  latestCatalogSyncStatus: "completed",
};

const ownerRoster: WorkspaceRoster = {
  scope,
  members: [{ userId: "user-1", displayName: "Owner", accessRole: "owner", operatingTitle: null, responsibilityTags: [] }],
  loadedAt: "2026-09-06T10:00:00.000Z",
};

const session = { user: { id: "user-1", email: "owner@example.com", displayName: "Owner" } };

function authAdapter(): ProductionAuthAdapter {
  return { getSession: async () => session };
}

function capability(planKey: WorkspaceTeamCapability["planKey"], firstRunCompletedAt: string | null = null): WorkspaceTeamCapability {
  return {
    ...scope,
    planKey,
    enabled: planKey === "team_6",
    entitled: planKey === "team_6",
    source: planKey === "team_6" ? "pilot" : "none",
    seatLimit: planKey === "team_6" ? 6 : 1,
    occupiedSeats: 1,
    reservedSeats: 0,
    endsAt: null,
    firstRunCompletedAt,
  };
}

function teamService(teamCapability: WorkspaceTeamCapability, roster = ownerRoster) {
  return {
    loadCapability: vi.fn().mockResolvedValue(teamCapability),
    loadRoster: vi.fn().mockResolvedValue(roster),
  } as unknown as WorkspaceTeamService;
}

afterEach(cleanup);

describe("Team first-run routing", () => {
  it("routes an entitled team owner to first-run after artist setup is ready", async () => {
    render(
      <ProductionApp
        fixtureMode
        initialView="labelHQ"
        authAdapter={authAdapter()}
        workspaceLoader={{ loadActiveWorkspace: async () => workspace }}
        repositories={createFixtureRepositories()}
        teamService={teamService(capability("team_6"))}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Set up your team" }, { timeout: 5_000 })).toBeInTheDocument();
  });

  it.each([
    ["member", { ...ownerRoster, members: [{ ...ownerRoster.members[0], accessRole: "member" as const }] }],
    ["solo", ownerRoster],
  ])("bypasses first-run for a %s workspace viewer", async (mode, roster) => {
    const teamCapability = mode === "solo" ? capability("solo") : capability("team_6");
    render(
      <ProductionApp
        fixtureMode
        initialView="labelHQ"
        authAdapter={authAdapter()}
        workspaceLoader={{ loadActiveWorkspace: async () => workspace }}
        repositories={createFixtureRepositories()}
        teamService={teamService(teamCapability, roster)}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("heading", { name: "Home" }).length).toBeGreaterThan(0));
    expect(screen.queryByRole("heading", { name: "Set up your team" })).not.toBeInTheDocument();
  });

  it("waits for existing artist setup completion before showing first-run", async () => {
    render(
      <ProductionApp
        fixtureMode
        initialView="setup"
        authAdapter={authAdapter()}
        workspaceLoader={{ loadActiveWorkspace: async () => ({ ...workspace, contextComplete: false }) }}
        repositories={createFixtureRepositories()}
        teamService={teamService(capability("team_6"))}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Give your Manager the starting point." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Set up your team" })).not.toBeInTheDocument();
  });
});
