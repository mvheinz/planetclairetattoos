import 'server-only'

import { TZDate } from '@date-fns/tz'
import { addDays, addMonths, addYears } from 'date-fns'

import type {
  AuditAction,
  InvoiceRetentionYears,
  PrivateUploadPurpose,
  PrivateUploadStatus,
} from '@/lib/enums'
import { APP_TIME_ZONE, berlinYear } from '@/lib/time'

// Alle Lösch- und Aufbewahrungsfristen (LOESCHKONZEPT §2, §3) – einzige Stelle (LOESCHKONZEPT §1 Nr. 4).
// Konstantennamen tragen die L-ID. Fristberechnung in Europe/Berlin (LOESCHKONZEPT §1 Nr. 3):
// - `event`: Ereignis + Dauer, Monate/Jahre kalendergenau (15.10. + 6 Monate = 15.04.), Stunden absolut;
// - `endOfYear`: 01.01. des Jahres (Ereignisjahr + N + 1), 00:00 Uhr Berlin (§ 147 Abs. 4 AO).

export interface RetentionDuration {
  years?: number
  months?: number
  days?: number
  hours?: number
}

export type RetentionStart = 'event' | 'endOfYear'
export type RetentionAction = 'delete' | 'anonymize' | 'minimize' | 'remind' | 'cookie'

export interface RetentionRule {
  /** Regel-ID wie im `deletion-log` (`^L-\d{2}( [a-h])?( Stufe [A-D12])?$`). */
  id: string
  duration: RetentionDuration
  start: RetentionStart
  action: RetentionAction
  /** Task aus ARCHITEKTUR Anhang A.3 (falls automatisch). */
  task?: string
  /** Fristbeginn laut LOESCHKONZEPT. */
  from: string
}

const rule = (r: RetentionRule): Readonly<RetentionRule> => Object.freeze(r)

// L-01 Warenkorb- und Kassen-Cookie (Browser-Laufzeit, ARCHITEKTUR §8.7)
export const L_01_CART_COOKIE = rule({
  id: 'L-01',
  duration: { days: 7 },
  start: 'event',
  action: 'cookie',
  from: 'Setzen bzw. letzte Änderung von pc_cart',
})
export const L_01_CHECKOUT_COOKIE = rule({
  id: 'L-01',
  duration: { hours: 1 },
  start: 'event',
  action: 'cookie',
  from: 'Setzen von pc_checkout',
})
// L-02 Reservierungen
export const L_02_RESERVATIONS = rule({
  id: 'L-02',
  duration: { days: 7 },
  start: 'event',
  action: 'delete',
  task: 'retentionTechnical',
  from: 'releasedAt/convertedAt',
})
// L-03 Kassen (alle, auch abgeschlossene) und consent-log ohne Bestellung (L-19 a)
export const L_03_CHECKOUTS = rule({
  id: 'L-03',
  duration: { days: 30 },
  start: 'event',
  action: 'delete',
  task: 'retentionAbandonedCheckouts',
  from: 'Anlage der Kasse',
})
// L-04 stornierte Vorkasse-Bestellungen
export const L_04_CANCELLED_PREPAYMENT_STAGE_1 = rule({
  id: 'L-04 Stufe 1',
  duration: { days: 30 },
  start: 'event',
  action: 'minimize',
  task: 'retentionOrderMinimize',
  from: 'timestamps.cancelledAt',
})
export const L_04_CANCELLED_PREPAYMENT_STAGE_2 = rule({
  id: 'L-04 Stufe 2',
  duration: { years: 6 },
  start: 'endOfYear',
  action: 'anonymize',
  task: 'retentionOrders',
  from: 'Ende des Stornojahres',
})
// L-05 Bestellungen mit Zahlung (LOESCHKONZEPT §3.1)
export const L_05_SHIPPED_FINAL_STATUS_FALLBACK = rule({
  id: 'L-05',
  duration: { days: 30 },
  start: 'event',
  action: 'minimize',
  from: 'shippedAt (Bestellung bleibt shipped)',
})
export const L_05_ORDERS_STAGE_A = rule({
  id: 'L-05 Stufe A',
  duration: { days: 30 },
  start: 'event',
  action: 'minimize',
  task: 'retentionOrderMinimize',
  from: 'timestamps.finalStatusAt',
})
export const L_05_ORDERS_STAGE_B = rule({
  id: 'L-05 Stufe B',
  duration: { days: 180 },
  start: 'event',
  action: 'minimize',
  task: 'retentionOrderMinimize',
  from: 'timestamps.finalStatusAt',
})
export const L_05_ORDERS_STAGE_C = rule({
  id: 'L-05 Stufe C',
  duration: { months: 12 },
  start: 'event',
  action: 'minimize',
  task: 'retentionOrderMinimize',
  from: 'shippedAt bzw. pickedUpAt; Rückgabefotos returnReceivedAt',
})
export const L_05_ORDERS_STAGE_D = rule({
  id: 'L-05 Stufe D',
  duration: { years: 6 },
  start: 'endOfYear',
  action: 'anonymize',
  task: 'retentionOrders',
  from: 'Ende des Kalenderjahres von finalStatusAt',
})
// L-06 Rechnungen und Gutschriften: Jahre aus settings.retention.invoiceYears (8 oder 10, Standard 10)
export const L_06_INVOICES_DEFAULT_YEARS: InvoiceRetentionYears = 10
export function L_06_INVOICES(years: InvoiceRetentionYears = L_06_INVOICES_DEFAULT_YEARS) {
  return rule({
    id: 'L-06',
    duration: { years },
    start: 'endOfYear',
    action: 'anonymize',
    task: 'retentionInvoices',
    from: 'Ende des Ausstellungsjahres',
  })
}
// L-07 Monatsexporte
export const L_07_MONTHLY_EXPORTS = rule({
  id: 'L-07',
  duration: { years: 10 },
  start: 'endOfYear',
  action: 'delete',
  task: 'retentionInvoices',
  from: 'Ende des Exportjahres',
})
// L-08 Widerrufe
export const L_08_WITHDRAWALS = rule({
  id: 'L-08',
  duration: { years: 6 },
  start: 'endOfYear',
  action: 'delete',
  task: 'retentionWithdrawals',
  from: 'Ende des Eingangsjahres',
})
export const L_08_WITHDRAWALS_SPAM = rule({
  id: 'L-08',
  duration: { days: 30 },
  start: 'event',
  action: 'delete',
  task: 'retentionWithdrawals',
  from: 'spam.markedAt',
})
// L-09 Reklamationen: wie L-05 (Löschen mit Stufe D der Bestellung)
export const L_09_COMPLAINTS = rule({ ...L_05_ORDERS_STAGE_D, id: 'L-09', action: 'delete' })
// L-10 Anfragen Auftragsarbeiten
export const L_10_INQUIRIES = rule({
  id: 'L-10',
  duration: { months: 6 },
  start: 'event',
  action: 'delete',
  task: 'retentionCommissionInquiries',
  from: 'Eingang (createdAt)',
})
// L-12 email-log ohne Bezug (mit Bezug: Frist des Bezugsobjekts)
export const L_12_EMAIL_LOG_UNRELATED = rule({
  id: 'L-12',
  duration: { days: 90 },
  start: 'event',
  action: 'delete',
  task: 'retentionEmailLog',
  from: 'Versand (sentAt)',
})
// L-13 technische Protokolle
export const L_13A_RATE_LIMIT = rule({
  id: 'L-13 a',
  duration: { hours: 24 },
  start: 'event',
  action: 'delete',
  task: 'retentionTechnical',
  from: 'Erfassung',
})
export const L_13B_ADMIN_LOGIN_LOG = rule({
  id: 'L-13 b',
  duration: { days: 14 },
  start: 'event',
  action: 'delete',
  task: 'retentionTechnical',
  from: 'Erfassung',
})
export const L_13C_APP_LOGS = rule({
  id: 'L-13 c',
  duration: { days: 14 },
  start: 'event',
  action: 'delete',
  from: 'Erfassung (Höchstwert beim Anbieter)',
})
export const L_13D_WEBHOOK_EVENTS = rule({
  id: 'L-13 d',
  duration: { days: 90 },
  start: 'event',
  action: 'delete',
  task: 'retentionTechnical',
  from: 'Erfassung (receivedAt)',
})
export const L_13F_PENDING_UPLOADS = rule({
  id: 'L-13 f',
  duration: { hours: 24 },
  start: 'event',
  action: 'delete',
  task: 'retentionTechnical',
  from: 'Erfassung',
})
export const L_13G_JOB_RUNS = rule({
  id: 'L-13 g',
  duration: { days: 90 },
  start: 'event',
  action: 'delete',
  task: 'retentionTechnical',
  from: 'Erfassung',
})
export const L_13H_AUDIT_LOG_RECORDS = rule({
  id: 'L-13 h',
  duration: { years: 10 },
  start: 'endOfYear',
  action: 'delete',
  task: 'retentionTechnical',
  from: 'Eintrag (Beleg-, Bestell-, Widerrufs- und Rechtstext-Aktionen)',
})
export const L_13H_AUDIT_LOG_OTHER = rule({
  id: 'L-13 h',
  duration: { years: 3 },
  start: 'event',
  action: 'delete',
  task: 'retentionTechnical',
  from: 'Eintrag (übrige Aktionen)',
})
// L-17 Betroffenenanfragen
export const L_17_PRIVACY_REQUESTS = rule({
  id: 'L-17',
  duration: { years: 3 },
  start: 'endOfYear',
  action: 'delete',
  task: 'retentionPrivacyRequests',
  from: 'Ende des Abschlussjahres',
})
export const L_17_EXPORT_FILES = rule({
  id: 'L-17',
  duration: { days: 30 },
  start: 'event',
  action: 'delete',
  task: 'retentionPrivacyRequests',
  from: 'Antwort (answeredAt)',
})
// L-18 Löschprotokoll
export const L_18_DELETION_LOG = rule({
  id: 'L-18',
  duration: { years: 3 },
  start: 'event',
  action: 'delete',
  task: 'retentionDeletionLog',
  from: 'Eintrag (executedAt)',
})
// L-19 Einwilligungs- und Vereinbarungsnachweise
export const L_19A_CONSENT_WITHOUT_ORDER = rule({
  ...L_03_CHECKOUTS,
  id: 'L-19 a',
  task: 'retentionConsentEvidence',
})
export const L_19B_PORTFOLIO_CONSENT = rule({
  id: 'L-19 b',
  duration: { years: 3 },
  start: 'event',
  action: 'delete',
  task: 'retentionConsentEvidence',
  from: 'Ende der Veröffentlichung bzw. Widerruf',
})
// L-20 Portfolio-Fotos nach Widerruf
export const L_20_GALLERY_FILES_AFTER_WITHDRAWAL = rule({
  id: 'L-20',
  duration: { hours: 24 },
  start: 'event',
  action: 'delete',
  task: 'retentionConsentEvidence',
  from: 'Widerruf (consentWithdrawnAt)',
})
// L-21 Sitzungen der Verwaltung
export const L_21_ADMIN_SESSION = rule({
  id: 'L-21',
  duration: { days: 7 },
  start: 'event',
  action: 'delete',
  from: 'Anmeldung (Payload-Einstellung tokenExpiration)',
})
// L-23 Backups (R2-Lebenszyklus bzw. Anbieter)
export const L_23A_DAILY_DUMPS = rule({
  id: 'L-23 a',
  duration: { days: 30 },
  start: 'event',
  action: 'delete',
  from: 'Erstellung',
})
export const L_23B_MONTHLY_DUMPS = rule({
  id: 'L-23 b',
  duration: { months: 12 },
  start: 'event',
  action: 'delete',
  from: 'Erstellung',
})
export const L_23C_FILE_MIRROR = rule({
  id: 'L-23 c',
  duration: { days: 7 },
  start: 'event',
  action: 'delete',
  from: 'Löschung der Quelldatei',
})
export const L_23D_NEON_HISTORY = rule({
  id: 'L-23 d',
  duration: { days: 7 },
  start: 'event',
  action: 'delete',
  from: 'Änderung in der DB',
})
export const L_23E_BROKEN_DATABASE = rule({
  id: 'L-23 e',
  duration: { days: 30 },
  start: 'event',
  action: 'delete',
  from: 'Umschalten',
})
// L-24 GPSR-/Konformitätsunterlagen: nur Erinnerung
export const L_24_COMPLIANCE_DOCS = rule({
  id: 'L-24',
  duration: { years: 10 },
  start: 'event',
  action: 'remind',
  task: 'complianceDocsReview',
  from: 'Inverkehrbringen des letzten Stücks',
})

/** Alle festen Regeln (für Tests, Löschvorschau und `retention:replay`). */
export const RETENTION_RULES: readonly Readonly<RetentionRule>[] = [
  L_01_CART_COOKIE,
  L_01_CHECKOUT_COOKIE,
  L_02_RESERVATIONS,
  L_03_CHECKOUTS,
  L_04_CANCELLED_PREPAYMENT_STAGE_1,
  L_04_CANCELLED_PREPAYMENT_STAGE_2,
  L_05_SHIPPED_FINAL_STATUS_FALLBACK,
  L_05_ORDERS_STAGE_A,
  L_05_ORDERS_STAGE_B,
  L_05_ORDERS_STAGE_C,
  L_05_ORDERS_STAGE_D,
  L_06_INVOICES(),
  L_07_MONTHLY_EXPORTS,
  L_08_WITHDRAWALS,
  L_08_WITHDRAWALS_SPAM,
  L_09_COMPLAINTS,
  L_10_INQUIRIES,
  L_12_EMAIL_LOG_UNRELATED,
  L_13A_RATE_LIMIT,
  L_13B_ADMIN_LOGIN_LOG,
  L_13C_APP_LOGS,
  L_13D_WEBHOOK_EVENTS,
  L_13F_PENDING_UPLOADS,
  L_13G_JOB_RUNS,
  L_13H_AUDIT_LOG_RECORDS,
  L_13H_AUDIT_LOG_OTHER,
  L_17_PRIVACY_REQUESTS,
  L_17_EXPORT_FILES,
  L_18_DELETION_LOG,
  L_19A_CONSENT_WITHOUT_ORDER,
  L_19B_PORTFOLIO_CONSENT,
  L_20_GALLERY_FILES_AFTER_WITHDRAWAL,
  L_21_ADMIN_SESSION,
  L_23A_DAILY_DUMPS,
  L_23B_MONTHLY_DUMPS,
  L_23C_FILE_MIRROR,
  L_23D_NEON_HISTORY,
  L_23E_BROKEN_DATABASE,
  L_24_COMPLIANCE_DOCS,
]

/** L-IDs ohne eigene Frist im Code (manuell, beim Anbieter oder ohne Löschfrist). */
export const RULES_WITHOUT_OWN_DEADLINE: Readonly<Record<string, string>> = {
  'L-11': 'Postfach – manuell durch Jutta',
  'L-14': 'Sentry – Anbieter löscht',
  'L-15': 'Statistik – Anbieter',
  'L-16': 'Zahlungsdaten beim Anbieter; Shop-IDs wie L-05/L-06',
  'L-22': 'Beispielbestand – entfernt vor Go-live (Knopf + Gate R-210)',
  'L-25': 'Inhalte ohne Bezug zu Dritten – keine Löschfrist',
}

/** Zeitpunkt, ab dem gelöscht/anonymisiert werden darf. */
export function retainUntil(r: Pick<RetentionRule, 'duration' | 'start'>, eventAt: Date): Date {
  const { years = 0, months = 0, days = 0, hours = 0 } = r.duration
  if (r.start === 'endOfYear') {
    if (months || days || hours) throw new Error('endOfYear-Fristen nur in ganzen Jahren')
    const start = new TZDate(berlinYear(eventAt) + years + 1, 0, 1, 0, 0, 0, APP_TIME_ZONE)
    return new Date(start.getTime())
  }
  let d: Date = new TZDate(eventAt.getTime(), APP_TIME_ZONE)
  if (years) d = addYears(d, years)
  if (months) d = addMonths(d, months)
  if (days) d = addDays(d, days)
  return new Date(d.getTime() + hours * 3_600_000)
}

/** Rechnungen/Gutschriften: 01.01.(Ausstellungsjahr + invoiceYears + 1) Berlin (L-06, beim Anlegen eingefroren). */
export function invoiceRetainUntil(issueDate: Date, invoiceYears: InvoiceRetentionYears): Date {
  return retainUntil(L_06_INVOICES(invoiceYears), issueDate)
}

/**
 * Frist eines Nachweises mit Bestellbezug (`email-log`, `consent-log`; L-12, L-19 a): wie die Bestellung
 * (`orders.retainUntil`, Stufe D). Solange die Bestellung noch keinen Endstatus hat, vorsorglich Stufe D ab
 * `eventAt`; der Bestell-Hook zieht den Wert nach, sobald `orders.retainUntil` feststeht.
 */
export function orderRelatedRetainUntil(orderRetainUntil: Date | null, eventAt: Date): Date {
  return orderRetainUntil ?? retainUntil(L_05_ORDERS_STAGE_D, eventAt)
}

/**
 * Widerrufe (L-08, DATENMODELL §6.11): zugeordnet wie die Bestellung, mindestens Ende des Eingangsjahres + 6 Jahre;
 * nicht zugeordnet Ende des Eingangsjahres + 6 Jahre; als Test/Spam markiert `spam.markedAt` + 30 Tage.
 */
export function withdrawalRetainUntil(input: {
  receivedAt: Date
  orderRetainUntil?: Date | null
  spamMarkedAt?: Date | null
}): Date {
  if (input.spamMarkedAt) return retainUntil(L_08_WITHDRAWALS_SPAM, input.spamMarkedAt)
  const own = retainUntil(L_08_WITHDRAWALS, input.receivedAt)
  if (input.orderRetainUntil && input.orderRetainUntil.getTime() > own.getTime()) {
    return input.orderRetainUntil
  }
  return own
}

/** Audit-Aktionen mit 10 Jahren ab Jahresende (Beleg-, Bestell-, Widerrufs- und Rechtstext-Aktionen, L-13 h). */
export const AUDIT_LONG_RETENTION_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  'order_created',
  'order_status_changed',
  'order_address_changed',
  'order_status_link_rotated',
  'order_refund_created',
  'order_refund_failed',
  'order_anonymized',
  'packing_photo_skipped',
  'carrier_consent_withdrawn',
  'complaint_changed',
  'invoice_issued',
  'credit_note_issued',
  'withdrawal_received',
  'withdrawal_matched',
  'withdrawal_status_changed',
  'legal_text_activated',
  'legal_text_superseded',
  'legal_snippet_activated',
  'legal_snippet_superseded',
  'legal_review_confirmed',
  'tax_mode_changed',
  'retention_setting_changed',
  'product_offline_sold',
])

export function auditRetentionRule(action: AuditAction): Readonly<RetentionRule> {
  return AUDIT_LONG_RETENTION_ACTIONS.has(action) ? L_13H_AUDIT_LOG_RECORDS : L_13H_AUDIT_LOG_OTHER
}

// ---------------------------------------------------------------------------------------------------------------------
// Private Dateien (DATENMODELL §6.4, Tabelle „Aufbewahrung je Zweck“)

/** Zwecke ohne automatische Löschung, die als Nachweis/Unterlage gelten (L-24, L-25, L-19 b). */
export const EVIDENCE_PURPOSES: ReadonlySet<PrivateUploadPurpose> = new Set<PrivateUploadPurpose>([
  'nickel_evidence',
  'lab_report',
  'supplier_document',
  'technical_file',
  'consent_evidence',
  'processor_agreement',
])

/** Beleg-PDFs mit gesetzlicher Aufbewahrung (`retainUntil`, Löschen vorher unmöglich). */
export const RECORD_PURPOSES: ReadonlySet<PrivateUploadPurpose> = new Set<PrivateUploadPurpose>([
  'invoice_pdf',
  'credit_note_pdf',
  'monthly_export',
])

export interface PrivateUploadRetentionInput {
  purpose: PrivateUploadPurpose
  status: PrivateUploadStatus
  /** Anlage der Datei (Fristbeginn bei `pending`). */
  createdAt: Date
  /** `settings.retention.invoiceYears` (Standard 10, L-06). */
  invoiceYears?: InvoiceRetentionYears
  /** Beleg- bzw. Exportdatum (`invoices.issueDate`, Exportmonat); ohne Angabe `createdAt`. */
  recordDate?: Date | null
  /** `inquiries.createdAt` der Bezugsanfrage; ohne Angabe `createdAt` (Formular schickt Datei und Anfrage zusammen). */
  inquiryCreatedAt?: Date | null
  /** Bezugsbestellung: `shippedAt` bzw. `pickedUpAt` (Packfoto) und `returnReceivedAt` (Rückgabefoto). */
  orderShippedAt?: Date | null
  orderPickedUpAt?: Date | null
  orderReturnReceivedAt?: Date | null
  /** Stufe D der Bezugsbestellung (`orders.retainUntil`) – Reklamationsfotos (L-09). */
  orderRetainUntil?: Date | null
  /** Antwort auf die Datenschutz-Anfrage (`privacy-requests.answeredAt`) – DSGVO-Exporte (L-17). */
  privacyAnsweredAt?: Date | null
  /** Widerruf bzw. Ende der Veröffentlichung des Galerie-Eintrags – Einwilligungsnachweise (L-19 b). */
  galleryEndedAt?: Date | null
}

export interface PrivateUploadRetention {
  /** Ab hier löscht der zuständige `retention*`-Task (leer = keine automatische Löschung). */
  deleteAfter: Date | null
  /** Vorher ist Löschen unmöglich (nur Beleg-PDFs und Monatsexporte). */
  retainUntil: Date | null
  /** Regel laut LOESCHKONZEPT (für `deletion-log`). */
  ruleId: string | null
}

const orNull = (d: Date | null | undefined, r: Pick<RetentionRule, 'duration' | 'start'>) =>
  d ? retainUntil(r, d) : null

/**
 * Fristen einer privaten Datei je Zweck (DATENMODELL §6.4). Fehlt das Bezugsereignis (z. B. noch nicht versendet),
 * bleibt `deleteAfter` leer, bis der Bezug es liefert.
 */
export function privateUploadRetention(input: PrivateUploadRetentionInput): PrivateUploadRetention {
  const none = (ruleId: string | null): PrivateUploadRetention => ({
    deleteAfter: null,
    retainUntil: null,
    ruleId,
  })
  switch (input.purpose) {
    case 'commission_reference':
      if (input.status === 'pending') {
        return {
          deleteAfter: retainUntil(L_13F_PENDING_UPLOADS, input.createdAt),
          retainUntil: null,
          ruleId: L_13F_PENDING_UPLOADS.id,
        }
      }
      return {
        deleteAfter: retainUntil(L_10_INQUIRIES, input.inquiryCreatedAt ?? input.createdAt),
        retainUntil: null,
        ruleId: L_10_INQUIRIES.id,
      }
    case 'packing_photo':
      return {
        deleteAfter: orNull(input.orderShippedAt ?? input.orderPickedUpAt, L_05_ORDERS_STAGE_C),
        retainUntil: null,
        ruleId: L_05_ORDERS_STAGE_C.id,
      }
    case 'return_photo':
      return {
        deleteAfter: orNull(input.orderReturnReceivedAt, L_05_ORDERS_STAGE_C),
        retainUntil: null,
        ruleId: L_05_ORDERS_STAGE_C.id,
      }
    case 'complaint_photo':
      return {
        deleteAfter: input.orderRetainUntil ?? null,
        retainUntil: null,
        ruleId: L_09_COMPLAINTS.id,
      }
    case 'consent_evidence':
      return {
        deleteAfter: orNull(input.galleryEndedAt, L_19B_PORTFOLIO_CONSENT),
        retainUntil: null,
        ruleId: L_19B_PORTFOLIO_CONSENT.id,
      }
    case 'invoice_pdf':
    case 'credit_note_pdf': {
      const until = invoiceRetainUntil(
        input.recordDate ?? input.createdAt,
        input.invoiceYears ?? L_06_INVOICES_DEFAULT_YEARS,
      )
      return { deleteAfter: null, retainUntil: until, ruleId: 'L-06' }
    }
    case 'monthly_export':
      return {
        deleteAfter: null,
        retainUntil: retainUntil(L_07_MONTHLY_EXPORTS, input.recordDate ?? input.createdAt),
        ruleId: L_07_MONTHLY_EXPORTS.id,
      }
    case 'data_export':
      return {
        deleteAfter: orNull(input.privacyAnsweredAt, L_17_EXPORT_FILES),
        retainUntil: null,
        ruleId: L_17_EXPORT_FILES.id,
      }
    case 'nickel_evidence':
    case 'lab_report':
    case 'supplier_document':
    case 'technical_file':
      return none(L_24_COMPLIANCE_DOCS.id)
    case 'processor_agreement':
      return none('L-25')
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Anfragen und Datenschutz-Anfragen (DATENMODELL §6.17, §6.26)

/** Anfrage Auftragsarbeiten: Löschung `createdAt + 6 Monate`, unabhängig vom Bearbeitungsstand (L-10). */
export function inquiryDeleteAfter(createdAt: Date): Date {
  return retainUntil(L_10_INQUIRIES, createdAt)
}

/** Datenschutz-Anfrage: Datensatz bis Ende des Abschlussjahres + 3 Jahre (L-17). */
export function privacyRequestRetainUntil(answeredAt: Date): Date {
  return retainUntil(L_17_PRIVACY_REQUESTS, answeredAt)
}

/** DSGVO-Export: Datei `answeredAt + 30 Tage` (L-17). */
export function privacyExportDeleteAfter(answeredAt: Date): Date {
  return retainUntil(L_17_EXPORT_FILES, answeredAt)
}
