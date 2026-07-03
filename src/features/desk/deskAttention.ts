import type { AttentionItem, MovementItem } from "../../types/cleanProduction";

const MOVEMENT_PREVIEW_LIMIT = 90;

export function isSourceContextAttention(item: AttentionItem) {
  const text = `${item.title} ${item.body}`.toLowerCase();
  return (
    text.includes("private analytics") ||
    text.includes("public catalog") ||
    text.includes("source-of-stream") ||
    text.includes("conversion remain unavailable")
  );
}

export function splitAttentionItems(attention: AttentionItem[]) {
  return {
    actionable: attention.filter((item) => !isSourceContextAttention(item)),
    sourceContext: attention.filter(isSourceContextAttention),
  };
}

export function compactMovementTitle(title: string) {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (normalized.length <= MOVEMENT_PREVIEW_LIMIT) return normalized;
  return `${normalized.slice(0, MOVEMENT_PREVIEW_LIMIT - 3).trimEnd()}...`;
}

export function movementKey(item: MovementItem, index: number) {
  return `${item.label}-${item.title}-${item.time}-${index}`;
}
