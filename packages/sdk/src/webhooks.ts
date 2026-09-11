import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebhookPayload { webhookTimestamp: number; action?: string; type?: string; data?: unknown; [key: string]: unknown }
export class WebhookVerificationError extends Error { readonly name = 'WebhookVerificationError'; }
/** Verify the exact request bytes before interpreting or processing an event. */
export function verifyWebhook<T extends WebhookPayload = WebhookPayload>(input: {
  body: string | Uint8Array;
  signature: string | null | undefined;
  secret: string;
  toleranceMs?: number;
  now?: number;
}): T {
  const { body, signature, secret } = input;
  if (!secret) throw new WebhookVerificationError('Webhook secret is required');
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) throw new WebhookVerificationError('Invalid webhook signature');
  const expected = createHmac('sha256', secret).update(body).digest();
  const actual = Buffer.from(signature, 'hex');
  if (!timingSafeEqual(expected, actual)) throw new WebhookVerificationError('Webhook signature does not match');
  let payload: T;
  try { payload = JSON.parse(typeof body === 'string' ? body : Buffer.from(body).toString('utf8')); }
  catch { throw new WebhookVerificationError('Webhook body is not valid JSON'); }
  const now = input.now ?? Date.now(); const tolerance = input.toleranceMs ?? 300_000;
  if (!Number.isFinite(now) || !Number.isFinite(tolerance) || tolerance < 0) throw new WebhookVerificationError('Invalid timestamp verification options');
  if (!payload || typeof payload.webhookTimestamp !== 'number' || !Number.isFinite(payload.webhookTimestamp) || Math.abs(now - payload.webhookTimestamp) > tolerance) throw new WebhookVerificationError('Webhook timestamp is missing or outside the allowed tolerance');
  return payload;
}
