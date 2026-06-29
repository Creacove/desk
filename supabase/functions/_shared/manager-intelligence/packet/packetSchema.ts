type PacketLike = Record<string, unknown>;

export type PacketValidationResult = {
  valid: boolean;
  errors: string[];
};

const forbiddenVisiblePattern = /\b(openai|anthropic|chatgpt|model|provider|prompt|playbook|social contagion|no engine|playlist discovery)\b/i;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const isNonEmptyString = (value: unknown) => typeof value === "string" && value.trim().length > 0;

const hasForbiddenVisibleText = (value: unknown): boolean => {
  if (typeof value === "string") return forbiddenVisiblePattern.test(value);
  if (Array.isArray(value)) return value.some(hasForbiddenVisibleText);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
      if (key === "internal_only_json" || key === "internal_only") return false;
      return hasForbiddenVisibleText(child);
    });
  }
  return false;
};

export const validateManagerIntelligencePacket = (packet: PacketLike): PacketValidationResult => {
  const errors: string[] = [];
  const executiveRead = asRecord(packet.executive_read_json);
  const insights = asArray(packet.management_insights_json);
  const signals = asArray(packet.signal_map_json);
  const evidence = asArray(packet.supporting_evidence_json);

  if (!isNonEmptyString(executiveRead.priority)) errors.push("executive_read_json.priority is required");
  if (!isNonEmptyString(executiveRead.manager_read)) errors.push("executive_read_json.manager_read is required");
  if (!isNonEmptyString(executiveRead.confidence_level)) errors.push("executive_read_json.confidence_level is required");
  if (!isNonEmptyString(executiveRead.confidence_reason)) errors.push("executive_read_json.confidence_reason is required");

  if (signals.length === 0) {
    errors.push("signal_map_json must not be empty");
  }
  if (evidence.length === 0) {
    errors.push("supporting_evidence_json must not be empty");
  }

  insights.forEach((insightValue, index) => {
    const insight = asRecord(insightValue);
    if (!isNonEmptyString(insight.avoid)) {
      errors.push(`management_insights_json[${index}].avoid is required`);
    }
    if (!Array.isArray(insight.evidence_ids) || insight.evidence_ids.length === 0) {
      errors.push(`management_insights_json[${index}].evidence_ids must not be empty`);
    }
    if (!isNonEmptyString(insight.confidence_level)) {
      errors.push(`management_insights_json[${index}].confidence_level is required`);
    }
  });

  if (insights.length === 0) {
    errors.push("management_insights_json must not be empty");
  }

  if (hasForbiddenVisibleText(packet)) {
    errors.push("visible packet fields must not expose provider, prompt, or playbook language");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
