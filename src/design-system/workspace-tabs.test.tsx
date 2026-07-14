import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceTabRail } from "./components";

describe("WorkspaceTabRail", () => {
  it("provides one calm, accessible tab language for product workspaces", () => {
    const onChange = vi.fn();
    render(
      <WorkspaceTabRail
        ariaLabel="Song sections"
        semanticTabs
        active="overview"
        onChange={onChange}
        items={[
          { id: "overview", label: "Overview" },
          { id: "details", label: "Details" },
          { id: "files", label: "Files", badge: "2" },
          { id: "rights", label: "Rights" },
        ]}
      />,
    );

    const rail = screen.getByRole("tablist", { name: "Song sections" });
    expect(rail).toHaveClass("workspace-tab-rail");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("2")).toHaveClass("workspace-tab-badge");

    fireEvent.click(screen.getByRole("tab", { name: /Files/i }));
    expect(onChange).toHaveBeenCalledWith("files");
  });
});
