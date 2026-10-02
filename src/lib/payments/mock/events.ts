import 'server-only'

import { stripeEventTemplate, type StripeEventFixture } from '../fixtures'
import type { StripeEventType } from '../normalize'

import type { MockDispute, MockPaymentMethod, MockRefund, MockSession } from './state'

// Mock-Ereignisse aus den Stripe-Fixtures mit ersetzten Werten (ARCHITEKTUR §3.5): Hülle (ID, Zeit, livemode = false)
// und das Objekt der Session, Zahlung, Erstattung bzw. Anfechtung. Personendaten aus den Vorlagen werden geleert
// (Datensparsamkeit); die `return_url` fehlt, weil der Kassen-Token nirgends gespeichert wird.

export interface MockEventContext {
  eventId: string
  created: Date
  checkoutRef: string
  appEnv: string
  session: MockSession
  /** Summe der nicht gescheiterten Erstattungen (für `charge.refunded`). */
  refundedCents?: number
  previousRefundedCents?: number
  refund?: MockRefund
  previousRefundStatus?: string
  dispute?: MockDispute
  previousDisputeStatus?: string
}

const unix = (d: Date | string) => Math.floor(new Date(d).getTime() / 1000)
/** Gemeinsamer Suffix der abgeleiteten IDs einer Session (`cs_mock_<uuid>` → `<uuid>`). */
const suffixOf = (id: string) => id.replace(/^[a-z]+_mock_/, '')

const NO_PERSON = {
  address: null,
  email: null,
  name: null,
  phone: null,
  tax_id: null,
}

function paymentMethodDetails(
  template: Record<string, unknown> | undefined,
  method: MockPaymentMethod,
): Record<string, unknown> {
  if (method.type === 'paypal') {
    return {
      paypal: {
        country: 'DE',
        payer_email: null,
        payer_id: null,
        payer_name: null,
        seller_protection: { dispute_categories: null, status: 'eligible' },
        transaction_id: null,
      },
      type: 'paypal',
    }
  }
  const card = (template?.card as Record<string, unknown> | undefined) ?? {}
  return {
    card: { ...card, wallet: method.wallet ? { [method.wallet]: {}, type: method.wallet } : null },
    type: 'card',
  }
}

function sessionObject(o: Record<string, unknown>, ctx: MockEventContext): void {
  const s = ctx.session
  const rate = `shr_mock_${suffixOf(s.sessionId)}`
  Object.assign(o, {
    id: s.sessionId,
    amount_subtotal: s.amountSubtotalCents,
    amount_total: s.amountTotalCents,
    client_reference_id: ctx.checkoutRef,
    client_secret: null,
    collected_information: null,
    created: unix(s.createdAt),
    customer_details: null,
    customer_email: null,
    expires_at: unix(s.expiresAt),
    livemode: false,
    locale: s.locale,
    metadata: { appEnv: ctx.appEnv, checkoutRef: ctx.checkoutRef },
    payment_intent: s.paymentIntentId ?? null,
    payment_status: s.paymentStatus,
    shipping_cost: {
      amount_subtotal: s.shippingCents,
      amount_tax: 0,
      amount_total: s.shippingCents,
      shipping_rate: rate,
    },
    shipping_options: [{ shipping_amount: s.shippingCents, shipping_rate: rate }],
    status: s.status,
    total_details: { amount_discount: 0, amount_shipping: s.shippingCents, amount_tax: 0 },
  })
  delete o.return_url
}

function chargeObject(o: Record<string, unknown>, ctx: MockEventContext): void {
  const s = ctx.session
  const refunded = ctx.refundedCents ?? 0
  Object.assign(o, {
    id: s.chargeId,
    amount: s.amountTotalCents,
    amount_captured: s.amountTotalCents,
    amount_refunded: refunded,
    balance_transaction: `txn_mock_${suffixOf(s.chargeId ?? '')}`,
    billing_details: NO_PERSON,
    created: unix(s.completedAt ?? s.createdAt),
    livemode: false,
    metadata: {},
    payment_intent: s.paymentIntentId,
    payment_method: `pm_mock_${suffixOf(s.paymentIntentId ?? '')}`,
    payment_method_details: paymentMethodDetails(
      o.payment_method_details as Record<string, unknown> | undefined,
      s.paymentMethod ?? { type: 'card' },
    ),
    receipt_url: null,
    refunded: refunded >= s.amountTotalCents,
  })
}

function refundObject(o: Record<string, unknown>, ctx: MockEventContext): void {
  const r = ctx.refund
  if (!r) throw new Error('Mock: Erstattung fehlt für das Ereignis.')
  const method = ctx.session.paymentMethod ?? { type: 'card' }
  Object.assign(o, {
    id: r.refundId,
    amount: r.amountCents,
    balance_transaction: `txn_mock_${suffixOf(r.refundId)}`,
    charge: r.chargeId,
    created: unix(r.createdAt),
    payment_intent: r.paymentIntentId,
    payment_method: `pm_mock_${suffixOf(r.paymentIntentId)}`,
    reason: 'requested_by_customer',
    status: r.status,
  })
  if (method.type === 'paypal') {
    o.destination_details = { paypal: {}, type: 'paypal' }
  }
  if (r.status === 'failed') {
    o.failure_balance_transaction = `txn_mock_failure_${suffixOf(r.refundId)}`
    o.failure_reason = 'expired_or_canceled_card'
  } else {
    delete o.failure_balance_transaction
    delete o.failure_reason
  }
}

function disputeObject(o: Record<string, unknown>, ctx: MockEventContext): void {
  const d = ctx.dispute
  if (!d) throw new Error('Mock: Anfechtung fehlt für das Ereignis.')
  const evidence = (o.evidence_details as Record<string, unknown> | undefined) ?? {}
  Object.assign(o, {
    id: d.disputeId,
    amount: d.amountCents,
    charge: d.chargeId,
    created: unix(d.createdAt),
    evidence_details: { ...evidence, due_by: unix(d.createdAt) + 21 * 86_400 },
    livemode: false,
    payment_intent: d.paymentIntentId,
    status: d.status,
  })
}

/** Stripe-förmiger Ereigniskörper aus der Fixture `type` mit den Werten des Mock-Zustands. */
export function buildMockEventBody(
  type: StripeEventType,
  ctx: MockEventContext,
): StripeEventFixture {
  const body = stripeEventTemplate(type)
  const object = body.data.object
  let previous: Record<string, unknown> | undefined
  switch (type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired':
      sessionObject(object, ctx)
      break
    case 'charge.refunded':
      chargeObject(object, ctx)
      previous = { amount_refunded: ctx.previousRefundedCents ?? 0 }
      break
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed':
      refundObject(object, ctx)
      if (type !== 'refund.created' && ctx.previousRefundStatus) {
        previous = { status: ctx.previousRefundStatus }
      }
      break
    case 'charge.dispute.created':
    case 'charge.dispute.closed':
      disputeObject(object, ctx)
      if (type === 'charge.dispute.closed' && ctx.previousDisputeStatus) {
        previous = { status: ctx.previousDisputeStatus }
      }
      break
  }
  body.data = previous ? { object, previous_attributes: previous } : { object }
  body.id = ctx.eventId
  body.created = unix(ctx.created)
  body.livemode = false
  body.request = { id: null, idempotency_key: null }
  return body
}
