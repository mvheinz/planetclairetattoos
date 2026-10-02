import 'server-only'

import type { Payload } from 'payload'

import { getPaymentsAdapter, type PaymentsAdapter } from '@/lib/payments'
import { formatBerlin } from '@/lib/time'

import { loadMonthDocuments, monthRange, type ExportDocument } from './documents'
import { CRLF, decimalComma } from './format'
import { balanceTransactionsFor } from './monthlyCsv'

// DATEV-Buchungsstapel (KONZEPT §7.15, R-124, E-04, PLAN P5.25): Format EXTF, Version 700, Kategorie 21
// („Buchungsstapel“, Formatversion 13) je Monat. Kopfzeile mit Berater-/Mandantennummer, Wirtschaftsjahr-Beginn und
// Zeitraum; je Beleg eine Buchung (Umsatz, Soll/Haben, Konto, Gegenkonto, Belegdatum, Belegfeld 1 = Belegnummer,
// Buchungstext ohne Personendaten); Stripe-Gebühren als eigene Buchungen. Nie Beispieldaten (wie P5.24).
// [Annahme, OFFENE-PUNKTE P5.25] Kodierung Windows-1252, CRLF, `;`, Textfelder in `"…"`, nur die ersten 14 Spalten
// des Buchungsstapels, „Erzeugt am“ = Monatsende (byte-identische Wiederholung) – die Steuerberatung prüft den ersten
// Import. Ohne hinterlegte Konten (`settings.export.datev.*`) gibt es keinen Export (409, Knopf ausgegraut).

export const DATEV_FIELDS = [
  'consultantNumber',
  'clientNumber',
  'fiscalYearStart',
  'revenueAccount',
  'stripeTransitAccount',
  'bankAccount',
  'feeAccount',
] as const
export type DatevField = (typeof DATEV_FIELDS)[number]
export type DatevSettings = Record<DatevField, string>

export const DATEV_FIELD_LABELS: Record<DatevField, string> = {
  consultantNumber: 'Beraternummer',
  clientNumber: 'Mandantennummer',
  fiscalYearStart: 'Beginn Wirtschaftsjahr',
  revenueAccount: 'Erlöskonto',
  stripeTransitAccount: 'Stripe-Verrechnungskonto',
  bankAccount: 'Bankkonto',
  feeAccount: 'Gebührenkonto',
}

/** Hinweis am ausgegrauten Knopf (KONZEPT §7.15). */
export const DATEV_NOT_CONFIGURED_HINT = 'Konten mit der Steuerberatung festlegen'

const PATTERNS: Record<DatevField, RegExp> = {
  consultantNumber: /^\d{4,7}$/,
  clientNumber: /^\d{1,5}$/,
  fiscalYearStart: /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  revenueAccount: /^\d{4,9}$/,
  stripeTransitAccount: /^\d{4,9}$/,
  bankAccount: /^\d{4,9}$/,
  feeAccount: /^\d{4,9}$/,
}

export class DatevNotConfiguredError extends Error {
  constructor(readonly missing: DatevField[]) {
    super(
      `${DATEV_NOT_CONFIGURED_HINT} (fehlt: ${missing.map((f) => DATEV_FIELD_LABELS[f]).join(', ')}).`,
    )
    this.name = 'DatevNotConfiguredError'
  }
}

export type DatevConfigStatus =
  { ready: true; settings: DatevSettings } | { ready: false; missing: DatevField[] }

/** Für Knopf und Endpunkt: sind alle Werte aus `settings.export.datev` gesetzt und gültig? */
export function datevConfigStatus(datev: unknown): DatevConfigStatus {
  const src = (datev && typeof datev === 'object' ? datev : {}) as Record<string, unknown>
  const missing = DATEV_FIELDS.filter((f) => {
    const v = src[f]
    return typeof v !== 'string' || !PATTERNS[f].test(v.trim())
  })
  if (missing.length > 0) return { ready: false, missing }
  return {
    ready: true,
    settings: Object.fromEntries(
      DATEV_FIELDS.map((f) => [f, String(src[f]).trim()]),
    ) as DatevSettings,
  }
}

// --- Windows-1252 -----------------------------------------------------------------------------------------------

const CP1252_EXTRA: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
}

/** Text → Windows-1252; nicht darstellbare Zeichen werden `?`. */
export function encodeWindows1252(text: string): Buffer {
  const out: number[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) out.push(code)
    else out.push(CP1252_EXTRA[ch] ?? 0x3f)
  }
  return Buffer.from(out)
}

// --- Aufbau -----------------------------------------------------------------------------------------------------

/** Textfeld: in Anführungszeichen, `"` verdoppelt, `;`/Zeilenumbrüche entfernt, gekürzt. */
const text = (value: string, max = 60) =>
  `"${value
    .replace(/[\r\n;]/g, ' ')
    .slice(0, max)
    .replace(/"/g, '""')}"`

const yyyymmdd = (d: Date) => formatBerlin(d, 'yyyyMMdd')

export const DATEV_COLUMNS = [
  'Umsatz (ohne Soll/Haben-Kz)',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basis-Umsatz',
  'WKZ Basis-Umsatz',
  'Konto',
  'Gegenkonto (ohne BU-Schlüssel)',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Belegfeld 2',
  'Skonto',
  'Buchungstext',
] as const

export interface DatevBooking {
  amountCents: number
  side: 'S' | 'H'
  account: string
  contraAccount: string
  date: string
  document: string
  text: string
}

/** Wirtschaftsjahr-Beginn (JJJJMMTT) für den Monat bei Beginn `MM-TT`. */
export function fiscalYearBegin(month: string, fiscalYearStart: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const [fm, fd] = fiscalYearStart.split('-')
  const year = m >= Number(fm) ? y : y - 1
  return `${year}${fm}${fd}`
}

export function datevHeader(month: string, s: DatevSettings): string {
  const { start, end } = monthRange(month)
  const last = new Date(end.getTime() - 1)
  const fields = [
    text('EXTF'),
    '700',
    '21',
    text('Buchungsstapel'),
    '13',
    `${yyyymmdd(last)}235959000`,
    '',
    text('RE'),
    text('planetclaire'),
    text(''),
    s.consultantNumber,
    s.clientNumber,
    fiscalYearBegin(month, s.fiscalYearStart),
    String(s.revenueAccount.length),
    yyyymmdd(start),
    yyyymmdd(last),
    text(`Buchungsstapel ${month}`, 30),
    text(''),
    '1',
    '0',
    '0',
    text('EUR'),
    '',
    text(''),
    '',
    '',
    text(''),
    '',
    '',
    text(''),
    text(''),
  ]
  return fields.join(';')
}

/**
 * Buchungen je Beleg: Rechnung = Soll Geldkonto (Stripe-Verrechnungskonto bzw. Bank bei Vorkasse) an Erlöskonto;
 * Gutschrift/Stornorechnung = Haben Geldkonto; Stripe-Gebühr = Soll Gebührenkonto an Stripe-Verrechnungskonto.
 */
export function datevBookings(
  docs: readonly ExportDocument[],
  fees: ReadonlyMap<string, number>,
  s: DatevSettings,
): DatevBooking[] {
  const out: DatevBooking[] = []
  for (const d of docs) {
    const money = d.paymentMethod === 'prepayment' ? s.bankAccount : s.stripeTransitAccount
    const date = formatBerlin(new Date(d.issueDate), 'ddMM')
    out.push({
      amountCents: Math.abs(d.grossCents),
      side: d.grossCents < 0 ? 'H' : 'S',
      account: money,
      contraAccount: s.revenueAccount,
      date,
      document: d.number,
      text: `${d.kind} ${d.number}`,
    })
    const fee = d.stripeId ? (fees.get(d.stripeId) ?? 0) : 0
    if (fee > 0) {
      out.push({
        amountCents: fee,
        side: 'S',
        account: s.feeAccount,
        contraAccount: s.stripeTransitAccount,
        date,
        document: d.number,
        text: `Stripe-Gebühr ${d.number}`,
      })
    }
  }
  return out
}

export function renderDatev(month: string, s: DatevSettings, bookings: readonly DatevBooking[]) {
  const lines = [datevHeader(month, s), DATEV_COLUMNS.join(';')]
  for (const b of bookings) {
    lines.push(
      [
        decimalComma(b.amountCents),
        text(b.side),
        text('EUR'),
        '',
        '',
        text(''),
        b.account,
        b.contraAccount,
        text(''),
        b.date,
        text(b.document, 36),
        text(''),
        '',
        text(b.text),
      ].join(';'),
    )
  }
  return encodeWindows1252(lines.join(CRLF) + CRLF)
}

export const datevFilename = (month: string) => `planetclaire-${month}-datev.csv`

export interface DatevExportResult {
  filename: string
  bytes: Buffer
  bookings: DatevBooking[]
}

export async function buildDatevExport(
  payload: Payload,
  month: string,
  options: {
    payments?: Pick<PaymentsAdapter, 'listBalanceTransactions'>
    settings?: unknown
  } = {},
): Promise<DatevExportResult> {
  monthRange(month)
  const settings =
    options.settings ??
    (await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true }))
  const datev = ((settings as { export?: { datev?: unknown } }).export ?? {}).datev
  const status = datevConfigStatus(datev)
  if (!status.ready) throw new DatevNotConfiguredError(status.missing)
  const docs = await loadMonthDocuments(payload, month)
  const txns = await balanceTransactionsFor(month, options.payments ?? getPaymentsAdapter())
  const fees = new Map([...txns].map(([id, t]) => [id, t.feeCents]))
  const bookings = datevBookings(docs, fees, status.settings)
  return {
    filename: datevFilename(month),
    bytes: renderDatev(month, status.settings, bookings),
    bookings,
  }
}
