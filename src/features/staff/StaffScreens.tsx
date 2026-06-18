import { Lock } from "lucide-react";
import { ProductButton, WorkspaceHeader, WorkspaceShell } from "../../design-system/components";
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
  const activeCount = agents.filter((agent) => agent.status === "available").length;
  const lockedCount = agents.length - activeCount;

  return (
    <section>
      <WorkspaceHeader eyebrow="Artist team" title="Artist Team Agents" />
      <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mb-5">Specialized AI agents that help the artist and their team prepare work, spot gaps, and move missions forward.</p>
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <Stat label="Team" value={String(agents.length)} />
        <Stat label="Active" value={String(activeCount)} />
        <Stat label="Waiting" value={String(lockedCount)} />
      </div>
      <div data-testid="staff-mobile-list" className="grid gap-2 md:hidden">
        {agents.map((agent) => {
          const Icon = agent.icon;
          return (
            <button
              key={agent.id}
              type="button"
              aria-label={`Open mobile agent ${agent.name}`}
              className="flex min-w-0 items-center gap-3 rounded-[14px] border border-foreground/10 bg-white p-3 text-left shadow-[0_1px_6px_rgba(17,19,24,0.045)]"
              onClick={() => (agent.status === "available" ? onManager() : onLockedAgent(agent))}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                {agent.status === "available" ? <Icon className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-foreground">{agent.name}</span>
                <span className="mt-0.5 line-clamp-1 block text-[12px] font-medium text-muted-foreground/82">{agent.purpose}</span>
              </span>
              <span className="shrink-0 rounded-full bg-foreground/[0.055] px-2 py-1 text-[10px] font-semibold text-muted-foreground">{agent.readiness}</span>
            </button>
          );
        })}
      </div>
      <div data-testid="staff-desktop-list" className="hidden gap-3 md:grid">
        {agents.map((agent) => {
          const Icon = agent.icon;
          return (
            <button
              key={agent.id}
              type="button"
              aria-label={agent.name}
              className="rounded-xl border border-foreground/10 bg-background shadow-sm flex flex-col gap-4 p-5 text-left md:flex-row md:items-center md:justify-between"
              onClick={() => (agent.status === "available" ? onManager() : onLockedAgent(agent))}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-foreground text-background">
                {agent.status === "available" ? <Icon className="h-5 w-5" aria-hidden="true" /> : <Lock className="h-5 w-5" aria-hidden="true" />}
              </span>
              <span>
                <span className="block text-base font-semibold">{agent.name}</span>
                <span className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-1 block">{agent.purpose}</span>
              </span>
              <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground self-center">{agent.readiness}</span>
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
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-5">
          <div className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
            <p className="text-[13px] font-semibold leading-relaxed text-foreground/90">{agent.workspaceSubtitle}</p>
          </div>
          {agent.sections.map((section) => (
            <div key={section.title} className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">{section.eyebrow}</p>
                  <h2 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">{section.title}</h2>
                </div>
                {section.actionLabel ? <ProductButton variant="secondary">{section.actionLabel}</ProductButton> : null}
              </div>
              <div className="grid gap-3 mt-5">
                {section.items.map((item) => (
                  <div key={item.title} className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mt-2">{item.meta}</p>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">{item.status}</span>
                    </div>
                    <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-3">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
        <aside className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Source rail</p>
          <div className="grid gap-3 mt-4">
            {agent.sources.map((source) => (
              <div key={source.label} className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
                <p className="text-sm font-semibold">{source.label}</p>
                <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">{source.detail}</p>
                <p className="mt-3 text-sm font-semibold text-muted-foreground">{source.action}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </WorkspaceShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-foreground/8 bg-foreground/[0.025] p-4">
      <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
      <p className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">{value}</p>
    </div>
  );
}
