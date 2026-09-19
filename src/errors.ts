/** Thrown for every non-2xx response from the KiPay API. `status` is the
 * HTTP status code; `body` is the parsed JSON error body when the response
 * was valid JSON (usually `{ error: string }`), or the raw response text
 * otherwise. */
export class KiPayError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'KiPayError';
    this.status = status;
    this.body = body;
  }
}
