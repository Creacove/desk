export type MusicManagerReadFailureKind =
  | "configuration"
  | "database"
  | "invalid_output"
  | "openai_http"
  | "openai_response"
  | "workflow";

export type PublicMusicManagerReadFailure = {
  code: string;
  message: string;
};

export class MusicManagerReadFailure extends Error {
  readonly kind: MusicManagerReadFailureKind;
  readonly providerStatus?: number;
  readonly diagnostic?: string;

  constructor(
    kind: MusicManagerReadFailureKind,
    options: { providerStatus?: number; diagnostic?: string; cause?: unknown } = {},
  ) {
    super(`Music Manager Read failure: ${kind}`, { cause: options.cause });
    this.name = "MusicManagerReadFailure";
    this.kind = kind;
    this.providerStatus = options.providerStatus;
    this.diagnostic = options.diagnostic;
  }
}

export function publicMusicManagerReadFailure(
  kind: MusicManagerReadFailureKind,
  providerStatus?: number,
): PublicMusicManagerReadFailure {
  if (kind === "openai_http" && (providerStatus === 429 || (providerStatus !== undefined && providerStatus >= 500))) {
    return {
      code: "manager_read_temporarily_unavailable",
      message: "Manager Read is temporarily unavailable. Try again shortly.",
    };
  }
  if (kind === "invalid_output") {
    return {
      code: "manager_read_invalid_response",
      message: "Manager Read could not produce a reliable result. Try again.",
    };
  }
  if (kind === "openai_http" || kind === "openai_response") {
    return {
      code: "manager_read_request_failed",
      message: "Manager Read could not be completed. Try again.",
    };
  }
  return {
    code: "manager_read_failed",
    message: "Manager Read could not be completed. Try again.",
  };
}

export function toPublicMusicManagerReadFailure(error: unknown): PublicMusicManagerReadFailure {
  if (error instanceof MusicManagerReadFailure) {
    return publicMusicManagerReadFailure(error.kind, error.providerStatus);
  }
  return publicMusicManagerReadFailure("workflow");
}

export function logMusicManagerReadDiagnostic(
  label: string,
  error: unknown,
  metadata: Record<string, unknown> = {},
): void {
  const diagnostic = error instanceof MusicManagerReadFailure
    ? {
        kind: error.kind,
        providerStatus: error.providerStatus,
        diagnostic: boundedDiagnostic(error.diagnostic),
      }
    : { kind: "unknown", diagnostic: boundedDiagnostic(readErrorName(error)) };
  console.error(label, { ...metadata, ...diagnostic });
}

function boundedDiagnostic(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 160);
}

function readErrorName(error: unknown): string | undefined {
  if (error instanceof Error) return error.name;
  return typeof error === "object" && error !== null ? "non_error_object" : typeof error;
}
