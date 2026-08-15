import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SongDocumentEditor } from "./features/music/SongDocumentEditor";
import type { SongMaterialViewModel } from "./types/cleanProduction";

function managerDocument(overrides: Partial<Extract<SongMaterialViewModel, { kind: "document" }>> = {}) {
  return {
    id: "document-1",
    kind: "document" as const,
    group: "Documents" as const,
    materialType: "epk" as const,
    title: "Down Below EPK",
    status: "draft",
    origin: "manager_generated" as const,
    reviewState: "ready" as const,
    body: "# Down Below EPK\n\n**Purpose:** Give press a useful release packet.\n**Audience:** Music press.\n**Core narrative:** A focused release story.\n\n## Release story\nThis is the canonical release story for the record.",
    currentVersionId: "version-1",
    ...overrides,
  };
}

describe("Manager document approval", () => {
  it("offers one-click approval for a quality-ready Manager artifact", () => {
    const onApprove = vi.fn();
    render(
      <SongDocumentEditor
        document={managerDocument()}
        pending={false}
        onCancel={() => undefined}
        onSave={() => undefined}
        onApprove={onApprove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve for sharing" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("never offers approval for the internal Release Narrative", () => {
    render(
      <SongDocumentEditor
        document={managerDocument({ title: "Release narrative", materialType: "press_angle" })}
        pending={false}
        onCancel={() => undefined}
        onSave={() => undefined}
        onApprove={() => undefined}
      />,
    );

    expect(screen.queryByRole("button", { name: "Approve for sharing" })).not.toBeInTheDocument();
    expect(screen.getByText("Internal campaign spine")).toBeInTheDocument();
  });

  it("withholds approval while the artifact still needs review", () => {
    render(
      <SongDocumentEditor
        document={managerDocument({ reviewState: "needs_review" })}
        pending={false}
        onCancel={() => undefined}
        onSave={() => undefined}
        onApprove={() => undefined}
      />,
    );

    expect(screen.queryByRole("button", { name: "Approve for sharing" })).not.toBeInTheDocument();
    expect(screen.getByText("Review draft")).toBeInTheDocument();
  });

  it("shows the approved state without asking for approval twice", () => {
    render(
      <SongDocumentEditor
        document={managerDocument({ status: "accepted" })}
        pending={false}
        onCancel={() => undefined}
        onSave={() => undefined}
        onApprove={() => undefined}
      />,
    );

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve for sharing" })).not.toBeInTheDocument();
  });
});
