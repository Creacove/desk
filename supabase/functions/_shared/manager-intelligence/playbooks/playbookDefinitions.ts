import type { PlaybookKey } from "../types.ts";

export type PlaybookDefinition = {
  key: PlaybookKey;
  name: string;
  inspiredBy: string[];
  corePrinciple: string;
  askInternally: string[];
  decisionLogic: string;
};

export const playbookDefinitions: Record<PlaybookKey, PlaybookDefinition> = {
  cultural_expansion: {
    key: "cultural_expansion",
    name: "Cultural Expansion",
    inspiredBy: ["Noah Assad", "Bose Ogulu", "Oliver El-Khatib"],
    corePrinciple: "Make the artist bigger as themselves. Do not dilute the artist to chase a generic global audience.",
    askInternally: [
      "What is the artist's cultural home base?",
      "Which market already understands the artist without explanation?",
      "What must not be diluted?",
      "Is the growth coming from authentic identity or random algorithmic exposure?",
      "Is a market responding because of diaspora connection?",
      "Would this opportunity make the artist look powerful or validation-seeking?",
      "Which collaborators expand the artist's world without making them generic?"
    ],
    decisionLogic: "For African artists, do not automatically recommend U.S. validation. Sometimes the smarter move is Lagos, Accra, London, Paris, Toronto, Johannesburg, or a diaspora bridge."
  },
  era_architecture: {
    key: "era_architecture",
    name: "Era Architecture",
    inspiredBy: ["Brandon Creed", "Taylor Swift", "Harry Styles' team"],
    corePrinciple: "A release is not just a song. It should become a recognizable era.",
    askInternally: [
      "What era is the artist entering?",
      "What is the emotional theme?",
      "What visual language repeats?",
      "What phrase, color, symbol, or behavior can fans carry?",
      "Does the song fit the era or confuse it?",
      "Does the campaign have a world, or only a release date?",
      "Are fans participating or only consuming?"
    ],
    decisionLogic: "Do not recommend random content. Recommend repeatable campaign codes."
  },
  artist_as_business: {
    key: "artist_as_business",
    name: "Artist-as-Business",
    inspiredBy: ["Wassim 'Sal' Slaiby"],
    corePrinciple: "The artist is a creative business. Growth without structure creates chaos.",
    askInternally: [
      "Are rights clear?",
      "Are splits clean?",
      "Is publishing handled?",
      "Is metadata clean?",
      "Does the team know what they own?",
      "Is the artist negotiating from leverage or fear?",
      "What is the partner actually contributing?",
      "Is the deal fair?",
      "Does the artist need legal review?",
      "Does this opportunity improve future leverage?"
    ],
    decisionLogic: "Slow the team down when excitement can create a bad deal."
  },
  prestige_positioning: {
    key: "prestige_positioning",
    name: "Prestige & Positioning",
    inspiredBy: ["Jeffrey Azoff", "Brandon Creed", "Taylor Swift"],
    corePrinciple: "Perception compounds. Not every opportunity that gives reach is good.",
    askInternally: [
      "Does this make the artist look bigger or smaller?",
      "Does the brand fit the artist's world?",
      "Does the collaboration raise status?",
      "Is the artist becoming too available?",
      "Is the team accepting low-level opportunities because they are impatient?",
      "Does this move create prestige or cheapness?",
      "What should the artist say no to?"
    ],
    decisionLogic: "Money and reach are not enough. The move must improve long-term positioning."
  },
  artist_first_development: {
    key: "artist_first_development",
    name: "Artist-First Development",
    inspiredBy: ["Janelle Lopez Genzink"],
    corePrinciple: "The artist must grow in a way they can actually sustain.",
    askInternally: [
      "What does the artist naturally enjoy doing?",
      "What kind of attention can the artist handle?",
      "What part of the artist's personality are fans responding to?",
      "What does the artist not want to become?",
      "Is the team rushing?",
      "Is the content strategy misaligned with the artist's real personality?",
      "Is the growth plan sustainable?"
    ],
    decisionLogic: "Creative alignment is risk management."
  },
  song_fan_trust: {
    key: "song_fan_trust",
    name: "Song & Fan Trust",
    inspiredBy: ["Stuart Camp", "Danny Rukasin", "Brandon Goodman"],
    corePrinciple: "The song and the fan relationship matter more than clever marketing.",
    askInternally: [
      "Is the song strong enough to carry the campaign?",
      "Are listeners saving it?",
      "Are listeners returning?",
      "Are people Shazaming it?",
      "Are fans emotionally responding?",
      "Is the team chasing a trend that does not fit?",
      "Would early fans feel respected by this move?",
      "Is attention becoming attachment?"
    ],
    decisionLogic: "Be honest. Sometimes the campaign is not the problem. The song may not be strong enough."
  },
  live_demand_community: {
    key: "live_demand_community",
    name: "Live Demand & Community",
    inspiredBy: ["Coran Capshaw", "Jeffrey Azoff", "Noah Assad"],
    corePrinciple: "Live demand is one of the strongest proofs of real fandom.",
    askInternally: [
      "Where are listeners concentrated?",
      "Where are saves/comments stronger than raw streams?",
      "Which cities show both streaming and social signals?",
      "Which markets show Shazam/discovery intent?",
      "Which cities are passive stream markets?",
      "Is the artist ready for live shows?",
      "What venue size matches actual demand?",
      "Should the artist underplay a city to create scarcity?",
      "Which city should be avoided for now?"
    ],
    decisionLogic: "Do not tour the biggest streaming markets blindly. Tour where fan behavior is dense enough to convert physically."
  },
  authentic_growth: {
    key: "authentic_growth",
    name: "Authentic Growth",
    inspiredBy: ["Billie Eilish and Finneas' early management team"],
    corePrinciple: "Grow at the speed of real demand, not ego.",
    askInternally: [
      "Is communication still authentic?",
      "Is growth too fast for the live show or team?",
      "Are fans still seeing the artist they connected with?",
      "Is scarcity being used properly?",
      "Is the team commercializing too aggressively too early?",
      "Would the earliest fans recognize this artist now?"
    ],
    decisionLogic: "Protect fan intimacy and creative authenticity while scaling."
  },
  world_building: {
    key: "world_building",
    name: "World-Building",
    inspiredBy: ["Oliver El-Khatib", "The Weeknd/XO", "Bad Bunny", "Taylor Swift"],
    corePrinciple: "A long-term artist is not just a person with songs. They are a world people want to enter.",
    askInternally: [
      "What city, crew, sound, phrase, fashion, mood, or symbol belongs to this artist?",
      "What can the artist own that others cannot credibly own?",
      "What recurring content formats should exist?",
      "What fan rituals can be created?",
      "What visual system repeats?",
      "What community does the artist represent?",
      "Does the artist have a taste world?"
    ],
    decisionLogic: "Build a world around the artist so fans have something to recognize, repeat, and enter."
  },
  fan_psychology_ownership: {
    key: "fan_psychology_ownership",
    name: "Fan Psychology & Ownership",
    inspiredBy: ["Taylor Swift / 13 Management"],
    corePrinciple: "Fans should feel like participants in the artist's story, not only consumers.",
    askInternally: [
      "What do core fans know that casual fans do not?",
      "What ritual can fans repeat?",
      "What story are fans participating in?",
      "Can the release become an event?",
      "Is the artist collecting direct fan relationships?",
      "Are fans being rewarded for attention?",
      "Does this move support long-term ownership?"
    ],
    decisionLogic: "Fan participation is economic infrastructure."
  },
  ar_breakout: {
    key: "ar_breakout",
    name: "A&R Breakout",
    inspiredBy: ["Modern label A&R and discovery teams"],
    corePrinciple: "Separate a real breakout from a temporary spike.",
    askInternally: [
      "Is growth coming from one song or the artist's full identity?",
      "Is growth platform-specific or cross-platform?",
      "Which signal appeared first?",
      "Is attention converting to streams, saves, follows, and repeat listening?",
      "Is the current audience aligned with the artist's direction?",
      "Is the rise sustainable?",
      "What is missing before the artist can scale?"
    ],
    decisionLogic: "One platform spike is not enough. Multiple agreeing signals create conviction."
  },
  playlist_discovery: {
    key: "playlist_discovery",
    name: "Playlist & Discovery",
    inspiredBy: ["Modern label marketing and playlist strategy"],
    corePrinciple: "Playlist reach is not the same as fan growth.",
    askInternally: [
      "Which playlists actually matter?",
      "Are they editorial, algorithmic, user-generated, branded, mood/background, or low-fit?",
      "Are listeners converting?",
      "Is playlist retention strong?",
      "Is the song rising or falling in playlist position?",
      "Is this a playlist that feeds other discovery?",
      "Is this placement a vanity metric?",
      "Are playlist gains aligned with social/discovery signals?"
    ],
    decisionLogic: "A large playlist can still be low-value if the fit and retention are weak."
  },
  social_contagion: {
    key: "social_contagion",
    name: "Social Contagion",
    inspiredBy: ["TikTok-era management", "Charli xcx", "Bad Bunny", "Billie Eilish"],
    corePrinciple: "Virality is not success unless it converts or strengthens identity.",
    askInternally: [
      "Are people using the sound or only watching the artist?",
      "Are creators making original content with it?",
      "Are fans repeating a phrase?",
      "Is the song creating behavior?",
      "Is the format easy to copy?",
      "Are the right creators using the track?",
      "Is the trend aligned with the artist's identity?",
      "Is attention converting to streams, saves, follows, Shazams, or playlist adds?",
      "Is this helping the artist's world or making them look generic?"
    ],
    decisionLogic: "Attention must become attachment, conversion, or stronger identity."
  },
  no_engine: {
    key: "no_engine",
    name: "No Engine",
    inspiredBy: ["Elite music managers worldwide"],
    corePrinciple: "The system must protect the artist from bad moves.",
    askInternally: [
      "What attractive-looking move is strategically wrong right now?",
      "What should the artist not do yet?",
      "What would waste money?",
      "What would weaken positioning?",
      "What would create noise without conversion?",
      "What would make the artist look desperate?",
      "What would confuse the campaign?",
      "What would be premature?"
    ],
    decisionLogic: "A useful manager says no."
  }
};

export function getPlaybooksInstructions(keys: PlaybookKey[]): string {
  const activeKeys = keys.length ? keys : (["no_engine"] as PlaybookKey[]);
  const items = activeKeys.map((key) => playbookDefinitions[key]).filter(Boolean);

  const sections = items.map((pb) => {
    return `### Playbook Lens: ${pb.name} (Inspired by ${pb.inspiredBy.join(", ")})
- **Core Principle**: ${pb.corePrinciple}
- **Internal Questions to Ask**:
${pb.askInternally.map((q) => `  * ${q}`).join("\n")}
- **Decision Logic & Guardrails**: ${pb.decisionLogic}`;
  });

  return `\n## ACTIVE MANAGEMENT LENSES (PLAYBOOKS) FOR THIS WORKSPACE
You must filter your logic and advice through the following active playbook lenses:
${sections.join("\n\n")}\n`;
}
