export class HttpError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, message: string, code = 'BAD_REQUEST', details?: unknown) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}
export function assert(condition: unknown, status: number, message: string, code?: string, details?:unknown): asserts condition {
  if (!condition) throw new HttpError(status, message, code,details);
}
