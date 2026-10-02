import 'server-only'

import balanceTransactions from '../../../tests/fixtures/stripe/balance_transactions.json'
import chargeDisputeClosed from '../../../tests/fixtures/stripe/charge.dispute.closed.json'
import chargeDisputeCreated from '../../../tests/fixtures/stripe/charge.dispute.created.json'
import chargeRefunded from '../../../tests/fixtures/stripe/charge.refunded.json'
import asyncFailed from '../../../tests/fixtures/stripe/checkout.session.async_payment_failed.json'
import asyncSucceeded from '../../../tests/fixtures/stripe/checkout.session.async_payment_succeeded.json'
import sessionCompleted from '../../../tests/fixtures/stripe/checkout.session.completed.json'
import sessionExpired from '../../../tests/fixtures/stripe/checkout.session.expired.json'
import refundCreated from '../../../tests/fixtures/stripe/refund.created.json'
import refundFailed from '../../../tests/fixtures/stripe/refund.failed.json'
import refundUpdated from '../../../tests/fixtures/stripe/refund.updated.json'

import type { StripeEventType } from './normalize'

// Stripe-Fixtures (tests/fixtures/stripe/*.json, erzeugt/geprüft mit `pnpm stripe:fixture`) als Vorlagen für den
// Mock-Treiber: Ereignisse werden mit ersetzten Werten erzeugt und wie beim Stripe-Treiber normalisiert (ARCHITEKTUR
// §3.5). Statisch importiert, damit sie im Build enthalten sind; der Mock ist in Produktion verboten.

export interface StripeEventFixture {
  id: string
  object: 'event'
  api_version: string
  created: number
  livemode: boolean
  type: StripeEventType
  data: { object: Record<string, unknown>; previous_attributes?: Record<string, unknown> }
  [key: string]: unknown
}

export interface BalanceTransactionFixture {
  id: string
  object: 'balance_transaction'
  amount: number
  available_on: number
  created: number
  fee: number
  net: number
  source: string
  type: string
  [key: string]: unknown
}

const asEvent = (json: unknown) => json as StripeEventFixture

export const STRIPE_EVENT_FIXTURES: Readonly<Record<StripeEventType, StripeEventFixture>> = {
  'checkout.session.completed': asEvent(sessionCompleted),
  'checkout.session.async_payment_succeeded': asEvent(asyncSucceeded),
  'checkout.session.async_payment_failed': asEvent(asyncFailed),
  'checkout.session.expired': asEvent(sessionExpired),
  'charge.refunded': asEvent(chargeRefunded),
  'refund.created': asEvent(refundCreated),
  'refund.updated': asEvent(refundUpdated),
  'refund.failed': asEvent(refundFailed),
  'charge.dispute.created': asEvent(chargeDisputeCreated),
  'charge.dispute.closed': asEvent(chargeDisputeClosed),
}

export const BALANCE_TRANSACTIONS_FIXTURE: readonly BalanceTransactionFixture[] = (
  balanceTransactions as unknown as { data: BalanceTransactionFixture[] }
).data

/** Tiefe Kopie einer Ereignis-Vorlage (Vorlagen bleiben unverändert). */
export function stripeEventTemplate(type: StripeEventType): StripeEventFixture {
  return structuredClone(STRIPE_EVENT_FIXTURES[type])
}
