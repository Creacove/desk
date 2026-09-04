import { createRoot } from "react-dom/client";
import "./lib/posthog";
import { ProductionApp } from "./app/ProductionApp";
import { ThemeProvider } from "./app/theme";
import { SplitConfirmationPortal } from "./features/music/SplitConfirmationPortal";
import { PublicMusicSharePortal } from "./features/music/PublicMusicSharePortal";
import { createBrowserSupabaseClient } from "./lib/supabaseClient";
import { installBrowserErrorTelemetry } from "./lib/errorTelemetry";
import { LaunchFilmStudio } from "./marketing/launch-film/FilmStudio";
import AiLabelPrototype from "./prototype/AiLabelPrototype";
import { createSupabaseProductionRepositories } from "./services/productionSupabase";
import { loadPublicMusicShare } from "./services/publicMusicShare";
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
const launchFilmRoute = window.location.pathname === "/launch-film";
const splitConfirmationToken = window.location.pathname === "/split-confirmation" ? params.get("token") ?? "" : "";
const publicShareToken = window.location.pathname === "/share" ? params.get("token") ?? "" : "";
if (import.meta.env.PROD && !launchFilmRoute && !splitConfirmationToken && !publicShareToken && import.meta.env.VITE_APP_MODE !== "prototype") {
  const telemetryClient = createBrowserSupabaseClient();
  installBrowserErrorTelemetry({
    capture: async (payload) => {
      const { data: { session } } = await telemetryClient.auth.getSession();
      if (!session) return;
      await telemetryClient.functions.invoke("capture-browser-error", { body: payload });
    },
  });
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
const app = launchFilmRoute ? (
    <LaunchFilmStudio />
  ) : splitConfirmationToken ? (
    <SplitConfirmationPortal
      token={splitConfirmationToken}
      musicRepository={createSupabaseProductionRepositories(createBrowserSupabaseClient(), publicSplitWorkspace).music}
    />
  ) : publicShareToken ? (
    <PublicMusicSharePortal
      token={publicShareToken}
      loadShare={(token) => loadPublicMusicShare(createBrowserSupabaseClient(), token)}
    />
  ) : import.meta.env.VITE_APP_MODE === "prototype" ? (
    <AiLabelPrototype />
  ) : (
    <ProductionApp fixtureMode={fixtureMode} initialView={initialView} />
  );

createRoot(document.getElementById("root")!).render(<ThemeProvider>{app}</ThemeProvider>);
