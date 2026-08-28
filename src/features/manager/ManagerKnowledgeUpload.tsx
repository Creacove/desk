import { Check, FileSpreadsheet, FileText, Loader2, Plus, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";
import type { CleanProductionRepositories, ManagerConversationAttachmentViewModel } from "../../types/cleanProduction";
import { MANAGER_KNOWLEDGE_ACCEPT, managerKnowledgeFileError } from "./managerAttachments";

type ManagerRepository = CleanProductionRepositories["manager"];
export type KnowledgeUploadItem = {
  localId: string;
  file: File;
  percent: number;
  state: "uploading" | "reading" | "ready" | "needs_review" | "failed";
  attachment?: ManagerConversationAttachmentViewModel;
  error?: string;
};

export function useManagerKnowledgeUploads(repository?: ManagerRepository) {
  const [items, setItems] = useState<KnowledgeUploadItem[]>([]);

  async function upload(item: KnowledgeUploadItem) {
    if (!repository?.uploadKnowledge) return;
    setItems((current) => current.map((entry) => entry.localId === item.localId ? { ...entry, state: "uploading", percent: 0, error: undefined } : entry));
    try {
      const attachment = await repository.uploadKnowledge({
        title: item.file.name,
        file: item.file,
        onProgress: (progress) => setItems((current) => current.map((entry) => entry.localId === item.localId ? {
          ...entry,
          percent: Math.round(progress.percent),
          state: progress.phase === "finalizing" ? "reading" : entry.state,
        } : entry)),
      });
      setItems((current) => current.map((entry) => entry.localId === item.localId ? {
        ...entry,
        attachment,
        percent: 100,
        state: attachment.extractionStatus === "completed" ? "ready" : "needs_review",
      } : entry));
    } catch (error) {
      setItems((current) => current.map((entry) => entry.localId === item.localId ? {
        ...entry,
        state: "failed",
        error: error instanceof Error ? error.message : "Upload failed.",
      } : entry));
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).map((file, index): KnowledgeUploadItem => {
      const error = managerKnowledgeFileError(file);
      return {
        localId: `manager-knowledge-${Date.now()}-${index}`,
        file,
        percent: 0,
        state: error ? "failed" : "uploading",
        ...(error ? { error } : {}),
      };
    });
    setItems((current) => [...current, ...next]);
    await Promise.all(next.filter((item) => !item.error).map(upload));
  }

  async function remove(localId: string) {
    const target = items.find((item) => item.localId === localId);
    setItems((current) => current.filter((item) => item.localId !== localId));
    if (target?.attachment?.documentId && repository?.revokeKnowledge) {
      try { await repository.revokeKnowledge(target.attachment.documentId); } catch { /* The tray is best-effort; server authorization remains authoritative. */ }
    }
  }

  return {
    items,
    addFiles,
    remove,
    retry: upload,
    clear: () => setItems([]),
    attachmentIds: items.flatMap((item) => item.attachment?.id && (item.state === "ready" || item.state === "needs_review") ? [item.attachment.id] : []),
    busy: items.some((item) => item.state === "uploading" || item.state === "reading"),
  };
}

export function ManagerKnowledgeUploadButton({ onFiles, disabled = false }: { onFiles(files: FileList | null): void | Promise<void>; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <input ref={inputRef} aria-label="Choose files for Manager" type="file" multiple accept={MANAGER_KNOWLEDGE_ACCEPT} className="sr-only" tabIndex={-1} onChange={(event) => { void onFiles(event.target.files); event.target.value = ""; setOpen(false); }} />
    <button type="button" aria-label="Add files for Manager" aria-expanded={open} disabled={disabled} onClick={() => setOpen((value) => !value)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30"><Plus className="h-4 w-4" /></button>
    {open ? <div className="absolute bottom-12 left-0 z-50 w-72 rounded-2xl border border-foreground/10 bg-background p-2 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
      <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-foreground/[0.05]">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span><span className="block text-[12px] font-semibold text-foreground">Upload Manager knowledge</span><span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-muted-foreground">PDF, Word, text, CSV, Excel, or JSON · private to this workspace</span></span>
      </button>
    </div> : null}
  </div>;
}

export function ManagerKnowledgeAttachmentTray({ items, onRemove, onRetry }: { items: KnowledgeUploadItem[]; onRemove(localId: string): void; onRetry(item: KnowledgeUploadItem): void }) {
  if (!items.length) return null;
  return <div data-testid="manager-knowledge-attachment-tray" className="mb-1 grid gap-1">
    {items.map((item) => {
      const Icon = item.file.name.toLowerCase().endsWith(".csv") || item.file.name.toLowerCase().endsWith(".xlsx") ? FileSpreadsheet : FileText;
      return <div key={item.localId} className="flex min-w-0 items-center gap-2 rounded-lg bg-foreground/[0.035] px-2.5 py-2">
        {item.state === "uploading" || item.state === "reading" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" /> : item.state === "ready" ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{item.file.name}</span>
        <span className={`max-w-[13rem] truncate text-[10px] ${item.state === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
          {item.state === "uploading" ? `${item.percent}%` : item.state === "reading" ? "Manager is reading…" : item.state === "ready" ? "Ready" : item.state === "needs_review" ? "Uploaded · needs review" : item.error ?? "Failed"}
        </span>
        {item.state === "failed" && !managerKnowledgeFileError(item.file) ? <button type="button" aria-label={`Retry ${item.file.name}`} onClick={() => onRetry(item)}><RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /></button> : null}
        <button type="button" aria-label={`Remove ${item.file.name}`} onClick={() => onRemove(item.localId)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
      </div>;
    })}
  </div>;
}
