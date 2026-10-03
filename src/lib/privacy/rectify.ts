import 'server-only'

import type { PayloadRequest } from 'payload'

import { writeAudit } from '@/lib/audit'
import { correctedOrderData, reissueInvoice, type OrderCorrection } from '@/lib/invoices/reissue'
import { preservingReq } from '@/lib/payload/localReq'
import type { Order, PrivacyRequest } from '@/payload-types'

import { PrivacyActionError } from './errors'
import { loadPrivacyRequest } from './requests'

// Berichtigung (PLAN P6.18, R-152, LOESCHKONZEPT §5.5): Name, E-Mail und Adressen einer gefundenen Bestellung. Ohne
// Rechnung direkt (mit Vermerk im Verlauf), nach der Rechnung nur per Gutschrift + neuer Rechnung (`reissueInvoice`,
// R-121). Nur bei offener Anfrage mit geprüfter Identität und nur für Bestellungen aus der Personensuche.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ADDRESS_KEYS = ['name', 'addressLine1', 'addressLine2', 'postalCode', 'city'] as const

function text(v: unknown, max: number, field: string): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (typeof v !== 'string' || v.trim().length > max) {
    throw new PrivacyActionError(400, `Ungültige Angabe (${field}).`)
  }
  return v.trim()
}

function address(v: unknown, field: string): Record<string, string | null> | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'object') throw new PrivacyActionError(400, `Ungültige Adresse (${field}).`)
  const out: Record<string, string | null> = {}
  for (const k of ADDRESS_KEYS) {
    const t = text((v as Record<string, unknown>)[k], 100, `${field}.${k}`)
    if (t !== undefined) out[k] = t
  }
  if (out.postalCode && !/^\d{5}$/.test(out.postalCode)) {
    throw new PrivacyActionError(400, 'Deutsche Postleitzahl: genau 5 Ziffern.')
  }
  return Object.keys(out).length ? out : undefined
}

export function parseCorrection(body: Record<string, unknown>): OrderCorrection {
  const c: OrderCorrection = {}
  const name = text(body.customerName, 100, 'Name')
  if (name !== undefined) {
    if (!name || name.length < 2) throw new PrivacyActionError(400, 'Bitte den Namen angeben.')
    c.customerName = name
  }
  if (body.customerEmail !== undefined) {
    const email =
      typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : ''
    if (!EMAIL_RE.test(email))
      throw new PrivacyActionError(400, 'Bitte eine gültige E-Mail-Adresse angeben.')
    c.customerEmail = email
  }
  const ship = address(body.shippingAddress, 'Lieferadresse')
  if (ship) c.shippingAddress = ship
  const bill = address(body.billingAddress, 'Rechnungsadresse')
  if (bill) c.billingAddress = bill
  if (Object.keys(c).length === 0) throw new PrivacyActionError(400, 'Keine Änderung angegeben.')
  return c
}

export interface RectifyResult {
  request: PrivacyRequest
  order: Order
  reissued: boolean
  jobs: (number | string)[]
}

export async function rectifyOrder(
  req: PayloadRequest,
  requestId: number,
  body: Record<string, unknown>,
  now: Date,
): Promise<RectifyResult> {
  const request = await loadPrivacyRequest(req, requestId)
  if (request.status === 'answered' || request.status === 'rejected') {
    throw new PrivacyActionError(409, 'Die Anfrage ist abgeschlossen.')
  }
  if (request.identityVerified !== true) {
    throw new PrivacyActionError(409, 'Bitte zuerst die Identität prüfen.')
  }
  const orderId = Number(body.orderId)
  const matched = (request.matchedOrders ?? []).map((o) =>
    typeof o === 'object' && o ? o.id : Number(o),
  )
  if (!matched.includes(orderId)) {
    throw new PrivacyActionError(400, 'Bitte eine Bestellung aus der Personensuche wählen.')
  }
  const changes = parseCorrection(body)
  const order = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )) as Order
  if (order.privacy?.anonymizedAt) {
    throw new PrivacyActionError(409, 'Die Bestellung ist bereits anonymisiert.')
  }
  const hasInvoice = order.invoice !== null && order.invoice !== undefined
  const note = hasInvoice
    ? `Berichtigung (${request.reference}): Gutschrift und neue Rechnung`
    : `Berichtigung (${request.reference})`
  let updated: Order
  let jobs: (number | string)[] = []
  if (hasInvoice) {
    const res = await reissueInvoice(req, orderId, changes, { now, note })
    updated = res.order
    jobs = res.jobs
  } else {
    updated = (await preservingReq(req, () =>
      req.payload.update({
        collection: 'orders',
        id: orderId,
        data: correctedOrderData(order, changes, note, now) as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, transition: 'rectify', now: now.toISOString() },
      }),
    )) as Order
  }
  await writeAudit(req, {
    action: 'privacy_request_changed',
    entityCollection: 'privacy-requests',
    entityId: request.id,
    summary: `Datenschutz-Anfrage ${request.reference}: Bestellung ${order.orderNumber} berichtigt${hasInvoice ? ' (Gutschrift und neue Rechnung)' : ''}.`,
  })
  return { request, order: updated, reissued: hasInvoice, jobs }
}
