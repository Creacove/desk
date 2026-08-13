import {
  ReleaseScheduleChange,
  ReleaseSchedulePreview,
  ReleaseSchedulePreviewInput,
  ReleaseSchedulePreserved,
  ReleaseTaskScheduleBindingInput,
} from "./types.ts";

const UTC_DAY_MS = 86_400_000;

export function applyReleaseOffset(isoDate: string, offsetDays: number) {
  const date = parseIsoDate(isoDate);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return formatIsoDate(date);
}

export function previewScheduleChange(input: ReleaseSchedulePreviewInput): ReleaseSchedulePreview {
  const changes: ReleaseScheduleChange[] = [];
  const preserved: ReleaseSchedulePreserved[] = [];

  for (const binding of [...input.bindings].sort((left, right) => left.taskId.localeCompare(right.taskId))) {
    const reason = preservationReason(binding);
    if (reason) {
      preserved.push({
        taskId: binding.taskId,
        title: binding.title,
        deadline: binding.deadline ?? null,
        reason,
      });
      continue;
    }
    changes.push({
      taskId: binding.taskId,
      title: binding.title,
      from: binding.deadline ?? null,
      to: applyReleaseOffset(input.proposedReleaseDate, binding.offsetDays),
      offsetDays: binding.offsetDays,
    });
  }

  return {
    fromDate: input.currentReleaseDate ?? null,
    proposedDate: input.proposedReleaseDate,
    expectedRevision: input.expectedRevision,
    changes: changes.sort((left, right) => left.to.localeCompare(right.to) || left.taskId.localeCompare(right.taskId)),
    preserved: preserved.sort((left, right) => left.taskId.localeCompare(right.taskId)),
  };
}

export async function hashSchedulePreview(preview: ReleaseSchedulePreview) {
  const canonical = canonicalize({
    fromDate: preview.fromDate,
    proposedDate: preview.proposedDate,
    expectedRevision: preview.expectedRevision,
    changes: preview.changes,
    preserved: preview.preserved,
  });
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return fallbackPreviewHash(canonical);
}

export async function createSchedulePreview(input: ReleaseSchedulePreviewInput) {
  const preview = previewScheduleChange(input);
  return { ...preview, previewHash: await hashSchedulePreview(preview) };
}

function preservationReason(binding: ReleaseTaskScheduleBindingInput): ReleaseSchedulePreserved["reason"] | null {
  if (binding.active === false) return "inactive";
  if (binding.scheduleMode === "fixed") return "fixed";
  if (binding.scheduleMode === "manual") return "manual";
  if (binding.taskStatus === "completed") return "completed";
  if (binding.taskStatus === "archived") return "archived";
  if (binding.scheduleMode !== "release_bound") return "unbound";
  return null;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function fallbackPreviewHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const mask = 0xffffffffffffffffn;
  const prime = 0x100000001b3n;
  const seeds = [0xcbf29ce484222325n, 0x84222325cbf29ce4n, 0x9e3779b185ebca87n, 0xd6e8feb86659fd93n];
  return seeds.map((seed) => {
    let hash = seed;
    for (const byte of bytes) {
      hash ^= BigInt(byte);
      hash = (hash * prime) & mask;
    }
    return hash.toString(16).padStart(16, "0");
  }).join("");
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid ISO date: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return date;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function daysBetweenReleaseDates(from: string, to: string) {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / UTC_DAY_MS);
}
