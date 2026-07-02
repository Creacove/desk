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
  const activeCount = orderedAgents.filter((agent) => agent.status === "available").length;
  const lockedCount = orderedAgents.length - activeCount;

  return (
    <section>
      <WorkspaceHeader eyebrow="Artist team" title="Artist Team Agents" />
      <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mb-5">AI Manager is live for conversations and operating decisions. The specialist agents are visible now as the next desks coming online.</p>
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <Stat label="Team" value={String(agents.length)} />
        <Stat label="Active" value={String(activeCount)} />
        <Stat label="Waiting" value={String(lockedCount)} />
      </div>
      <div data-testid="staff-mobile-list" className="grid gap-2 md:hidden">
        {orderedAgents.map((agent) => {
          const Icon = agent.icon;
          const locked = agent.status !== "available";
          return (
            <button
              key={agent.id}
              type="button"
              aria-label={`Open mobile agent ${agent.name}`}
              className={`flex min-w-0 items-center gap-3 rounded-[14px] border p-3 text-left shadow-[0_1px_6px_rgba(17,19,24,0.045)] ${
                locked ? "border-dashed border-foreground/12 bg-foreground/[0.025]" : "border-foreground/10 bg-white"
              }`}
              onClick={() => (locked ? onLockedAgent(agent) : onManager())}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${locked ? "bg-foreground/[0.07] text-muted-foreground" : "bg-foreground text-background"}`}>
                {locked ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-foreground">{agent.name}</span>
                <span className="mt-0.5 line-clamp-1 block text-[12px] font-medium text-muted-foreground/82">
                  {locked ? "Specialist desk coming soon." : agent.purpose}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-foreground/[0.055] px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                {locked ? "Coming soon" : agent.readiness}
              </span>
            </button>
          );
        })}
      </div>
      <div data-testid="staff-desktop-list" className="hidden gap-3 md:grid">
        {orderedAgents.map((agent) => {
          const Icon = agent.icon;
          const locked = agent.status !== "available";
          return (
            <button
              key={agent.id}
              type="button"
              aria-label={agent.name}
              className={`grid min-w-0 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border p-4 text-left shadow-sm transition-colors ${
                locked
                  ? "border-dashed border-foreground/12 bg-foreground/[0.018] hover:bg-foreground/[0.025]"
                  : "border-foreground/10 bg-background hover:border-brand-accent/20 hover:bg-white"
              }`}
              onClick={() => (locked ? onLockedAgent(agent) : onManager())}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${locked ? "bg-foreground/[0.07] text-muted-foreground" : "bg-foreground text-background"}`}>
                {locked ? <Lock className="h-5 w-5" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold">{agent.name}</span>
                <span className="mt-1 block text-[13px] font-semibold leading-relaxed text-muted-foreground/82">
                  {locked ? "Specialist desk coming soon. AI Manager is the live agent for now." : agent.purpose}
                </span>
              </span>
              <span className="justify-self-end rounded-full bg-foreground/[0.055] px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                {locked ? "Coming soon" : agent.readiness}
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
      <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-foreground/12 bg-foreground/[0.018] p-6 text-center">
        <div className="max-w-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/[0.07] text-muted-foreground">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-5 font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Coming soon</p>
          <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight text-foreground">{agent.name} is not live yet.</h2>
          <p className="mt-3 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">
            This specialist desk is locked while the first AI Manager experience is being tested.
          </p>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-foreground/8 bg-foreground/[0.025] p-4">
      <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
      <p className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">{value}</p>
    </div>
  );
}
