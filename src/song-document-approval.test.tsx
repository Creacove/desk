import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SongDocumentEditor } from "./features/music/SongDocumentEditor";
import type { SongMaterialViewModel } from "./types/cleanProduction";

afterEach(() => cleanup());

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
    body: "# Down Below EPK\n\n**Purpose:** Give press a useful release packet.\n**Audience:** Music press.\n**Core narrative:** A focused release story.\n\n## Artist\nDown Below is the current focus release.\n\n## Needs verification\n- Approved press contact",
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

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
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

    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByText("Internal strategy")).toBeTruthy();
  });

  it("withholds approval while the artifact still needs review without putting review-state copy on the document", () => {
    render(
      <SongDocumentEditor
        document={managerDocument({ reviewState: "needs_review" })}
        pending={false}
        onCancel={() => undefined}
        onSave={() => undefined}
        onApprove={() => undefined}
      />,
    );

    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByText("Review draft")).toBeNull();
  });

  it("does not expose Desk planning or missing-input scaffolding in an old Manager artifact", () => {
    render(
      <SongDocumentEditor
        document={managerDocument()}
        pending={false}
        onCancel={() => undefined}
        onSave={() => undefined}
        onApprove={() => undefined}
      />,
    );

    expect(screen.queryByText(/Give press a useful release packet/)).toBeNull();
    expect(screen.queryByText(/Music press/)).toBeNull();
    expect(screen.queryByText(/A focused release story/)).toBeNull();
    expect(screen.queryByText(/Needs verification/i)).toBeNull();
    expect(screen.queryByText(/Approved press contact/i)).toBeNull();
    expect(screen.getByText(/Down Below is the current focus release/)).toBeTruthy();
  });

  it("does not ask for approval twice after the exact version is approved", () => {
    render(
      <SongDocumentEditor
        document={managerDocument({ status: "accepted" })}
        pending={false}
        onCancel={() => undefined}
        onSave={() => undefined}
        onApprove={() => undefined}
      />,
    );

    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});


describe("SongDocumentEditor conversation preview", () => {
  it("keeps a Manager document read-only in conversation while exposing its canonical Files location", () => {
    const onOpenFiles = vi.fn();
    render(
      <SongDocumentEditor
        document={managerDocument()}
        pending={false}
        onCancel={() => undefined}
        onSave={() => undefined}
        onApprove={() => undefined}
        previewOnly
        contextNote="Saved to Dance → Files. You can find this document there anytime."
        onOpenFiles={onOpenFiles}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.getByText("Saved to Dance → Files. You can find this document there anytime.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open in Files" }));
    expect(onOpenFiles).toHaveBeenCalledTimes(1);
  });
});
