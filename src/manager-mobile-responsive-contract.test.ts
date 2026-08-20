import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Manager mobile responsive contract", () => {
  it("reflows artifacts and keeps the V2 composer safe-area dock stable on narrow screens", () => {
    const manager = readFileSync("src/features/manager/ManagerScreensLegacy.tsx", "utf8");
    const composer = readFileSync("src/features/manager/ManagerComposer.tsx", "utf8");

    expect(manager).toContain("pb-[calc(17rem+env(safe-area-inset-bottom))]");
    expect(manager).toContain("sm:pb-[calc(9rem+env(safe-area-inset-bottom))]");
    expect(manager).toContain("grid-cols-[2rem_minmax(0,1fr)]");
    expect(manager).toContain("sm:grid-cols-[2rem_minmax(0,1fr)_auto]");
    expect(manager).toContain("col-start-2 sm:col-start-3 sm:row-start-1");
    expect(manager).toContain("break-words text-[13px]");
    expect(manager).toContain("whitespace-normal");
    expect(composer).toContain("fixed bottom-0 left-0 right-0");
    expect(composer).toContain("pb-[calc(0.5rem+env(safe-area-inset-bottom))]");
    expect(composer).toContain("min-h-10 w-full resize-none");
    expect(composer).toContain('aria-label="Work with Manager"');
  });
});
