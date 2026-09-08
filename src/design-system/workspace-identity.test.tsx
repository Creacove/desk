import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WorkspaceIdentity } from "./workspaceIdentity";

describe("WorkspaceIdentity", () => {
  afterEach(() => cleanup());

  it("keeps the desktop shell artist-first with a compact team badge", () => {
    render(<WorkspaceIdentity variant="shell" teamName="CBA — House 3" artistName="Godwinton" isTeamPlan />);

    expect(screen.getByText("Godwinton's Desk")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-team-badge")).toHaveTextContent("CBA — House 3");
    expect(screen.queryByText("Godwinton · Artist")).not.toBeInTheDocument();
  });

  it("keeps the solo fallback artist-focused", () => {
    render(<WorkspaceIdentity variant="shell" teamName={null} artistName="Godwinton" isTeamPlan={false} />);

    expect(screen.getByText("Godwinton's Desk")).toBeInTheDocument();
    expect(screen.queryByText("Artist desk")).not.toBeInTheDocument();
  });

  it("does not show a loading placeholder when a Team name is unavailable", () => {
    render(<WorkspaceIdentity variant="shell" teamName={null} artistName="Godwinton" isTeamPlan />);

    expect(screen.getByText("Godwinton's Desk")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-team-badge")).not.toBeInTheDocument();
  });

  it("keeps the full team context available on the settings page", () => {
    render(<WorkspaceIdentity variant="page" teamName="CBA — House 3" artistName="Godwinton" isTeamPlan />);

    expect(screen.getByRole("heading", { name: "CBA — House 3" })).toBeInTheDocument();
    expect(screen.getByText("Godwinton")).toBeInTheDocument();
  });
});
