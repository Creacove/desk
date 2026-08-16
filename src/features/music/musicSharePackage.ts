export type SharePurpose = "listen" | "epk_press" | "delivery" | "custom";

export type ShareInventory = {
  assets: Array<{
    id: string;
    group: "Audio" | "Artwork" | "Documents";
    label: string;
    assetType?: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    documentType: string;
    body?: string;
    ready: boolean;
  }>;
  information: Array<{ key: string; label: string; value: string }>;
};

export type ShareSelection = {
  assetIds: string[];
  documentIds: string[];
  informationKeys: string[];
};

const IDENTITY_KEYS = new Set(["song_title", "primary_artist"]);
const PRESS_INFORMATION_KEYS = new Set(["song_title", "primary_artist", "release_date", "genre", "label"]);
const DELIVERY_INFORMATION_KEYS = new Set(["song_title", "primary_artist", "release_date", "genre", "label", "copyright"]);

// Recipient-facing press materials only. Outreach strategy and pitch drafts are
// deliberately excluded: they are tools used to contact press/playlists, not part
// of the EPK a journalist or media partner should receive.
const PRESS_DOCUMENT_TYPES = new Set([
  "epk",
  "artist_biography",
  "one_sheet",
  "press_release",
  "credits",
]);
const DELIVERY_DOCUMENT_TYPES = new Set(["lyrics", "credits", "distributor_notes"]);

export function availableShareInformation(inventory: ShareInventory) {
  return inventory.information.filter((field) => field.value.trim());
}

export function buildShareSelection(purpose: SharePurpose, inventory: ShareInventory): ShareSelection {
  if (purpose === "custom") return { assetIds: [], documentIds: [], informationKeys: [] };
  const availableInformation = availableShareInformation(inventory);
  const currentAudio = inventory.assets.find((asset) => asset.group === "Audio" && asset.assetType === "final_master")
    ?? inventory.assets.find((asset) => asset.group === "Audio");
  const cover = inventory.assets.find((asset) => asset.group === "Artwork" && asset.assetType === "cover_art")
    ?? inventory.assets.find((asset) => asset.group === "Artwork");

  if (purpose === "listen") {
    return {
      assetIds: [currentAudio?.id, cover?.id].filter(isString),
      documentIds: [],
      informationKeys: availableInformation.filter((field) => IDENTITY_KEYS.has(field.key)).map((field) => field.key),
    };
  }

  const assets = purpose === "epk_press"
    ? [
        currentAudio,
        cover,
        ...inventory.assets.filter((asset) =>
          asset.group === "Artwork"
          && asset.id !== cover?.id
          && asset.assetType !== "cover_art"
          && (asset.assetType === "press_photo" || asset.assetType === "artist_photo" || asset.assetType === "alternate_artwork"),
        ),
      ].filter(isDefined)
    : [currentAudio, cover].filter(isDefined);
  const documentTypes = purpose === "epk_press" ? PRESS_DOCUMENT_TYPES : DELIVERY_DOCUMENT_TYPES;
  const informationTypes = purpose === "epk_press" ? PRESS_INFORMATION_KEYS : DELIVERY_INFORMATION_KEYS;

  return {
    assetIds: assets.map((asset) => asset.id),
    documentIds: inventory.documents
      .filter((document) => document.ready && Boolean(document.body?.trim()) && documentTypes.has(document.documentType))
      .map((document) => document.id),
    informationKeys: availableInformation.filter((field) => informationTypes.has(field.key)).map((field) => field.key),
  };
}

export function selectionMatchesPreset(purpose: SharePurpose, inventory: ShareInventory, selection: ShareSelection) {
  const expected = buildShareSelection(purpose, inventory);
  return sameValues(expected.assetIds, selection.assetIds)
    && sameValues(expected.documentIds, selection.documentIds)
    && sameValues(expected.informationKeys, selection.informationKeys);
}

export function sharePurposeLabel(purpose: SharePurpose) {
  if (purpose === "listen") return "Private listen";
  if (purpose === "epk_press") return "Press / media";
  if (purpose === "delivery") return "Distributor delivery";
  return "Custom";
}

export function sharePurposeShortLabel(purpose: SharePurpose) {
  if (purpose === "listen") return "Listen";
  if (purpose === "epk_press") return "Press / media";
  if (purpose === "delivery") return "Delivery";
  return "Custom";
}

function sameValues(left: string[], right: string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
