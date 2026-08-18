import { Lock } from "lucide-react";
import { WorkspaceHeader, WorkspaceShell } from "../../design-system/components";
import type { AgentViewModel } from "../../types/cleanProduction";

export function StaffWorkspace({
  agents,
  onManager,
  onLockedAgent,
}: {
  agents: AgentViewModel[];
  onManager: () => void;
  onLockedAgent: (agent: AgentViewModel) => void;
}) {
  const orderedAgents = orderTeamAgents(agents);

  return (
    <section className="app-workspace app-workspace-reveal pb-12">
      <WorkspaceHeader eyebrow="Artist team" title="Artist Team Agents" />
      <p className="mb-6 max-w-[680px] text-[14px] font-medium leading-[1.6] text-muted-foreground">Your AI team helps plan, coordinate, and execute the work that moves your career forward.</p>

      <div data-testid="staff-mobile-list" className="grid gap-2 md:hidden">
        {orderedAgents.map((agent) => {
          const Icon = agent.icon;
          const locked = agent.status !== "available";
          return (
            <button
              key={agent.id}
              type="button"
              aria-label={`Open mobile agent ${agent.name}`}
              className={`flex min-w-0 items-center gap-3 rounded-[14px] border p-3 text-left ${locked ? "border-dashed border-foreground/12 bg-foreground/[0.025]" : "border-foreground/10 bg-background"}`}
              onClick={() => (locked ? onLockedAgent(agent) : onManager())}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${locked ? "bg-foreground/[0.06] text-muted-foreground" : "bg-brand-accent/10 text-brand-accent"}`}>
                {locked ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-foreground">{agent.name}</span>
                <span className="mt-0.5 line-clamp-1 block text-[12px] font-medium text-muted-foreground">{locked ? "Not available on this plan" : agent.purpose}</span>
              </span>
              {!locked ? <span className="shrink-0 text-[11px] font-semibold text-brand-accent">Available now</span> : null}
            </button>
          );
        })}
      </div>

      <div data-testid="staff-desktop-list" className="hidden border-y border-foreground/8 md:block">
        {orderedAgents.map((agent) => {
          const Icon = agent.icon;
          const locked = agent.status !== "available";
          return (
            <button
              key={agent.id}
              type="button"
              aria-label={agent.name}
              className="group grid min-h-[76px] w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 border-b border-foreground/8 px-3 py-4 text-left outline-none transition-colors duration-150 last:border-b-0 hover:bg-foreground/[0.02] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/20"
              onClick={() => (locked ? onLockedAgent(agent) : onManager())}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] ${locked ? "bg-foreground/[0.055] text-muted-foreground" : "bg-brand-accent/10 text-brand-accent"}`}>
                {locked ? <Lock className="h-[18px] w-[18px]" aria-hidden="true" /> : <Icon className="h-[18px] w-[18px]" aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-foreground">{agent.name}</span>
                <span className="mt-1 block max-w-[680px] text-[13px] font-medium leading-[1.55] text-muted-foreground">{locked ? "Not available on this plan" : agent.purpose}</span>
              </span>
              <span className={`justify-self-end whitespace-nowrap text-[12px] font-medium ${locked ? "text-muted-foreground/65" : "text-brand-accent"}`}>
                {locked ? "Locked" : "Available now"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function LockedAgentWorkspace({ agent, onBack }: { agent: AgentViewModel; onBack: () => void }) {
  return (
    <WorkspaceShell eyebrow={agent.name} title={agent.workspaceTitle} onBack={onBack}>
      <div className="grid min-h-[320px] max-w-[760px] place-items-center border-y border-foreground/8 px-6 py-10 text-center">
        <div className="max-w-sm">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-[11px] bg-foreground/[0.055] text-muted-foreground">
            <Lock className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <p className="mt-5 font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Plan access</p>
          <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground">Not available on this plan</h2>
          <p className="mt-3 text-[13px] font-medium leading-[1.6] text-muted-foreground">You don&apos;t have access to this agent on your current plan.</p>
        </div>
      </div>
    </WorkspaceShell>
  );
}

function orderTeamAgents(agents: AgentViewModel[]) {
  return [...agents].sort((left, right) => agentSortValue(left) - agentSortValue(right));
}

function agentSortValue(agent: AgentViewModel) {
  if (agent.id === "manager") return 0;
  if (agent.status === "available") return 1;
  return 2;
}
