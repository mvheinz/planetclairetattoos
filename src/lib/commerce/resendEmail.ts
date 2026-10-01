import 'server-only'

import type { PayloadRequest } from 'payload'

import { ENUM_LABELS } from '@/lib/enumLabels'
import type { EmailTemplate } from '@/lib/enums'
import { enqueueEmail, type EnqueueEmailResult } from '@/lib/email/outbox'
import { buildOrderMailData } from '@/lib/email/orderMailData'
import { isTemplateImplemented } from '@/lib/email/registry'
import { preservingReq } from '@/lib/payload/localReq'
import type { Order } from '@/payload-types'

// „Erneut senden“ im Bestell-Detail (PLAN P5.9, KONZEPT §6.1): M01, M02, M05, M06, M07 lassen sich nach einem
// Bestätigungsdialog noch einmal an die Kundin schicken – nur Mails, die zu dieser Bestellung schon einmal eingereiht
// wurden. Jede Öffnung des Dialogs hat einen eigenen Schlüssel (`dialogKey`); der Idempotenz-Schlüssel
// `<mailtyp>:<Bestell-ID>:resend-<dialogKey>` sorgt dafür, dass ein zweiter Tipp im selben Dialog keine zweite Mail
// erzeugt (Outbox, P4.13). Die Mail-Daten entstehen wie beim ersten Versand aus dem Snapshot der Bestellung.

export const RESENDABLE_TEMPLATES = [
  'order_confirmation',
  'prepayment_instructions',
  'prepayment_received',
  'order_shipped',
  'pickup_ready',
] as const satisfies readonly EmailTemplate[]
export type ResendableTemplate = (typeof RESENDABLE_TEMPLATES)[number]

export const isResendable = (v: unknown): v is ResendableTemplate =>
  (RESENDABLE_TEMPLATES as readonly string[]).includes(String(v))

type DataBuilder = (req: PayloadRequest, order: Order) => Promise<Record<string, unknown>>

/** Mail-Daten je Vorlage. M06 ergänzt P5.15 („Versendet melden“), M07 P5.17 („Bereit zur Abholung“). */
const BUILDERS: Partial<Record<ResendableTemplate, DataBuilder>> = {
  order_confirmation: async (req, order) => ({ ...(await buildOrderMailData(req, order)) }),
  prepayment_instructions: async (req, order) => ({ ...(await buildOrderMailData(req, order)) }),
  prepayment_received: async (req, order) => ({ ...(await buildOrderMailData(req, order)) }),
}

/** Für spätere Aufgaben (M06/M07): Daten-Erzeuger für „Erneut senden“ eintragen. */
export function registerResendBuilder(template: ResendableTemplate, builder: DataBuilder): void {
  BUILDERS[template] = builder
}

export const DIALOG_KEY_RE = /^[A-Za-z0-9-]{8,64}$/

export interface ResendOption {
  template: ResendableTemplate
  label: string
  /** Schon einmal eingereiht (sonst kein „erneut“). */
  sentBefore: boolean
  available: boolean
}

/** Welche Mails im Bestell-Detail „erneut senden“ anbieten. */
export function resendOptions(sentTemplates: ReadonlySet<string>): ResendOption[] {
  return RESENDABLE_TEMPLATES.map((template) => {
    const sentBefore = sentTemplates.has(template)
    return {
      template,
      label: ENUM_LABELS.EMAIL_TEMPLATES[template].de,
      sentBefore,
      available: sentBefore && !!BUILDERS[template] && isTemplateImplemented(template),
    }
  })
}

export class ResendError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ResendError'
  }
}

export interface ResendResult extends EnqueueEmailResult {
  /** Derselbe Dialog hatte die Mail schon eingereiht. */
  unchanged: boolean
}

/** Mail erneut einreihen (in der Transaktion von `req`). */
export async function resendOrderEmail(
  req: PayloadRequest,
  order: Order,
  template: unknown,
  dialogKey: unknown,
): Promise<ResendResult> {
  if (!isResendable(template)) {
    throw new ResendError(400, 'Diese Mail lässt sich hier nicht erneut senden.')
  }
  if (typeof dialogKey !== 'string' || !DIALOG_KEY_RE.test(dialogKey)) {
    throw new ResendError(400, 'Bitte den Dialog neu öffnen und noch einmal bestätigen.')
  }
  const previous = await preservingReq(req, () =>
    req.payload.count({
      collection: 'email-log',
      where: { and: [{ order: { equals: order.id } }, { template: { equals: template } }] },
      overrideAccess: true,
      req,
    }),
  )
  const builder = BUILDERS[template]
  if (previous.totalDocs === 0 || !builder || !isTemplateImplemented(template)) {
    throw new ResendError(
      409,
      `${ENUM_LABELS.EMAIL_TEMPLATES[template].de} wurde zu dieser Bestellung noch nicht verschickt – erneut senden geht nicht.`,
    )
  }
  if (order.privacy?.anonymizedAt) {
    throw new ResendError(409, 'Die Bestellung ist anonymisiert – keine Mail möglich.')
  }
  const result = await enqueueEmail(req, {
    template,
    to: order.customer.email,
    locale: order.locale,
    data: await builder(req, order),
    idempotencyKey: `${template}:${order.id}:resend-${dialogKey}`,
    relations: { order: order.id },
  })
  return { ...result, unchanged: result.status === 'duplicate' }
}
