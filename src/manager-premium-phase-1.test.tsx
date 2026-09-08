import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationWorkspace, ManagerOfficeScreen } from "./features/manager/ManagerScreens";
import { ManagerComposer } from "./features/manager/ManagerComposer";
import { DeskRail, MobileChrome } from "./design-system/components";

afterEach(() => cleanup());

describe("Manager premium desktop system", () => {
  it("keeps Manager Office top-level and frames Manager around work", () => {
    render(<ManagerOfficeScreen {...({ conversations: [], missionGenesisResult: null, missionGenesisAnswers: {}, missionGenesisPending: false, missionGenesisError: null, onMissionGenesisAnswerChange: vi.fn(), onSubmitMissionGenesisAnswers: vi.fn(), onOpenCreatedMission: vi.fn(), onBack: vi.fn(), onConversation: vi.fn(), onAskManager: vi.fn(), askManagerPending: false, askManagerError: null } as any)} />);
    expect(screen.getByRole("heading", { name: "Manager's Office" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Back to Desk/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("What do you want to work on?")).toBeInTheDocument();
    expect(screen.getByText("No conversations yet. Start working with Manager.")).toBeInTheDocument();
  });

  it("renders a structural conversation loading state instead of false empty content", () => {
    render(<ConversationWorkspace {...({ conversation: { id: "conversation-1", topic: "Dance — song workspace", prompt: "", messages: [] }, onBack: vi.fn(), onOpenCreatedWork: vi.fn(), onSendMessage: vi.fn(), onSendContextAnswers: vi.fn(), sendPending: false, sendError: null, detailPending: true } as any)} />);
    expect(screen.getByTestId("manager-conversation-loading")).toBeInTheDocument();
    expect(screen.queryByText(/No conversations yet/i)).not.toBeInTheDocument();
  });

  it("preserves an existing conversation while fresher detail is loading", () => {
    render(<ConversationWorkspace {...({ conversation: { id: "conversation-1", topic: "Dance — song workspace", prompt: "", createdWork: [], releaseSuccessArtifacts: [], releaseOpportunityArtifacts: [], messages: [{ id: "message-1", speaker: "manager", body: "The current release plan is ready.", createdAt: "2026-08-20T12:00:00Z" }] }, onBack: vi.fn(), onOpenCreatedWork: vi.fn(), onSendMessage: vi.fn(), onSendContextAnswers: vi.fn(), sendPending: false, sendError: null, detailPending: true } as any)} />);

    expect(screen.getByText("The current release plan is ready.")).toBeInTheDocument();
    expect(screen.queryByTestId("manager-conversation-loading")).not.toBeInTheDocument();
  });

  it("renders Manager markdown emphasis without leaking markdown markers", () => {
    render(<ConversationWorkspace {...({ conversation: { id: "conversation-1", topic: "Dance — song workspace", prompt: "", createdWork: [], releaseSuccessArtifacts: [], releaseOpportunityArtifacts: [], messages: [{ id: "message-1", speaker: "manager", body: "The **release plan** is ready.", createdAt: "2026-08-20T12:00:00Z" }] }, onBack: vi.fn(), onOpenCreatedWork: vi.fn(), onSendMessage: vi.fn(), onSendContextAnswers: vi.fn(), sendPending: false, sendError: null } as any)} />);

    const message = screen.getByTestId("manager-message-manager");
    expect(message).toHaveTextContent("The release plan is ready.");
    expect(message.querySelector("strong")).toHaveTextContent("release plan");
    expect(message).not.toHaveTextContent("**");
  });

  it("shows only the current page title in mobile chrome", () => {
    render(<MobileChrome active="labelHQ" title="Home" onNavigate={vi.fn()} />);

    const topbar = screen.getByTestId("mobile-app-topbar");
    expect(topbar).toHaveTextContent("Home");
    expect(topbar).not.toHaveTextContent("Desk");
    expect(topbar).not.toHaveTextContent("Artist workspace");
  });

  it("keeps mobile chrome to the page title and actions", () => {
    render(<MobileChrome active="settings" title="Settings" teamName={null} artistName="Godwinton" isTeamPlan onNavigate={vi.fn()} />);

    const topbar = screen.getByTestId("mobile-app-topbar");
    expect(topbar).toHaveTextContent("Settings");
    expect(topbar).not.toHaveTextContent("Loading team identity");
    expect(topbar).not.toHaveTextContent("Account");
    expect(topbar).not.toHaveTextContent("Godwinton");
  });

  it("keeps the desktop rail to the artist desk and compact team badge", () => {
    render(<DeskRail active="labelHQ" artistName="Victorni" teamName="CBA House 3" isTeamPlan onNavigate={vi.fn()} />);

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    expect(rail).toHaveTextContent("Victorni's Desk");
    expect(rail).toHaveTextContent("CBA House 3");
    expect(rail).not.toHaveTextContent("Ordersounds");
    expect(rail).not.toHaveTextContent("Artist");
    expect(rail).not.toHaveTextContent("Team workspace");
  });

  it("does not show a permanent verification disclaimer under normal work", () => {
    render(<ManagerComposer draft="" onDraftChange={vi.fn()} onSend={vi.fn()} sendPending={false} />);
    expect(screen.getByPlaceholderText("What do you want to work on?")).toBeInTheDocument();
    expect(screen.queryByText("Verify important decisions before acting.")).not.toBeInTheDocument();
  });
});
