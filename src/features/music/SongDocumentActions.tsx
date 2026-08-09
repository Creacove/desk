import { FileText, Plus, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
      <button
        ref={triggerRef}
        type="button"
        aria-label="Add document"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.045]"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add document
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Add document"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) close();
              }}
              className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground/24 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
            >
              <section className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[22px] border border-foreground/10 bg-background shadow-[0_24px_70px_rgba(17,19,24,0.22)] sm:w-[min(100%,28rem)] sm:rounded-[22px]">
                <header className="flex items-start justify-between gap-4 border-b border-foreground/8 px-5 py-4">
                  <div>
                    <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Add to song</p>
                    <h3 className="mt-1 font-display text-[22px] font-bold leading-tight text-foreground">Add document</h3>
                    <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">Write it here, ask the Manager for a draft, or add a file you already have.</p>
                  </div>
                  <button type="button" aria-label="Close Add document" onClick={close} className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </header>
                <div className="grid gap-1 p-2">
                  {onWrite ? (
                    <button ref={firstActionRef} type="button" aria-label="Write here" onClick={() => choose(onWrite)} className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-left hover:bg-foreground/[0.04]">
                      <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span><span className="block text-[13px] font-semibold text-foreground">Write here</span><span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">Create lyrics, press notes, or another song document.</span></span>
                    </button>
                  ) : null}
                  {onAskManager ? (
                    <button ref={onWrite ? undefined : firstActionRef} type="button" aria-label="Ask Manager to draft" onClick={() => choose(onAskManager)} className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-left hover:bg-foreground/[0.04]">
                      <Sparkles className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                      <span><span className="block text-[13px] font-semibold text-foreground">Ask Manager to draft</span><span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">Start from the song’s current lyrics, files, and release context.</span></span>
                    </button>
                  ) : null}
                  <div className="my-1 border-t border-foreground/8" />
                  <p className="px-3 pb-1 pt-2 font-ui text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Upload existing file</p>
                  {uploadChoices.map((choice, index) => (
                    <button
                      key={choice.assetType}
                      ref={!onWrite && !onAskManager && index === 0 ? firstActionRef : undefined}
                      type="button"
                      onClick={() => choose(() => onUpload(choice))}
                      className="flex min-h-11 items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[12px] font-semibold text-foreground hover:bg-foreground/[0.04]"
                    >
                      <Upload className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> {choice.label}
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
