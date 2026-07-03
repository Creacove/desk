import { createRoot } from "react-dom/client";
import { ProductionApp } from "./app/ProductionApp";
import { ThemeProvider } from "./app/theme";
import { SplitConfirmationPortal } from "./features/music/SplitConfirmationPortal";
import { createBrowserSupabaseClient } from "./lib/supabaseClient";
import AiLabelPrototype from "./prototype/AiLabelPrototype";
import { createSupabaseProductionRepositories } from "./services/productionSupabase";
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
  ) : import.meta.env.VITE_APP_MODE === "prototype" ? (
    <AiLabelPrototype />
  ) : (
    <ProductionApp fixtureMode={fixtureMode} initialView={initialView} />
  );

createRoot(document.getElementById("root")!).render(<ThemeProvider>{app}</ThemeProvider>);
