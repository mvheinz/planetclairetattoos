import 'server-only'

import type { PayloadRequest } from 'payload'

import { requestNow } from '@/lib/payload/context'

import { sendAdminAlert, type AdminAlertResult } from './alerts'
import { enqueueEmail, type EmailRelations, type EnqueueEmailResult } from './outbox'
import type { AdminTemplate } from './registry'
import type * as adm from './templates/admin'

// Verwaltungs-Mails (KONZEPT §6.4, PLAN P5.2): ein Einstieg für alle Auslöser A01–A16. Schreibt in die Outbox
// (`email-log` + Job `sendEmail`, in der Transaktion von `req`); Empfänger `settings.adminNotificationEmail`, Rückfall
// `ADMIN_NOTIFY_EMAIL` (`adminRecipient`), Sprache immer Deutsch. A12 geht über die Drosselung in `alerts.ts`
// (höchstens eine Mail je Fehlerart und Stunde, Ausnahmen `ALWAYS_ALERT_KINDS`). Die Vorlagen-Schemata lassen keine
// Kund:innen-Freitexte, E-Mail-Adressen oder Bilder durch (A05 strikt, R-160).

export interface AdminNotifyData {
  admin_order_placed: adm.AdminOrderPlacedData
  admin_prepayment_cancelled: adm.AdminPrepaymentCancelledData
  admin_withdrawal_received: adm.AdminWithdrawalReceivedData
  admin_inquiry_received: adm.AdminInquiryReceivedData
  admin_oversold: adm.AdminOversoldData
  admin_dispute_opened: adm.AdminDisputeOpenedData
  admin_refund_failed: adm.AdminRefundFailedData
  admin_revenue_guard: adm.AdminRevenueGuardData
  admin_legal_review_due: adm.AdminLegalReviewDueData
  admin_monthly_close: adm.AdminMonthlyCloseData
  admin_alert: adm.AdminAlertData
  admin_withdrawal_deadline: adm.AdminWithdrawalDeadlineData
  admin_privacy_request_due: adm.AdminPrivacyRequestDueData
  admin_legal_hold_review: adm.AdminLegalHoldReviewData
  admin_compliance_docs_review: adm.AdminComplianceDocsReviewData
}

export interface NotifyAdminOptions {
  /** Injizierte Zeit (Standard: `req.context.now`, sonst Systemuhr); bei A12 Grundlage der Drosselung. */
  now?: Date
  /** `<Schlüssel>:<Objekt-ID>:<Ereignis>` – Pflicht außer bei A12 (dort aus Fehlerart und Zeit gebildet). */
  idempotencyKey?: string
  relations?: EmailRelations
  /** Nur Tests/Sonderfälle: fester Empfänger statt Einstellung bzw. `ADMIN_NOTIFY_EMAIL`. */
  to?: string
}

export type NotifyAdminResult = EnqueueEmailResult | AdminAlertResult

export class NotifyAdminError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotifyAdminError'
  }
}

export async function notifyAdmin<K extends AdminTemplate>(
  req: PayloadRequest,
  kind: K,
  data: AdminNotifyData[K],
  options: NotifyAdminOptions = {},
): Promise<NotifyAdminResult> {
  const now = options.now ?? requestNow(req)
  if (kind === 'admin_alert') {
    return sendAdminAlert(req, { ...(data as adm.AdminAlertData), now })
  }
  const key = options.idempotencyKey
  if (!key) throw new NotifyAdminError(`${kind}: Idempotenz-Schlüssel fehlt.`)
  return enqueueEmail(req, {
    template: kind,
    locale: 'de',
    to: options.to,
    data: data as unknown as Record<string, unknown>,
    idempotencyKey: key,
    relations: options.relations,
  })
}
