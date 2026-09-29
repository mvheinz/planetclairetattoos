import 'server-only'

import { createLocalReq, type Payload } from 'payload'

import { createManualCarrierAdapter } from '@/lib/carrier/manual'
import type { CarrierCode, TrackingUrlTemplate } from '@/lib/carrier/types'
import type { Locale, OrderStatus, TaxMode } from '@/lib/enums'
import { legalAttachmentInfo } from '@/lib/legal/attachments'
import { createLogger } from '@/lib/monitoring/logger'
import { matchesHash, unsealToken } from '@/lib/security/tokens'
import type { Order, Setting } from '@/payload-types'

import { buildEpcPayload, formatIban } from './epc'
import { buildStatusLine, customerStatus, maskEmail, type StatusStep } from './orderStatusLine'
import { epcQrSvg } from './qr'

// Anzeige-Daten einer Bestellung für Danke-Seite R08 und Bestellstatus R09 (KONZEPT §4.12, DATENMODELL §6.8.2): feste
// Feldauswahl aus dem Snapshot – Nummer, Verlauf, Positionen, Versand/Tracking, Summen, Name, PLZ/Ort, maskierte E-Mail,
// Bankdaten bei offener Vorkasse (mit EPC-QR), Rechtstext-Dokumente in der Fassung der Bestellung. Nie Straße, volle
// E-Mail, Rechnung oder Gutschrift (R-067, C-24). Der Status-Token wird nur für den Link der Danke-Seite entsiegelt.

const log = createLogger()

/** EPC-QR auf Danke- und Statusseite: Kasten 168 px (DESIGN KO-19). */
export const EPC_QR_DISPLAY_PX = 168

export interface OrderViewItem {
  id: string | null
  productId: number | null
  itemNumber: number
  title: string
  priceCents: number
  imageUrl: string | null
}

export interface OrderViewBank {
  accountHolder: string
  iban: string
  ibanRaw: string
  bic: string | null
  bankName: string | null
  amountCents: number
  reference: string
  dueAt: string | null
  /** SVG als Data-URI (`img-src data:` ist erlaubt); `null`, wenn die Daten nicht EPC-tauglich sind. */
  qrDataUri: string | null
}

export interface OrderViewDocument {
  kind: 'agb' | 'withdrawal'
  version: number
  file: string
}

export interface OrderView {
  id: number
  orderNumber: string
  orderLocale: Locale
  seed: boolean
  placedAt: string
  status: OrderStatus
  /** Status für die Kund:in (`disputed` → `statusBeforeDispute`). */
  shownStatus: OrderStatus
  fulfillmentMethod: 'shipping' | 'pickup'
  paymentMethod: 'card' | 'paypal' | 'prepayment'
  /** Wallet bzw. PayPal laut Anbieter (`card`, `apple_pay`, `google_pay`, `paypal`). */
  paymentMethodType: string | null
  taxMode: TaxMode
  items: OrderViewItem[]
  /** S4: fehlende Stücke mit erstattetem Betrag (Block „Leider schon weg“). */
  unavailable: { itemNumber: number; refundedCents: number }[]
  shippingCents: number
  totalCents: number
  refundedCents: number
  bank: OrderViewBank | null
  tracking: { carrier: string | null; number: string; url: string | null } | null
  customer: {
    name: string | null
    postalCode: string | null
    city: string | null
    email: string | null
  }
  steps: StatusStep[]
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

async function settingsOf(payload: Payload, locale: Locale): Promise<Setting> {
  return (await payload.findGlobal({
    slug: 'settings',
    locale,
    depth: 0,
    overrideAccess: true,
  })) as Setting
}

async function bankOf(order: Order, settings: Setting): Promise<OrderViewBank | null> {
  if (order.status !== 'awaiting_prepayment') return null
  const p = settings.payment ?? {}
  if (!p.accountHolder || !p.iban) return null
  let qrDataUri: string | null = null
  try {
    const epc = buildEpcPayload({
      name: p.accountHolder,
      iban: p.iban,
      bic: p.bic ?? null,
      amountCents: order.totalCents,
      reference: order.orderNumber,
    })
    const svg = await epcQrSvg(epc, { width: EPC_QR_DISPLAY_PX })
    qrDataUri = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
  } catch (err) {
    log.warn('order_view.epc_failed', { orderId: order.id, error: (err as Error)?.message })
  }
  return {
    accountHolder: p.accountHolder,
    iban: formatIban(p.iban),
    ibanRaw: p.iban.replace(/\s+/g, ''),
    bic: p.bic ?? null,
    bankName: p.bankName ?? null,
    amountCents: order.totalCents,
    reference: order.orderNumber,
    dueAt: order.prepayment?.dueAt ? new Date(order.prepayment.dueAt).toISOString() : null,
    qrDataUri,
  }
}

function trackingOf(order: Order, settings: Setting, locale: Locale): OrderView['tracking'] {
  const number = order.shipment?.trackingNumber
  if (!number) return null
  const carrier = order.shipment?.carrier ?? null
  const templates = (settings.shipping?.trackingUrlTemplates ?? []).filter(
    (t): t is TrackingUrlTemplate =>
      !!t && (t.carrier === 'dhl' || t.carrier === 'deutsche_post') && !!t.urlTemplate,
  )
  const url =
    carrier === 'dhl' || carrier === 'deutsche_post'
      ? createManualCarrierAdapter(templates).trackingUrl(carrier as CarrierCode, number, locale)
      : null
  return { carrier, number, url }
}

/** Anzeige-Daten der Bestellung in der Sprache `locale` (Seite), nicht der Bestellung. */
export async function buildOrderView(
  payload: Payload,
  order: Order,
  locale: Locale,
): Promise<OrderView> {
  const settings = await settingsOf(payload, locale)
  const unavailableIds = new Set(
    (order.refunds ?? [])
      .filter((r) => r.reason === 'item_unavailable')
      .flatMap((r) => (Array.isArray(r.itemIds) ? (r.itemIds as unknown[]).map(String) : [])),
  )
  const all = order.items ?? []
  const isUnavailable = (i: (typeof all)[number]) =>
    i.id !== null && i.id !== undefined && unavailableIds.has(String(i.id))
  const items = all
    .filter((i) => !isUnavailable(i))
    .map((i) => ({
      id: i.id ?? null,
      productId: idOf(i.product),
      itemNumber: i.itemNumber,
      title: (locale === 'en' ? i.titleEn : null) || i.titleDe,
      priceCents: i.priceCents,
      imageUrl: i.coverImageUrl ?? null,
    }))
  const unavailable = all
    .filter(isUnavailable)
    .map((i) => ({ itemNumber: i.itemNumber, refundedCents: i.refundedCents ?? i.priceCents }))
  const shipping = order.fulfillmentMethod === 'shipping'
  const address =
    shipping && !order.billingAddressDiffers ? order.shippingAddress : order.billingAddress
  const refundedCents = (order.refunds ?? [])
    .filter((r) => r.status !== 'failed')
    .reduce((n, r) => n + (r.amountCents ?? 0), 0)
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderLocale: order.locale,
    seed: order.seed === true,
    placedAt: new Date(order.timestamps.placedAt).toISOString(),
    status: order.status,
    shownStatus: customerStatus(order.status, order.statusBeforeDispute),
    fulfillmentMethod: order.fulfillmentMethod,
    paymentMethod: order.paymentMethod,
    paymentMethodType: order.stripe?.paymentMethodType ?? null,
    taxMode: order.taxModeAtOrder,
    items,
    unavailable,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    refundedCents,
    bank: await bankOf(order, settings),
    tracking: trackingOf(order, settings, locale),
    customer: {
      name: order.customer?.name ?? address?.name ?? null,
      postalCode: address?.postalCode ?? null,
      city: address?.city ?? null,
      email: maskEmail(order.customer?.email),
    },
    steps: buildStatusLine({
      status: order.status,
      statusBeforeDispute: order.statusBeforeDispute ?? null,
      fulfillmentMethod: order.fulfillmentMethod,
      paymentMethod: order.paymentMethod,
      placedAt: new Date(order.timestamps.placedAt).toISOString(),
      history: (order.statusHistory ?? []).map((h) => ({ to: h.to, at: h.at })),
    }),
  }
}

/**
 * Status-Token der Bestellung für den Link auf der Danke-Seite: entsiegelt und gegen den Hash geprüft. Ein Seitenaufruf
 * rotiert nie (das tut nur die nächste Kund:innen-Mail, `statusTokenForMail`) – ohne lesbares Siegel gibt es keinen Link.
 */
export function statusTokenOf(
  order: Pick<Order, 'statusTokenHash' | 'statusTokenSealed'>,
): string | null {
  if (!order.statusTokenHash || !order.statusTokenSealed) return null
  try {
    const token = unsealToken(order.statusTokenSealed)
    return matchesHash(token, order.statusTokenHash) ? token : null
  } catch {
    return null
  }
}

/**
 * Rechtstext-Dokumente der Bestellung (`AGB_v{n}.pdf`, `Widerrufsbelehrung-und-Formular_v{n}.pdf`, bei EN-Bestellungen
 * ggf. `…_EN.pdf`) – Dateinamen wie die Anhänge von M01/M02. Für die Seite je Dokument eine Datei: die EN-Fassung,
 * wenn die Seite englisch ist und es sie gibt, sonst die deutsche.
 */
export async function orderLegalDocuments(
  payload: Payload,
  order: Order,
  locale: Locale,
): Promise<{ files: string[]; shown: OrderViewDocument[] }> {
  const req = await createLocalReq({ context: { system: true } }, payload)
  const info = await legalAttachmentInfo(req, order)
  const pick = (base: string) =>
    locale === 'en' && info.files.includes(`${base}_EN.pdf`) ? `${base}_EN.pdf` : `${base}.pdf`
  return {
    files: info.files,
    shown: [
      { kind: 'agb', version: info.agb.version, file: pick(`AGB_v${info.agb.version}`) },
      {
        kind: 'withdrawal',
        version: info.withdrawal.version,
        file: pick(`Widerrufsbelehrung-und-Formular_v${info.withdrawal.version}`),
      },
    ],
  }
}
