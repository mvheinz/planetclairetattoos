import 'server-only'

import { ValidationError, type Payload, type PayloadRequest } from 'payload'

import { REVENUE_SOURCES, type RevenueSource } from '@/lib/enums'
import { parseEuroInput } from '@/lib/money'
import { requestNow } from '@/lib/payload/context'
import { inTransaction } from '@/lib/payload/transaction'
import { berlinMonthKey, berlinMonthRange } from '@/lib/time'

// „Monat abschließen“ (V-38, U-93, KONZEPT §8.4, R-125, E-11): die vier Monatssummen außerhalb des Shops (Tattoo,
// Flohmarkt, Auftragsarbeiten, Sonstiges) in **einem** Formular. Leeres Feld = 0 €. Legt je Quelle den Eintrag in
// `revenue-entries` an oder ändert ihn (eindeutig je Monat und Quelle) – in einer Transaktion, idempotent: gleiche Werte
// noch einmal ändern nichts. Danach fehlt für den Monat keine Quelle mehr, der gelbe Hinweis auf „Heute“ verschwindet.
// Notizen an bestehenden Einträgen bleiben. Regeln (Format, keine Zukunft, Grenzen, Seed-Ersatz) prüft die Collection.
// Dazu der Stand je Monat für das Formular: eingetragene Summen und „Markt-Verkäufe schon erfasst“ (Stücke mit Preis
// aus „Offline verkauft“, nach Verkaufsdatum; ohne Beispieldaten).

export const MONTH_CLOSE_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_CENTS = 100_000_000

export type MonthCloseAmounts = Partial<Record<RevenueSource, unknown>>

export interface MonthCloseResult {
  month: string
  /** Quellen, deren Eintrag neu angelegt oder geändert wurde. */
  changed: RevenueSource[]
  /** Quellen, deren Betrag schon so stand. */
  unchanged: RevenueSource[]
  amounts: Record<RevenueSource, number>
}

/** Formularwerte → Cent je Quelle (leer = 0). Fehler mit Pfad `amounts.<quelle>` bzw. `month`. */
export function parseMonthClose(
  month: unknown,
  amounts: MonthCloseAmounts,
): { month: string; cents: Record<RevenueSource, number> } {
  const errors: { path: string; message: string }[] = []
  const m = typeof month === 'string' ? month.trim() : ''
  if (!MONTH_CLOSE_MONTH_RE.test(m))
    errors.push({ path: 'month', message: 'Monat im Format JJJJ-MM, z. B. 2026-09.' })
  const cents = {} as Record<RevenueSource, number>
  for (const source of REVENUE_SOURCES) {
    const raw = amounts?.[source]
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      cents[source] = 0
      continue
    }
    // Beträge immer in Euro (Formular: Text „125“ oder „12,50“; Zahl 12.5 = 12,50 €)
    const text =
      typeof raw === 'number' && Number.isFinite(raw)
        ? String(raw)
        : typeof raw === 'string'
          ? raw
          : null
    const value = text === null ? null : parseEuroInput(text, { min: 0, max: MAX_CENTS })
    if (value === null)
      errors.push({
        path: `amounts.${source}`,
        message: 'Bitte einen Betrag wie 125 oder 12,50 eingeben (leer = 0 €).',
      })
    else cents[source] = value
  }
  if (errors.length > 0) throw new ValidationError({ collection: 'revenue-entries', errors })
  return { month: m, cents }
}

/** Alle vier Monatssummen eines Monats speichern (anlegen oder ändern), idempotent. */
export async function closeRevenueMonth(
  req: PayloadRequest,
  input: { month: unknown; amounts: MonthCloseAmounts },
): Promise<MonthCloseResult> {
  const { month, cents } = parseMonthClose(input.month, input.amounts)
  if (month > berlinMonthKey(requestNow(req)))
    throw new ValidationError({
      collection: 'revenue-entries',
      errors: [{ path: 'month', message: 'Der Monat liegt in der Zukunft.' }],
    })
  return inTransaction(req, async () => {
    const existing = await req.payload.find({
      collection: 'revenue-entries',
      where: { and: [{ month: { equals: month } }, { seed: { not_equals: true } }] },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
    })
    const bySource = new Map(
      (
        existing.docs as unknown as { id: number; source: RevenueSource; amountCents: number }[]
      ).map((d) => [d.source, d]),
    )
    const changed: RevenueSource[] = []
    const unchanged: RevenueSource[] = []
    for (const source of REVENUE_SOURCES) {
      const doc = bySource.get(source)
      const amountCents = cents[source]
      if (doc && doc.amountCents === amountCents) {
        unchanged.push(source)
        continue
      }
      if (doc)
        await req.payload.update({
          collection: 'revenue-entries',
          id: doc.id,
          data: { amountCents } as never,
          depth: 0,
          overrideAccess: true,
          req,
        })
      else
        await req.payload.create({
          collection: 'revenue-entries',
          data: { month, source, amountCents } as never,
          depth: 0,
          overrideAccess: true,
          req,
        })
      changed.push(source)
    }
    return { month, changed, unchanged, amounts: cents }
  })
}

export interface MonthCloseState {
  month: string
  /** Eingetragene Summen (ohne Beispieldaten); fehlt eine Quelle, ist sie `null`. */
  amounts: Record<RevenueSource, number | null>
  /** Markt-Verkäufe von Stücken mit Preis in diesem Monat (Cent). */
  marketCents: number
  /** Sind alle vier Quellen eingetragen? */
  complete: boolean
}

/** Stand je Monat für das Formular (eine Abfrage je Collection). */
export async function monthCloseStates(
  payload: Payload,
  months: readonly string[],
): Promise<MonthCloseState[]> {
  const valid = months.filter((m) => MONTH_CLOSE_MONTH_RE.test(m))
  if (valid.length === 0) return []
  const sorted = [...valid].sort()
  const from = berlinMonthRange(sorted[0]!).start.toISOString()
  const to = berlinMonthRange(sorted.at(-1)!).end.toISOString()
  const [entries, sales] = await Promise.all([
    payload.find({
      collection: 'revenue-entries',
      where: { and: [{ month: { in: valid } }, { seed: { not_equals: true } }] },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'products',
      where: {
        and: [
          { soldChannel: { equals: 'offline' } },
          { offlineSalePriceCents: { exists: true } },
          { soldAt: { greater_than_equal: from } },
          { soldAt: { less_than: to } },
          { seed: { not_equals: true } },
        ],
      },
      select: { soldAt: true, offlineSalePriceCents: true },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
  ])
  const market = new Map<string, number>()
  for (const d of sales.docs as unknown as {
    soldAt?: string | null
    offlineSalePriceCents?: number | null
  }[]) {
    if (!d.soldAt || typeof d.offlineSalePriceCents !== 'number') continue
    const key = berlinMonthKey(new Date(d.soldAt))
    market.set(key, (market.get(key) ?? 0) + d.offlineSalePriceCents)
  }
  const rows = entries.docs as unknown as {
    month: string
    source: RevenueSource
    amountCents: number
  }[]
  return valid.map((month) => {
    const amounts = Object.fromEntries(REVENUE_SOURCES.map((s) => [s, null])) as Record<
      RevenueSource,
      number | null
    >
    for (const r of rows) if (r.month === month) amounts[r.source] = r.amountCents
    return {
      month,
      amounts,
      marketCents: market.get(month) ?? 0,
      complete: REVENUE_SOURCES.every((s) => amounts[s] !== null),
    }
  })
}
