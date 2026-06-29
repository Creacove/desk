import type { ManagerSignalType, PlaybookKey } from "../types";

export type PlaybookRoutingInput = {
  careerStage?: string | null;
  signalTypes?: ManagerSignalType[];
  strongestSignal?: string | null;
  biggestRisk?: string | null;
  marketShape?: string | null;
  catalogShape?: string | null;
  hasRightsOrDealRisk?: boolean;
};

export type PlaybookRouting = {
  consideredPlaybooks: PlaybookKey[];
  appliedPlaybooks: PlaybookKey[];
  routingNotes: string[];
};

const allPlaybooks: PlaybookKey[] = [
  "cultural_expansion",
  "era_architecture",
  "artist_as_business",
  "prestige_positioning",
  "artist_first_development",
  "song_fan_trust",
  "live_demand_community",
  "authentic_growth",
  "world_building",
  "fan_psychology_ownership",
  "ar_breakout",
  "playlist_discovery",
  "social_contagion",
  "no_engine",
];

const contains = (value: string | null | undefined, needle: string) => (value ?? "").toLowerCase().includes(needle);

export const routePlaybooks = (input: PlaybookRoutingInput): PlaybookRouting => {
  const signals = new Set(input.signalTypes ?? []);
  const applied = new Set<PlaybookKey>(["no_engine"]);
  const notes: string[] = ["Always apply the no-engine check so every output can say what not to do."];

  if (signals.has("attention") || contains(input.strongestSignal, "tiktok")) {
    applied.add("social_contagion");
    notes.push("Attention-led signal needs conversion and identity checks.");
  }
  if (signals.has("playlist") || contains(input.biggestRisk, "playlist")) {
    applied.add("playlist_discovery");
    notes.push("Playlist reach must be separated from durable fan growth.");
  }
  if (signals.has("discovery") && (signals.has("attention") || signals.has("conversion") || signals.has("playlist"))) {
    applied.add("ar_breakout");
    notes.push("Multiple discovery/attention signals require breakout validation.");
  }
  if (signals.has("market") || contains(input.marketShape, "lagos") || contains(input.marketShape, "diaspora")) {
    applied.add("cultural_expansion");
    notes.push("Market shape requires cultural expansion without dilution.");
  }
  if (signals.has("live")) {
    applied.add("live_demand_community");
  }
  if (contains(input.catalogShape, "song") || signals.has("catalog")) {
    applied.add("song_fan_trust");
  }
  if (input.hasRightsOrDealRisk || signals.has("risk")) {
    applied.add("artist_as_business");
    notes.push("Rights, deal, or readiness risk should slow external moves.");
  }
  if (contains(input.careerStage, "developing")) {
    applied.add("artist_first_development");
    applied.add("authentic_growth");
  }

  return {
    consideredPlaybooks: allPlaybooks,
    appliedPlaybooks: [...applied],
    routingNotes: notes,
  };
};

export const summarizePlaybookInfluenceForPublicOutput = (routing: PlaybookRouting) => {
  const applied = new Set(routing.appliedPlaybooks);
  const parts = ["Protect the artist from the attractive wrong move."];

  if (applied.has("social_contagion") || applied.has("ar_breakout")) {
    parts.push("Convert attention into owned fan behavior before scaling.");
  }
  if (applied.has("playlist_discovery")) {
    parts.push("Treat playlist reach as exposure until retention and conversion agree.");
  }
  if (applied.has("cultural_expansion")) {
    parts.push("Focus the market story where the artist's identity is strongest.");
  }
  if (applied.has("artist_as_business")) {
    parts.push("Do not let momentum outrun rights, structure, or leverage.");
  }

  return parts.join(" ");
};
