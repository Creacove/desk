import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskAssigneeControl } from "./TaskAssigneeControl";
import type { WorkspaceMember, WorkspaceRoster } from "../../types/workspaceTeam";

const owner: WorkspaceMember = {
  userId: "44444444-4444-4444-8444-444444444444",
  displayName: "Amina",
  accessRole: "owner",
  operatingTitle: "Artist",
  responsibilityTags: [],
};
const sarah: WorkspaceMember = {
  userId: "55555555-5555-4555-8555-555555555555",
  displayName: "Sarah",
  accessRole: "member",
  operatingTitle: "Distribution",
  responsibilityTags: ["DSPs"],
};
const favour: WorkspaceMember = {
  userId: "77777777-7777-4777-8777-777777777777",
  displayName: "Favour",
  accessRole: "member",
  operatingTitle: "Content",
  responsibilityTags: ["content"],
};
const roster: WorkspaceRoster = {
  scope: {
    accountId: "11111111-1111-4111-8111-111111111111",
    artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
    artistId: "33333333-3333-4333-8333-333333333333",
  },
  members: [owner, sarah, favour],
  loadedAt: "2026-09-05T09:00:00.000Z",
};

describe("TaskAssigneeControl", () => {
  afterEach(cleanup);

  it("shows a compact assignee chip", () => {
    render(<TaskAssigneeControl roster={roster} assigneeUserId={sarah.userId} viewerUserId={sarah.userId} assignmentVersion={2} />);

    expect(screen.getByText("Sarah")).toBeInTheDocument();
    expect(screen.queryByText("ASSIGNEE")).not.toBeInTheDocument();
    expect(screen.queryByText("Assigned to you")).not.toBeInTheDocument();
  });

  it("lets the owner reassign from the compact picker", async () => {
    const onReassign = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskAssigneeControl
        roster={roster}
        assigneeUserId={sarah.userId}
        viewerUserId={owner.userId}
        assignmentVersion={2}
        onReassign={onReassign}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /assigned to sarah/i }));
    fireEvent.click(screen.getByRole("button", { name: /assign to favour/i }));
    await waitFor(() => expect(onReassign).toHaveBeenCalledWith(favour.userId, 2));
  });

  it("keeps reassignment controls out of a member view", () => {
    render(
      <TaskAssigneeControl
        roster={roster}
        assigneeUserId={sarah.userId}
        viewerUserId={sarah.userId}
        assignmentVersion={2}
        onReassign={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /change assignee/i })).not.toBeInTheDocument();
    expect(screen.getByText("Sarah")).toBeInTheDocument();
  });

  it("hides assignment entirely when the workspace has one active person", () => {
    render(
      <TaskAssigneeControl
        roster={{ ...roster, members: [owner] }}
        assigneeUserId={owner.userId}
        viewerUserId={owner.userId}
        assignmentVersion={1}
        onReassign={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("task-assignee-control")).not.toBeInTheDocument();
  });

  it("hides assignment for Manager-owned work", () => {
    render(
      <TaskAssigneeControl
        roster={roster}
        assigneeUserId={null}
        viewerUserId={owner.userId}
        assignmentVersion={0}
        onReassign={vi.fn()}
        workMode="manager_work"
      />,
    );

    expect(screen.queryByTestId("task-assignee-control")).not.toBeInTheDocument();
  });
});
