import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WorkspaceIdentity } from "./workspaceIdentity";

describe("WorkspaceIdentity", () => {
  afterEach(() => cleanup());

  it("puts the team first and the artist second for a Team workspace", () => {
    render(<WorkspaceIdentity variant="shell" teamName="CBA — House 3" artistName="Godwinton" isTeamPlan />);

    expect(screen.getByText("CBA — House 3")).toBeInTheDocument();
    expect(screen.getByText("Godwinton · Artist")).toBeInTheDocument();
    expect(screen.queryByText("Artist desk")).not.toBeInTheDocument();
  });

  it("keeps the solo fallback artist-focused", () => {
    render(<WorkspaceIdentity variant="shell" teamName={null} artistName="Godwinton" isTeamPlan={false} />);

    expect(screen.getByText("Godwinton")).toBeInTheDocument();
    expect(screen.getByText("Artist desk")).toBeInTheDocument();
  });

  it("does not invent a company name while Team identity is loading", () => {
    render(<WorkspaceIdentity variant="shell" teamName={null} artistName="Godwinton" isTeamPlan />);

    expect(screen.getByText("Loading team identity")).toBeInTheDocument();
    expect(screen.queryByText("Godwinton · Artist")).not.toBeInTheDocument();
  });
});
