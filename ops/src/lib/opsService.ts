import type { TodayItem } from "./types";

export type CaseDraft = {
  display_name: string;
  source: string;
  release_timing: string;
  primary_contact_email: string;
  primary_contact_handle: string;
  music_url: string;
  music_file: File | null;
};

export function validateCaseDraft(draft: CaseDraft): string | null {
  if (!draft.display_name.trim()) return "Add a project name.";
  if (!draft.source.trim()) return "Add the source for this lead.";
  if (!draft.release_timing.trim()) return "Choose release timing.";
  if (!draft.primary_contact_email.trim() && !draft.primary_contact_handle.trim()) {
    return "Add an email or social handle for the primary contact.";
  }
  if (!draft.music_url.trim() && !draft.music_file) return "Add a music link or upload.";
  return null;
}

export function buildMusicPath(caseId: string, fileName: string): string {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^\w.\- ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120) || "upload";
  return `${caseId}/${safeName}`;
}

export function getNextAction(item: Pick<TodayItem, "kind" | "action">): {
  label: string;
  tone: "neutral" | "accent" | "warning";
} {
  if (item.kind === "failed_processing") return { label: item.action || "Retry", tone: "warning" };
  if (item.kind === "transcript_ready") return { label: item.action || "Process in Desk", tone: "accent" };
  return { label: item.action || "Open", tone: "neutral" };
}
