import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { BrandMark, Field, ProductButton } from "../design-system/components";
import type { OperatorWorkspaceLoader, OperatorWorkspaceSummary } from "../services/productionSupabase";

export function OperatorWorkspacePicker({
  loader,
  initialWorkspaces,
  onSelect,
  onSignOut,
}: {
  loader: OperatorWorkspaceLoader;
  initialWorkspaces?: OperatorWorkspaceSummary[];
  onSelect: (artistWorkspaceId: string) => void;
  onSignOut?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [workspaces, setWorkspaces] = useState<OperatorWorkspaceSummary[]>(initialWorkspaces ?? []);
  const [pending, setPending] = useState(!initialWorkspaces);
  const [error, setError] = useState<string | null>(null);

  async function search(nextQuery = query) {
    try {
      setPending(true);
      setError(null);
      setWorkspaces(await loader.listOperatorWorkspaces(nextQuery));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Operator access is not available.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!initialWorkspaces) void search("");
    // The initial operator probe is intentionally the source of truth for this
    // screen; avoid re-querying when the parent renders a new array instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main data-testid="operator-workspace-picker" className="app-theme min-h-dvh bg-background px-5 py-6 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-[980px]">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><BrandMark size="sm" /><span className="font-display text-[17px] font-semibold">Ops workspaces</span></div>
          {onSignOut ? <button type="button" className="text-[12px] font-semibold text-muted-foreground hover:text-foreground" onClick={onSignOut}>Sign out</button> : null}
        </header>
        <section className="mt-14 max-w-[680px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent">Operator access</p>
          <h1 className="mt-3 font-display text-[36px] font-semibold tracking-[-0.035em]">Open a Desk workspace.</h1>
          <p className="mt-3 text-[14px] font-medium text-muted-foreground">Search by artist, workspace, account, ID, or linked contact.</p>
          <form className="mt-8 flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
            <div className="min-w-0 flex-1"><Field label="Search workspaces" value={query} onChange={setQuery} helper="Artist, contact, workspace, or ID" /></div>
            <ProductButton type="submit" variant="secondary" disabled={pending} aria-label="Search workspaces"><Search className="h-4 w-4" /></ProductButton>
          </form>
        </section>
        <section className="mt-10 divide-y divide-foreground/8 border-y border-foreground/8">
          {workspaces.map((workspace) => (
            <button key={workspace.artistWorkspaceId} type="button" className="group flex w-full items-center justify-between gap-4 py-4 text-left hover:bg-foreground/[0.025]" onClick={() => onSelect(workspace.artistWorkspaceId)}>
              <span className="min-w-0">
                <strong className="block truncate text-[14px]">{workspace.workspaceName}</strong>
                <span className="mt-1 block truncate text-[12px] text-muted-foreground">{workspace.artistName ?? "Unnamed artist"} · {workspace.accountName ?? "Unnamed account"} · {workspace.workspaceStatus}</span>
                <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground/70">workspace {workspace.artistWorkspaceId} · account {workspace.accountId}</span>
                {workspace.contactEmail ? <span className="mt-1 block truncate text-[11px] text-muted-foreground/80">{workspace.contactEmail}</span> : null}
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          ))}
          {pending && !workspaces.length ? <p className="py-10 text-[13px] font-medium text-muted-foreground">Loading workspaces…</p> : null}
          {!pending && !workspaces.length && !error ? <p className="py-10 text-[13px] font-medium text-muted-foreground">No linked workspaces found.</p> : null}
          {error ? <p role="alert" className="py-10 text-[13px] font-semibold text-destructive">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
