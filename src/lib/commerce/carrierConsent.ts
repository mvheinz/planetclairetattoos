import 'server-only'

import type { PayloadRequest } from 'payload'

import { writeAudit } from '@/lib/audit'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order } from '@/payload-types'

import { loadOrder, updateOrderFields } from './transitionOrder'

// Widerruf der DHL-Einwilligung (PLAN P5.10, DATENMODELL §6.23, R-101, R-152; `POST /api/orders/:id/withdraw-carrier-
// consent`): in einer Transaktion `orders.carrierEmailConsentRevokedAt = now`, `withdrawnAt` am ursprünglichen
// `consent-log`-Eintrag (Zweck `carrier_email_forwarding`), ein neuer Eintrag mit `granted = false` und Audit
// `carrier_consent_withdrawn`. Ab sofort gibt „Adresse kopieren“ keine E-Mail mehr aus. Auf Wunsch Bestätigung M16
// (`consent_withdrawal_confirmation`, P6.18).

export const CARRIER_CONSENT_WITHDRAWN_NOTE = 'Widerruf über die Verwaltung (Bestellung {{order}})'

export class CarrierConsentError extends Error {
  readonly status = 409
  constructor(message: string) {
    super(message)
    this.name = 'CarrierConsentError'
  }
}

export async function withdrawCarrierConsent(
  req: PayloadRequest,
  order: Order,
  now: Date,
  options: { confirmationMail?: boolean } = {},
): Promise<{ order: Order; unchanged: boolean; mailJobId: number | string | null }> {
  if (order.carrierEmailConsentRevokedAt) return { order, unchanged: true, mailJobId: null }
  if (order.carrierEmailConsent !== true) {
    throw new CarrierConsentError(
      'Zu dieser Bestellung gibt es keine Einwilligung zur DHL-Weitergabe.',
    )
  }
  return inTransaction(req, async () => {
    const at = now.toISOString()
    await updateOrderFields(req, order.id, { carrierEmailConsentRevokedAt: at }, now)
    const entries = await preservingReq(req, () =>
      req.payload.find({
        collection: 'consent-log',
        where: {
          and: [
            { order: { equals: order.id } },
            { purpose: { equals: 'carrier_email_forwarding' } },
            { granted: { equals: true } },
          ],
        },
        pagination: false,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )
    for (const entry of entries.docs) {
      if (entry.withdrawnAt) continue
      await preservingReq(req, () =>
        req.payload.update({
          collection: 'consent-log',
          id: entry.id,
          data: { withdrawnAt: at } as never,
          depth: 0,
          overrideAccess: true,
          req,
          context: { ...req.context, system: true },
        }),
      )
    }
    const original = entries.docs[0]
    await preservingReq(req, () =>
      req.payload.create({
        collection: 'consent-log',
        data: {
          purpose: 'carrier_email_forwarding',
          granted: false,
          textSnapshot: CARRIER_CONSENT_WITHDRAWN_NOTE.replace('{{order}}', order.orderNumber),
          snippetKey: original?.snippetKey ?? 'checkout.dhlEmailConsent',
          snippetVersion: original?.snippetVersion ?? undefined,
          locale: order.locale,
          email: order.customer.email,
          order: order.id,
          withdrawnAt: at,
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true },
      }),
    )
    await writeAudit(req, {
      action: 'carrier_consent_withdrawn',
      entityCollection: 'orders',
      entityId: order.id,
      summary: `Bestellung ${order.orderNumber}: Einwilligung zur E-Mail-Weitergabe an DHL widerrufen`,
    })
    // Bestätigung M16 auf Wunsch (R-152, LOESCHKONZEPT §5.10); eingeschränkte Bestellungen unterdrückt die Outbox
    let mailJobId: number | string | null = null
    if (options.confirmationMail) {
      const { enqueueEmail } = await import('@/lib/email/outbox')
      const mail = await enqueueEmail(req, {
        template: 'consent_withdrawal_confirmation',
        to: order.customer.email,
        locale: order.locale,
        data: {
          purpose: 'carrier_email_forwarding',
          withdrawnAt: at,
          name: order.customer.name ?? null,
          orderNumber: order.orderNumber,
        },
        idempotencyKey: `consent_withdrawal_confirmation:${order.id}:carrier_email_forwarding`,
        relations: { order: order.id },
      })
      mailJobId = mail.jobId
    }
    return { order: await loadOrder(req, order.id), unchanged: false, mailJobId }
  })
}
