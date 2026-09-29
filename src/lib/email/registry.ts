import 'server-only'

import { z } from 'zod'

import { EMAIL_TEMPLATES, type EmailTemplate, type Locale } from '@/lib/enums'

import { renderAdminAlert, ADMIN_ALERT_VERSION, adminAlertDataSchema } from './templates/adminAlert'
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
  admin_alert: {
    version: ADMIN_ALERT_VERSION,
    schema: adminAlertDataSchema,
    subject: (data) => `Technisches Problem: ${data.summary}`.slice(0, 200),
    render: renderAdminAlert,
  } satisfies TemplateDef<z.infer<typeof adminAlertDataSchema>> as unknown as AnyTemplate,
}

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
