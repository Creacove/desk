import type { MusicObjectViewModel } from "../../types/cleanProduction";

export type SongRightsState =
  | "not_managed"
  | "draft"
  | "ready"
  | "awaiting"
  | "partially_confirmed"
  | "disputed"
  | "confirmed"
  | "document_on_file";

export type SongRightsSummary = {
  state: SongRightsState;
  headline: string;
  description: string;
  publishingAllocated: number;
  masterAllocated: number;
  confirmedCount: number;
  contributorCount: number;
  externalRecordId?: string;
};

export function deriveSongRightsState(song: MusicObjectViewModel): SongRightsSummary {
  const contributors = song.splits?.contributors ?? [];
  const externalRecord = song.fileAssets?.find((asset) => asset.assetType === "split_sheet" && asset.status.toLowerCase() !== "missing");
  const publishingAllocated = sumShares(contributors.map((contributor) => contributor.publishingShare));
  const masterAllocated = sumShares(contributors.map((contributor) => contributor.masterShare));
  const confirmedCount = contributors.filter((contributor) => ["confirmed", "cleared"].includes(contributor.approval.toLowerCase())).length;
  const contributorCount = contributors.length;
  const normalized = (song.splits?.status ?? "missing").toLowerCase().replaceAll(" ", "_");

  let state: SongRightsState;
  if (!contributors.length && externalRecord) state = "document_on_file";
  else if (["cleared", "confirmed"].includes(normalized)) state = "confirmed";
  else if (["disputed", "rejected"].includes(normalized)) state = "disputed";
  else if (["partially_confirmed", "partial"].includes(normalized)) state = "partially_confirmed";
  else if (["pending_confirmation", "pending"].includes(normalized)) state = "awaiting";
  else if (normalized === "ready" || (contributorCount > 0 && publishingAllocated === 100 && masterAllocated === 100)) state = "ready";
  else if (contributorCount > 0 || normalized === "draft") state = "draft";
  else state = "not_managed";

  const copy = rightsCopy(state, confirmedCount, contributorCount, Boolean(song.sourceKind === "spotify_public_catalog"));
  return {
    state,
    ...copy,
    publishingAllocated,
    masterAllocated,
    confirmedCount,
    contributorCount,
    externalRecordId: externalRecord?.assetId,
  };
}

export function buildSplitRecord(song: MusicObjectViewModel, generatedAt = new Date().toISOString()) {
  const contributors = song.splits?.contributors ?? [];
  return [
    "ORDERSOUNDS SPLIT CONFIRMATION RECORD",
    `Song: ${song.title}`,
    `Generated: ${generatedAt}`,
    "",
    ...contributors.flatMap((contributor, index) => [
      `${index + 1}. ${contributor.name} — ${contributor.role}`,
      `   Publishing: ${contributor.publishingShare}`,
      `   Master: ${contributor.masterShare}`,
      `   Confirmation: ${contributor.approval}`,
    ]),
    "",
    "Ordersounds confirmation record — not legal advice or a qualified electronic-signature certificate.",
  ].join("\n");
}

function rightsCopy(state: SongRightsState, confirmed: number, count: number, imported: boolean) {
  switch (state) {
    case "document_on_file":
      return { headline: "Rights document on file", description: "An external split sheet is attached. It is available to your team but not independently verified by Ordersounds." };
    case "confirmed":
      return { headline: "Splits confirmed", description: `All ${count} collaborator${count === 1 ? "" : "s"} confirmed this allocation.` };
    case "disputed":
      return { headline: "A correction was requested", description: "Review the collaborator’s note, revise the proposal, and send a new request." };
    case "partially_confirmed":
      return { headline: `${confirmed} of ${count} collaborators confirmed`, description: `${Math.max(0, count - confirmed)} still ${count - confirmed === 1 ? "needs" : "need"} to respond.` };
    case "awaiting":
      return { headline: "Waiting for collaborators", description: `Confirmation requests were sent to ${count} collaborator${count === 1 ? "" : "s"}.` };
    case "ready":
      return { headline: "Splits ready to send", description: "Publishing and master allocations are complete. Review the proposal before sending it." };
    case "draft":
      return { headline: "Complete the allocation", description: "Publishing and master recording each need to total 100%." };
    default:
      return imported
        ? { headline: "Rights not managed in Ordersounds", description: "This song was imported from the public catalog. Public catalog data does not verify ownership or collaborator agreements." }
        : { headline: "Set up song rights", description: "Add collaborators and agree how publishing and master ownership are divided." };
  }
}

function sumShares(values: string[]) {
  return Number(values.reduce((total, value) => total + parseShare(value), 0).toFixed(2));
}

function parseShare(value: string) {
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
