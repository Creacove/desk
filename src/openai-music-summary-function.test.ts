import { describe, expect, it } from "vitest";
import {
  MUSIC_MANAGER_READ_SCHEMA_VERSION,
  buildMusicManagerReadInstructions,
  buildMusicManagerReadRepairInstructions,
  musicManagerReadJsonSchema,
  parseMusicManagerReadOutput,
  validateMusicManagerReadOutput,
} from "../supabase/functions/_shared/openaiMusicManagerRead";

const allowedEvidenceIds = new Set(["ev-streams", "ev-tiktok", "ev-market"]);

const body = [
  "Jam is the clearest lead-attention asset in the current release picture. Its 5.2M recent streams show meaningful listening scale, while the 19M-view top TikTok clip shows that discovery is reaching well beyond the existing audience. A #14 Lagos rank gives the activity a useful market centre rather than leaving it as broad platform noise. Together, those facts put Jam ahead as the record that can open the campaign conversation, but they do not yet prove that casual discovery is becoming durable fandom.",
  "The management priority is to concentrate the next decision around Jam without treating every large number as the same kind of demand. Short-form reach is attention, the Lagos chart position is local traction, and streams are closer to consumption; the team should connect those layers before widening spend. Keep the story specific to the record and market, then watch whether the next reporting window holds listening and rank as the TikTok clip ages.",
].join("\n\n");

const validOutput = {
  position: "Jam is the clearest lead-attention record in the current release picture.",
  managementRole: "Lead attention asset",
  body,
  decision: "Concentrate the next campaign decision on Jam and connect its discovery reach to listening in Lagos.",
  avoid: "Do not spread spend evenly across the release before Jam's attention converts into sustained consumption.",
  watch: "Watch whether streams and the Lagos rank hold as the leading TikTok clip ages.",
  confidence: "high" as const,
  confidenceReason: "Three independent public signals point to the same record and market.",
  signals: [
    {
      label: "Recent streams",
      value: "5.2M",
      meaning: "Listening scale supports Jam as more than a short-form moment.",
      evidenceIds: ["ev-streams"],
    },
    {
      label: "Top TikTok clip",
      value: "19M",
      meaning: "Short-form discovery is the largest attention signal.",
      evidenceIds: ["ev-tiktok"],
    },
    {
      label: "Lagos rank",
      value: "#14",
      meaning: "The record has a specific market centre for the next decision.",
      evidenceIds: ["ev-market"],
    },
  ],
  evidenceIds: ["ev-streams", "ev-tiktok", "ev-market"],
};

const validationContext = {
  subjectType: "music_item" as const,
  subjectTitle: "Jam",
  allowedEvidenceIds,
};

describe("Music Manager Read v2 contract", () => {
  it("uses the v2 schema version and parses the exact complete payload", () => {
    expect(MUSIC_MANAGER_READ_SCHEMA_VERSION).toBe("music-manager-read-v2");
    expect(parseMusicManagerReadOutput(validOutput)).toEqual(validOutput);
  });

  it("defines a strict structured-output schema for every v2 field", () => {
    expect(musicManagerReadJsonSchema.name).toBe("music_manager_read_v2");
    expect(musicManagerReadJsonSchema.strict).toBe(true);
    expect(musicManagerReadJsonSchema.schema.additionalProperties).toBe(false);
    expect(musicManagerReadJsonSchema.schema.required).toEqual([
      "position",
      "managementRole",
      "body",
      "decision",
      "avoid",
      "watch",
      "confidence",
      "confidenceReason",
      "signals",
      "evidenceIds",
    ]);
    expect(musicManagerReadJsonSchema.schema.properties.signals.minItems).toBe(3);
    expect(musicManagerReadJsonSchema.schema.properties.signals.maxItems).toBe(6);
    expect(musicManagerReadJsonSchema.schema.properties.signals.items.additionalProperties).toBe(false);
  });

  it("does not preserve any removed legacy keys", () => {
    const parsed = parseMusicManagerReadOutput({
      ...validOutput,
      headline: "legacy",
      situationLine: "legacy",
      nextMove: "legacy",
      watchNext: "legacy",
      generationState: "legacy",
      whatMatters: ["legacy"],
      doNotDoYet: ["legacy"],
      missingProof: ["legacy"],
      evidenceIdsUsed: ["legacy"],
      sourcePanelNote: "legacy",
      sourceLine: "legacy",
      snapshotSummary: "legacy",
      intelligenceSnapshot: ["legacy"],
      claimAudit: ["legacy"],
    });

    const serialized = JSON.stringify(parsed);
    for (const removedKey of [
      "headline",
      "situationLine",
      "nextMove",
      "watchNext",
      "generationState",
      "whatMatters",
      "doNotDoYet",
      "missingProof",
      "evidenceIdsUsed",
      "sourcePanelNote",
      "sourceLine",
      "snapshotSummary",
      "intelligenceSnapshot",
      "claimAudit",
    ]) {
      expect(serialized).not.toContain(`"${removedKey}"`);
    }
  });

  it("returns useful exact violations for a substituted subject and invented evidence", () => {
    expect(validateMusicManagerReadOutput(validOutput, validationContext)).toEqual([]);

    const invalidOutput = {
      ...validOutput,
      position: "Another Song is the clearest lead-attention record.",
      evidenceIds: [...validOutput.evidenceIds, "ev-invented"],
    };

    expect(validateMusicManagerReadOutput(invalidOutput, validationContext)).toEqual([
      'position must name the exact subject title "Jam".',
      'evidenceIds contains unsupported evidence ID "ev-invented".',
    ]);
  });

  it("rejects visible provider and internal terminology", () => {
    const invalidOutput = {
      ...validOutput,
      body: validOutput.body.replace("Its 5.2M", "The Chartmetric API reports 5.2M"),
    };

    expect(validateMusicManagerReadOutput(invalidOutput, validationContext)).toContain(
      'body contains forbidden provider or internal terminology "Chartmetric".',
    );
  });

  it("rejects meaningfully repeated decision, avoid, and watch text", () => {
    const repeated = "Keep Jam as the lead record and focus the next campaign decision on Lagos listening.";
    const invalidOutput = {
      ...validOutput,
      decision: repeated,
      avoid: repeated,
      watch: repeated,
    };

    expect(validateMusicManagerReadOutput(invalidOutput, validationContext)).toEqual(
      expect.arrayContaining([
        "decision and avoid must be meaningfully distinct.",
        "decision and watch must be meaningfully distinct.",
        "avoid and watch must be meaningfully distinct.",
      ]),
    );
  });

  it("builds repair instructions from exact violations while preserving valid content", () => {
    const violations = [
      'position must name the exact subject title "Jam".',
      'evidenceIds contains unsupported evidence ID "ev-invented".',
    ];
    const instructions = buildMusicManagerReadRepairInstructions(violations);

    for (const violation of violations) expect(instructions).toContain(violation);
    expect(instructions).toContain("Correct only these violations");
    expect(instructions).toContain("Preserve all already-valid content");
    expect(instructions).toContain("Return the full music_manager_read_v2 schema again");
  });

  it("keeps the main prompt focused on senior Manager judgment and natural prose", () => {
    const instructions = buildMusicManagerReadInstructions("music_item", "");

    expect(instructions).toContain("artist's senior Manager");
    expect(instructions).toContain("current position");
    expect(instructions).toContain("two or three natural paragraphs");
    expect(instructions).toContain("5.2M");
    expect(instructions).toContain("decision, avoid, and watch");
    expect(instructions).toContain("Do not substitute a comparison");
    expect(instructions).toContain("attention, discovery, conversion, and durable fandom");
    expect(instructions).not.toContain("sourceLine must be exactly");
    expect(instructions).not.toContain("headline");
    expect(instructions).not.toContain("watchNext");
  });

  it("adds trimmed playbook instructions exactly once and omits empty playbooks", () => {
    const playbook = "  Give priority to Lagos before wider market expansion.  ";
    const withPlaybook = buildMusicManagerReadInstructions("music_project", playbook);
    const withoutPlaybook = buildMusicManagerReadInstructions("music_project", "   ");

    expect(withPlaybook.match(/Give priority to Lagos before wider market expansion\./g)).toHaveLength(1);
    expect(withPlaybook).toContain("reason across the release");
    expect(withPlaybook).toContain("carrying tracks");
    expect(withoutPlaybook).not.toContain("Playbook");
  });
});

describe("parseMusicManagerReadOutput", () => {
  it("throws when a required field is missing or has the wrong type", () => {
    const { position: _position, ...missingPosition } = validOutput;

    expect(() => parseMusicManagerReadOutput(missingPosition)).toThrow(/position/);
    expect(() => parseMusicManagerReadOutput({ ...validOutput, body: 42 })).toThrow(/body/);
    expect(() => parseMusicManagerReadOutput("not an object")).toThrow(/object/);
  });

  it("accepts only low, medium, or high confidence", () => {
    for (const confidence of ["low", "medium", "high"] as const) {
      expect(parseMusicManagerReadOutput({ ...validOutput, confidence }).confidence).toBe(confidence);
    }
    expect(() => parseMusicManagerReadOutput({ ...validOutput, confidence: "unknown" })).toThrow(/confidence/);
    expect(() => parseMusicManagerReadOutput({ ...validOutput, confidence: 1 })).toThrow(/confidence/);
  });

  it("requires three to six complete signal objects", () => {
    expect(() => parseMusicManagerReadOutput({ ...validOutput, signals: validOutput.signals.slice(0, 2) })).toThrow(/signals/);
    expect(() =>
      parseMusicManagerReadOutput({
        ...validOutput,
        signals: [...validOutput.signals, ...validOutput.signals, validOutput.signals[0]],
      }),
    ).toThrow(/signals/);
    expect(() =>
      parseMusicManagerReadOutput({
        ...validOutput,
        signals: validOutput.signals.map((signal, index) => {
          if (index !== 0) return signal;
          const { meaning: _meaning, ...incomplete } = signal;
          return incomplete;
        }),
      }),
    ).toThrow(/signals\[0\]\.meaning/);
  });

  it("trims strings and trims and deduplicates every evidence ID array", () => {
    const parsed = parseMusicManagerReadOutput({
      ...validOutput,
      position: `  ${validOutput.position}  `,
      managementRole: ` ${validOutput.managementRole} `,
      body: `\n${validOutput.body}\n`,
      decision: ` ${validOutput.decision} `,
      avoid: ` ${validOutput.avoid} `,
      watch: ` ${validOutput.watch} `,
      confidenceReason: ` ${validOutput.confidenceReason} `,
      evidenceIds: [" ev-streams ", "ev-streams", " ev-market "],
      signals: validOutput.signals.map((signal) => ({
        ...signal,
        label: ` ${signal.label} `,
        value: ` ${signal.value} `,
        meaning: ` ${signal.meaning} `,
        evidenceIds: [` ${signal.evidenceIds[0]} `, signal.evidenceIds[0]],
      })),
    });

    expect(parsed.position).toBe(validOutput.position);
    expect(parsed.body).toBe(validOutput.body);
    expect(parsed.evidenceIds).toEqual(["ev-streams", "ev-market"]);
    expect(parsed.signals[0]).toEqual(validOutput.signals[0]);
  });

  it("rejects malformed evidence ID arrays instead of coercing them", () => {
    expect(() => parseMusicManagerReadOutput({ ...validOutput, evidenceIds: "ev-streams" })).toThrow(/evidenceIds/);
    expect(() => parseMusicManagerReadOutput({ ...validOutput, evidenceIds: ["ev-streams", 12] })).toThrow(/evidenceIds/);
    expect(() =>
      parseMusicManagerReadOutput({
        ...validOutput,
        signals: validOutput.signals.map((signal, index) =>
          index === 0 ? { ...signal, evidenceIds: ["ev-streams", "   "] } : signal,
        ),
      }),
    ).toThrow(/signals\[0\]\.evidenceIds/);
  });

  it("constructs fresh root and signal objects without unknown properties", () => {
    const parsed = parseMusicManagerReadOutput({
      ...validOutput,
      ignoredRoot: "do not copy",
      signals: validOutput.signals.map((signal) => ({ ...signal, ignoredSignal: "do not copy" })),
    });

    expect(parsed).not.toHaveProperty("ignoredRoot");
    for (const signal of parsed.signals) expect(signal).not.toHaveProperty("ignoredSignal");
  });
});
