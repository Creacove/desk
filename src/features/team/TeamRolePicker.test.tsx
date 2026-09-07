import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import type { TeamResponsibilities } from "../../types/workspaceTeam";
import { TeamRolePicker } from "./TeamRolePicker";

afterEach(cleanup);

function Harness({
  initialValue = { operatingTitle: null, responsibilityTags: [] },
  mode = "all",
}: {
  initialValue?: TeamResponsibilities;
  mode?: "role" | "responsibilities" | "all";
}) {
  const [value, setValue] = useState(initialValue);
  return <TeamRolePicker value={value} onChange={setValue} mode={mode} />;
}

describe("TeamRolePicker", () => {
  it("keeps role selection in one compact music-industry dropdown", () => {
    render(<Harness mode="role" />);

    expect(screen.getByRole("combobox", { name: "Your role" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Responsibility 1" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Your role" }), { target: { value: "Manager / project lead" } });

    expect(screen.getByRole("combobox", { name: "Your role" })).toHaveValue("Manager / project lead");
  });

  it("shows three compact responsibility slots and adds another only on request", () => {
    render(<Harness mode="responsibilities" initialValue={{ operatingTitle: "Manager / project lead", responsibilityTags: [] }} />);

    expect(screen.getByRole("combobox", { name: "Responsibility 1" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Responsibility 2" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Responsibility 3" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Responsibility 4" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add responsibility" }));

    expect(screen.getByRole("combobox", { name: "Responsibility 4" })).toBeInTheDocument();
  });

  it("keeps a custom role editable without making owner an industry role", () => {
    render(<Harness mode="role" />);

    fireEvent.change(screen.getByRole("combobox", { name: "Your role" }), { target: { value: "Other" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Custom role" }), { target: { value: "House coordinator" } });

    expect(screen.getByDisplayValue("House coordinator")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Owner" })).not.toBeInTheDocument();
  });

  it("does not mutate the value when disabled", () => {
    const onChange = () => undefined;
    render(<TeamRolePicker value={{ operatingTitle: null, responsibilityTags: [] }} onChange={onChange} disabled />);

    expect(screen.getByRole("combobox", { name: "Your role" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Responsibility 1" })).toBeDisabled();
  });
});
