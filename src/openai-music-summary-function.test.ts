import { describe, expect, it } from "vitest";
import {
  MUSIC_MANAGER_READ_SCHEMA_VERSION,
  type MusicManagerReadV2,
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

const validOutput: MusicManagerReadV2 = {
  position: "Jam is the clearest lead-attention record in the current release picture.",
  managementRole: "Lead attention asset",
  body,
  decision: "Concentrate the next campaign decision on Jam and connect its discovery reach to listening in Lagos.",
  avoid: "Do not spread spend evenly across the release before Jam's attention converts into sustained consumption.",
  watch: "Watch whether streams and the Lagos rank hold as the leading TikTok clip ages.",
  confidence: "high",
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

function cloneValidOutput(): MusicManagerReadV2 {
  return JSON.parse(JSON.stringify(validOutput)) as MusicManagerReadV2;
}

function outputWithBodyWords(wordCount: number): MusicManagerReadV2 {
  return {
    ...cloneValidOutput(),
    body: Array.from({ length: wordCount }, (_, index) => `word${index + 1}`).join(" "),
  };
}

function countOccurrences(value: string, fragment: string): number {
  return value.split(fragment).length - 1;
}

describe("Music Manager Read v2 contract", () => {
  it("uses the v2 schema version and parses the exact complete payload", () => {
    expect(MUSIC_MANAGER_READ_SCHEMA_VERSION).toBe("music-manager-read-v2");
    expect(parseMusicManagerReadOutput(validOutput)).toEqual(validOutput);
  });

  it("defines a strict structured-output schema for every v2 field", () => {
    const properties = musicManagerReadJsonSchema.schema.properties;
    const signalSchema = properties.signals;

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
    expect(properties.position.maxLength).toBe(220);
    expect(properties.managementRole.maxLength).toBe(100);
    expect(properties.body.maxLength).toBe(2400);
    expect(properties.decision.maxLength).toBe(260);
    expect(properties.avoid.maxLength).toBe(260);
    expect(properties.watch.maxLength).toBe(260);
    expect(properties.confidenceReason.maxLength).toBe(260);
    expect(properties.confidence.enum).toEqual(["low", "medium", "high"]);
    expect(signalSchema.minItems).toBe(3);
    expect(signalSchema.maxItems).toBe(6);
    expect(signalSchema.items.additionalProperties).toBe(false);
    expect(signalSchema.items.required).toEqual(["label", "value", "meaning", "evidenceIds"]);
    expect(signalSchema.items.properties.label.maxLength).toBe(56);
    expect(signalSchema.items.properties.value.maxLength).toBe(18);
    expect(signalSchema.items.properties.meaning.maxLength).toBe(120);
    expect(signalSchema.items.properties.evidenceIds.items.type).toBe("string");
    expect(properties.evidenceIds.items.type).toBe("string");
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

  it("finds a later case-insensitive exact subject after an embedded substring", () => {
    const output = {
      ...cloneValidOutput(),
      position: "Jamming leads, but JAM is the requested subject.",
    };

    expect(validateMusicManagerReadOutput(output, validationContext)).toEqual([]);
  });

  it.each([
    {
      field: "position",
      expected: 'position contains forbidden provider or internal terminology "OpenAI".',
      change: (output: MusicManagerReadV2) => {
        output.position = "Jam is the OpenAI-led subject.";
      },
    },
    {
      field: "managementRole",
      expected: 'managementRole contains forbidden provider or internal terminology "OpenAI".',
      change: (output: MusicManagerReadV2) => {
        output.managementRole = "OpenAI attention lead";
      },
    },
    {
      field: "body",
      expected: 'body contains forbidden provider or internal terminology "OpenAI".',
      change: (output: MusicManagerReadV2) => {
        output.body = `${output.body} OpenAI`;
      },
    },
    {
      field: "decision",
      expected: 'decision contains forbidden provider or internal terminology "OpenAI".',
      change: (output: MusicManagerReadV2) => {
        output.decision = "Use OpenAI for the next distinct operating choice.";
      },
    },
    {
      field: "avoid",
      expected: 'avoid contains forbidden provider or internal terminology "OpenAI".',
      change: (output: MusicManagerReadV2) => {
        output.avoid = "Avoid an OpenAI-led expansion before conversion is clear.";
      },
    },
    {
      field: "watch",
      expected: 'watch contains forbidden provider or internal terminology "OpenAI".',
      change: (output: MusicManagerReadV2) => {
        output.watch = "Watch a separate OpenAI measure over the next window.";
      },
    },
    {
      field: "confidenceReason",
      expected: 'confidenceReason contains forbidden provider or internal terminology "OpenAI".',
      change: (output: MusicManagerReadV2) => {
        output.confidenceReason = "OpenAI is named as the confidence source.";
      },
    },
    {
      field: "signal label",
      expected: 'signals[0].label contains forbidden provider or internal terminology "OpenAI".',
      change: (output: MusicManagerReadV2) => {
        output.signals[0].label = "OpenAI streams";
      },
    },
    {
      field: "signal value",
      expected: 'signals[0].value contains forbidden provider or internal terminology "API".',
      change: (output: MusicManagerReadV2) => {
        output.signals[0].value = "API";
      },
    },
    {
      field: "signal meaning",
      expected: 'signals[0].meaning contains forbidden provider or internal terminology "OpenAI".',
      change: (output: MusicManagerReadV2) => {
        output.signals[0].meaning = "OpenAI is presented as the source of this signal.";
      },
    },
  ])("rejects forbidden terminology in $field", ({ change, expected }) => {
    const output = cloneValidOutput();
    change(output);

    expect(validateMusicManagerReadOutput(output, validationContext)).toEqual([expected]);
  });

  it("rejects decision and avoid at exactly 0.8 token overlap", () => {
    const output = {
      ...cloneValidOutput(),
      decision: "alpha beta gamma delta epsilon",
      avoid: "alpha beta gamma delta zeta",
      watch: "theta iota kappa lambda mu",
    };

    expect(validateMusicManagerReadOutput(output, validationContext)).toContain(
      "decision and avoid must be meaningfully distinct.",
    );
  });

  it("accepts judgment pairs below 0.8 token overlap", () => {
    const output = {
      ...cloneValidOutput(),
      decision: "alpha beta gamma delta epsilon",
      avoid: "alpha beta gamma zeta eta",
      watch: "theta iota kappa lambda mu",
    };

    expect(validateMusicManagerReadOutput(output, validationContext).filter((violation) =>
      violation.includes("meaningfully distinct"),
    )).toEqual([]);
  });

  it("rejects an unsupported evidence ID inside a signal", () => {
    const output = cloneValidOutput();
    output.signals[1].evidenceIds.push("ev-invented");

    expect(validateMusicManagerReadOutput(output, validationContext)).toContain(
      'signals[1].evidenceIds contains unsupported evidence ID "ev-invented".',
    );
  });

  it.each([120, 320])("accepts a body containing exactly %i words", (wordCount) => {
    expect(validateMusicManagerReadOutput(outputWithBodyWords(wordCount), validationContext)).toEqual([]);
  });

  it.each([119, 321])("rejects a body containing %i words", (wordCount) => {
    expect(validateMusicManagerReadOutput(outputWithBodyWords(wordCount), validationContext)).toContain(
      `body must contain 120–320 words; received ${wordCount}.`,
    );
  });

  it("validates without mutating any output content", () => {
    const output = cloneValidOutput();
    output.position = "Another Song leads the current picture.";
    output.signals[0].evidenceIds.push("ev-invented");
    const snapshot = structuredClone(output);

    validateMusicManagerReadOutput(output, validationContext);

    expect(output).toEqual(snapshot);
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
    expect(countOccurrences(instructions, "senior Manager")).toBe(1);
    expect(instructions).toContain("current position");
    expect(instructions).toContain("Put the conclusion first");
    expect(instructions).toContain("two or three natural paragraphs");
    expect(instructions).toContain("plain, direct English");
    expect(instructions).toContain("exact requested subject, artist, markets, comparisons, and numbers");
    expect(instructions).toContain("5.2M");
    expect(instructions).toContain("decision, avoid, and watch");
    expect(instructions).toContain("Do not substitute a comparison");
    expect(instructions).toContain("attention, discovery, conversion, and durable fandom");
    expect(instructions).toContain("missions");
    expect(instructions).toContain("tasks");
    expect(instructions).toContain("fake commitments");
    expect(instructions).toContain("provider references");
    expect(instructions).toContain("internal mechanics");
    expect(instructions).toContain("Use only supplied evidence IDs");
    expect(instructions).toContain("never print evidence IDs in visible text");
    expect(instructions).not.toContain("sourceLine must be exactly");
    expect(instructions).not.toContain("headline");
    expect(instructions).not.toContain("watchNext");
    for (const ruleFragment of [
      "two or three natural paragraphs",
      "Do not substitute a comparison",
      "5.2M",
      "supplied evidence IDs",
    ]) {
      expect(countOccurrences(instructions, ruleFragment)).toBe(1);
    }
  });

  it("includes project guidance only for projects and appends a trimmed playbook exactly once", () => {
    const playbook = "  Give priority to Lagos before wider market expansion.  ";
    const withPlaybook = buildMusicManagerReadInstructions("music_project", playbook);
    const itemInstructions = buildMusicManagerReadInstructions("music_item", playbook);
    const withoutPlaybook = buildMusicManagerReadInstructions("music_project", "   ");

    expect(withPlaybook.match(/Give priority to Lagos before wider market expansion\./g)).toHaveLength(1);
    expect(withPlaybook).toContain("reason across the release");
    expect(withPlaybook).toContain("carrying tracks");
    expect(itemInstructions).not.toContain("reason across the release");
    expect(itemInstructions).not.toContain("carrying tracks");
    expect(itemInstructions.match(/Give priority to Lagos before wider market expansion\./g)).toHaveLength(1);
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

  it.each([
    "position",
    "managementRole",
    "body",
    "decision",
    "avoid",
    "watch",
    "confidenceReason",
  ] as const)("rejects a whitespace-only %s", (field) => {
    expect(() => parseMusicManagerReadOutput({ ...validOutput, [field]: " \n\t " })).toThrow(
      new RegExp(field),
    );
  });

  it.each(["label", "value", "meaning"] as const)("rejects a whitespace-only signal %s", (field) => {
    const output = cloneValidOutput();
    output.signals[0][field] = " \n\t ";

    expect(() => parseMusicManagerReadOutput(output)).toThrow(new RegExp(`signals\\[0\\]\\.${field}`));
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
