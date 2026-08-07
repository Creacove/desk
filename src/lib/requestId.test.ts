import { describe, expect, it } from "vitest";
import { createClientRequestId } from "./requestId";

describe("createClientRequestId", () => {
  it("returns a version 4 UUID when randomUUID is unavailable", () => {
    expect(createClientRequestId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
