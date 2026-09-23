import { beforeEach, describe, expect, it, vi } from "vitest";

const initializePaddle = vi.hoisted(() => vi.fn());
vi.mock("@paddle/paddle-js", () => ({ initializePaddle }));

beforeEach(() => {
  vi.resetModules();
  initializePaddle.mockReset();
});

describe("Paddle initialization", () => {
  it("retries initialization after a transient failure", async () => {
    const paddle = { PricePreview: vi.fn(), Checkout: { open: vi.fn() } };
    initializePaddle.mockRejectedValueOnce(new Error("Paddle script temporarily unavailable"))
      .mockResolvedValueOnce(paddle);
    const { getPaddle } = await import("./lib/paddleBilling");
    const config = { environment: "production" as const, clientToken: "live_test_token" };

    await expect(getPaddle(config)).rejects.toThrow("Paddle script temporarily unavailable");
    await expect(getPaddle(config)).resolves.toBe(paddle);
    expect(initializePaddle).toHaveBeenCalledTimes(2);
  });
});
