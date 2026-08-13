import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SongDocumentActions } from "./features/music/SongDocumentActions";

afterEach(cleanup);

describe("SongDocumentActions", () => {
  it("renders outside clipped song surfaces and exposes every document path", () => {
    render(
      <div style={{ overflow: "hidden", height: 20 }}>
        <SongDocumentActions
          onWrite={vi.fn()}
          onAskManager={vi.fn()}
          onUpload={vi.fn()}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add document" }));

    const dialog = screen.getByRole("dialog", { name: "Add document" });
    expect(dialog.parentElement).toBe(document.body);
    for (const label of [
      "Write here",
      "Ask Manager to draft",
      "Lyrics",
      "EPK / press kit",
      "Press material",
      "Split sheet / rights document",
      "Other document",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("restores focus, closes on Escape, and routes typed uploads", () => {
    const upload = vi.fn();
    render(<SongDocumentActions onWrite={vi.fn()} onAskManager={vi.fn()} onUpload={upload} />);
    const trigger = screen.getByRole("button", { name: "Add document" });

    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Add document" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Split sheet / rights document" }));
    expect(upload).toHaveBeenCalledWith({ label: "Split sheet / rights document", assetType: "split_sheet" });
    expect(screen.queryByRole("dialog", { name: "Add document" })).not.toBeInTheDocument();
  });

  it("makes the canonical Files destination explicit for Manager drafts", () => {
    render(<SongDocumentActions onWrite={vi.fn()} onAskManager={vi.fn()} onUpload={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add document" }));

    expect(screen.getByRole("dialog", { name: "Add document" })).toHaveTextContent("song Files");
    expect(screen.getByRole("dialog", { name: "Add document" })).toHaveTextContent("review before sharing");
  });
});
