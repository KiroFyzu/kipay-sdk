export type TransactionMode = 'sandbox' | 'production';
export type TransactionStatus = 'pending' | 'paid' | 'expired';
export type FeeBearer = 'merchant' | 'buyer';
export type SimulateProvider = 'shopeepay' | 'gopay';

/** Shape returned by every /api/pay/{apiKey}/transactions* endpoint. Note
 * there's no `net_amount` here — that field only appears in the outgoing
 * webhook payload and the merchant dashboard, not this public API. */
export interface Transaction {
  trx_id: string;
  mode: TransactionMode;
  requested_amount: number;
  /** Random surcharge added to requested_amount so `amount` uniquely
   * identifies this transaction among concurrent pending ones. */
  unique_code: number;
  /** requested_amount + unique_code — the exact figure the payer must send. */
  amount: number;
  fee_amount: number;
  fee_bearer: FeeBearer;
  status: TransactionStatus;
  provider: string | null;
  note: string | null;
  matched_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface CreateTransactionParams {
  /** Rupiah, integer, 1 to 100,000,000. */
  amount: number;
  note?: string;
}

export interface SimulatePaymentParams {
  /** Sandbox-only. Defaults to 'shopeepay'. */
  provider?: SimulateProvider;
}

export interface KiPayClientOptions {
  /** Override the API origin — e.g. http://localhost:4000 for local/staging.
   * Defaults to https://api.kipay.id. */
  baseUrl?: string;
  /** Inject a custom fetch implementation (polyfill, instrumentation, proxy
   * agent). Defaults to the runtime's global fetch (Node.js 18+). */
  fetch?: typeof fetch;
}
