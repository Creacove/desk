import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CleanProductionRepositories } from "./types/cleanProduction";
import { ManagerKnowledgeAttachmentTray, ManagerKnowledgeUploadButton, useManagerKnowledgeUploads } from "./features/manager/ManagerKnowledgeUpload";

afterEach(cleanup);

function Harness({ manager }: { manager: CleanProductionRepositories["manager"] }) {
  const uploads = useManagerKnowledgeUploads(manager);
  return <div>
    <ManagerKnowledgeUploadButton onFiles={uploads.addFiles} />
    <ManagerKnowledgeAttachmentTray items={uploads.items} onRemove={(id) => void uploads.remove(id)} onRetry={(item) => void uploads.retry(item)} />
    <output aria-label="attachment ids">{uploads.attachmentIds.join(",")}</output>
  </div>;
}

function repository(uploadKnowledge: CleanProductionRepositories["manager"]["uploadKnowledge"]): CleanProductionRepositories["manager"] {
  return {
    loadConversations: async () => [],
    uploadKnowledge,
    revokeKnowledge: async () => undefined,
  };
}

describe("Manager knowledge upload UI", () => {
  it("uploads a supported file and exposes it only when Manager can read it", async () => {
    const uploadKnowledge = vi.fn(async ({ file, onProgress }) => {
      onProgress?.({ phase: "uploading", percent: 40, bytesUploaded: 40, bytesTotal: 100 });
      onProgress?.({ phase: "finalizing", percent: 72, bytesUploaded: 100, bytesTotal: 100 });
      return { id: "doc-1", documentId: "doc-1", kind: "knowledge_document" as const, title: file.name, extractionStatus: "completed", status: "ready" };
    });
    render(<Harness manager={repository(uploadKnowledge)} />);
    fireEvent.click(screen.getByRole("button", { name: "Add files for Manager" }));
    expect(screen.getByText("Upload Manager knowledge")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Choose files for Manager"), { target: { files: [new File(["private deal note"], "deal-notes.txt", { type: "text/plain" })] } });
    await waitFor(() => expect(screen.getByLabelText("attachment ids").textContent).toContain("doc-1"));
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(uploadKnowledge).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported files before calling the repository", async () => {
    const uploadKnowledge = vi.fn();
    render(<Harness manager={repository(uploadKnowledge)} />);
    fireEvent.change(screen.getByLabelText("Choose files for Manager"), { target: { files: [new File(["x"], "clip.mp4", { type: "video/mp4" })] } });
    expect(await screen.findByText(/not supported/i)).toBeTruthy();
    expect(uploadKnowledge).not.toHaveBeenCalled();
  });
});
