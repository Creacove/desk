import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Ops meeting review surface", () => {
  it("is reachable from an explicit operator workspace URL", () => {
    const source = readFileSync("src/app/OperatorWorkspaceRoute.tsx", "utf8");
    expect(source).toContain("OpsMeetingReview");
    expect(source).toContain("opsMeetingId");
  });
});
