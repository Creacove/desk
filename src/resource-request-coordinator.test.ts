import { describe, expect, it, vi } from "vitest";

import { createResourceRequestCoordinator } from "./services/resourceRequestCoordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("createResourceRequestCoordinator", () => {
  it("shares one in-flight promise for the same workspace resource", async () => {
    const pending = deferred<string>();
    const loader = vi.fn(() => pending.promise);
    const coordinator = createResourceRequestCoordinator();

    const first = coordinator.load("workspace-a", "music-list", loader);
    const second = coordinator.load("workspace-a", "music-list", loader);

    expect(second).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
    pending.resolve("catalog");
    await expect(first).resolves.toBe("catalog");
  });

  it("runs at most one follow-up when an in-flight resource is invalidated", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const loader = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const coordinator = createResourceRequestCoordinator();

    const initial = coordinator.load("workspace-a", "desk-brief", loader);
    coordinator.invalidate("workspace-a", "desk-brief");
    coordinator.invalidate("workspace-a", "desk-brief");
    const followUp = coordinator.load("workspace-a", "desk-brief", loader);

    expect(loader).toHaveBeenCalledTimes(1);
    first.resolve("old");
    await expect(initial).resolves.toBe("old");
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(2);
    second.resolve("fresh");
    await expect(followUp).resolves.toBe("fresh");
  });

  it("isolates cached values by workspace", async () => {
    const coordinator = createResourceRequestCoordinator();
    const loaderA = vi.fn(async () => "workspace-a-value");
    const loaderB = vi.fn(async () => "workspace-b-value");

    await expect(coordinator.load("workspace-a", "activity", loaderA)).resolves.toBe("workspace-a-value");
    await expect(coordinator.load("workspace-b", "activity", loaderB)).resolves.toBe("workspace-b-value");
    await expect(coordinator.load("workspace-a", "activity", loaderA)).resolves.toBe("workspace-a-value");
    expect(loaderA).toHaveBeenCalledTimes(1);
    expect(loaderB).toHaveBeenCalledTimes(1);
  });

  it("does not let an old generation overwrite a newer completion", async () => {
    const oldRequest = deferred<string>();
    const coordinator = createResourceRequestCoordinator();
    const oldResult = coordinator.load("workspace-a", "mission-list", () => oldRequest.promise);

    coordinator.clearWorkspace("workspace-a");
    await expect(coordinator.load("workspace-a", "mission-list", async () => "new")).resolves.toBe("new");
    oldRequest.resolve("old");
    await expect(oldResult).resolves.toBe("old");

    const shouldNotRun = vi.fn(async () => "wrong");
    await expect(coordinator.load("workspace-a", "mission-list", shouldNotRun)).resolves.toBe("new");
    expect(shouldNotRun).not.toHaveBeenCalled();
  });

  it("clears every cached and in-flight resource owned by a workspace", async () => {
    const coordinator = createResourceRequestCoordinator();
    await coordinator.load("workspace-a", "activity", async () => "activity-v1");
    await coordinator.load("workspace-a", "conversation-list", async () => "conversations-v1");
    await coordinator.load("workspace-b", "activity", async () => "other-workspace");

    coordinator.clearWorkspace("workspace-a");

    await expect(coordinator.load("workspace-a", "activity", async () => "activity-v2")).resolves.toBe("activity-v2");
    await expect(coordinator.load("workspace-a", "conversation-list", async () => "conversations-v2")).resolves.toBe("conversations-v2");
    const otherLoader = vi.fn(async () => "wrong");
    await expect(coordinator.load("workspace-b", "activity", otherLoader)).resolves.toBe("other-workspace");
    expect(otherLoader).not.toHaveBeenCalled();
  });
});
