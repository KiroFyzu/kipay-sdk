# kipay

[![npm version](https://img.shields.io/npm/v/kipay.svg)](https://www.npmjs.com/package/kipay)
[![CI](https://github.com/KiroFyzu/kipay-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/KiroFyzu/kipay-sdk/actions/workflows/ci.yml)

Official Node.js SDK for the [KiPay](https://kipay.id) QRIS payment gateway API. Thin, typed wrapper around the four public checkout endpoints documented at [kipay.id/docs](https://kipay.id/docs) — no magic, no hidden retries.

## Install

```bash
npm install kipay
```

Requires Node.js 18+ (uses the runtime's global `fetch`).

## Quickstart

```ts
import { KiPay } from 'kipay';

const kipay = new KiPay(process.env.KIPAY_API_KEY!);

// 1. Create a transaction
const trx = await kipay.createTransaction({ amount: 25000, note: 'INV-2048' });
console.log(trx.trx_id, trx.amount); // amount includes the unique code surcharge

// 2. Show the QR code (either just link to it, or fetch the bytes)
const qrUrl = kipay.getQrCodeUrl(trx.trx_id);
// or: const png = await kipay.getQrCodePng(trx.trx_id);

// 3. Verify status from your backend before fulfilling the order
const current = await kipay.getTransaction(trx.trx_id);
if (current.status === 'paid') {
  // fulfill the order — use trx_id as your idempotency key
}
```

`apiKey` is a project's **API Key** (from `/dashboard/projects`), not a secret credential — but requests should still be made server-to-server so transaction data isn't exposed straight to the browser.

## API

### `new KiPay(apiKey, options?)`

- `apiKey: string` — required, your project's API Key.
- `options.baseUrl?: string` — override the API origin, e.g. `http://localhost:4000` for local development against a self-hosted gateway. Defaults to `https://api.kipay.id`.
- `options.fetch?: typeof fetch` — inject a custom fetch implementation (polyfill, instrumentation, proxy agent). Defaults to the global `fetch`.
- `options.timeout?: number` — per-request timeout in milliseconds. Defaults to `30000`. A request that exceeds it rejects with a `TimeoutError` (`error.name === 'TimeoutError'`), not a `KiPayError`.

### `kipay.createTransaction({ amount, note? })`

`POST /api/pay/{apiKey}/transactions`. `amount` is an integer in Rupiah. Returns a `Transaction`.

### `kipay.getTransaction(trxId)`

`GET /api/pay/{apiKey}/transactions/{trxId}`. The source of truth for payment status — always re-check here from your backend before fulfilling an order; don't trust a webhook payload or client-side poll on its own. Returns a `Transaction`.

### `kipay.simulatePayment(trxId, { provider? })`

`POST /api/pay/{apiKey}/transactions/{trxId}/simulate`. **Sandbox projects only** — marks a pending transaction as paid for integration testing, without a real payment. `provider` is `'shopeepay'` (default) or `'gopay'`. Rejected on production projects.

### `kipay.getQrCodeUrl(trxId)`

Builds the `image/png` QR code URL for a transaction — no request made, just a string, ready to drop into an `<img src>`.

### `kipay.getQrCodePng(trxId)`

`GET /api/pay/{apiKey}/transactions/{trxId}/qr.png`. Fetches the QR code bytes directly (`Uint8Array`) — useful for saving to a file or attaching to an email.

### `Transaction`

```ts
interface Transaction {
  trx_id: string;
  mode: 'sandbox' | 'production';
  requested_amount: number;
  unique_code: number;
  amount: number; // requested_amount + unique_code — the exact figure the payer must send
  fee_amount: number;
  fee_bearer: 'merchant' | 'buyer';
  status: 'pending' | 'paid' | 'expired';
  provider: string | null;
  note: string | null;
  matched_at: string | null;
  created_at: string;
  expires_at: string | null;
}
```

### Errors

Every failed request throws `KiPayError` (extends `Error`):

```ts
import { KiPay, KiPayError } from 'kipay';

try {
  await kipay.getTransaction('does-not-exist');
} catch (error) {
  if (error instanceof KiPayError) {
    console.error(error.status, error.message); // e.g. 404 "Transaksi tidak ditemukan."
  }
}
```

## Webhooks

This SDK does not include webhook signature verification — as of this API's current contract, the signature header and retry schedule for outgoing webhooks aren't part of the documented public interface yet (see the "Terima webhook" guide at [kipay.id/docs](https://kipay.id/docs)). Don't build your own assumptions about that header on top of this package. Instead, treat an incoming webhook as a hint to re-check, not a source of truth:

```ts
app.post('/webhooks/kipay', express.json(), async (req, res) => {
  res.status(200).send('ok'); // ack fast, verify async

  const { transaction } = req.body;
  const current = await kipay.getTransaction(transaction.trx_id);
  if (current.status === 'paid') {
    // fulfill the order — idempotent on trx_id
  }
});
```

## License

MIT
