import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationWorkspace, ManagerOfficeScreen } from "./features/manager/ManagerScreens";
import { ManagerComposer } from "./features/manager/ManagerComposer";

afterEach(() => cleanup());

describe("Manager premium phase 1", () => {
  it("keeps Manager Office as a top-level surface without a nested back button", () => {
    render(<ManagerOfficeScreen {...({ conversations: [], missionGenesisResult: null, missionGenesisAnswers: {}, missionGenesisPending: false, missionGenesisError: null, onMissionGenesisAnswerChange: vi.fn(), onSubmitMissionGenesisAnswers: vi.fn(), onOpenCreatedMission: vi.fn(), onBack: vi.fn(), onConversation: vi.fn(), onAskManager: vi.fn(), askManagerPending: false, askManagerError: null } as any)} />);
    expect(screen.getByRole("heading", { name: "Manager's Office" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Back to Desk/i })).not.toBeInTheDocument();
    expect(screen.getByText("No conversations yet. Ask Manager something to start.")).toBeInTheDocument();
  });

  it("renders an intentional conversation loading state instead of an incomplete thread", () => {
    render(<ConversationWorkspace {...({ conversation: { id: "conversation-1", topic: "Dance — song workspace", prompt: "", messages: [] }, onBack: vi.fn(), onOpenCreatedWork: vi.fn(), onSendMessage: vi.fn(), onSendContextAnswers: vi.fn(), sendPending: false, sendError: null, detailPending: true } as any)} />);
    expect(screen.getByTestId("manager-conversation-loading")).toBeInTheDocument();
    expect(screen.getByText("Loading conversation...")).toBeInTheDocument();
  });

  it("does not show a permanent verification disclaimer under normal chat", () => {
    render(<ManagerComposer draft="" onDraftChange={vi.fn()} onSend={vi.fn()} sendPending={false} />);
    expect(screen.queryByText("Verify important decisions before acting.")).not.toBeInTheDocument();
  });
});
