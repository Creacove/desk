import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { Button, ManagerComposer, formatProductTimestamp } from "./desktopPrimitives";

const desktopCss = readFileSync("src/design-system/desktop-premium.css", "utf8");

describe("desktop design primitives", () => {
  it("makes the primary action the purple forward-action variant", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("bg-brand-accent", "px-4", "min-h-10");
  });

  it("keeps semantic button variants constrained", () => {
    const { rerender } = render(<Button variant="secondary">Upload</Button>);
    expect(screen.getByRole("button", { name: "Upload" })).toHaveClass("border", "bg-background");
    rerender(<Button variant="ghost">Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("bg-transparent");
    rerender(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("bg-destructive");
  });

  it("keeps pending actions dimensionally stable and non-repeatable", () => {
    render(<Button pending>Save changes</Button>);
    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("px-4", "min-h-10");
  });

  it("frames Manager as work and submits without chat-language defaults", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<ManagerComposer value="Plan the release" onChange={onChange} onSubmit={onSubmit} />);

    expect(screen.getByPlaceholderText("What do you want to work on?")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ask manager/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send to Manager" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("uses exact desktop timestamps with one formatter", () => {
    const now = new Date("2026-08-18T11:34:00+01:00");
    expect(formatProductTimestamp("2026-08-18T10:42:00+01:00", "standalone", now)).toContain("Today");
    expect(formatProductTimestamp("2026-08-17T16:18:00+01:00", "standalone", now)).toContain("Yesterday");
    expect(formatProductTimestamp("2026-08-18T10:42:00+01:00", "grouped", now)).not.toContain("Today");
  });

  it("locks the deliberate desktop composition widths and adaptive gutters", () => {
    expect(desktopCss).toContain("max-width: 1320px");
    expect(desktopCss).toContain("padding-inline: 32px !important");
    expect(desktopCss).toContain("padding-inline: 40px !important");
    expect(desktopCss).toContain("padding-inline: 48px !important");
  });

  it("keeps reduced-motion users out of decorative workspace movement", () => {
    expect(desktopCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(desktopCss).toContain("transform: none !important");
  });
});
