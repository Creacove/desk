import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import type { TeamResponsibilities } from "../../types/workspaceTeam";
import { TeamRolePicker } from "./TeamRolePicker";

afterEach(cleanup);

function Harness({ initialValue = { operatingTitle: null, responsibilityTags: [] } }: { initialValue?: TeamResponsibilities }) {
  const [value, setValue] = useState(initialValue);
  return <TeamRolePicker value={value} onChange={setValue} />;
}

describe("TeamRolePicker", () => {
  it("fills a preset and emits the remaining tags after a chip is removed", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "DSP & Distribution" }));

    expect(screen.getByText("DSP pitching")).toBeInTheDocument();
    expect(screen.getByText("Distribution")).toBeInTheDocument();
    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.getByText("Platform relationships")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove DSP pitching" }));

    expect(screen.queryByText("DSP pitching")).not.toBeInTheDocument();
    expect(screen.getByText("Distribution")).toBeInTheDocument();
  });

  it("lets an Other role enter a custom title and responsibility tags", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Operating title" }), { target: { value: "Tour manager" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Add responsibility" }), { target: { value: "Tour logistics, tour logistics, Booking" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Add responsibility" }), { key: "Enter", code: "Enter" });

    expect(screen.getByDisplayValue("Tour manager")).toBeInTheDocument();
    expect(screen.getByText("Tour logistics")).toBeInTheDocument();
    expect(screen.getByText("Booking")).toBeInTheDocument();
  });

  it("does not mutate the value when disabled", () => {
    const onChange = () => undefined;
    render(<TeamRolePicker value={{ operatingTitle: null, responsibilityTags: [] }} onChange={onChange} disabled />);

    expect(screen.getByRole("button", { name: "DSP & Distribution" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Add responsibility" })).toBeDisabled();
  });
});
