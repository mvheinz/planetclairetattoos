import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { z } from 'zod'

import {
  SEED_FILE_SCHEMAS,
  type BaseData,
  type CustomersData,
  type MediaData,
  type OrdersData,
  type PagesData,
  type PrivateUploadsData,
  type ProductSeed,
  type SeedFileName,
} from './schemas'
import { planOrder, seedReservationRef } from './orderPlan'
import { resolveSeedTime } from './time'

// Lader der Datendateien (SEED-SPEC §1.7 Schritt 1): alles oder nichts. Jede Datei wird mit ihrem zod-Schema geprüft,
// danach die Verweise zwischen den Dateien und alle Zeitausdrücke. Ein einziger Fehler bricht den Lauf ab, bevor
// irgendetwas geschrieben wird.

export const SEED_DATA_DIR = path.join('content', 'seed', 'data')

export interface SeedData {
  base: BaseData | null
  customers: CustomersData
  media: MediaData
  privateUploads: PrivateUploadsData
  products: ProductSeed[]
  orders: OrdersData
  pages: PagesData
}

export class SeedDataError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(
      `Seed-Daten ungültig – nichts wurde geschrieben:\n${issues.map((i) => `- ${i}`).join('\n')}`,
    )
    this.name = 'SeedDataError'
  }
}

const EMPTY: Omit<SeedData, 'base'> = {
  customers: [],
  media: { instagram: [], placeholders: [] },
  privateUploads: [],
  products: [],
  orders: { checkouts: [], orders: [], reservations: [] },
  pages: [],
}

async function readJson(file: string): Promise<unknown | undefined> {
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw e
  }
  return JSON.parse(raw) as unknown
}

function parseFile<S extends z.ZodType>(
  name: string,
  schema: S,
  value: unknown,
  issues: string[],
): z.output<S> | undefined {
  const res = schema.safeParse(value)
  if (res.success) return res.data
  for (const i of res.error.issues)
    issues.push(`${name} ${i.path.join('.') || '(Datei)'}: ${i.message}`)
  return undefined
}

function duplicates(keys: string[]): string[] {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const k of keys) (seen.has(k) ? dup : seen).add(k)
  return [...dup]
}

/** Verweise zwischen den Dateien, eindeutige Schlüssel, Nummern und Zeitausdrücke (SEED-SPEC §1.2, §2.2, §2.5). */
export function crossCheck(data: SeedData, now: Date): string[] {
  const issues: string[] = []
  const mediaKeys = new Set(
    [...data.media.instagram, ...data.media.placeholders].map((m) => `media:${m.key}`),
  )
  const uploadKeys = new Set(data.privateUploads.map((u) => `private-uploads:${u.key}`))
  const productKeys = new Set(data.products.map((p) => `products:${p.key}`))
  const checkoutKeys = new Set([
    ...data.orders.checkouts.map((c) => `checkouts:${c.key}`),
    ...data.orders.orders.map((o) => `checkouts:${o.key}`),
  ])
  const orderKeys = new Set(data.orders.orders.map((o) => `orders:${o.key}`))
  const customerKeys = new Set(data.customers.map((c) => `customers:${c.key}`))
  const productByKey = new Map(data.products.map((p) => [`products:${p.key}`, p]))

  const dupLists: [string, string[]][] = [
    ['media.json', [...mediaKeys.values()]],
    ['media.json', [...data.media.instagram, ...data.media.placeholders].map((m) => m.key)],
    ['private-uploads.json', data.privateUploads.map((u) => u.key)],
    ['products.json', data.products.map((p) => p.key)],
    ['products.json itemNumber', data.products.map((p) => String(p.itemNumber))],
    ['orders.json checkouts', data.orders.checkouts.map((c) => c.key)],
    ['orders.json orders', data.orders.orders.map((o) => o.key)],
    ['orders.json orderNumber', data.orders.orders.map((o) => o.orderNumber)],
    ['customers.json', data.customers.map((c) => c.key)],
    ['orders.json reservations', data.orders.reservations.map((r) => r.key)],
    ['pages.json', data.pages.map((p) => p.key)],
  ]
  for (const [file, keys] of dupLists) {
    for (const d of duplicates(keys)) issues.push(`${file}: Schlüssel ${d} doppelt`)
  }

  const time = (where: string, expr: string | undefined) => {
    if (expr === undefined) return
    try {
      resolveSeedTime(expr, { now })
    } catch (e) {
      issues.push(`${where}: ${(e as Error).message}`)
    }
  }

  for (const p of data.products) {
    const where = `products.json ${p.key}`
    if (p.itemNumber !== 900 + Number(p.key.slice(1))) {
      issues.push(`${where}: itemNumber muss ${900 + Number(p.key.slice(1))} sein (§2.5)`)
    }
    for (const img of p.images) if (!mediaKeys.has(img)) issues.push(`${where}: Bild ${img} fehlt`)
    if (p.nickelEvidence && !uploadKeys.has(p.nickelEvidence)) {
      issues.push(`${where}: Nachweis ${p.nickelEvidence} fehlt`)
    }
    const s = p.state
    if (s.reservationCheckout && !checkoutKeys.has(s.reservationCheckout)) {
      issues.push(`${where}: Kasse ${s.reservationCheckout} fehlt`)
    }
    for (const f of ['firstPublishedAt', 'soldAt', 'archivedAt', 'reservedUntil'] as const) {
      time(`${where} state.${f}`, s[f])
    }
  }
  for (const u of data.privateUploads) {
    if (u.relatedOrder && !orderKeys.has(u.relatedOrder)) {
      issues.push(`private-uploads.json ${u.key}: Bestellung ${u.relatedOrder} fehlt`)
    }
  }
  for (const c of data.orders.checkouts) {
    const where = `orders.json checkouts ${c.key}`
    for (const item of c.items) if (!productKeys.has(item)) issues.push(`${where}: ${item} fehlt`)
    if (c.customer && !customerKeys.has(c.customer)) issues.push(`${where}: ${c.customer} fehlt`)
    if (c.reservationRef !== seedReservationRef(c.key)) {
      issues.push(`${where}: reservationRef muss ${seedReservationRef(c.key)} sein (§2.5)`)
    }
    for (const f of ['createdAt', 'displayExpiresAt', 'expiresAt', 'submittedAt'] as const) {
      time(`${where} ${f}`, c[f])
    }
    time(`${where} stripe.sessionExpiresAt`, c.stripe.sessionExpiresAt)
  }
  for (const o of data.orders.orders) {
    const where = `orders.json orders ${o.key}`
    if (o.orderNumber !== `PC-2026-900${o.key.slice(1)}`) {
      issues.push(`${where}: orderNumber muss PC-2026-900${o.key.slice(1)} sein (§2.5)`)
    }
    if (!customerKeys.has(o.customer)) issues.push(`${where}: ${o.customer} fehlt`)
    if (o.checkout && o.checkout !== `checkouts:${o.key}`) {
      issues.push(`${where}: checkout muss checkouts:${o.key} sein (§2.5)`)
    }
    for (const item of o.items) {
      if (!productByKey.has(item.product)) issues.push(`${where}: ${item.product} fehlt`)
    }
    for (const k of o.packingPhotos ?? []) {
      if (!uploadKeys.has(k)) issues.push(`${where}: ${k} fehlt`)
    }
    for (const [f, expr] of Object.entries(o.timeline)) time(`${where} timeline.${f}`, expr)
    time(`${where} prepayment.reminderSentAt`, o.prepayment?.reminderSentAt)
    for (const r of o.refunds ?? []) {
      time(`${where} refunds.createdAt`, r.createdAt)
      for (const id of r.itemIds) {
        const n = Number(id.split('-L')[1])
        if (!id.startsWith(`${o.key}-L`) || n < 1 || n > o.items.length) {
          issues.push(`${where}: Position ${id} gibt es nicht`)
        }
      }
    }
    if (issues.length === 0) {
      try {
        planOrder(o, now, null)
      } catch (e) {
        issues.push(`${where}: ${(e as Error).message}`)
      }
    }
    if (o.status === 'cancelled' && o.cancelReason !== 'payment_timeout') {
      issues.push(`${where}: cancelled nur mit cancelReason payment_timeout (§7.1)`)
    }
  }
  for (const r of data.orders.reservations) {
    const where = `orders.json reservations ${r.key}`
    if (!productKeys.has(r.product)) issues.push(`${where}: ${r.product} fehlt`)
    if (!checkoutKeys.has(r.checkout)) issues.push(`${where}: ${r.checkout} fehlt`)
    for (const f of [
      'createdAt',
      'expiresAt',
      'displayExpiresAt',
      'convertedAt',
      'releasedAt',
    ] as const) {
      time(`${where} ${f}`, r[f])
    }
  }
  return issues
}

export interface LoadOptions {
  dir?: string
  now: Date
  /** `base.json` ist Pflicht (Befehle `base`, `all`, `reset`). */
  requireBase?: boolean
}

/** Lädt und prüft alle Datendateien. Wirft `SeedDataError` mit allen Fehlern. */
export async function loadSeedData(options: LoadOptions): Promise<SeedData> {
  const dir = options.dir ?? path.join(process.cwd(), SEED_DATA_DIR)
  const issues: string[] = []
  const raw = {} as Record<SeedFileName, unknown>
  for (const name of Object.keys(SEED_FILE_SCHEMAS) as SeedFileName[]) {
    try {
      raw[name] = await readJson(path.join(dir, name))
    } catch (e) {
      issues.push(`${name}: ${(e as Error).message}`)
    }
  }
  const parse = <N extends SeedFileName>(name: N) =>
    raw[name] === undefined
      ? undefined
      : parseFile(name, SEED_FILE_SCHEMAS[name], raw[name], issues)

  const base = parse('base.json') ?? null
  if (options.requireBase && raw['base.json'] === undefined) issues.push('base.json fehlt')
  const data: SeedData = {
    base: base as BaseData | null,
    customers: (parse('customers.json') as CustomersData | undefined) ?? EMPTY.customers,
    media: (parse('media.json') as MediaData | undefined) ?? EMPTY.media,
    privateUploads:
      (parse('private-uploads.json') as PrivateUploadsData | undefined) ?? EMPTY.privateUploads,
    products: (parse('products.json') as ProductSeed[] | undefined) ?? EMPTY.products,
    orders: (parse('orders.json') as OrdersData | undefined) ?? EMPTY.orders,
    pages: (parse('pages.json') as PagesData | undefined) ?? EMPTY.pages,
  }
  if (issues.length === 0) issues.push(...crossCheck(data, options.now))
  if (issues.length > 0) throw new SeedDataError(issues)
  return data
}
