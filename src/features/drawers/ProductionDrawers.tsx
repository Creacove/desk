import { X } from "lucide-react";
import { IconButton } from "../../design-system/desktopPrimitives";
import type { DrawerKind, EvidenceItemViewModel, MissionViewModel } from "../../types/cleanProduction";

export function ProductionDrawers({
  drawer,
  evidence,
  mission,
  onClose,
}: {
  drawer: DrawerKind;
  evidence: EvidenceItemViewModel[];
  mission: MissionViewModel | null;
  onClose: () => void;
}) {
  if (!drawer) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/18 backdrop-blur-[2px]" role="presentation">
      <aside
        className="h-full w-[min(100%,34rem)] overflow-y-auto border-l border-foreground/10 bg-background shadow-[0_28px_80px_hsl(var(--foreground)/0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label={drawerLabel(drawer)}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-foreground/8 bg-background/96 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-accent">{drawerLabel(drawer)}</p>
            <h2 className="mt-1.5 font-display text-[22px] font-semibold tracking-[-0.02em] text-foreground">{drawerTitle(drawer)}</h2>
          </div>
          <IconButton type="button" variant="ghost" size="md" label={`Close ${drawerLabel(drawer)}`} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </header>

        <div className="px-5 py-5 sm:px-6 sm:py-6">
          {drawer === "evidence" ? <EvidenceContent evidence={evidence} /> : null}
          {drawer === "missionRecord" ? <MissionRecordContent mission={mission} /> : null}
          {drawer === "workDraft" ? <WorkDraftContent /> : null}
        </div>
      </aside>
    </div>
  );
}

function EvidenceContent({ evidence }: { evidence: EvidenceItemViewModel[] }) {
  if (!evidence.length) return <p className="py-6 text-[13px] font-medium text-muted-foreground">No evidence yet</p>;

  return (
    <div className="border-y border-foreground/8">
      {evidence.map((item) => (
        <article key={item.id} className="border-b border-foreground/8 py-5 last:border-b-0">
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{item.id} / {item.source}</p>
          <h3 className="mt-2 font-display text-[18px] font-semibold tracking-[-0.015em] text-foreground">{item.subject}</h3>
          <dl className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <EvidenceField label="Source kind" value={item.sourceKind} />
            <EvidenceField label="Metric" value={item.metric} />
            <EvidenceField label="Window" value={item.window} />
            <EvidenceField label="Confidence" value={item.confidence} />
          </dl>
          <p className="mt-4 max-w-[30rem] text-[13px] font-medium leading-[1.6] text-muted-foreground">Limitation: {item.limitation}</p>
        </article>
      ))}
    </div>
  );
}

function MissionRecordContent({ mission }: { mission: MissionViewModel | null }) {
  return (
    <section className="border-y border-foreground/8 py-5">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Mission recap</p>
      <h3 className="mt-2 font-display text-[18px] font-semibold tracking-[-0.015em] text-foreground">{mission?.title ?? "Current mission"}</h3>
      <p className="mt-4 max-w-[30rem] text-[14px] font-medium leading-[1.6] text-foreground/88">Living recap of the mission, task changes, checkpoint status, blockers, and next recommendation.</p>
      {mission?.recommendation ? <p className="mt-4 max-w-[30rem] text-[13px] font-medium leading-[1.6] text-muted-foreground">{mission.recommendation}</p> : null}
    </section>
  );
}

function WorkDraftContent() {
  return (
    <section className="border-y border-foreground/8 py-5">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Draft status</p>
      <p className="mt-3 max-w-[30rem] text-[14px] font-medium leading-[1.6] text-foreground/88">Nothing is sent automatically. Drafts require review before export or delivery.</p>
    </section>
  );
}

function EvidenceField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-ui text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[13px] font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function drawerLabel(drawer: DrawerKind) {
  if (drawer === "evidence") return "Evidence Drawer";
  if (drawer === "missionRecord") return "Mission Record";
  return "Work Draft";
}

function drawerTitle(drawer: DrawerKind) {
  if (drawer === "evidence") return "Supporting evidence";
  if (drawer === "missionRecord") return "Living mission intelligence";
  return "Generated work draft";
}
