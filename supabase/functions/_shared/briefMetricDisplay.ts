export type BriefMetricDisplayInput = {
  label: string;
  value: string;
  context?: string;
};

export function normalizeBriefMetricDisplay<T extends BriefMetricDisplayInput>(metric: T, groupTitle: string): T {
  const value = formatBriefMetricValue(metric.value);
  const normalizedLabel = formatBriefMetricValue(metric.label);
  const labelIsValue = comparableMetricText(normalizedLabel) === comparableMetricText(value);
  const label = isNumericMetricText(metric.label) || labelIsValue
    ? metricLabelFallback(metric.context, groupTitle, value)
    : metric.label.trim();

  return { ...metric, label, value };
}

export function formatBriefMetricValue(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^([#$]?)(-?[\d,]+(?:\.\d+)?)([KMB])?(%)?$/i);
  if (!match) return trimmed;

  const [, prefix, numericText, compactSuffix = "", percent = ""] = match;
  const parsed = Number(numericText.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return trimmed;

  const multiplier = compactSuffix.toUpperCase() === "B"
    ? 1_000_000_000
    : compactSuffix.toUpperCase() === "M"
      ? 1_000_000
      : compactSuffix.toUpperCase() === "K"
        ? 1_000
        : 1;
  const numericValue = parsed * multiplier;
  const absoluteValue = Math.abs(numericValue);
  const formatted = prefix !== "#" && !percent && absoluteValue >= 1_000_000_000
    ? `${formatCompactDecimal(numericValue / 1_000_000_000)}B`
    : prefix !== "#" && !percent && absoluteValue >= 1_000_000
      ? `${formatCompactDecimal(numericValue / 1_000_000)}M`
      : Math.round(numericValue).toLocaleString("en-US");

  return `${prefix}${formatted}${percent}`;
}

function formatCompactDecimal(value: number) {
  return Number(value.toFixed(1)).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function isNumericMetricText(value: string) {
  return formatBriefMetricValue(value) !== value.trim() || /^([#$]?)(-?[\d,]+(?:\.\d+)?)([KMB])?(%)?$/i.test(value.trim());
}

function metricLabelFallback(context: string | undefined, groupTitle: string, value: string) {
  const contextLabel = context?.trim();
  if (contextLabel && !isNumericMetricText(contextLabel) && comparableMetricText(contextLabel) !== comparableMetricText(value)) {
    return sentenceCase(contextLabel);
  }
  const groupLabel = groupTitle.trim();
  if (groupLabel && !isNumericMetricText(groupLabel) && comparableMetricText(groupLabel) !== comparableMetricText(value)) {
    return groupLabel;
  }
  return "Metric";
}

function sentenceCase(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function comparableMetricText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
