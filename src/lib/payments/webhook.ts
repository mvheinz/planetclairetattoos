import 'server-only'

import { createHash } from 'node:crypto'

import type { Payload } from 'payload'

import { createLogger } from '@/lib/monitoring/logger'

import { getPaymentsAdapter } from './index'
import { processPaymentEvent } from './processPaymentEvent'
import { InvalidSignatureError, PaymentEventShapeError, type PaymentsAdapter } from './types'

// `POST /api/stripe/webhook` (ARCHITEKTUR §2.5, DATENMODELL §8.8): Rohkörper → Signatur des aktiven Treibers
// (Stripe: `stripe-signature`, Mock: HMAC `x-pc-mock-signature`) → `processPaymentEvent`. Der Körper wird nie
// geloggt oder gespeichert (nur sein SHA-256).

const log = createLogger()

export interface WebhookDeps {
  payload?: Payload
  payments?: PaymentsAdapter
  now?: Date
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export async function handleWebhookRequest(
  rawBody: string,
  headers: Headers,
  deps: WebhookDeps = {},
): Promise<Response> {
  const payments = deps.payments ?? getPaymentsAdapter()
  let event
  try {
    event = payments.parseWebhook(rawBody, headers)
  } catch (err) {
    if (err instanceof InvalidSignatureError) {
      log.warn('payments.webhook_signature_invalid', { driver: payments.driver })
      return json(400, { error: 'invalid_signature' })
    }
    if (err instanceof PaymentEventShapeError) {
      log.error('payments.webhook_shape_invalid', { error: err.message })
      return json(400, { error: 'invalid_event' })
    }
    log.error('payments.webhook_parse_failed', { error: (err as Error)?.message })
    return json(500, { error: 'webhook_unavailable' })
  }
  try {
    const result = await processPaymentEvent(event, {
      payload: deps.payload,
      payments,
      now: deps.now,
      payloadSha256: createHash('sha256').update(rawBody).digest('hex'),
    })
    return json(200, { received: true, status: result.status })
  } catch {
    return json(500, { error: 'processing_failed' })
  }
}
