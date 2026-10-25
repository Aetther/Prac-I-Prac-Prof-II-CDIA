export type ApiErrorKind = "network" | "timeout" | "http" | "validation";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  detail?: string;
  retryAfterSeconds?: number;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: {
      status?: number;
      detail?: string;
      retryAfterSeconds?: number;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.detail = options.detail;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
