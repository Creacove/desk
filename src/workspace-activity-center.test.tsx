import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  countUnreadActivity,
  groupActivityByDay,
  WorkspaceActivityCenter,
} from "./features/notifications/WorkspaceActivityCenter";
import type { WorkspaceOperatingEvent } from "./services/workspaceLiveSync";

const events: WorkspaceOperatingEvent[] = [
  { id: "action-1", artistWorkspaceId: "workspace-a", eventType: "approval_needed", createdAt: "2026-07-28T12:00:00.000Z", displayMode: "action", refreshScope: ["missions"], summary: "Approve the release plan", targetType: "mission", targetId: "mission-a" },
  { id: "toast-1", artistWorkspaceId: "workspace-a", eventType: "manager_read_completed", createdAt: "2026-07-28T11:00:00.000Z", displayMode: "toast", refreshScope: ["music-object"], summary: "Manager Read is ready", targetType: "music_item", targetId: "song-a" },
  { id: "activity-1", artistWorkspaceId: "workspace-a", eventType: "catalog_updated", createdAt: "2026-07-27T10:00:00.000Z", displayMode: "activity", refreshScope: ["music-list"], summary: "Catalogue updated" },
];

afterEach(cleanup);

describe("WorkspaceActivityCenter", () => {
  it("renders one chronological feed without empty status dashboards and deep-links exact objects", () => {
    const onSelect = vi.fn();
    render(<WorkspaceActivityCenter open events={events} hasMore={false} onOpenChange={vi.fn()} onSelect={onSelect} onLoadOlder={vi.fn()} onSeen={vi.fn()} />);

    expect(screen.queryByText("Needs you")).not.toBeInTheDocument();
    expect(screen.queryByText("Recently completed")).not.toBeInTheDocument();
    expect(screen.queryByText("Background activity")).not.toBeInTheDocument();
    expect(screen.getByText("Approve the release plan")).toBeInTheDocument();
    expect(screen.getByText("Manager Read is ready")).toBeInTheDocument();
    expect(screen.getByText("Catalogue updated")).toBeInTheDocument();
    expect(document.querySelector('[data-event-id="action-1"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Approve the release plan/i }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ targetType: "mission", targetId: "mission-a" }));
  });

  it("groups activity by familiar day labels without changing event order", () => {
    const grouped = groupActivityByDay(events, new Date("2026-07-28T18:00:00.000Z"));
    expect(grouped.map((group) => group.label)).toEqual(["Today", "Yesterday"]);
    expect(grouped[0].events.map((event) => event.id)).toEqual(["action-1", "toast-1"]);
  });

  it("derives unread count from the saved cursor", () => {
    expect(countUnreadActivity(events, { createdAt: "2026-07-27T10:00:00.000Z", id: "activity-1" })).toBe(2);
    expect(countUnreadActivity(events, { createdAt: "2026-07-28T12:00:00.000Z", id: "action-1" })).toBe(0);
  });

  it("marks the newest event seen idempotently and restores trigger focus on Escape", async () => {
    const onSeen = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return <>
        <button type="button" onClick={() => setOpen(true)}>Activity, 3 unread</button>
        <WorkspaceActivityCenter open={open} events={events} hasMore={false} onOpenChange={setOpen} onSelect={vi.fn()} onLoadOlder={vi.fn()} onSeen={onSeen} />
      </>;
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Activity, 3 unread" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Activity" })).toBeInTheDocument();
    expect(onSeen).toHaveBeenCalledWith({ createdAt: events[0].createdAt, id: events[0].id });
    const closeButton = screen.getByRole("button", { name: "Close Activity Center" });
    await waitFor(() => expect(closeButton).toHaveFocus());
    fireEvent.keyDown(closeButton, { key: "Escape", code: "Escape", keyCode: 27 });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("uses one useful empty state instead of three empty buckets", () => {
    render(<WorkspaceActivityCenter open events={[]} hasMore={false} onOpenChange={vi.fn()} onSelect={vi.fn()} onLoadOlder={vi.fn()} onSeen={vi.fn()} />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.queryByText(/Nothing is waiting on you/i)).not.toBeInTheDocument();
  });

  it("announces errors and loads older history only on request", () => {
    const onLoadOlder = vi.fn();
    render(<WorkspaceActivityCenter open events={events} error="Activity could not load." hasMore onOpenChange={vi.fn()} onSelect={vi.fn()} onLoadOlder={onLoadOlder} onSeen={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Activity could not load.");
    fireEvent.click(screen.getByRole("button", { name: "Load earlier activity" }));
    expect(onLoadOlder).toHaveBeenCalledTimes(1);
  });
});
