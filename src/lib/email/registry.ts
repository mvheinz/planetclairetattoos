import 'server-only'

import { z } from 'zod'

import { EMAIL_TEMPLATES, type EmailTemplate, type Locale } from '@/lib/enums'

import {
  ORDER_CONFIRMATION_VERSION,
  orderConfirmationSubject,
  orderMailDataSchema,
  PREPAYMENT_INSTRUCTIONS_VERSION,
  PREPAYMENT_RECEIVED_VERSION,
  prepaymentInstructionsSubject,
  prepaymentReceivedSubject,
  renderOrderConfirmation,
  renderPrepaymentInstructions,
  renderPrepaymentReceived,
} from './templates/orderConfirmation'
import * as adm from './templates/admin'
import * as pre from './templates/prepayment'
import type { MailBusiness, MailLinks } from './layout'
import type { MailAttachment } from './types'

// Vorlagen-Registry (KONZEPT §6, DATENMODELL §4 „Mail-Vorlagen: Schlüssel ↔ KONZEPT-ID“): je Schlüssel aus
// `EMAIL_TEMPLATES` die KONZEPT-ID (nur Anzeige), Empfängerart (Kund:in bzw. Verwaltung – Verwaltungs-Mails gehen an
// `settings.adminNotificationEmail`, Rückfall `ADMIN_NOTIFY_EMAIL`), Pflicht-Anhänge, ob es eine Bestellmail ist
// (Fuß mit Bestellstatus und „Vertrag widerrufen“) und – sobald umgesetzt – die Vorlage selbst mit Version (R-081).
// Kund:innen-Vorlagen folgen in P4.14 ff.; `admin_password_reset` (A17) verschickt Payload selbst (P1.9).

export type MailRecipient = 'customer' | 'admin'
/** Pflicht-Anhänge: Rechnung der Bestellung, Gutschrift (`data.creditNoteId`), Rechtstext-PDFs der Bestellfassung. */
export type RequiredAttachment = 'invoice' | 'credit_note' | 'legal_texts'

export interface TemplateMeta {
  konzeptId: string
  recipient: MailRecipient
  attachments: readonly RequiredAttachment[]
  /** Bestellmail: Fuß mit Bestellstatus-Link und „Vertrag widerrufen“ (KONZEPT §6.1). */
  orderMail: boolean
}

const customer = (
  konzeptId: string,
  orderMail: boolean,
  attachments: readonly RequiredAttachment[] = [],
): TemplateMeta => ({ konzeptId, recipient: 'customer', attachments, orderMail })
const admin = (konzeptId: string): TemplateMeta => ({
  konzeptId,
  recipient: 'admin',
  attachments: [],
  orderMail: false,
})

export const TEMPLATE_META = {
  order_confirmation: customer('M01', true, ['invoice', 'legal_texts']),
  prepayment_instructions: customer('M02', true, ['legal_texts']),
  prepayment_reminder: customer('M03', true),
  prepayment_cancelled: customer('M04', true),
  prepayment_received: customer('M05', true, ['invoice']),
  order_shipped: customer('M06', true),
  pickup_ready: customer('M07', true),
  withdrawal_receipt: customer('M08', false),
  refund_confirmation: customer('M09', true, ['credit_note']),
  oversold_apology: customer('M10', true),
  inquiry_receipt: customer('M11', false),
  complaint_repair_choice: customer('M12', true),
  dispute_vsbg: customer('M13', true),
  privacy_access_response: customer('M14', false),
  privacy_erasure_response: customer('M15', false),
  consent_withdrawal_confirmation: customer('M16', false),
  admin_order_placed: admin('A01/A02'),
  admin_prepayment_cancelled: admin('A03'),
  admin_withdrawal_received: admin('A04'),
  admin_inquiry_received: admin('A05'),
  admin_oversold: admin('A06'),
  admin_dispute_opened: admin('A07'),
  admin_refund_failed: admin('A08'),
  admin_revenue_guard: admin('A09'),
  admin_legal_review_due: admin('A10'),
  admin_monthly_close: admin('A11'),
  admin_alert: admin('A12'),
  admin_withdrawal_deadline: admin('A13'),
  admin_privacy_request_due: admin('A14'),
  admin_legal_hold_review: admin('A15'),
  admin_compliance_docs_review: admin('A16'),
  admin_password_reset: admin('A17'),
} as const satisfies Record<EmailTemplate, TemplateMeta>

export interface TemplateRenderInput<D = Record<string, unknown>> {
  locale: Locale
  data: D
  links: MailLinks
  business: MailBusiness
  now: Date
}

export interface RenderedMail {
  subject: string
  html: string
  text: string
  /** Eingebettete Bilder (CID), z. B. Coco-Vignette, EPC-QR. */
  images: MailAttachment[]
}

export interface TemplateDef<D = Record<string, unknown>> {
  /** Version der Vorlage (`email-log.templateVersion`, R-081). */
  version: string
  schema: z.ZodType<D>
  /** Betreff (steht schon beim Einreihen im `email-log`). */
  subject(data: D, locale: Locale): string
  render(input: TemplateRenderInput<D>): Promise<RenderedMail>
}

export class TemplateNotImplementedError extends Error {
  constructor(template: string) {
    super(`Mail-Vorlage „${template}“ ist noch nicht umgesetzt.`)
    this.name = 'TemplateNotImplementedError'
  }
}

type AnyTemplate = TemplateDef<never>

/** Typsicher definieren, dann für die Tabelle vereinheitlichen. */
function def<D>(d: TemplateDef<D>): AnyTemplate {
  return d as unknown as AnyTemplate
}

type OrderMail = z.infer<typeof orderMailDataSchema>

const TEMPLATES: Partial<Record<EmailTemplate, AnyTemplate>> = {
  prepayment_reminder: def<pre.PrepaymentReminderData>({
    version: pre.PREPAYMENT_REMINDER_VERSION,
    schema: pre.prepaymentReminderDataSchema,
    subject: pre.prepaymentReminderSubject,
    render: pre.renderPrepaymentReminder,
  }),
  prepayment_cancelled: def<pre.PrepaymentCancelledData>({
    version: pre.PREPAYMENT_CANCELLED_VERSION,
    schema: pre.prepaymentCancelledDataSchema,
    subject: pre.prepaymentCancelledSubject,
    render: pre.renderPrepaymentCancelled,
  }),
  oversold_apology: def<pre.OversoldApologyData>({
    version: pre.OVERSOLD_APOLOGY_VERSION,
    schema: pre.oversoldApologyDataSchema,
    subject: pre.oversoldApologySubject,
    render: pre.renderOversoldApology,
  }),
  admin_order_placed: def<adm.AdminOrderPlacedData>({
    version: adm.ADMIN_ORDER_PLACED_VERSION,
    schema: adm.adminOrderPlacedDataSchema,
    subject: adm.adminOrderPlacedSubject,
    render: adm.renderAdminOrderPlaced,
  }),
  admin_prepayment_cancelled: def<adm.AdminPrepaymentCancelledData>({
    version: adm.ADMIN_PREPAYMENT_CANCELLED_VERSION,
    schema: adm.adminPrepaymentCancelledDataSchema,
    subject: adm.adminPrepaymentCancelledSubject,
    render: adm.renderAdminPrepaymentCancelled,
  }),
  admin_oversold: def<adm.AdminOversoldData>({
    version: adm.ADMIN_OVERSOLD_VERSION,
    schema: adm.adminOversoldDataSchema,
    subject: adm.adminOversoldSubject,
    render: adm.renderAdminOversold,
  }),
  admin_dispute_opened: def<adm.AdminDisputeOpenedData>({
    version: adm.ADMIN_DISPUTE_OPENED_VERSION,
    schema: adm.adminDisputeOpenedDataSchema,
    subject: adm.adminDisputeOpenedSubject,
    render: adm.renderAdminDisputeOpened,
  }),
  admin_refund_failed: def<adm.AdminRefundFailedData>({
    version: adm.ADMIN_REFUND_FAILED_VERSION,
    schema: adm.adminRefundFailedDataSchema,
    subject: adm.adminRefundFailedSubject,
    render: adm.renderAdminRefundFailed,
  }),
  admin_revenue_guard: def<adm.AdminRevenueGuardData>({
    version: adm.ADMIN_REVENUE_GUARD_VERSION,
    schema: adm.adminRevenueGuardDataSchema,
    subject: adm.adminRevenueGuardSubject,
    render: adm.renderAdminRevenueGuard,
  }),
  order_confirmation: def<OrderMail>({
    version: ORDER_CONFIRMATION_VERSION,
    schema: orderMailDataSchema as unknown as z.ZodType<OrderMail>,
    subject: orderConfirmationSubject,
    render: renderOrderConfirmation,
  }),
  prepayment_instructions: def<OrderMail>({
    version: PREPAYMENT_INSTRUCTIONS_VERSION,
    schema: orderMailDataSchema as unknown as z.ZodType<OrderMail>,
    subject: prepaymentInstructionsSubject,
    render: renderPrepaymentInstructions,
  }),
  prepayment_received: def<OrderMail>({
    version: PREPAYMENT_RECEIVED_VERSION,
    schema: orderMailDataSchema as unknown as z.ZodType<OrderMail>,
    subject: prepaymentReceivedSubject,
    render: renderPrepaymentReceived,
  }),
  admin_withdrawal_received: def<adm.AdminWithdrawalReceivedData>({
    version: adm.ADMIN_WITHDRAWAL_RECEIVED_VERSION,
    schema: adm.adminWithdrawalReceivedDataSchema as z.ZodType<adm.AdminWithdrawalReceivedData>,
    subject: adm.adminWithdrawalReceivedSubject,
    render: adm.renderAdminWithdrawalReceived,
  }),
  admin_inquiry_received: def<adm.AdminInquiryReceivedData>({
    version: adm.ADMIN_INQUIRY_RECEIVED_VERSION,
    schema: adm.adminInquiryReceivedDataSchema,
    subject: adm.adminInquiryReceivedSubject,
    render: adm.renderAdminInquiryReceived,
  }),
  admin_legal_review_due: def<adm.AdminLegalReviewDueData>({
    version: adm.ADMIN_LEGAL_REVIEW_DUE_VERSION,
    schema: adm.adminLegalReviewDueDataSchema,
    subject: adm.adminLegalReviewDueSubject,
    render: adm.renderAdminLegalReviewDue,
  }),
  admin_monthly_close: def<adm.AdminMonthlyCloseData>({
    version: adm.ADMIN_MONTHLY_CLOSE_VERSION,
    schema: adm.adminMonthlyCloseDataSchema,
    subject: adm.adminMonthlyCloseSubject,
    render: adm.renderAdminMonthlyClose,
  }),
  admin_alert: def<adm.AdminAlertData>({
    version: adm.ADMIN_ALERT_VERSION,
    schema: adm.adminAlertDataSchema,
    subject: (data) => `Technisches Problem: ${data.summary}`.slice(0, 200),
    render: adm.renderAdminAlert,
  }),
  admin_withdrawal_deadline: def<adm.AdminWithdrawalDeadlineData>({
    version: adm.ADMIN_WITHDRAWAL_DEADLINE_VERSION,
    schema: adm.adminWithdrawalDeadlineDataSchema,
    subject: adm.adminWithdrawalDeadlineSubject,
    render: adm.renderAdminWithdrawalDeadline,
  }),
  admin_privacy_request_due: def<adm.AdminPrivacyRequestDueData>({
    version: adm.ADMIN_PRIVACY_REQUEST_DUE_VERSION,
    schema: adm.adminPrivacyRequestDueDataSchema,
    subject: adm.adminPrivacyRequestDueSubject,
    render: adm.renderAdminPrivacyRequestDue,
  }),
  admin_legal_hold_review: def<adm.AdminLegalHoldReviewData>({
    version: adm.ADMIN_LEGAL_HOLD_REVIEW_VERSION,
    schema: adm.adminLegalHoldReviewDataSchema,
    subject: adm.adminLegalHoldReviewSubject,
    render: adm.renderAdminLegalHoldReview,
  }),
  admin_compliance_docs_review: def<adm.AdminComplianceDocsReviewData>({
    version: adm.ADMIN_COMPLIANCE_DOCS_REVIEW_VERSION,
    schema: adm.adminComplianceDocsReviewDataSchema,
    subject: adm.adminComplianceDocsReviewSubject,
    render: adm.renderAdminComplianceDocsReview,
  }),
}

/**
 * Verwaltungs-Mails: KONZEPT-ID → Schlüssel aus `EMAIL_TEMPLATES` (DATENMODELL §4, KONZEPT §6.4, P5.2). A01/A02 teilen
 * sich einen Schlüssel (Variante über `transition`). A17 rendert `src/lib/email/render.ts`; Payload verschickt sie.
 */
export const ADMIN_MAILS = {
  A01: 'admin_order_placed',
  A02: 'admin_order_placed',
  A03: 'admin_prepayment_cancelled',
  A04: 'admin_withdrawal_received',
  A05: 'admin_inquiry_received',
  A06: 'admin_oversold',
  A07: 'admin_dispute_opened',
  A08: 'admin_refund_failed',
  A09: 'admin_revenue_guard',
  A10: 'admin_legal_review_due',
  A11: 'admin_monthly_close',
  A12: 'admin_alert',
  A13: 'admin_withdrawal_deadline',
  A14: 'admin_privacy_request_due',
  A15: 'admin_legal_hold_review',
  A16: 'admin_compliance_docs_review',
  A17: 'admin_password_reset',
} as const satisfies Record<`A${string}`, EmailTemplate>

export type AdminMailId = keyof typeof ADMIN_MAILS
/** Verwaltungs-Mails, die über die Outbox gehen (alle außer A17). */
export type AdminTemplate = Exclude<(typeof ADMIN_MAILS)[AdminMailId], 'admin_password_reset'>

const overrides = new Map<EmailTemplate, AnyTemplate | undefined>()

export function templateMeta(template: EmailTemplate): TemplateMeta {
  return TEMPLATE_META[template]
}

/** Umgesetzte Vorlage oder `TemplateNotImplementedError`. */
export function getTemplate(template: EmailTemplate): TemplateDef<Record<string, unknown>> {
  const def = overrides.has(template) ? overrides.get(template) : TEMPLATES[template]
  if (!def) throw new TemplateNotImplementedError(template)
  return def as unknown as TemplateDef<Record<string, unknown>>
}

export function isTemplateImplemented(template: EmailTemplate): boolean {
  return (overrides.has(template) ? overrides.get(template) : TEMPLATES[template]) !== undefined
}

/** Umgesetzte Vorlagen (für Snapshot- und Werbe-Scans). */
export function implementedTemplates(): EmailTemplate[] {
  return EMAIL_TEMPLATES.filter((t) => isTemplateImplemented(t))
}

/** Nur in Tests: Vorlage ersetzen bzw. (mit `undefined`) die Ersetzung aufheben. */
export function __setTemplateForTests<D>(template: EmailTemplate, def?: TemplateDef<D>): void {
  if (def === undefined) overrides.delete(template)
  else overrides.set(template, def as unknown as AnyTemplate)
}
