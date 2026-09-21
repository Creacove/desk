import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Search } from "lucide-react";
import { BrandMark, Field, ProductButton } from "../design-system/components";
import { FrontDoorAuthScreen, FrontDoorMessageScreen, FrontDoorTransitionScreen } from "../features/onboarding/FrontDoorAuth";
import { createBrowserSupabaseClient } from "../lib/supabaseClient";
import {
  createOperatorWorkspaceLoader,
  createSupabaseAuthAdapter,
  type OperatorWorkspaceLoader,
  type OperatorWorkspaceSummary,
} from "../services/productionSupabase";
import { ProductionApp } from "./ProductionApp";
import { OpsMeetingReview } from "./OpsMeetingReview";
import type { ProductionSession, WorkspaceAccessContext } from "../types/productionApp";

export type OperatorWorkspaceRoute =
  | { kind: "list" }
  | { kind: "workspace"; artistWorkspaceId: string };

export function parseOperatorWorkspaceRoute(pathname: string): OperatorWorkspaceRoute | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/admin/workspaces") return { kind: "list" };
  if (!normalized.startsWith("/admin/workspaces/")) return null;
  const target = normalized.slice("/admin/workspaces/".length);
  if (!target) return { kind: "list" };
  try {
    return { kind: "workspace", artistWorkspaceId: decodeURIComponent(target) };
  } catch {
    return { kind: "workspace", artistWorkspaceId: target };
  }
}

export function OperatorWorkspaceRoute({ client }: { client: ReturnType<typeof createBrowserSupabaseClient> }) {
  const authAdapter = useMemo(() => createSupabaseAuthAdapter(client), [client]);
  const loader = useMemo<OperatorWorkspaceLoader>(() => createOperatorWorkspaceLoader(client), [client]);
  const [route, setRoute] = useState<OperatorWorkspaceRoute | null>(() => parseOperatorWorkspaceRoute(window.location.pathname));
  const [opsMeetingId, setOpsMeetingId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("opsMeetingId"));
  const [session, setSession] = useState<ProductionSession | null>(null);
  const [workspaces, setWorkspaces] = useState<OperatorWorkspaceSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"loading" | "signed-out" | "listing" | "ready" | "denied" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const goToList = useCallback(() => {
    window.history.pushState({}, "", "/admin/workspaces");
    setRoute({ kind: "list" });
    setStatus(session?.user ? "listing" : "signed-out");
    setError(null);
  }, [session?.user]);

  const loadList = useCallback(async (nextQuery = query) => {
    if (!session?.user) return;
    try {
      setStatus("listing");
      setError(null);
      setWorkspaces(await loader.listOperatorWorkspaces(nextQuery));
      setStatus("ready");
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Operator access is not available.";
      setError(message);
      setStatus(/not available|forbidden|operator/i.test(message) ? "denied" : "error");
    }
  }, [loader, query, session?.user]);

  useEffect(() => {
    const onPopState = () => { setRoute(parseOperatorWorkspaceRoute(window.location.pathname)); setOpsMeetingId(new URLSearchParams(window.location.search).get("opsMeetingId")); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void authAdapter.getSession().then((nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setStatus(nextSession.user ? route?.kind === "list" ? "listing" : "ready" : "signed-out");
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => { cancelled = true; };
  }, [authAdapter, route?.kind]);

  useEffect(() => {
    if (route?.kind !== "list" || !session?.user || status !== "listing") return;
    void loadList("");
  }, [loadList, route?.kind, session?.user, status]);

  if (!route) return null;
  if (status === "loading") return <FrontDoorTransitionScreen title="Opening Ops" />;
  if (status === "signed-out") {
    return <FrontDoorAuthScreen authAdapter={authAdapter} onAuthenticated={async () => {
      const nextSession = await authAdapter.getSession();
      setSession(nextSession);
      setStatus(route.kind === "list" ? "listing" : "ready");
    }} />;
  }
  if (route.kind === "workspace" && session?.user) {
    if (opsMeetingId) {
      return <OpsMeetingReview client={client} artistWorkspaceId={route.artistWorkspaceId} opsMeetingId={opsMeetingId} onBack={() => { window.history.pushState({}, "", `/admin/workspaces/${encodeURIComponent(route.artistWorkspaceId)}`); setOpsMeetingId(null); }} />;
    }
    const accessContext: WorkspaceAccessContext = {
      mode: "operator",
      artistWorkspaceId: route.artistWorkspaceId,
      opsMeetingId: undefined,
      capabilities: {
        canRead: true,
        canWrite: false,
        canUseBilling: false,
        canManageTeam: false,
        canUpload: false,
        canProcessOpsMeeting: true,
      },
    };
    return (
      <ProductionApp
        authAdapter={authAdapter}
        workspaceLoader={loader}
        accessContext={accessContext}
        initialView="labelHQ"
        onBackToOperatorWorkspaces={goToList}
      />
    );
  }
  if (status === "denied") {
    return <FrontDoorMessageScreen title="Ops access required" body={error ?? "This account is not enabled for Ops."} action={<button type="button" onClick={goToList}>Back to workspaces</button>} />;
  }
  if (status === "error") {
    return <FrontDoorMessageScreen title="Ops could not load" body={error ?? "Try again."} action={<ProductButton onClick={() => void loadList()}>Retry</ProductButton>} />;
  }

  return (
    <main data-testid="operator-workspace-list" className="app-theme min-h-dvh bg-background px-5 py-6 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-[980px]">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><BrandMark size="sm" /><span className="font-display text-[17px] font-semibold">Ops workspaces</span></div>
          <button type="button" className="text-[12px] font-semibold text-muted-foreground hover:text-foreground" onClick={async () => { await authAdapter.signOut?.(); setSession({ user: null }); setStatus("signed-out"); }}>Sign out</button>
        </header>
        <section className="mt-14 max-w-[620px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent">Operator access</p>
          <h1 className="mt-3 font-display text-[36px] font-semibold tracking-[-0.035em]">Open a Desk workspace.</h1>
          <p className="mt-3 text-[14px] font-medium text-muted-foreground">Search by artist, workspace, account, ID, or linked contact.</p>
          <form className="mt-8 flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void loadList(); }}>
            <div className="min-w-0 flex-1"><Field label="Search workspaces" value={query} onChange={setQuery} helper="Artist, contact, workspace, or ID" /></div>
            <ProductButton type="submit" variant="secondary" aria-label="Search workspaces"><Search className="h-4 w-4" /></ProductButton>
          </form>
        </section>
        <section className="mt-10 divide-y divide-foreground/8 border-y border-foreground/8">
          {workspaces.map((workspace) => (
            <button key={workspace.artistWorkspaceId} type="button" className="group flex w-full items-center justify-between gap-4 py-4 text-left hover:bg-foreground/[0.025]" onClick={() => { window.history.pushState({}, "", `/admin/workspaces/${encodeURIComponent(workspace.artistWorkspaceId)}`); setRoute({ kind: "workspace", artistWorkspaceId: workspace.artistWorkspaceId }); setStatus("ready"); }}>
              <span className="min-w-0"><strong className="block truncate text-[14px]">{workspace.workspaceName}</strong><span className="mt-1 block truncate text-[12px] text-muted-foreground">{workspace.artistName ?? "Unnamed artist"} · {workspace.accountName ?? "Unnamed account"} · {workspace.workspaceStatus}</span><span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground/70">workspace {workspace.artistWorkspaceId} · account {workspace.accountId}</span>{workspace.contactEmail ? <span className="mt-1 block truncate text-[11px] text-muted-foreground/80">{workspace.contactEmail}</span> : null}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          ))}
          {!workspaces.length ? <p className="py-10 text-[13px] font-medium text-muted-foreground">No linked workspaces found.</p> : null}
        </section>
        <button type="button" onClick={goToList} className="mt-6 inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Refresh list</button>
      </div>
    </main>
  );
}
