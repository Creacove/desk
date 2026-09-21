import { describe, expect, it } from "vitest";
import { buildLinkCaseWorkspaceParams } from "./opsApi";

describe("Ops RPC contracts", () => {
  it("uses the deployed SQL parameter names when linking a Desk workspace", () => {
    expect(buildLinkCaseWorkspaceParams("case-id", "workspace-id", null)).toEqual({
      p_ops_case_id: "case-id",
      p_artist_workspace_id: "workspace-id",
      p_expected_current_workspace_id: null,
    });
  });
});
