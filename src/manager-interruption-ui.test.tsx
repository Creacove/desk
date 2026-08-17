import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GuidedContextQuestion,
  ManagerWorkspaceActions,
  parseManagerWorkspaceAction,
} from "./features/manager/ManagerComposer";
import type { ManagerMissionContextQuestion } from "./types/cleanProduction";

afterEach(cleanup);

function question(overrides: Partial<ManagerMissionContextQuestion> = {}): ManagerMissionContextQuestion {
  return {
    key: "launch_market",
    question: "Which market should we prioritize for launch?",
    reason: "This explanation should not be repeated in the compact decision UI.",
    answerKind: "single_select",
    options: ["Nigeria", "UK", "US"],
    recommendedAnswer: "Nigeria",
    recommendationReason: "This second explanation should not be rendered either.",
    ...overrides,
  };
}

describe("Manager interruption UI", () => {
  it("parses workspace blockers as actions instead of conversational answers", () => {
    const action = parseManagerWorkspaceAction(question({
      key: "workspace_action:files:cover_art",
      question: "Approved cover artwork is missing.",
      reason: "Add the approved cover before Manager finishes the launch kit.",
      answerKind: "short_text",
      options: [],
      recommendedAnswer: "Add artwork",
      recommendationReason: "",
    }));

    expect(action).toEqual({
      key: "workspace_action:files:cover_art",
      target: "files",
      action: "cover_art",
      title: "Approved cover artwork is missing.",
      description: "Add the approved cover before Manager finishes the launch kit.",
      actionLabel: "Add artwork",
    });
  });

  it("renders required workspace work as a direct action with no answer field", () => {
    const onOpen = vi.fn();
    const action = parseManagerWorkspaceAction(question({
      key: "workspace_action:files:cover_art",
      question: "Approved cover artwork is missing.",
      reason: "Add the approved cover before Manager finishes the launch kit.",
      answerKind: "short_text",
      options: [],
      recommendedAnswer: "Add artwork",
    }))!;

    render(<ManagerWorkspaceActions actions={[action]} onOpen={onOpen} />);

    expect(screen.queryByText("Action required")).not.toBeInTheDocument();
    expect(screen.getByText("Approved cover artwork is missing.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add artwork/i }));
    expect(onOpen).toHaveBeenCalledWith(action);
  });

  it("shows choices as compact decision rows and integrates the recommendation", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <GuidedContextQuestion
        question={question()}
        position={0}
        total={1}
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        onUseRecommendation={vi.fn()}
        sendPending={false}
      />,
    );

    expect(screen.getByText("Which market should we prioritize for launch?")).toBeInTheDocument();
    expect(screen.queryByText("This explanation should not be repeated in the compact decision UI.")).not.toBeInTheDocument();
    expect(screen.queryByText("This second explanation should not be rendered either.")).not.toBeInTheDocument();
    expect(screen.queryByText("I’m not sure")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("manager-choice-option")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Nigeria.*Recommended/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Other/i }));
    expect(screen.getByRole("textbox", { name: "Which market should we prioritize for launch?" })).toBeInTheDocument();
  });
});
