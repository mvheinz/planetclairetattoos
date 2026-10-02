import 'server-only'

import { z } from 'zod'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { INQUIRY_OBJECT_TYPES, PRIVACY_REQUEST_TYPES } from '@/lib/enums'
import { padItemNumber } from '@/lib/products/itemNumber'

import type { RenderedMail, TemplateRenderInput } from '../../registry'
import { block, fmtDate, fmtDateTime, renderAdminMail, type Block } from '../kit'

import { ADMIN_MAIL_PATHS } from './paths'

// Verwaltungs-Mails zu einzelnen Vorgängen (KONZEPT §6.4, P5.2): A04 Widerruf eingegangen, A05 neue Anfrage, A13
// Erstattungsfrist, A14 Datenschutz-Frist. Immer Deutsch, kurz, Direktlink. Die Schemata sind strikt: Felder, die nicht
// vorgesehen sind (Namen, E-Mail-Adressen, Freitexte, Bilder), werden abgelehnt – bei A05 besonders wichtig (R-160).

export const ADMIN_WITHDRAWAL_RECEIVED_VERSION = 'a04-v1'
export const ADMIN_INQUIRY_RECEIVED_VERSION = 'a05-v1'
export const ADMIN_WITHDRAWAL_DEADLINE_VERSION = 'a13-v1'
export const ADMIN_PRIVACY_REQUEST_DUE_VERSION = 'a14-v1'

const iso = z.iso.datetime({ offset: true })
const id = z.number().int().positive()
const orderNumber = z.string().regex(/^(BSP-)?PC-\d{4}-\d{5}$/)
const withdrawalRef = z.string().regex(/^(BSP-)?WR-\d{4}-\d{5}$/)
const item = z.strictObject({
  itemNumber: z.number().int().positive(),
  title: z.string().min(1).max(200),
})
const itemLine = (i: z.infer<typeof item>) => `Nr. ${padItemNumber(i.itemNumber)} · ${i.title}`

// --- A04 -------------------------------------------------------------------------------------------------------

export const adminWithdrawalReceivedDataSchema = z.strictObject({
  withdrawalId: id,
  reference: withdrawalRef,
  /** Zugeordnete Bestellung; `null` = nicht zugeordnet. */
  orderNumber: orderNumber.nullish(),
  /** Eingang (Datum und Uhrzeit, wie in M08). */
  receivedAt: iso,
  /** Widerrufene Stücke laut Erklärung (leer = ganze Bestellung bzw. unbekannt). */
  items: z.array(item).max(50).default([]),
  /** Späteste Erstattung (§ 357 Abs. 1 BGB: 14 Tage ab Eingang). */
  refundDueAt: iso,
})
export type AdminWithdrawalReceivedData = z.infer<typeof adminWithdrawalReceivedDataSchema>

export const adminWithdrawalReceivedSubject = (d: AdminWithdrawalReceivedData) =>
  `Widerruf eingegangen: ${d.reference} (${d.orderNumber ?? 'nicht zugeordnet'})`

export async function renderAdminWithdrawalReceived(
  input: TemplateRenderInput<AdminWithdrawalReceivedData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  const blocks: Block[] = [
    block.rows([
      ['Widerruf', d.reference],
      ['Bestellung', d.orderNumber ?? 'nicht zugeordnet – bitte in der Verwaltung zuordnen'],
      ['Eingang', fmtDateTime(d.receivedAt, 'de')],
      ['Erstatten bis', fmtDate(d.refundDueAt, 'de')],
    ]),
    ...(d.items.length > 0
      ? [block.p('Widerrufene Stücke:'), block.list(d.items.map(itemLine))]
      : [block.p('Widerrufen: ganze Bestellung (keine einzelnen Stücke angegeben).')]),
    block.p(
      'Die Eingangsbestätigung ist automatisch an die Kundin bzw. den Kunden gegangen. Details unter „Widerrufe“.',
    ),
  ]
  return renderAdminMail({
    subject: adminWithdrawalReceivedSubject(d),
    blocks,
    links,
    adminPath: ADMIN_MAIL_PATHS.withdrawal(d.withdrawalId),
  })
}

// --- A05 -------------------------------------------------------------------------------------------------------

export const adminInquiryReceivedDataSchema = z.strictObject({
  inquiryId: id,
  reference: z.string().regex(/^(BSP-)?AA-\d{4}-\d{4}$/),
  objectType: z.enum(INQUIRY_OBJECT_TYPES),
  imageCount: z.number().int().min(0).max(20),
})
export type AdminInquiryReceivedData = z.infer<typeof adminInquiryReceivedDataSchema>

const objectLabel = (t: AdminInquiryReceivedData['objectType']) =>
  ENUM_LABELS.INQUIRY_OBJECT_TYPES[t].de

export const adminInquiryReceivedSubject = (d: AdminInquiryReceivedData) =>
  `Neue Anfrage ${d.reference} (${objectLabel(d.objectType)})`

export async function renderAdminInquiryReceived(
  input: TemplateRenderInput<AdminInquiryReceivedData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  return renderAdminMail({
    subject: adminInquiryReceivedSubject(d),
    blocks: [
      block.rows([
        ['Referenz', d.reference],
        ['Gegenstand', objectLabel(d.objectType)],
        ['Bilder', String(d.imageCount)],
      ]),
      block.p('Die ganze Anfrage siehst du in der Verwaltung unter „Anfragen“.'),
    ],
    links,
    adminPath: ADMIN_MAIL_PATHS.inquiry(d.inquiryId),
  })
}

// --- A13 -------------------------------------------------------------------------------------------------------

export const adminWithdrawalDeadlineDataSchema = z.strictObject({
  withdrawalId: id,
  reference: withdrawalRef,
  orderNumber: orderNumber.nullish(),
  /** Ende der Erstattungsfrist. */
  refundDueAt: iso,
  daysLeft: z.number().int().min(0).max(14),
})
export type AdminWithdrawalDeadlineData = z.infer<typeof adminWithdrawalDeadlineDataSchema>

const daysText = (n: number) => (n === 0 ? 'heute' : n === 1 ? 'noch 1 Tag' : `noch ${n} Tage`)

export const adminWithdrawalDeadlineSubject = (d: AdminWithdrawalDeadlineData) =>
  `Erstattungsfrist läuft ab: ${d.reference} (${daysText(d.daysLeft)})`

export async function renderAdminWithdrawalDeadline(
  input: TemplateRenderInput<AdminWithdrawalDeadlineData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  return renderAdminMail({
    subject: adminWithdrawalDeadlineSubject(d),
    blocks: [
      block.rows([
        ['Bestellung', d.orderNumber ?? 'nicht zugeordnet'],
        ['Erstatten bis', fmtDate(d.refundDueAt, 'de')],
      ]),
      block.p(
        'Bitte die Erstattung auslösen – bei Ware, die noch unterwegs ist, erst nach Eingang oder Versandnachweis.',
      ),
    ],
    links,
    adminPath: ADMIN_MAIL_PATHS.withdrawal(d.withdrawalId),
  })
}

// --- A14 -------------------------------------------------------------------------------------------------------

export const adminPrivacyRequestDueDataSchema = z.strictObject({
  privacyRequestId: id,
  reference: z.string().regex(/^(BSP-)?DS-\d{4}-\d{4}$/),
  type: z.enum(PRIVACY_REQUEST_TYPES),
  /** `extendedDueAt ?? dueAt`. */
  dueAt: iso,
})
export type AdminPrivacyRequestDueData = z.infer<typeof adminPrivacyRequestDueDataSchema>

export const adminPrivacyRequestDueSubject = (d: AdminPrivacyRequestDueData) =>
  `Datenschutz-Anfrage ${d.reference}: Frist endet am ${fmtDate(d.dueAt, 'de')}`

export async function renderAdminPrivacyRequestDue(
  input: TemplateRenderInput<AdminPrivacyRequestDueData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  return renderAdminMail({
    subject: adminPrivacyRequestDueSubject(d),
    blocks: [
      block.rows([
        ['Art der Anfrage', ENUM_LABELS.PRIVACY_REQUEST_TYPES[d.type].de],
        ['Frist', fmtDate(d.dueAt, 'de')],
      ]),
      block.p('Bitte die Anfrage unter „Datenschutz-Anfragen“ bis zur Frist beantworten.'),
    ],
    links,
    adminPath: ADMIN_MAIL_PATHS.privacyRequest(d.privacyRequestId),
  })
}
