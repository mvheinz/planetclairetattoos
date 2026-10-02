import 'server-only'

import { z } from 'zod'

import { padItemNumber } from '@/lib/products/itemNumber'

import type { RenderedMail, TemplateRenderInput } from '../registry'

import { block, fmtDate, fmtDateTime, money, renderAdminMail, type Block } from './kit'

// Verwaltungs-Mails (KONZEPT §6.4, P4.15): immer Deutsch, kurz, Direktlink in die Verwaltung, keine Kund:innen-Freitexte
// (nur Name und Ort bei A01). A01/A02 `admin_order_placed`, A03 `admin_prepayment_cancelled`, A06 `admin_oversold`,
// A07 `admin_dispute_opened`, A08 `admin_refund_failed`; A12 `admin_alert` steht in `adminAlert.tsx`.

export const ADMIN_ORDER_PLACED_VERSION = 'a01-v1'
export const ADMIN_PREPAYMENT_CANCELLED_VERSION = 'a03-v1'
export const ADMIN_OVERSOLD_VERSION = 'a06-v1'
export const ADMIN_DISPUTE_OPENED_VERSION = 'a07-v1'
export const ADMIN_REFUND_FAILED_VERSION = 'a08-v1'

/** Hinweis „> 500 €“ ab diesem Gesamtbetrag (KONZEPT §6.4 A01). */
export const HIGH_VALUE_CENTS = 50_000

const iso = z.iso.datetime({ offset: true })
const orderNumber = z.string().regex(/^(BSP-)?PC-\d{4}-\d{5}$/)
const orderId = z.number().int().positive()
const item = z.object({
  itemNumber: z.number().int().positive(),
  title: z.string().min(1).max(200),
  category: z.string().max(40).optional(),
})

const orderPath = (id: number) => `/collections/orders/${id}`
const nr = (n: number) => `Nr. ${padItemNumber(n)}`
const itemLine = (i: z.infer<typeof item>) => `${nr(i.itemNumber)} · ${i.title}`
const shortDate = (d: string) => fmtDate(d, 'de').slice(0, 6)

const METHOD: Record<string, string> = {
  card: 'Karte',
  paypal: 'PayPal',
  prepayment: 'Vorkasse (Überweisung)',
}
const WALLET: Record<string, string> = { apple_pay: 'Apple Pay', google_pay: 'Google Pay' }

// --- A01/A02 ---------------------------------------------------------------------------------------------------

export const adminOrderPlacedDataSchema = z.object({
  orderId,
  orderNumber,
  /** O1 = bezahlt (A01), O2 = Vorkasse offen (A02). */
  transition: z.enum(['O1', 'O2']),
  totalCents: z.number().int().positive(),
  fulfillmentMethod: z.enum(['shipping', 'pickup']),
  items: z.array(item).min(1),
  customerName: z.string().max(200).nullish(),
  city: z.string().max(100).nullish(),
  paymentMethod: z.enum(['card', 'paypal', 'prepayment']),
  paymentMethodType: z.string().max(40).nullish(),
  /** A02: Zahlungsfrist. */
  dueAt: iso.nullish(),
})
export type AdminOrderPlacedData = z.infer<typeof adminOrderPlacedDataSchema>

export function adminOrderPlacedSubject(d: AdminOrderPlacedData): string {
  const amount = money(d.totalCents, 'de')
  if (d.transition === 'O2') {
    return `Vorkasse offen: ${d.orderNumber} – ${amount}${d.dueAt ? ` bis ${shortDate(d.dueAt)}` : ''}`
  }
  return `Neue Bestellung ${d.orderNumber} – ${amount} – ${d.fulfillmentMethod === 'pickup' ? 'Abholung' : 'Versand'}`
}

export function adminOrderHints(d: AdminOrderPlacedData): string[] {
  const hints: string[] = []
  if (d.items.some((i) => i.category === 'keramik')) hints.push('Keramik – bruchsicher verpacken')
  if (d.totalCents > HIGH_VALUE_CENTS) hints.push('> 500 € – ggf. versichert versenden')
  return hints
}

export async function renderAdminOrderPlaced(
  input: TemplateRenderInput<AdminOrderPlacedData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  const method =
    (METHOD[d.paymentMethod] ?? d.paymentMethod) +
    (d.paymentMethodType && WALLET[d.paymentMethodType] ? ` (${WALLET[d.paymentMethodType]})` : '')
  const who = [d.customerName, d.city].filter(Boolean).join(', ')
  const rows: [string, string][] = [
    ['Lieferart', d.fulfillmentMethod === 'pickup' ? 'Abholung' : 'Versand'],
    ...(who ? [['Name und Ort', who] as [string, string]] : []),
    ['Zahlart', method],
    ['Summe', money(d.totalCents, 'de')],
    ...(d.transition === 'O2' && d.dueAt
      ? [['Frist', fmtDateTime(d.dueAt, 'de')] as [string, string]]
      : []),
  ]
  const hints = adminOrderHints(d)
  const next =
    d.transition === 'O2'
      ? 'Vorkasse offen: Sobald das Geld da ist, in der Bestellung „Zahlung erhalten“ eintragen.'
      : d.fulfillmentMethod === 'pickup'
        ? 'Abholung: Bitte Termin mit der Kundin bzw. dem Kunden absprechen.'
        : 'Zu packen: Die Bestellung ist bezahlt und kann verschickt werden.'
  const blocks: Block[] = [
    block.list(d.items.map(itemLine)),
    block.rows(rows),
    ...(hints.length > 0 ? [block.p(`Hinweise: ${hints.join(' · ')}`)] : []),
    block.p(next),
  ]
  return renderAdminMail({
    subject: adminOrderPlacedSubject(d),
    blocks,
    links,
    adminPath: orderPath(d.orderId),
  })
}

// --- A03 -------------------------------------------------------------------------------------------------------

export const adminPrepaymentCancelledDataSchema = z.object({
  orderId,
  orderNumber,
  items: z.array(item).min(1),
})
export type AdminPrepaymentCancelledData = z.infer<typeof adminPrepaymentCancelledDataSchema>

export const adminPrepaymentCancelledSubject = (d: AdminPrepaymentCancelledData) =>
  `Vorkasse storniert: ${d.orderNumber} (keine Zahlung)`

export async function renderAdminPrepaymentCancelled(
  input: TemplateRenderInput<AdminPrepaymentCancelledData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  return renderAdminMail({
    subject: adminPrepaymentCancelledSubject(d),
    blocks: [
      block.p(
        'Die Zahlungsfrist ist abgelaufen, ohne dass Geld eingegangen ist. Die Bestellung ist storniert.',
      ),
      block.p('Diese Stücke sind wieder online:'),
      block.list(d.items.map(itemLine)),
    ],
    links,
    adminPath: orderPath(d.orderId),
  })
}

// --- A06 -------------------------------------------------------------------------------------------------------

export const adminOversoldDataSchema = z.object({
  items: z.array(item).min(1),
  orders: z.array(z.object({ orderId, orderNumber })).min(1),
  refundedCents: z.number().int().positive(),
  refundStatus: z.enum(['pending', 'succeeded', 'failed']),
})
export type AdminOversoldData = z.infer<typeof adminOversoldDataSchema>

const REFUND_STATUS: Record<AdminOversoldData['refundStatus'], string> = {
  pending: 'in Bearbeitung',
  succeeded: 'erstattet',
  failed: 'fehlgeschlagen – bitte im Stripe-Dashboard prüfen',
}

export const adminOversoldSubject = (d: AdminOversoldData) =>
  `ACHTUNG: ${d.items.map((i) => nr(i.itemNumber)).join(', ')} doppelt bezahlt – automatisch erstattet`

export async function renderAdminOversold(
  input: TemplateRenderInput<AdminOversoldData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  return renderAdminMail({
    subject: adminOversoldSubject(d),
    blocks: [
      block.p('Für diese Stücke ist eine Zahlung eingegangen, obwohl sie schon verkauft waren:'),
      block.list(d.items.map(itemLine)),
      block.rows([
        ['Bestellungen', d.orders.map((o) => o.orderNumber).join(', ')],
        ['Erstattet', money(d.refundedCents, 'de')],
        ['Erstattungsstatus', REFUND_STATUS[d.refundStatus]],
      ]),
      block.p('Die Kundin bzw. der Kunde hat automatisch eine Entschuldigung bekommen.'),
    ],
    links,
    adminPath: orderPath(d.orders[0]!.orderId),
  })
}

// --- A07 -------------------------------------------------------------------------------------------------------

export const adminDisputeOpenedDataSchema = z.object({
  orderId,
  orderNumber,
  amountCents: z.number().int().positive(),
  /** Grund laut Stripe (Code, z. B. `fraudulent`). */
  reason: z
    .string()
    .regex(/^[a-z_]{1,60}$/)
    .max(60),
  /** Antwortfrist laut Stripe (`evidence_details.due_by`). */
  dueBy: iso.nullish(),
})
export type AdminDisputeOpenedData = z.infer<typeof adminDisputeOpenedDataSchema>

const DISPUTE_REASON: Record<string, string> = {
  fraudulent: 'Betrug vermutet',
  product_not_received: 'Ware nicht erhalten',
  product_unacceptable: 'Ware mangelhaft oder anders als beschrieben',
  duplicate: 'doppelt belastet',
  subscription_canceled: 'Abo gekündigt',
  credit_not_processed: 'Erstattung nicht erhalten',
  unrecognized: 'Zahlung nicht erkannt',
  general: 'allgemein',
}

export const adminDisputeOpenedSubject = (d: AdminDisputeOpenedData) =>
  `ACHTUNG: Zahlung angefochten – ${d.orderNumber}`

export async function renderAdminDisputeOpened(
  input: TemplateRenderInput<AdminDisputeOpenedData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  const reason = DISPUTE_REASON[d.reason] ? `${DISPUTE_REASON[d.reason]} (${d.reason})` : d.reason
  return renderAdminMail({
    subject: adminDisputeOpenedSubject(d),
    blocks: [
      block.rows([
        ['Betrag', money(d.amountCents, 'de')],
        ['Grund laut Stripe', reason],
        ['Antwortfrist', d.dueBy ? fmtDateTime(d.dueBy, 'de') : 'siehe Stripe-Dashboard'],
      ]),
      block.p('Belege (Sendungsnummer, Rechnung, Packfotos) im Stripe-Dashboard einreichen.'),
    ],
    links,
    adminPath: orderPath(d.orderId),
  })
}

// --- A08 -------------------------------------------------------------------------------------------------------

export const adminRefundFailedDataSchema = z.object({
  orderId,
  orderNumber,
  amountCents: z.number().int().positive(),
  /** Fehlergrund laut Anbieter (Code bzw. kurze technische Meldung, keine Kund:innen-Texte). */
  error: z.string().max(300).nullish(),
})
export type AdminRefundFailedData = z.infer<typeof adminRefundFailedDataSchema>

export const adminRefundFailedSubject = (d: AdminRefundFailedData) =>
  `ACHTUNG: Erstattung fehlgeschlagen – ${d.orderNumber}`

export async function renderAdminRefundFailed(
  input: TemplateRenderInput<AdminRefundFailedData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  return renderAdminMail({
    subject: adminRefundFailedSubject(d),
    blocks: [
      block.rows([
        ['Betrag', money(d.amountCents, 'de')],
        ['Fehlermeldung', d.error || 'keine Angabe'],
      ]),
      block.p(
        'Bitte die Erstattung in der Bestellung prüfen und bei Bedarf neu anstoßen oder überweisen.',
      ),
    ],
    links,
    adminPath: orderPath(d.orderId),
  })
}
