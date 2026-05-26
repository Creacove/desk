import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AiLabelPrototype from "./pages/AiLabelPrototype";

const enterLabelHq = () => {
  render(<AiLabelPrototype />);
  fireEvent.click(screen.getByRole("button", { name: /continue to artist context/i }));
  fireEvent.click(screen.getByRole("button", { name: /enter desk hq/i }));
};

beforeEach(() => {
  Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AiLabelPrototype Ordersounds Desk operating room", () => {
  it("exposes a mobile app shell with bottom navigation while keeping the desktop rail for larger screens", () => {
    enterLabelHq();

    const desktopRail = screen.getByRole("navigation", { name: /ordersounds desk navigation/i });
    expect(desktopRail).toHaveClass("hidden", "lg:flex");

    const mobileTopBar = screen.getByTestId("mobile-app-topbar");
    expect(mobileTopBar).toHaveClass("lg:hidden");
    expect(mobileTopBar).toHaveTextContent(/ordersounds/i);
    expect(mobileTopBar).toHaveTextContent(/desk hq/i);

    const mobileNav = screen.getByRole("navigation", { name: /mobile desk navigation/i });
    expect(mobileNav).toHaveClass("lg:hidden");
    expect(screen.getByRole("button", { name: /^hq$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^missions$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^manager$/i })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("button", { name: /^team agents$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^profile$/i })).toBeInTheDocument();
  }, 15000);

  it("keeps the core Desk HQ workflow reachable in the mobile density layout", () => {
    enterLabelHq();

    expect(screen.getByTestId("mobile-priority-stack")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-priority-stack")).toHaveTextContent(/needs attention/i);
    expect(screen.getByTestId("mobile-priority-stack")).toHaveTextContent(/active missions/i);
    expect(screen.getByTestId("mobile-team-strip")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-team-strip")).toHaveTextContent(/team readiness/i);
    expect(screen.getByText(/today's brief/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /talk to manager/i })).toBeInTheDocument();
  });

  it("routes Desk HQ strip signals to the right work surfaces", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /open active missions/i }));
    expect(screen.getByRole("heading", { name: /^missions\.?$/i })).toBeInTheDocument();

    cleanup();
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /open blocked rights task/i }));
    expect(screen.getByRole("heading", { name: /^release tasks\.?$/i })).toBeInTheDocument();

    cleanup();
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /open next task/i }));
    expect(screen.getByRole("heading", { name: /^release tasks\.?$/i })).toBeInTheDocument();

    cleanup();
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /open active music focus/i }));
    expect(screen.getByRole("heading", { name: /^music\.?$/i })).toBeInTheDocument();
    expect(screen.getByText(/recorded work under management/i)).toBeInTheDocument();
  }, 15000);

  it("opens Music as a durable operating area for songs and projects", () => {
    enterLabelHq();

    fireEvent.click(screen.getByRole("button", { name: /^music$/i }));
    expect(screen.getByRole("heading", { name: /^music\.?$/i })).toBeInTheDocument();
    expect(screen.getByText(/recorded work under management/i)).toBeInTheDocument();
    expect(screen.queryByText(/current music focus/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("music-detail-panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^songs$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^projects$/i })).toBeInTheDocument();
    expect(screen.getByTestId("music-library")).toHaveTextContent(/night bus/i);
    expect(screen.getByTestId("music-library")).toHaveTextContent(/after hours static/i);
    expect(screen.getByTestId("music-library")).not.toHaveTextContent(/manager next move/i);
    expect(screen.getByTestId("music-library")).toHaveTextContent(/files/i);
    expect(screen.getByTestId("music-library")).toHaveTextContent(/details/i);
    expect(screen.getByTestId("music-library")).toHaveTextContent(/rights/i);
    expect(screen.getByTestId("music-library")).toHaveTextContent(/confirm split sheet/i);

    fireEvent.click(screen.getByRole("button", { name: /open song night bus/i }));
    const nightBusRoom = screen.getByTestId("music-song-detail");
    expect(nightBusRoom).toHaveTextContent(/song room/i);
    expect(screen.queryByRole("heading", { name: /^music\.?$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /song stage/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /recording/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /released/i })).toBeInTheDocument();
    expect(within(nightBusRoom).getByRole("button", { name: /^overview$/i })).toHaveAttribute("aria-pressed", "true");
    expect(within(nightBusRoom).getByRole("button", { name: /^files$/i })).toBeInTheDocument();
    expect(within(nightBusRoom).getByRole("button", { name: /^details$/i })).toBeInTheDocument();
    expect(within(nightBusRoom).getByRole("button", { name: /^rights$/i })).toBeInTheDocument();
    expect(within(nightBusRoom).queryByRole("button", { name: /^songs$/i })).not.toBeInTheDocument();
    expect(within(nightBusRoom).queryByRole("button", { name: /^projects$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^back$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to music/i })).toBeInTheDocument();
    expect(within(nightBusRoom).queryByRole("button", { name: /^metadata$/i })).not.toBeInTheDocument();
    expect(within(nightBusRoom).queryByRole("button", { name: /^splits$/i })).not.toBeInTheDocument();
    expect(within(nightBusRoom).queryByRole("button", { name: /^manager$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^idea recording production mixing mastering ready scheduled released catalog$/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/confirm split sheet/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/linked work/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/release night bus on june 12/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/source limit/i);
    expect(within(nightBusRoom).getByRole("button", { name: /release night bus on june 12/i })).toBeInTheDocument();
    const linkedWork = within(nightBusRoom).getByTestId("music-linked-work");
    expect(linkedWork).toHaveTextContent(/mission path/i);
    expect(linkedWork).toHaveTextContent(/3 tasks attached/i);
    expect(linkedWork).not.toHaveTextContent(/confirm split sheet/i);
    expect(linkedWork).not.toHaveTextContent(/submit distributor package/i);
    expect(linkedWork).not.toHaveTextContent(/submit spotify for artists pitch/i);
    expect(within(linkedWork).queryByRole("button", { name: /view tasks/i })).not.toBeInTheDocument();
    expect(within(linkedWork).queryByRole("button", { name: /view evidence/i })).not.toBeInTheDocument();
    expect(within(nightBusRoom).queryByText(/^linked tasks$/i)).not.toBeInTheDocument();

    fireEvent.click(within(nightBusRoom).getByRole("button", { name: /^files$/i }));
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/audio files/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/master delivery/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/artwork/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/rights documents/i);

    fireEvent.click(within(nightBusRoom).getByRole("button", { name: /^details$/i }));
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/song identity/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/credits/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/producer/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/mix engineer/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/release details/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/isrc/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/missing/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/draft/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/confirmed/i);

    fireEvent.click(within(nightBusRoom).getByRole("button", { name: /^rights$/i }));
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/split sheet document/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/confirm split sheet/i);

    fireEvent.click(within(nightBusRoom).getByRole("button", { name: /^overview$/i }));
    fireEvent.click(within(nightBusRoom).getByRole("button", { name: /release night bus on june 12/i }));
    expect(screen.getByRole("heading", { name: /^missions\.?$/i })).toBeInTheDocument();
    expect(screen.getByText(/music subject/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Night Bus/i).length).toBeGreaterThan(0);
  }, 15000);

  it("keeps projects as containers while songs remain atomic music objects", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /^music$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^projects$/i }));

    expect(screen.getByRole("button", { name: /^projects$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("music-library")).toHaveTextContent(/glass room ep/i);
    expect(screen.queryByTestId("music-detail-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open project glass room ep/i }));
    expect(screen.getByTestId("music-project-detail")).toHaveTextContent(/tracklist/i);
    expect(screen.getByTestId("music-project-detail")).toHaveTextContent(/night bus/i);
    expect(screen.getByTestId("music-project-detail")).toHaveTextContent(/inherited blocker/i);
    expect(screen.getByTestId("music-project-detail")).toHaveTextContent(/night bus split sheet/i);
    expect(screen.getByTestId("music-project-detail")).toHaveTextContent(/songs stay atomic/i);

    fireEvent.click(screen.getByRole("button", { name: /open song southbound blue/i }));
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/southbound blue/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/song room/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/user-supplied/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/no spotify private analytics/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/no mission is attached/i);
  }, 15000);

  it("shows available splits as a usable rights breakdown instead of a missing-state placeholder", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /^music$/i }));
    fireEvent.click(screen.getByRole("button", { name: /open song after hours static/i }));

    const songRoom = screen.getByTestId("music-song-detail");
    fireEvent.click(within(songRoom).getByRole("button", { name: /^rights$/i }));

    expect(songRoom).toHaveTextContent(/split sheet confirmed/i);
    expect(songRoom).toHaveTextContent(/publishing splits/i);
    expect(songRoom).toHaveTextContent(/master share/i);
    expect(songRoom).toHaveTextContent(/sable day/i);
    expect(songRoom).toHaveTextContent(/mara vale/i);
    expect(songRoom).toHaveTextContent(/50%/i);
    expect(songRoom).toHaveTextContent(/approval log/i);
    expect(songRoom).toHaveTextContent(/document source/i);
    expect(songRoom).not.toHaveTextContent(/release confidence is blocked/i);
  }, 15000);

  it("keeps the song rights tab focused on split confirmation instead of distribution launch work", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /^music$/i }));
    fireEvent.click(screen.getByRole("button", { name: /open song night bus/i }));

    const songRoom = screen.getByTestId("music-song-detail");
    fireEvent.click(within(songRoom).getByRole("button", { name: /^rights$/i }));

    expect(songRoom).toHaveTextContent(/no splits started/i);
    expect(songRoom).toHaveTextContent(/add collaborator/i);
    expect(songRoom).toHaveTextContent(/publishing\s*\/\s*composition/i);
    expect(songRoom).toHaveTextContent(/master recording/i);
    expect(songRoom).not.toHaveTextContent(/global distribution hub/i);
    expect(songRoom).not.toHaveTextContent(/initialize global distribution/i);
  }, 15000);

  it("moves split confirmations from draft to pending to cleared as collaborators approve", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /^music$/i }));
    fireEvent.click(screen.getByRole("button", { name: /open song night bus/i }));

    const songRoom = screen.getByTestId("music-song-detail");
    fireEvent.click(within(songRoom).getByRole("button", { name: /^rights$/i }));

    fireEvent.change(within(songRoom).getByLabelText(/^name$/i), { target: { value: "Sable Day" } });
    fireEvent.change(within(songRoom).getByLabelText(/^role$/i), { target: { value: "Artist / writer" } });
    fireEvent.change(within(songRoom).getByLabelText(/email/i), { target: { value: "sable@example.com" } });
    fireEvent.change(within(songRoom).getByLabelText(/publishing/i), { target: { value: "50" } });
    fireEvent.change(within(songRoom).getByLabelText(/master/i), { target: { value: "70" } });
    fireEvent.click(within(songRoom).getByRole("button", { name: /add collaborator/i }));

    fireEvent.change(within(songRoom).getByLabelText(/^name$/i), { target: { value: "Mara Vale" } });
    fireEvent.change(within(songRoom).getByLabelText(/^role$/i), { target: { value: "Producer / writer" } });
    fireEvent.change(within(songRoom).getByLabelText(/email/i), { target: { value: "mara@example.com" } });
    fireEvent.change(within(songRoom).getByLabelText(/publishing/i), { target: { value: "50" } });
    fireEvent.change(within(songRoom).getByLabelText(/master/i), { target: { value: "30" } });
    fireEvent.click(within(songRoom).getByRole("button", { name: /add collaborator/i }));

    expect(songRoom).toHaveTextContent(/draft/i);
    expect(within(songRoom).getByRole("button", { name: /send split confirmation links/i })).toBeEnabled();

    fireEvent.click(within(songRoom).getByRole("button", { name: /send split confirmation links/i }));
    expect(songRoom).toHaveTextContent(/pending/i);

    fireEvent.click(within(songRoom).getByRole("button", { name: /open sable day confirmation page/i }));
    expect(screen.getByRole("heading", { name: /confirm split for night bus/i })).toBeInTheDocument();
    expect(screen.getAllByText(/sable day/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/50% publishing/i)).toBeInTheDocument();
    expect(screen.getByText(/70% master/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/i confirm these split details are correct/i));
    fireEvent.click(screen.getByRole("button", { name: /^confirm split$/i }));
    expect(screen.getByText(/split confirmed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /return to song room/i }));

    expect(songRoom).toHaveTextContent(/pending/i);
    expect(songRoom).not.toHaveTextContent(/split sheet cleared and confirmed by all collaborators/i);

    fireEvent.click(within(songRoom).getByRole("button", { name: /open mara vale confirmation page/i }));
    fireEvent.click(screen.getByLabelText(/i confirm these split details are correct/i));
    fireEvent.click(screen.getByRole("button", { name: /^confirm split$/i }));
    fireEvent.click(screen.getByRole("button", { name: /return to song room/i }));

    expect(songRoom).toHaveTextContent(/cleared/i);
    expect(songRoom).toHaveTextContent(/split sheet cleared and confirmed by all collaborators/i);
  }, 15000);

  it("uses compact mobile drill-down patterns for team, missions, tasks, and checkpoints", () => {
    enterLabelHq();

    fireEvent.click(within(screen.getByRole("navigation", { name: /mobile desk navigation/i })).getByRole("button", { name: /^team agents$/i }));
    expect(screen.getByTestId("mobile-staff-roster")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-staff-roster")).toHaveTextContent(/helps with/i);
    fireEvent.click(screen.getByRole("button", { name: /marketing lead/i }));
    expect(screen.getAllByText(/campaign command board/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/source rail/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /^missions$/i }).at(-1)!);
    expect(screen.getByTestId("mobile-mission-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-mission-tabs")).toHaveTextContent(/tasks/i);
    expect(screen.getByTestId("mobile-mission-tabs")).toHaveTextContent(/checkpoints/i);
    expect(
      screen.getByTestId("mobile-mission-tabs").compareDocumentPosition(screen.getByText(/manager check-in/i)),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(screen.getAllByText(/^tasks$/i)[0].closest("button")!);
    expect(screen.getByTestId("mobile-task-stepper")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-task-stepper")).toHaveTextContent(/release foundation/i);
    expect(screen.getByTestId("task-group-cp-1-foundation")).toHaveTextContent(/checkpoint 1/i);
    expect(screen.getByTestId("task-group-cp-1-foundation")).toHaveTextContent(/is the release safe/i);

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    fireEvent.click(screen.getAllByText(/^checkpoints$/i)[0].closest("button")!);
    expect(screen.getByTestId("mobile-checkpoint-list")).toBeInTheDocument();
    expect(screen.getByTestId("checkpoint-inspector")).toHaveTextContent(/manager recommendation/i);
  }, 15000);

  it("captures Artist Direction as long-form setup context without crowding Desk HQ", () => {
    render(<AiLabelPrototype />);
    fireEvent.click(screen.getByRole("button", { name: /continue to artist context/i }));

    const direction = "Build Sable Day into a credible late-night R&B artist with real audience proof, careful release timing, and a team that protects the songs before chasing scale.";
    const directionField = screen.getByRole("textbox", { name: /artist direction/i });
    expect(directionField.tagName.toLowerCase()).toBe("textarea");
    fireEvent.change(directionField, { target: { value: direction } });
    fireEvent.click(screen.getByRole("button", { name: /enter desk hq/i }));

    expect(screen.queryByText(direction)).not.toBeInTheDocument();
    expect(screen.getAllByText(/night bus/i).length).toBeGreaterThan(0);
  });

  it("makes Desk HQ the operating room and keeps Manager Office focused on conversation", () => {
    enterLabelHq();

    expect(screen.getByRole("heading", { name: /^desk hq$/i })).toBeInTheDocument();
    expect(screen.getByText(/desk read/i)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /ordersounds desk navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^desk hq$/i })).toBeInTheDocument();
    expect(screen.queryByText(/^label hq$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ai record label/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^team agents$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^missions$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.queryByText(/notifications/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^manager$/i })).toBeInTheDocument();
    expect(screen.queryByText(/^evidence$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^review$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/artist profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/operating dashboard/i)).not.toBeInTheDocument();
    expect(screen.getByText(/today's brief/i)).toBeInTheDocument();
    expect(screen.getByText(/Sable Day is building real breakout pressure/i)).toBeInTheDocument();
    expect(screen.getByText(/128\.4k tracked streams across connected sources/i)).toBeInTheDocument();
    expect(screen.getByText(/Night Bus is the strongest current signal/i)).toBeInTheDocument();
    expect(screen.getByText(/today's directive/i)).toBeInTheDocument();
    expect(screen.getByText(/focus/i)).toBeInTheDocument();
    expect(screen.getAllByText(/active missions/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/needs attention/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/manager read/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/next move/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^team agents$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/specialized ai agents that help the artist and their team prepare work, spot gaps, and move missions forward/i)).toBeInTheDocument();
    expect(screen.queryByText(/label staff/i)).not.toBeInTheDocument();
    expect(screen.getByText(/sync & deals/i)).toBeInTheDocument();
    expect(screen.getByText(/finance\/rights/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/view supporting evidence/i).closest("button")!);
    expect(screen.getByText(/evidence file/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Private saves/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    fireEvent.click(screen.getByText(/talk to manager/i).closest("button")!);

    expect(screen.getByText(/manager office/i)).toBeInTheDocument();
    expect(screen.getByText(/manager briefing/i)).toBeInTheDocument();
    expect(screen.getByText(/context needed/i)).toBeInTheDocument();
    expect(screen.getByText(/Manager needs these answers before making decisions/i)).toBeInTheDocument();
    expect(screen.getByText(/question list/i)).toBeInTheDocument();
    expect(screen.getByText(/active question/i)).toBeInTheDocument();
    expect(screen.queryByText(/manager directive/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/conversation history/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/current focus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/flagged for you/i)).not.toBeInTheDocument();
  }, 15000);

  it("keeps Desk HQ sidebar actions wired to durable prototype surfaces", () => {
    enterLabelHq();

    fireEvent.click(screen.getAllByRole("button", { name: /^missions$/i })[0]);
    expect(screen.getByRole("heading", { name: /^missions\.?$/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /ordersounds desk navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^desk hq$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^team agents$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^missions$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^settings$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(screen.getByText(/artist identity/i)).toBeInTheDocument();
    expect(screen.getByText(/artist direction/i)).toBeInTheDocument();
    expect(screen.getByText(/current focus/i)).toBeInTheDocument();
    expect(screen.getByText(/connected channels/i)).toBeInTheDocument();
    expect(screen.getByText(/private data needed/i)).toBeInTheDocument();

    const settingsDirection = screen.getByRole("textbox", { name: /artist direction/i });
    const updatedDirection = "Spend the next quarter proving the Night Bus world, building direct fan demand, and only scaling spend when rights, content, and save data are clean.";
    fireEvent.change(settingsDirection, { target: { value: updatedDirection } });

    fireEvent.click(screen.getByRole("button", { name: /^desk hq$/i }));
    expect(screen.queryByText(updatedDirection)).not.toBeInTheDocument();
    expect(screen.getAllByText(/night bus/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/talk to manager/i).closest("button")!);
    expect(screen.getByText(/manager office/i)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /ordersounds desk navigation/i })).toBeInTheDocument();
  }, 15000);

  it("opens Team Agents as a durable sidebar destination and routes agents from there", () => {
    enterLabelHq();

    fireEvent.click(screen.getAllByRole("button", { name: /^team agents$/i })[0]);
    expect(screen.getByRole("heading", { name: /^artist team agents$/i })).toBeInTheDocument();
    expect(screen.getByText(/specialized ai agents that help the artist and their team prepare work, spot gaps, and move missions forward/i)).toBeInTheDocument();
    expect(screen.getByText(/^5$/i)).toBeInTheDocument();
    expect(screen.getByText(/^1$/i)).toBeInTheDocument();
    expect(screen.getByText(/^4$/i)).toBeInTheDocument();
    expect(screen.getByText(/system coverage on/i)).toBeInTheDocument();
    expect(screen.getAllByText(/can prepare today/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/needed to work/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/needs source/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/missing proof/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connected proof/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^team agents$/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /ai manager/i }));
    expect(screen.getByText(/manager office/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^team agents$/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /^team agents$/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /marketing lead/i }));
    expect(screen.getAllByRole("heading", { name: /marketing lead/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/campaign command board/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/AI ad lab/i)).toBeInTheDocument();
    expect(screen.getByText(/source rail/i)).toBeInTheDocument();
    expect(screen.queryByText(/still cannot conclude/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Spotify for Artists export/i)).toBeInTheDocument();
    expect(screen.getAllByText(/smart-link report/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/campaign report\/spend report/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/content analytics/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/campaign history/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chartmetric/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Soundcharts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/this agent is locked/i)).not.toBeInTheDocument();
  }, 20000);

  it("shows role-specific workspaces with compact source rails inside agent rooms", () => {
    enterLabelHq();

    fireEvent.click(screen.getByRole("button", { name: /finance\/rights/i }));
    expect(screen.getByText(/finance investigation desk/i)).toBeInTheDocument();
    expect(screen.getByText(/Royalty statement comparison/i)).toBeInTheDocument();
    expect(screen.getAllByText(/royalty statements/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/signed split sheets/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/distributor payout\/export report/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/song-level rights state/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/compare statement to splits/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload royalty statement/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload split sheet/i })).toBeInTheDocument();
    expect(screen.queryByText(/still cannot conclude/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    fireEvent.click(screen.getByRole("button", { name: /sync & deals/i }));
    expect(screen.getAllByText(/sync deal pipeline/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Track new deal/i)).toBeInTheDocument();
    expect(screen.getAllByText(/submitted songs/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/licensing opportunity/i)).toBeInTheDocument();
    expect(screen.getByText(/music supervisor brief/i)).toBeInTheDocument();
    expect(screen.getAllByText(/signed split sheet or rights document/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/clean master\/instrumental/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/pitch assets/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/song metadata/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/still cannot conclude/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    fireEvent.click(screen.getByRole("button", { name: /touring agent/i }));
    expect(screen.getByText(/booking and tour desk/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Show holds/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/The Masquerade/i)).toBeInTheDocument();
    expect(screen.getByText(/\$3,500 guarantee/i)).toBeInTheDocument();
    expect(screen.getByText(/Google Calendar availability/i)).toBeInTheDocument();
    expect(screen.getAllByText(/live history/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/venue\/promoter notes/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/city signal coverage/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/still cannot conclude/i)).not.toBeInTheDocument();
  }, 15000);

  it("makes notes helpful release-room communication and records mission memory", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /release night bus on june 12/i }));

    fireEvent.click(screen.getAllByText(/^notes$/i)[0].closest("button")!);
    expect(screen.getByText(/Manager -> Marketing Lead/i)).toBeInTheDocument();
    expect(screen.getByText(/Creator seeding request/i)).toBeInTheDocument();
    expect(screen.getByText(/Build the creator target list around night-drive/i)).toBeInTheDocument();
    expect(screen.getByText(/Press angle and EPK request/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Evidence used:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Resulting change:/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /approve for use/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^export$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Message$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Linked mission$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    fireEvent.click(screen.getAllByText(/^mission recap$/i)[0].closest("button")!);
    expect(screen.getAllByText(/Mission recap/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/living recap of the mission/i)).toBeInTheDocument();
    expect(screen.getByText(/original request/i)).toBeInTheDocument();
    expect(screen.getAllByText(/I want to drop a new song next week/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/task status summary/i)).toBeInTheDocument();
    expect(screen.getByText(/checkpoint status summary/i)).toBeInTheDocument();
    expect(screen.getByText(/agent notes that changed the mission/i)).toBeInTheDocument();
    expect(screen.getByText(/decisions already made/i)).toBeInTheDocument();
    expect(screen.getByText(/blockers and missing evidence/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Manager moved the target from next Friday to Friday, June 12, 2026/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Mission log/i)).toBeInTheDocument();
    expect(screen.getByText(/task_result_added/i)).toBeInTheDocument();
    expect(screen.getByText(/recommendation_changed/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Current state$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Evidence used$/i)).not.toBeInTheDocument();
  }, 10000);

  it("keeps recent conversations as Manager threads after context is ready", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /talk to manager/i }));

    while (screen.queryByRole("button", { name: /next question|submit context/i })) {
      fireEvent.click(screen.getByRole("button", { name: /use suggested context/i }));
      const saveButton = screen.queryByRole("button", { name: /next question|submit context/i });
      if (saveButton) fireEvent.click(saveButton);
    }

    expect(screen.getByText(/context synchronized/i)).toBeInTheDocument();
    expect(screen.getByText(/manager directive/i)).toBeInTheDocument();
    expect(screen.getByText(/conversation history/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /release plan/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /rights blocker/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /night bus release planning/i }));

    expect(screen.getByText(/direct message/i)).toBeInTheDocument();
    expect(screen.getAllByText(/night bus release planning/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/I want to drop a new song next week/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Night Bus/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Release Night Bus on June 12/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /open created music item/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open created mission/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open created task/i })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("conversation-message-artist")[0]).toHaveClass("bg-foreground", "text-background");
    expect(screen.getAllByTestId("conversation-message-manager")[0]).toHaveClass("bg-background", "text-foreground");

    fireEvent.click(screen.getByRole("button", { name: /open created mission/i }));
    expect(screen.getByText(/What is happening/i)).toBeInTheDocument();
    expect(screen.getByText(/Mission pulse/i)).toBeInTheDocument();
  }, 10000);

  it("opens the created Music item from a Manager conversation into the song room", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /talk to manager/i }));

    while (screen.queryByRole("button", { name: /next question|submit context/i })) {
      fireEvent.click(screen.getByRole("button", { name: /use suggested context/i }));
      const saveButton = screen.queryByRole("button", { name: /next question|submit context/i });
      if (saveButton) fireEvent.click(saveButton);
    }

    fireEvent.click(screen.getByRole("button", { name: /night bus release planning/i }));
    fireEvent.click(screen.getByRole("button", { name: /open created music item/i }));

    expect(screen.getByTestId("music-song-detail")).toBeInTheDocument();
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/song room/i);
    expect(screen.getByTestId("music-song-detail")).toHaveTextContent(/night bus/i);
    expect(screen.getByRole("button", { name: /^overview$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("music-linked-work")).toHaveTextContent(/release night bus on june 12/i);
  }, 10000);

  it("creates song and mission artifacts for new release-song Manager prompts", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /talk to manager/i }));

    while (screen.queryByRole("button", { name: /next question|submit context/i })) {
      fireEvent.click(screen.getByRole("button", { name: /use suggested context/i }));
      const saveButton = screen.queryByRole("button", { name: /next question|submit context/i });
      if (saveButton) fireEvent.click(saveButton);
    }

    const composer = screen.getByPlaceholderText(/ask the manager/i);
    fireEvent.change(composer, { target: { value: "I want to release a song next month. What should happen?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask manager/i }));

    expect(screen.getByText(/direct message/i)).toBeInTheDocument();
    expect(screen.getByText(/new song release planning/i)).toBeInTheDocument();
    expect(screen.getByText(/Treat the song as the durable recorded-work object first/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open created music item/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open created mission/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open created task/i })).not.toBeInTheDocument();
  }, 10000);

  it("shows the release mission feedback loop from task reviews into checkpoints and mission memory", () => {
    enterLabelHq();

    fireEvent.click(screen.getByRole("button", { name: /release night bus on june 12/i }));

    expect(screen.getByText(/What is happening/i)).toBeInTheDocument();
    expect(screen.getByTestId("mission-command-bar")).toBeInTheDocument();
    expect(screen.getByTestId("mission-surface-rail")).toBeInTheDocument();
    expect(screen.getByTestId("mission-command-bar")).toHaveTextContent(/coordinate every release-critical step for night bus/i);
    expect(screen.getByTestId("mission-command-bar")).not.toHaveTextContent(/Manager moved the rushed next-Friday drop/i);
    expect(screen.getByTestId("mission-command-bar")).not.toHaveTextContent(/Needs attention/i);
    expect(screen.getByTestId("mission-command-bar")).not.toHaveTextContent(/Next move/i);
    expect(screen.getByTestId("mission-command-bar")).not.toHaveTextContent(/Music subject/i);
    expect(screen.getAllByText(/Rights & Metadata Gate/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/mission pulse/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resume mission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/^recommendation$/i)).toBeInTheDocument();
    expect(screen.getByText(/Move the release to Friday, June 12, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/what changed/i)).toBeInTheDocument();
    expect(screen.getByText(/preserved the Spotify pitch window/i)).toBeInTheDocument();
    expect(screen.getAllByText(/active blocker/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/next review/i)).toBeInTheDocument();
    expect(screen.getByText(/music subject/i)).toBeInTheDocument();
    expect(screen.queryByText(/what you need to do next/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^next task$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^tasks$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^checkpoints$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^notes$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^mission recap$/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Mission Profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/full log/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText(/^tasks$/i)[0].closest("button")!);
    expect(screen.getByText(/Release tasks/i)).toBeInTheDocument();
    expect(screen.getByTestId("task-group-tab-cp-1-foundation")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("task-group-cp-1-foundation")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("task-group-cp-1-foundation")).toHaveTextContent(/tasks under this checkpoint/i);
    expect(screen.getByTestId("task-group-cp-1-foundation")).toHaveTextContent(/task 1/i);
    expect(screen.getByTestId("task-group-cp-1-foundation")).toHaveTextContent(/task 2/i);
    expect(screen.getAllByText(/Release Foundation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Campaign Build/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Outreach & Activation/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Confirm split sheet/i)).toBeInTheDocument();
    expect(screen.getByText(/Submit Spotify for Artists pitch/i)).toBeInTheDocument();
    expect(screen.getByText(/Build TikTok creator target list/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /show details/i })[0]);
    expect(screen.getAllByText(/Risk if late/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("task-group-tab-cp-2-campaign"));
    expect(screen.getByTestId("task-group-tab-cp-2-campaign")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("task-group-cp-2-campaign")).toHaveAttribute("data-active", "true");
    expect(screen.queryByText(/track saves, clicks, follows/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show details submit spotify for artists pitch/i }));

    expect(screen.getAllByText(/Manager note/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Pitch submitted Monday with story, genre, mood, marketing plan/i)).toBeInTheDocument();
    expect(screen.getByText(/DSP gate improved/i)).toBeInTheDocument();
    expect(screen.getByText(/Prepare independent curator outreach using the same positioning/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirm split sheet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show details confirm split sheet/i }));
    expect(screen.getByText(/Rights gate failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Create urgent split approval task/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    fireEvent.click(screen.getAllByText(/^checkpoints$/i)[0].closest("button")!);

    expect(screen.getAllByText(/mission checkpoints/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Mission progress map/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("checkpoint-command-strip")).not.toBeInTheDocument();
    expect(screen.getByTestId("checkpoint-workspace-grid")).toHaveTextContent(/active blocker/i);
    expect(screen.getByTestId("checkpoint-workspace-grid")).toHaveTextContent(/Fri Jun 12/i);
    expect(screen.getByTestId("checkpoint-inspector")).toHaveClass("lg:sticky");
    expect(screen.getAllByText(/Required task results/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/The foundation review found a real hold/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Get the producer split sheet signed and uploaded/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Needs fix/i)).toBeInTheDocument();
    expect(screen.queryByText(/You do not need to track this manually/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI-owned release readiness reviews/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("checkpoint-summary-rail")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Campaign Build/i }));
    expect(screen.getByText(/Campaign Build remains conditional/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Complete the creator list, EPK, and content approval/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/budget task state/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve cap/i })).not.toBeInTheDocument();
  }, 15000);
});
