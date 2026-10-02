import {
  normalizeStripeEvent,
  STRIPE_EVENT_NAMES,
  STRIPE_EVENT_TYPES,
  type StripeEventType,
} from '../../src/lib/payments/normalize'
import { STRIPE_API_VERSION } from '../../src/lib/payments/stripe/config'

// Stripe-Fixtures (ARCHITEKTUR §3.5, §7.2; PLAN P4.4): zehn Webhook-Ereignisse und eine Liste von Balance
// Transactions in der Form der gepinnten API-Version – bereinigt: keine echten IDs (jede ID enthält „fixture“), keine
// Schlüssel, keine echten Personendaten (nur example.com), Kassen-Referenz = Platzhalter-UUID. `pnpm stripe:fixture`
// erzeugt fehlende Dateien aus den Vorlagen unten und prüft vorhandene (auch aufgezeichnete und bereinigte).

export const FIXTURE_DIR = 'tests/fixtures/stripe'
export const BALANCE_FIXTURE = 'balance_transactions'
export type FixtureName = StripeEventType | typeof BALANCE_FIXTURE
export const FIXTURE_NAMES: FixtureName[] = [...STRIPE_EVENT_NAMES, BALANCE_FIXTURE]
/** Kassen-Referenz in allen Fixtures (der Mock ersetzt sie durch die echte `checkoutRef`). */
export const FIXTURE_REF = '00000000-0000-4000-8000-000000000000'

export function isFixtureName(name: string): name is FixtureName {
  return (FIXTURE_NAMES as string[]).includes(name)
}

const T0 = Date.parse('2026-10-15T08:00:00.000Z') / 1000
const MIN = 60
const DAY = 86_400

const ID = {
  session: 'cs_test_fixture_session_0001',
  paymentIntent: 'pi_fixture_0001',
  charge: 'ch_fixture_0001',
  paymentMethod: 'pm_fixture_0001',
  shippingRate: 'shr_fixture_0001',
  refund: 're_fixture_0001',
  dispute: 'du_fixture_0001',
  txnCharge: 'txn_fixture_0001',
  txnRefund: 'txn_fixture_0002',
  txnRefundFailure: 'txn_fixture_0003',
  txnPayout: 'txn_fixture_0004',
  payout: 'po_fixture_0001',
} as const

const SUBTOTAL = 7300
const SHIPPING = 690
const TOTAL = SUBTOTAL + SHIPPING
const PARTIAL_REFUND = 4500

const ADDRESS = {
  city: 'Berlin',
  country: 'DE',
  line1: 'Beispielstraße 1',
  line2: null,
  postal_code: '10115',
  state: null,
}

type Json = Record<string, unknown>

function envelope(type: StripeEventType, created: number, object: Json, previous?: Json): Json {
  return {
    id: `evt_fixture_${type.replaceAll('.', '_')}`,
    object: 'event',
    api_version: STRIPE_API_VERSION,
    created,
    data: { object, ...(previous ? { previous_attributes: previous } : {}) },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
  }
}

function checkoutSession(
  status: 'open' | 'complete' | 'expired',
  paymentStatus: 'paid' | 'unpaid',
): Json {
  const complete = status === 'complete'
  return {
    id: ID.session,
    object: 'checkout.session',
    adaptive_pricing: null,
    after_expiration: null,
    allow_promotion_codes: null,
    amount_subtotal: SUBTOTAL,
    amount_total: TOTAL,
    automatic_tax: { enabled: false, liability: null, provider: null, status: null },
    billing_address_collection: null,
    cancel_url: null,
    client_reference_id: FIXTURE_REF,
    client_secret: null,
    collected_information: complete
      ? {
          business_name: null,
          individual_name: null,
          shipping_details: { address: ADDRESS, name: 'Test Kundin' },
        }
      : null,
    consent: null,
    consent_collection: null,
    created: T0,
    currency: 'eur',
    currency_conversion: null,
    custom_fields: [],
    custom_text: {
      after_submit: null,
      shipping_address: null,
      submit: null,
      terms_of_service_acceptance: null,
    },
    customer: null,
    customer_account: null,
    customer_creation: 'if_required',
    customer_details: complete
      ? {
          address: ADDRESS,
          business_name: null,
          email: 'kundin@example.com',
          individual_name: null,
          name: 'Test Kundin',
          phone: null,
          tax_exempt: 'none',
          tax_ids: [],
        }
      : null,
    customer_email: null,
    discounts: [],
    expires_at: T0 + 31 * MIN,
    integration_identifier: null,
    invoice: null,
    invoice_creation: null,
    livemode: false,
    locale: 'de',
    managed_payments: null,
    metadata: { appEnv: 'test', checkoutRef: FIXTURE_REF },
    mode: 'payment',
    origin_context: null,
    payment_intent: complete ? ID.paymentIntent : null,
    payment_link: null,
    payment_method_collection: 'if_required',
    payment_method_configuration_details: null,
    payment_method_options: { card: { request_three_d_secure: 'automatic' } },
    payment_method_types: ['card', 'paypal'],
    payment_status: paymentStatus,
    permissions: null,
    recovered_from: null,
    redirect_on_completion: 'always',
    return_url: 'http://localhost:3000/de/danke/fixture-token',
    saved_payment_method_options: null,
    setup_intent: null,
    shipping_address_collection: null,
    shipping_cost: {
      amount_subtotal: SHIPPING,
      amount_tax: 0,
      amount_total: SHIPPING,
      shipping_rate: ID.shippingRate,
    },
    shipping_options: [{ shipping_amount: SHIPPING, shipping_rate: ID.shippingRate }],
    status,
    submit_type: null,
    subscription: null,
    success_url: null,
    total_details: { amount_discount: 0, amount_shipping: SHIPPING, amount_tax: 0 },
    ui_mode: 'elements',
    url: null,
    wallet_options: null,
  }
}

function charge(amountRefunded: number): Json {
  return {
    id: ID.charge,
    object: 'charge',
    amount: TOTAL,
    amount_captured: TOTAL,
    amount_refunded: amountRefunded,
    application: null,
    application_fee: null,
    application_fee_amount: null,
    balance_transaction: ID.txnCharge,
    billing_details: {
      address: ADDRESS,
      email: 'kundin@example.com',
      name: 'Test Kundin',
      phone: null,
      tax_id: null,
    },
    calculated_statement_descriptor: 'PLANETCLAIRE',
    captured: true,
    created: T0 + 5 * MIN,
    currency: 'eur',
    customer: null,
    description: null,
    disputed: false,
    failure_balance_transaction: null,
    failure_code: null,
    failure_message: null,
    fraud_details: {},
    livemode: false,
    metadata: {},
    on_behalf_of: null,
    outcome: {
      advice_code: null,
      network_advice_code: null,
      network_decline_code: null,
      network_status: 'approved_by_network',
      reason: null,
      risk_level: 'normal',
      seller_message: 'Payment complete.',
      type: 'authorized',
    },
    paid: true,
    payment_intent: ID.paymentIntent,
    payment_method: ID.paymentMethod,
    payment_method_details: {
      card: {
        brand: 'visa',
        country: 'DE',
        exp_month: 12,
        exp_year: 2030,
        funding: 'credit',
        last4: '4242',
        network: 'visa',
        wallet: null,
      },
      type: 'card',
    },
    receipt_email: null,
    receipt_number: null,
    receipt_url: null,
    refunded: amountRefunded >= TOTAL,
    review: null,
    shipping: null,
    source_transfer: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    status: 'succeeded',
    transfer_data: null,
    transfer_group: null,
  }
}

function refund(status: 'pending' | 'succeeded' | 'failed'): Json {
  return {
    id: ID.refund,
    object: 'refund',
    amount: PARTIAL_REFUND,
    balance_transaction: ID.txnRefund,
    charge: ID.charge,
    created: T0 + 2 * DAY,
    currency: 'eur',
    customer: null,
    customer_account: null,
    destination_details: {
      card: {
        reference_status: 'pending',
        reference_type: 'acquirer_reference_number',
        type: 'refund',
      },
      type: 'card',
    },
    ...(status === 'failed'
      ? {
          failure_balance_transaction: ID.txnRefundFailure,
          failure_reason: 'expired_or_canceled_card',
        }
      : {}),
    metadata: {},
    payment_intent: ID.paymentIntent,
    payment_method: ID.paymentMethod,
    reason: 'requested_by_customer',
    receipt_number: null,
    source_transfer_reversal: null,
    status,
    transfer_reversal: null,
  }
}

function dispute(status: 'needs_response' | 'lost'): Json {
  return {
    id: ID.dispute,
    object: 'dispute',
    amount: TOTAL,
    balance_transactions: [],
    charge: ID.charge,
    created: T0 + 10 * DAY,
    currency: 'eur',
    enhanced_eligibility_types: [],
    evidence: {
      access_activity_log: null,
      billing_address: null,
      cancellation_policy: null,
      customer_communication: null,
      customer_email_address: null,
      customer_name: null,
      product_description: null,
      receipt: null,
      refund_policy: null,
      shipping_address: null,
      shipping_carrier: null,
      shipping_date: null,
      shipping_documentation: null,
      shipping_tracking_number: null,
      uncategorized_text: null,
    },
    evidence_details: {
      due_by: T0 + 31 * DAY,
      enhanced_eligibility: {},
      has_evidence: false,
      past_due: false,
      submission_count: 0,
    },
    is_charge_refundable: false,
    livemode: false,
    metadata: {},
    network_reason_code: '13.1',
    payment_intent: ID.paymentIntent,
    reason: 'product_not_received',
    status,
  }
}

function balanceTransaction(
  id: string,
  type: 'charge' | 'refund' | 'payout',
  amount: number,
  fee: number,
  source: string,
  created: number,
): Json {
  return {
    id,
    object: 'balance_transaction',
    amount,
    // Zahlungen werden nach 2 Tagen verfügbar, Erstattungen und Auszahlungen sofort.
    available_on: type === 'charge' ? created + 2 * DAY : created,
    balance_type: 'payments',
    created,
    currency: 'eur',
    description: null,
    exchange_rate: null,
    fee,
    fee_details: fee
      ? [
          {
            amount: fee,
            application: null,
            currency: 'eur',
            description: 'Stripe processing fees',
            type: 'stripe_fee',
          },
        ]
      : [],
    net: amount - fee,
    reporting_category: type,
    source,
    status: 'available',
    type,
  }
}

/** Vorlage einer Fixture (deterministisch). */
export function generateFixture(name: FixtureName): Json {
  switch (name) {
    case 'checkout.session.completed':
      return envelope(name, T0 + 5 * MIN, checkoutSession('complete', 'paid'))
    case 'checkout.session.async_payment_succeeded':
      return envelope(name, T0 + 6 * MIN, checkoutSession('complete', 'paid'))
    case 'checkout.session.async_payment_failed':
      return envelope(name, T0 + 6 * MIN, checkoutSession('complete', 'unpaid'))
    case 'checkout.session.expired':
      return envelope(name, T0 + 31 * MIN, checkoutSession('expired', 'unpaid'))
    case 'charge.refunded':
      return envelope(name, T0 + 2 * DAY, charge(PARTIAL_REFUND), {
        amount_refunded: 0,
      })
    case 'refund.created':
      return envelope(name, T0 + 2 * DAY, refund('pending'))
    case 'refund.updated':
      return envelope(name, T0 + 2 * DAY + 5 * MIN, refund('succeeded'), { status: 'pending' })
    case 'refund.failed':
      return envelope(name, T0 + 5 * DAY, refund('failed'), { status: 'succeeded' })
    case 'charge.dispute.created':
      return envelope(name, T0 + 10 * DAY, dispute('needs_response'))
    case 'charge.dispute.closed':
      return envelope(name, T0 + 40 * DAY, dispute('lost'), { status: 'needs_response' })
    case BALANCE_FIXTURE: {
      const chargeFee = Math.round(TOTAL * 0.015) + 25
      const payoutAmount = TOTAL - chargeFee - PARTIAL_REFUND
      return {
        object: 'list',
        data: [
          balanceTransaction(ID.txnPayout, 'payout', -payoutAmount, 0, ID.payout, T0 + 3 * DAY),
          balanceTransaction(ID.txnRefund, 'refund', -PARTIAL_REFUND, 0, ID.refund, T0 + 2 * DAY),
          balanceTransaction(ID.txnCharge, 'charge', TOTAL, chargeFee, ID.charge, T0 + 5 * MIN),
        ],
        has_more: false,
        url: '/v1/balance_transactions',
      }
    }
  }
}

// --- Prüfung ---

const ID_PREFIXES = [
  'acct',
  'ba',
  'card',
  'ch',
  'cs',
  'cus',
  'dp',
  'du',
  'evt',
  'ii',
  'in',
  'pi',
  'pm',
  'po',
  'price',
  'prod',
  'py',
  'pyr',
  're',
  'req',
  'seti',
  'shr',
  'src',
  'tok',
  'txn',
]
const ID_LIKE = new RegExp(`^(?:${ID_PREFIXES.join('|')})_(?:test_|live_)?[A-Za-z0-9_-]{4,}$`)
const KEY_LIKE = /(?:^|[^A-Za-z])(?:sk|rk|pk)_(?:live|test)_|whsec_/
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+)/g
const URL_LIKE = /^https?:\/\//i

function scan(value: unknown, path: string, errors: string[]): void {
  if (typeof value === 'string') {
    if (KEY_LIKE.test(value)) errors.push(`${path}: enthält einen Schlüssel (sk_/rk_/pk_/whsec_).`)
    if (ID_LIKE.test(value) && !/fixture/i.test(value)) {
      errors.push(`${path}: ID „${value}“ ist nicht bereinigt (jede ID muss „fixture“ enthalten).`)
    }
    for (const m of value.matchAll(EMAIL)) {
      if (!/^example\.(?:com|org|net)$/i.test(m[1] ?? '')) {
        errors.push(`${path}: E-Mail-Adresse außerhalb von example.com.`)
      }
    }
    if (URL_LIKE.test(value)) {
      const host = new URL(value).hostname
      if (
        host !== 'localhost' &&
        host !== '127.0.0.1' &&
        !/(?:^|\.)example\.(?:com|org|net)$/.test(host)
      ) {
        errors.push(`${path}: URL auf ${host} (nur localhost/example.com erlaubt).`)
      }
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scan(v, `${path}[${i}]`, errors))
    return
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) scan(v, path ? `${path}.${k}` : k, errors)
  }
}

function checkEvent(name: StripeEventType, json: Json, errors: string[]): void {
  if (json.object !== 'event') errors.push('object muss „event“ sein.')
  if (json.type !== name) errors.push(`type muss „${name}“ sein (ist „${String(json.type)}“).`)
  if (json.api_version !== STRIPE_API_VERSION) {
    errors.push(`api_version muss ${STRIPE_API_VERSION} sein (ist ${String(json.api_version)}).`)
  }
  if (json.livemode !== false) errors.push('livemode muss false sein.')
  const object = (json.data as { object?: Json } | undefined)?.object
  if (!object || typeof object !== 'object') {
    errors.push('data.object fehlt.')
    return
  }
  if ('livemode' in object && object.livemode !== false)
    errors.push('data.object.livemode muss false sein.')
  if ('client_secret' in object && object.client_secret !== null) {
    errors.push('data.object.client_secret muss null sein.')
  }
  if ('client_reference_id' in object && object.client_reference_id !== FIXTURE_REF) {
    errors.push(`client_reference_id muss ${FIXTURE_REF} sein.`)
  }
  const meta = object.metadata as Record<string, unknown> | null | undefined
  if (meta && 'checkoutRef' in meta && meta.checkoutRef !== FIXTURE_REF) {
    errors.push(`metadata.checkoutRef muss ${FIXTURE_REF} sein.`)
  }
  try {
    const event = normalizeStripeEvent(json, 'stripe')
    if (event.type !== STRIPE_EVENT_TYPES[name]) {
      errors.push(`normalisiert zu ${event.type} statt ${STRIPE_EVENT_TYPES[name]}.`)
    }
  } catch (e) {
    errors.push(`Normalisierung scheitert: ${(e as Error).message}`)
  }
}

function checkBalance(json: Json, errors: string[]): void {
  if (json.object !== 'list' || !Array.isArray(json.data)) {
    errors.push('Balance Transactions: Stripe-Liste ({ object: "list", data: [...] }) erwartet.')
    return
  }
  for (const [i, t] of (json.data as Json[]).entries()) {
    if (t.object !== 'balance_transaction')
      errors.push(`data[${i}].object muss balance_transaction sein.`)
    for (const k of ['amount', 'fee', 'net', 'created', 'available_on'] as const) {
      if (!Number.isInteger(t[k])) errors.push(`data[${i}].${k} muss eine ganze Zahl sein.`)
    }
    if (typeof t.source !== 'string') errors.push(`data[${i}].source fehlt.`)
    if (Number(t.amount) - Number(t.fee) !== Number(t.net)) {
      errors.push(`data[${i}]: net ≠ amount − fee.`)
    }
  }
}

/** Fehlerliste (leer = in Ordnung) für eine Fixture. */
export function checkFixture(name: FixtureName, json: unknown): string[] {
  const errors: string[] = []
  if (!json || typeof json !== 'object' || Array.isArray(json)) return ['kein JSON-Objekt.']
  if (name === BALANCE_FIXTURE) checkBalance(json as Json, errors)
  else checkEvent(name, json as Json, errors)
  scan(json, '', errors)
  return errors
}

export function fixtureFile(name: FixtureName): string {
  return `${FIXTURE_DIR}/${name}.json`
}

export function serializeFixture(json: unknown): string {
  return `${JSON.stringify(json, null, 2)}\n`
}
