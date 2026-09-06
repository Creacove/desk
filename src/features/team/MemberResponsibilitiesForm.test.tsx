import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import type { TeamResponsibilities } from "../../types/workspaceTeam";
import { MemberResponsibilitiesForm } from "./MemberResponsibilitiesForm";

afterEach(cleanup);

describe("MemberResponsibilitiesForm", () => {
  it("uses the shared role picker and preserves the save/cancel actions", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    function Harness() {
      const [draft, setDraft] = useState<TeamResponsibilities>({ operatingTitle: null, responsibilityTags: [] });
      return (
        <MemberResponsibilitiesForm
          memberName="Mina"
          draft={draft}
          pending={false}
          onChange={setDraft}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "DSP & Distribution" }));

    expect(screen.getByText("Platform relationships")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save responsibilities for Mina" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
