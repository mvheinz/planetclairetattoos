import 'server-only'

import { z } from 'zod'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { LEGAL_TEXT_TYPES, PRIVATE_UPLOAD_PURPOSES, REVENUE_SOURCES } from '@/lib/enums'
import { berlinMonthRange, formatBerlin } from '@/lib/time'

import type { RenderedMail, TemplateRenderInput } from '../../registry'
import { block, fmtDate, money, renderAdminMail, type Block } from '../kit'

import { ADMIN_MAIL_PATHS } from './paths'

// Verwaltungs-Mails aus Erinnerungs-Tasks (KONZEPT §6.4, P5.2): A10 Rechtstexte prüfen, A11 Monatsabschluss, A15
// Aufbewahrungssperren prüfen, A16 Produktsicherheits-Unterlagen. Immer Deutsch, kurz, Direktlink; strikte Schemata.

export const ADMIN_LEGAL_REVIEW_DUE_VERSION = 'a10-v1'
export const ADMIN_MONTHLY_CLOSE_VERSION = 'a11-v1'
export const ADMIN_LEGAL_HOLD_REVIEW_VERSION = 'a15-v1'
export const ADMIN_COMPLIANCE_DOCS_REVIEW_VERSION = 'a16-v1'

const iso = z.iso.datetime({ offset: true })
const cents = z.number().int()
const count = z.number().int().nonnegative()

// --- A10 -------------------------------------------------------------------------------------------------------

export const adminLegalReviewDueDataSchema = z.strictObject({
  texts: z
    .array(
      z.strictObject({
        type: z.enum(LEGAL_TEXT_TYPES),
        /** Letzte Prüfung bzw. Aktivierung der aktiven Fassung. */
        lastReviewedAt: iso,
      }),
    )
    .min(1),
})
export type AdminLegalReviewDueData = z.infer<typeof adminLegalReviewDueDataSchema>

export const adminLegalReviewDueSubject = () => 'Jährliche Erinnerung: Rechtstexte prüfen lassen'

export async function renderAdminLegalReviewDue(
  input: TemplateRenderInput<AdminLegalReviewDueData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  return renderAdminMail({
    subject: adminLegalReviewDueSubject(),
    blocks: [
      block.p('Diese Texte sind länger nicht geprüft worden:'),
      block.list(
        d.texts.map(
          (t) =>
            `${ENUM_LABELS.LEGAL_TEXT_TYPES[t.type].de} – zuletzt geprüft am ${fmtDate(t.lastReviewedAt, 'de')}`,
        ),
      ),
      block.p(
        'Bitte von der Kanzlei prüfen lassen und danach unter „Texte“ als geprüft markieren.',
      ),
    ],
    links,
    adminPath: ADMIN_MAIL_PATHS.legalTexts(),
  })
}

// --- A11 -------------------------------------------------------------------------------------------------------

export const adminMonthlyCloseDataSchema = z.strictObject({
  /** `JJJJ-MM` (Berliner Monat). */
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  invoiceCount: count,
  /** Summe der Rechnungen (brutto, positiv). */
  invoiceTotalCents: cents.nonnegative(),
  creditNoteCount: count,
  /** Summe der Gutschriften (brutto, positiv). */
  creditNoteTotalCents: cents.nonnegative(),
  /** Manuelle Monatssummen, die für den Monat fehlen (`revenue-entries`). */
  missingManualSources: z.array(z.enum(REVENUE_SOURCES)).max(REVENUE_SOURCES.length),
})
export type AdminMonthlyCloseData = z.infer<typeof adminMonthlyCloseDataSchema>

export const monthLabel = (month: string) =>
  formatBerlin(berlinMonthRange(month).start, 'MMMM yyyy', 'de')

export const adminMonthlyCloseSubject = (d: AdminMonthlyCloseData) =>
  `Monatsexport ${monthLabel(d.month)} ist bereit`

export async function renderAdminMonthlyClose(
  input: TemplateRenderInput<AdminMonthlyCloseData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  const blocks: Block[] = [
    block.rows([
      ['Rechnungen', `${d.invoiceCount} · ${money(d.invoiceTotalCents, 'de')}`],
      ['Gutschriften', `${d.creditNoteCount} · ${money(d.creditNoteTotalCents, 'de')}`],
      ['Saldo', money(d.invoiceTotalCents - d.creditNoteTotalCents, 'de')],
    ]),
    block.p(
      'Monats-CSV und Rechnungs-ZIP liegen in der Verwaltung unter „Export“ und können an die Steuerberatung gehen.',
    ),
  ]
  if (d.missingManualSources.length > 0) {
    blocks.push(
      block.p(
        `Hinweis: Für ${monthLabel(d.month)} fehlen noch manuelle Monatssummen (${d.missingManualSources
          .map((s) => ENUM_LABELS.REVENUE_SOURCES[s].de)
          .join(
            ', ',
          )}). Bitte unter Einstellungen → Umsatz-Wächter eintragen, auch wenn es 0 € waren.`,
      ),
    )
  }
  return renderAdminMail({
    subject: adminMonthlyCloseSubject(d),
    blocks,
    links,
    adminPath: ADMIN_MAIL_PATHS.exports(),
  })
}

// --- A15 -------------------------------------------------------------------------------------------------------

export const adminLegalHoldReviewDataSchema = z.strictObject({
  holds: z
    .array(
      z.strictObject({
        /** Art des Vorgangs, z. B. Bestellung. */
        kind: z.enum(['order', 'withdrawal', 'invoice', 'inquiry', 'privacy_request']),
        id: z.number().int().positive(),
        /** Nummer des Vorgangs (PC-…, WR-…, RE-…, AA-…, DS-…). */
        reference: z.string().regex(/^[A-Z0-9-]{4,40}$/),
        /** Grund, den Jutta selbst eingetragen hat (Verwaltungstext, keine Kund:innen-Angabe). */
        reason: z.string().min(1).max(300),
        since: iso,
      }),
    )
    .min(1)
    .max(200),
})
export type AdminLegalHoldReviewData = z.infer<typeof adminLegalHoldReviewDataSchema>

const HOLD_KIND: Record<AdminLegalHoldReviewData['holds'][number]['kind'], string> = {
  order: 'Bestellung',
  withdrawal: 'Widerruf',
  invoice: 'Beleg',
  inquiry: 'Anfrage',
  privacy_request: 'Datenschutz-Anfrage',
}

export const adminLegalHoldReviewSubject = (d: AdminLegalHoldReviewData) =>
  `Aufbewahrungssperre prüfen: ${d.holds.length} ${d.holds.length === 1 ? 'Vorgang' : 'Vorgänge'}`

export async function renderAdminLegalHoldReview(
  input: TemplateRenderInput<AdminLegalHoldReviewData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  return renderAdminMail({
    subject: adminLegalHoldReviewSubject(d),
    blocks: [
      block.p('Diese Sperren sind seit mehr als 6 Monaten nicht geprüft worden:'),
      block.list(
        d.holds.map(
          (h) =>
            `${HOLD_KIND[h.kind]} ${h.reference} – seit ${fmtDate(h.since, 'de')} – Grund: ${h.reason}`,
        ),
      ),
      block.p(
        'Bitte prüfen, ob die Sperre noch nötig ist. Aufheben oder bestätigen geht im jeweiligen Vorgang.',
      ),
    ],
    links,
    adminPath: d.holds.every((h) => h.kind === 'order')
      ? ADMIN_MAIL_PATHS.orders()
      : ADMIN_MAIL_PATHS.settings(),
  })
}

// --- A16 -------------------------------------------------------------------------------------------------------

const COMPLIANCE_KINDS = [
  'nickel_evidence',
  'lab_report',
  'supplier_document',
  'technical_file',
  'conformity_declaration',
] as const satisfies readonly (
  (typeof PRIVATE_UPLOAD_PURPOSES)[number] | 'conformity_declaration'
)[]

export const adminComplianceDocsReviewDataSchema = z.strictObject({
  documents: z
    .array(
      z.strictObject({
        kind: z.enum(COMPLIANCE_KINDS),
        title: z.string().min(1).max(200),
        /** Ende der 10-Jahres-Frist nach dem letzten betroffenen Stück; `null` = Stück noch im Verkauf. */
        keepUntil: iso.nullable(),
      }),
    )
    .max(500),
})
export type AdminComplianceDocsReviewData = z.infer<typeof adminComplianceDocsReviewDataSchema>

const COMPLIANCE_KIND_LABEL: Record<(typeof COMPLIANCE_KINDS)[number], string> = {
  nickel_evidence: 'Nickel-Nachweis',
  lab_report: 'Prüfbericht',
  supplier_document: 'Lieferantenerklärung',
  technical_file: 'Technische Unterlagen',
  conformity_declaration: 'Konformitätserklärung',
}

export const adminComplianceDocsReviewSubject = () => 'Produktsicherheits-Unterlagen prüfen'

export async function renderAdminComplianceDocsReview(
  input: TemplateRenderInput<AdminComplianceDocsReviewData>,
): Promise<RenderedMail> {
  const { data: d, links } = input
  const blocks: Block[] =
    d.documents.length === 0
      ? [block.p('Es sind keine Unterlagen hinterlegt.')]
      : [
          block.p('Diese Unterlagen musst du aufbewahren:'),
          block.list(
            d.documents.map(
              (doc) =>
                `${COMPLIANCE_KIND_LABEL[doc.kind]}: ${doc.title} – ${
                  doc.keepUntil
                    ? `aufbewahren bis ${fmtDate(doc.keepUntil, 'de')}`
                    : 'Stück noch im Verkauf'
                }`,
            ),
          ),
        ]
  blocks.push(
    block.p(
      'Unterlagen zu Produktsicherheit bleiben 10 Jahre nach dem letzten verkauften Stück aufbewahrt. Das ist nur eine Erinnerung – es wird nichts gelöscht.',
    ),
  )
  return renderAdminMail({
    subject: adminComplianceDocsReviewSubject(),
    blocks,
    links,
    adminPath: ADMIN_MAIL_PATHS.privateUploads(),
  })
}
