import { ProductButton } from "../../design-system/components";
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
  if (!drawer) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/15 backdrop-blur-[2px]" role="presentation">
      <aside className="h-full w-[min(100%,34rem)] overflow-y-auto border-l border-foreground/10 bg-background p-6 shadow-[0_32px_70px_-36px_rgba(17,19,24,0.45)]" role="dialog" aria-modal="true" aria-label={drawerLabel(drawer)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">{drawerLabel(drawer)}</p>
            <h2 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">{drawerTitle(drawer)}</h2>
          </div>
          <ProductButton variant="secondary" onClick={onClose}>Close</ProductButton>
        </div>
        <div className="mt-6">
          {drawer === "evidence" ? <EvidenceContent evidence={evidence} /> : null}
          {drawer === "missionRecord" ? <MissionRecordContent mission={mission} /> : null}
          {drawer === "workDraft" ? <WorkDraftContent /> : null}
        </div>
      </aside>
    </div>
  );
}

function EvidenceContent({ evidence }: { evidence: EvidenceItemViewModel[] }) {
  return (
    <div className="grid gap-3">
      {evidence.map((item) => (
        <div key={item.id} className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{item.id} / {item.source}</p>
          <h3 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">{item.subject}</h3>
          <div className="grid gap-3 mt-4">
            <EvidenceField label="Source kind" value={item.sourceKind} />
            <EvidenceField label="Metric" value={item.metric} />
            <EvidenceField label="Window" value={item.window} />
            <EvidenceField label="Confidence" value={item.confidence} />
          </div>
          <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-4">Limitation: {item.limitation}</p>
        </div>
      ))}
    </div>
  );
}

function MissionRecordContent({ mission }: { mission: MissionViewModel | null }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4">
      <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Mission recap</p>
      <h3 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">{mission?.title ?? "Current mission"}</h3>
      <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 mt-4">Living recap of the mission, task changes, checkpoint status, blockers, and next recommendation.</p>
      <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-4">{mission?.recommendation}</p>
    </div>
  );
}

function WorkDraftContent() {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4">
      <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Draft status</p>
      <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 mt-3">Nothing is sent automatically. Drafts require review before export or delivery.</p>
    </div>
  );
}

function EvidenceField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-3">
      <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-1">{value}</p>
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
