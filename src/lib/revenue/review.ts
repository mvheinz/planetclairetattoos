import 'server-only'

import type { Payload } from 'payload'

import { seedPreviewModeActive } from '@/lib/env'
import {
  PRODUCT_CATEGORIES,
  SOLD_CHANNELS,
  type ProductCategory,
  type SoldChannel,
} from '@/lib/enums'
import { addBerlinDays, addBerlinMonths } from '@/lib/time'

// Werkstatt-Rückblick im Umsatz-Wächter (V-40, U-93): nur aus Juttas eigenen Daten, **ohne Besucherdaten** (V-46 a:
// Statistik bleibt aus). Verkäufe der letzten 12 Monate je Kategorie und Weg (online, Abholung, Markt), wie lange ein
// Stück im Schnitt online war (erstes Veröffentlichen bis Verkauf), die Liste „liegt seit über 60 Tagen“ und „fast
// gekauft“: abgebrochene Kassen (abgelaufen, abgebrochen, gescheitert) der letzten 30 Tage je Stück – nur gezählt,
// ohne Personendaten und ohne neues Feld (Kassen werden nach 30 Tagen gelöscht, L-03). Beispieldaten nur im
// Vorschau-Modus (wie der Umsatz-Wächter).

export const REVIEW_SALES_MONTHS = 12
export const REVIEW_LONG_DAYS = 60
export const REVIEW_ABANDONED_DAYS = 30
const ABANDONED_STATUSES = ['expired', 'cancelled', 'failed'] as const
const DAY_MS = 24 * 60 * 60 * 1000

export interface ReviewPiece {
  id: number
  itemNumber: number | null
  title: string
  category: ProductCategory | null
}

export interface WorkshopReview {
  /** Beginn des Zeitraums der Verkäufe (ISO). */
  salesSince: string
  /** Verkäufe je Kategorie und Weg (Anzahl Stücke). */
  sales: Record<ProductCategory, Record<SoldChannel, number>>
  salesTotal: number
  /** Durchschnittliche Tage vom ersten Online-Stellen bis zum Verkauf (gerundet) bzw. `null` ohne Verkäufe. */
  averageDaysToSale: number | null
  /** Verkäufe, die in den Durchschnitt eingehen (mit Datum des ersten Online-Stellens). */
  averageBasis: number
  /** Im Shop seit über 60 Tagen (älteste zuerst). */
  longListed: (ReviewPiece & { days: number })[]
  /** Abgebrochene Kassen der letzten 30 Tage je Stück (meiste zuerst). */
  almostBought: (ReviewPiece & { count: number; available: boolean })[]
}

type ProductRow = {
  id: number
  itemNumber?: number | null
  adminTitle?: string | null
  category?: ProductCategory | null
  status?: string | null
  firstPublishedAt?: string | null
  soldAt?: string | null
  soldChannel?: SoldChannel | null
}

const piece = (p: ProductRow): ReviewPiece => ({
  id: p.id,
  itemNumber: typeof p.itemNumber === 'number' ? p.itemNumber : null,
  title: p.adminTitle?.trim() || `#${p.id}`,
  category: p.category ?? null,
})

const days = (from: string, to: Date) =>
  Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / DAY_MS))

export async function workshopReview(
  payload: Payload,
  now: Date,
  options: { includeSeed?: boolean } = {},
): Promise<WorkshopReview> {
  const includeSeed = options.includeSeed ?? seedPreviewModeActive()
  const seedFilter = includeSeed ? [] : [{ seed: { not_equals: true } }]
  const salesSince = addBerlinMonths(now, -REVIEW_SALES_MONTHS)
  const longBefore = addBerlinDays(now, -REVIEW_LONG_DAYS)
  const abandonedSince = addBerlinDays(now, -REVIEW_ABANDONED_DAYS)
  const select = {
    itemNumber: true,
    adminTitle: true,
    category: true,
    status: true,
    firstPublishedAt: true,
    soldAt: true,
    soldChannel: true,
  } as const

  const [sold, waiting, checkouts] = await Promise.all([
    payload.find({
      collection: 'products',
      where: {
        and: [
          { status: { equals: 'sold' } },
          { soldAt: { greater_than_equal: salesSince.toISOString() } },
          ...seedFilter,
        ],
      },
      select,
      depth: 0,
      locale: 'de',
      pagination: false,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'products',
      where: {
        and: [
          { status: { equals: 'available' } },
          { firstPublishedAt: { less_than: longBefore.toISOString() } },
          ...seedFilter,
        ],
      },
      select,
      depth: 0,
      locale: 'de',
      pagination: false,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'checkouts',
      where: {
        and: [
          { status: { in: [...ABANDONED_STATUSES] } },
          { createdAt: { greater_than_equal: abandonedSince.toISOString() } },
        ],
      },
      // nur die Stück-Bezüge – keine Namen, E-Mails oder Adressen
      select: { items: { product: true } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
  ])

  const sales = Object.fromEntries(
    PRODUCT_CATEGORIES.map((c) => [c, Object.fromEntries(SOLD_CHANNELS.map((ch) => [ch, 0]))]),
  ) as WorkshopReview['sales']
  let salesTotal = 0
  let daySum = 0
  let averageBasis = 0
  for (const p of sold.docs as unknown as ProductRow[]) {
    if (p.category && p.soldChannel && sales[p.category]) {
      sales[p.category][p.soldChannel]++
      salesTotal++
    }
    if (p.firstPublishedAt && p.soldAt) {
      daySum += days(p.firstPublishedAt, new Date(p.soldAt))
      averageBasis++
    }
  }

  const longListed = (waiting.docs as unknown as ProductRow[])
    .filter((p) => p.firstPublishedAt)
    .map((p) => ({ ...piece(p), days: days(p.firstPublishedAt!, now) }))
    .sort((a, b) => b.days - a.days || (a.itemNumber ?? 0) - (b.itemNumber ?? 0))

  // Je Stück: in wie vielen abgebrochenen Kassen lag es (eine Kasse zählt je Stück einmal)?
  const counts = new Map<number, number>()
  for (const c of checkouts.docs as unknown as { items?: { product?: unknown }[] | null }[]) {
    const ids = new Set<number>()
    for (const item of c.items ?? []) {
      const ref = item.product
      const id =
        typeof ref === 'number'
          ? ref
          : ref && typeof ref === 'object'
            ? Number((ref as { id: unknown }).id)
            : NaN
      if (Number.isSafeInteger(id)) ids.add(id)
    }
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  let almostBought: WorkshopReview['almostBought'] = []
  if (counts.size > 0) {
    const pieces = await payload.find({
      collection: 'products',
      where: { and: [{ id: { in: [...counts.keys()] } }, ...seedFilter] },
      select,
      depth: 0,
      locale: 'de',
      pagination: false,
      overrideAccess: true,
    })
    almostBought = (pieces.docs as unknown as ProductRow[])
      .map((p) => ({
        ...piece(p),
        count: counts.get(p.id) ?? 0,
        available: p.status === 'available',
      }))
      .sort((a, b) => b.count - a.count || (a.itemNumber ?? 0) - (b.itemNumber ?? 0))
  }

  return {
    salesSince: salesSince.toISOString(),
    sales,
    salesTotal,
    averageDaysToSale: averageBasis > 0 ? Math.round(daySum / averageBasis) : null,
    averageBasis,
    longListed,
    almostBought,
  }
}
