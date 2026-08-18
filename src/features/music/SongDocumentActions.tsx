import { FileText, Plus, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, IconButton } from "../../design-system/desktopPrimitives";

type UploadChoice = { label: string; assetType: string };

const uploadChoices: UploadChoice[] = [
  { label: "Lyrics", assetType: "lyrics" },
  { label: "EPK / press kit", assetType: "epk" },
  { label: "Press material", assetType: "pitch_asset" },
  { label: "Split sheet / rights document", assetType: "split_sheet" },
  { label: "Other document", assetType: "other" },
];

export function SongDocumentActions({
  onWrite,
  onAskManager,
  onUpload,
}: {
  onWrite?: () => void;
  onAskManager?: () => void;
  onUpload: (choice: UploadChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  useEffect(() => {
    if (!open) return;
    firstActionRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        size="sm"
        aria-label="Add document"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        leadingIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
      >
        Add document
      </Button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Add document"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) close();
              }}
              className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground/22 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
            >
              <section className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[22px] border border-foreground/10 bg-background shadow-[0_28px_80px_hsl(var(--foreground)/0.18)] sm:w-[min(100%,29rem)] sm:rounded-[18px]">
                <header className="flex items-start justify-between gap-4 border-b border-foreground/8 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-accent">Song files</p>
                    <h3 className="mt-1.5 font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground">Add a document</h3>
                    <p className="mt-2 max-w-[25rem] text-[13px] font-medium leading-[1.55] text-muted-foreground">Build a campaign artifact with Manager, write something manually, or bring in a document you already have.</p>
                  </div>
                  <IconButton type="button" aria-label="Close Add document" label="Close Add document" onClick={close} variant="ghost" size="md">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </header>
                <div className="grid gap-1 p-2.5">
                  {onAskManager ? (
                    <button ref={firstActionRef} type="button" aria-label="Build with Manager" onClick={() => choose(onAskManager)} className="group flex items-start gap-3 rounded-[12px] bg-brand-accent/[0.045] px-3.5 py-3 text-left outline-none transition-colors duration-150 hover:bg-brand-accent/[0.075] focus-visible:ring-2 focus-visible:ring-brand-accent/20">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent/10 text-brand-accent"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
                      <span className="min-w-0"><span className="block text-[13px] font-semibold text-foreground">Build with Manager</span><span className="mt-1 block text-[12px] font-medium leading-[1.5] text-muted-foreground">Manager starts from the song’s current evidence and campaign narrative, builds the right artifact, quality-checks it, then saves the canonical draft here for review.</span></span>
                    </button>
                  ) : null}
                  {onWrite ? (
                    <button ref={onAskManager ? undefined : firstActionRef} type="button" aria-label="Write manually" onClick={() => choose(onWrite)} className="flex items-start gap-3 rounded-[12px] px-3.5 py-3 text-left outline-none transition-colors duration-150 hover:bg-foreground/[0.035] focus-visible:ring-2 focus-visible:ring-brand-accent/20">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-foreground/[0.045] text-muted-foreground"><FileText className="h-4 w-4" aria-hidden="true" /></span>
                      <span className="min-w-0"><span className="block text-[13px] font-semibold text-foreground">Write manually</span><span className="mt-1 block text-[12px] font-medium leading-[1.5] text-muted-foreground">Create or take direct control of a song document yourself.</span></span>
                    </button>
                  ) : null}
                  <div className="my-1 border-t border-foreground/8" />
                  <p className="px-3 pb-1 pt-2 font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Upload existing file</p>
                  {uploadChoices.map((choice, index) => (
                    <button
                      key={choice.assetType}
                      ref={!onWrite && !onAskManager && index === 0 ? firstActionRef : undefined}
                      type="button"
                      onClick={() => choose(() => onUpload(choice))}
                      className="flex min-h-11 items-center gap-3 rounded-[11px] px-3 py-2.5 text-left text-[13px] font-semibold text-foreground outline-none transition-colors duration-150 hover:bg-foreground/[0.035] focus-visible:ring-2 focus-visible:ring-brand-accent/20"
                    >
                      <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> {choice.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
