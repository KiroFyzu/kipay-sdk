import { KiPayError } from './errors.js';
import type {
  CreateTransactionParams,
  KiPayClientOptions,
  SimulatePaymentParams,
  Transaction,
} from './types.js';

export { KiPayError } from './errors.js';
export type {
  CreateTransactionParams,
  FeeBearer,
  KiPayClientOptions,
  SimulateProvider,
  SimulatePaymentParams,
  Transaction,
  TransactionMode,
  TransactionStatus,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.kipay.id';

/**
 * Client for KiPay's public checkout API (https://kipay.id/docs).
 *
 * `apiKey` is a project's API Key (from /dashboard/projects) — a public
 * identifier, not a secret credential, but requests should still be made
 * server-to-server so response data isn't exposed straight to the browser.
 *
 * @example
 * ```ts
 * const kipay = new KiPay(process.env.KIPAY_API_KEY!);
 * const trx = await kipay.createTransaction({ amount: 25000, note: 'INV-2048' });
 * const status = await kipay.getTransaction(trx.trx_id);
 * ```
 */
export class KiPay {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, options: KiPayClientOptions = {}) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new TypeError('KiPay: apiKey wajib diisi (API Key project — lihat /dashboard/projects).');
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new TypeError('KiPay: tidak ada fetch implementation tersedia. Pakai Node.js 18+, atau kirim options.fetch.');
    }
    this.fetchImpl = fetchImpl;
  }

  /** POST /api/pay/{apiKey}/transactions — buat transaksi QRIS baru. */
  async createTransaction(params: CreateTransactionParams): Promise<Transaction> {
    return this.request<Transaction>('POST', '/transactions', {
      amount: params.amount,
      note: params.note,
    });
  }

  /** GET /api/pay/{apiKey}/transactions/{trxId} — baca status transaksi.
   * Ini adalah sumber kebenaran untuk status pembayaran — selalu cek ulang
   * lewat method ini sebelum memenuhi order, jangan percaya webhook payload
   * begitu saja (lihat panduan "Terima webhook" di /docs). */
  async getTransaction(trxId: string): Promise<Transaction> {
    return this.request<Transaction>('GET', `/transactions/${encodeURIComponent(trxId)}`);
  }

  /** POST /api/pay/{apiKey}/transactions/{trxId}/simulate — sandbox only.
   * Menandai transaksi sandbox sebagai paid, untuk pengujian integrasi
   * tanpa pembayaran sungguhan. Ditolak oleh project mode production. */
  async simulatePayment(trxId: string, params: SimulatePaymentParams = {}): Promise<Transaction> {
    return this.request<Transaction>('POST', `/transactions/${encodeURIComponent(trxId)}/simulate`, {
      provider: params.provider ?? 'shopeepay',
    });
  }

  /** URL gambar QR untuk transaksi ini (image/png) — tidak melakukan
   * request, cukup untuk dipakai langsung sebagai `src` gambar. */
  getQrCodeUrl(trxId: string): string {
    return `${this.baseUrl}/api/pay/${encodeURIComponent(this.apiKey)}/transactions/${encodeURIComponent(trxId)}/qr.png`;
  }

  /** GET /api/pay/{apiKey}/transactions/{trxId}/qr.png — ambil bytes PNG
   * QR code-nya langsung, mis. untuk disimpan ke file atau dilampirkan ke email. */
  async getQrCodePng(trxId: string): Promise<Uint8Array> {
    const url = this.getQrCodeUrl(trxId);
    const response = await this.fetchImpl(url);
    if (!response.ok) {
      throw new KiPayError(`Gagal mengambil QR code (HTTP ${response.status}).`, response.status);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  private async request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/api/pay/${encodeURIComponent(this.apiKey)}${path}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new KiPayError(`Response tidak valid dari KiPay (HTTP ${response.status}).`, response.status, text);
    }

    if (!response.ok) {
      const message = (json as { error?: string } | null)?.error || `KiPay API error (HTTP ${response.status}).`;
      throw new KiPayError(message, response.status, json);
    }
    return json as T;
  }
}

export default KiPay;
