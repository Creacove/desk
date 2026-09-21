import { createRoot } from "react-dom/client";
import "./lib/posthog";
import { ProductionApp } from "./app/ProductionApp";
import { ThemeProvider } from "./app/theme";
import { SplitConfirmationPortal } from "./features/music/SplitConfirmationPortal";
import { PublicMusicSharePortal } from "./features/music/PublicMusicSharePortal";
import { createBrowserSupabaseClient } from "./lib/supabaseClient";
import { installBrowserErrorTelemetry } from "./lib/errorTelemetry";
import AiLabelPrototype from "./prototype/AiLabelPrototype";
import { createSupabaseAuthAdapter, createSupabaseProductionRepositories } from "./services/productionSupabase";
import { createWorkspaceTeamService } from "./services/workspaceTeamService";
import { loadPublicMusicShare } from "./services/publicMusicShare";
import { TeamJoinRoute } from "./features/team/TeamJoinRoute";
import { OperatorWorkspaceRoute, parseOperatorWorkspaceRoute } from "./app/OperatorWorkspaceRoute";
import { FrontDoorMessageScreen } from "./features/onboarding/FrontDoorAuth";
import "./index.css";
import type { CleanProductionView } from "./types/cleanProduction";
import type { ProductionWorkspace } from "./types/productionApp";

const productionViews = [
  "connectArtist",
  "setup",
  "labelHQ",
  "musicWorkspace",
  "staffWorkspace",
  "managerOffice",
  "missionsWorkspace",
  "artistProfileWorkspace",
] satisfies CleanProductionView[];

const params = new URLSearchParams(window.location.search);
const requestedView = params.get("view") as CleanProductionView | null;
const initialView = requestedView && productionViews.includes(requestedView) ? requestedView : "connectArtist";
const fixtureMode = params.get("fixtures") === "true";
const splitConfirmationToken = window.location.pathname === "/split-confirmation" ? params.get("token") ?? "" : "";
const publicShareToken = window.location.pathname === "/share" ? params.get("token") ?? "" : "";
const teamJoinRoute = window.location.pathname === "/join";
const operatorWorkspaceRoute = parseOperatorWorkspaceRoute(window.location.pathname);
let teamClient: ReturnType<typeof createBrowserSupabaseClient> | null = null;
if (teamJoinRoute) {
  try {
    teamClient = createBrowserSupabaseClient();
  } catch {
    teamClient = null;
  }
}
const teamService = teamClient ? createWorkspaceTeamService(teamClient) : null;
const teamAuthAdapter = teamClient ? createSupabaseAuthAdapter(teamClient) : null;
if (import.meta.env.PROD && !splitConfirmationToken && !publicShareToken && !teamJoinRoute && !operatorWorkspaceRoute && import.meta.env.VITE_APP_MODE !== "prototype") {
  const telemetryClient = createBrowserSupabaseClient();
  installBrowserErrorTelemetry({
    capture: async (payload) => {
      const { data: { session } } = await telemetryClient.auth.getSession();
      if (!session) return;
      await telemetryClient.functions.invoke("capture-browser-error", { body: payload });
    },
  });
}
let operatorClient: ReturnType<typeof createBrowserSupabaseClient> | null = null;
if (operatorWorkspaceRoute) {
  try {
    operatorClient = createBrowserSupabaseClient();
  } catch {
    operatorClient = null;
  }
}
const publicSplitWorkspace = {
  accountId: "public-split-confirmation",
  artistWorkspaceId: "public-split-confirmation",
  artistId: "public-split-confirmation",
  artistName: "Split confirmation",
  workspaceName: "Split confirmation",
  status: "active",
  spotifyConnected: false,
  contextComplete: true,
} satisfies ProductionWorkspace;
const app = splitConfirmationToken ? (
    <SplitConfirmationPortal
      token={splitConfirmationToken}
      musicRepository={createSupabaseProductionRepositories(createBrowserSupabaseClient(), publicSplitWorkspace).music}
    />
  ) : publicShareToken ? (
    <PublicMusicSharePortal
      token={publicShareToken}
      loadShare={(token) => loadPublicMusicShare(createBrowserSupabaseClient(), token)}
    />
  ) : teamJoinRoute ? (
    teamService && teamAuthAdapter
      ? <TeamJoinRoute service={teamService} authAdapter={teamAuthAdapter} />
      : <FrontDoorMessageScreen title="Invitation unavailable" body="This environment is not configured to accept team invitations." />
  ) : operatorWorkspaceRoute ? (
    operatorClient
      ? <OperatorWorkspaceRoute client={operatorClient} />
      : <FrontDoorMessageScreen title="Ops unavailable" body="This environment is not configured to open operator workspaces." />
  ) : import.meta.env.VITE_APP_MODE === "prototype" ? (
    <AiLabelPrototype />
  ) : (
    <ProductionApp fixtureMode={fixtureMode} initialView={initialView} />
  );

createRoot(document.getElementById("root")!).render(<ThemeProvider>{app}</ThemeProvider>);
