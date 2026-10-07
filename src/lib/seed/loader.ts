import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { z } from 'zod'

import {
  SEED_FILE_SCHEMAS,
  type BaseData,
  type ComplaintSeed,
  type CustomersData,
  type FaqsData,
  type InquirySeed,
  type LogsData,
  type MediaData,
  type OrdersData,
  type PagesData,
  type PrivacyRequestSeed,
  type PrivateUploadsData,
  type ProductSeed,
  type RevenueData,
  type SeedFileName,
  type TattooData,
  type TourSeed,
  type WithdrawalSeed,
} from './schemas'
import { dateTokenExprs } from './lexical'
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
  faqs: FaqsData
  withdrawals: WithdrawalSeed[]
  complaints: ComplaintSeed[]
  inquiries: InquirySeed[]
  privacyRequests: PrivacyRequestSeed[]
  revenue: RevenueData
  tattoo: TattooData
  tour: TourSeed[]
  logs: LogsData
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
  faqs: [],
  withdrawals: [],
  complaints: [],
  inquiries: [],
  privacyRequests: [],
  revenue: [],
  tattoo: { flash: [], gallery: [] },
  tour: [],
  logs: { email: [], consent: [], audit: [] },
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
    ['faqs.json', data.faqs.map((f) => f.key)],
    ['withdrawals.json', data.withdrawals.map((w) => w.key)],
    ['withdrawals.json reference', data.withdrawals.map((w) => w.reference)],
    ['complaints.json', data.complaints.map((c) => c.key)],
    ['inquiries.json', data.inquiries.map((i) => i.key)],
    ['inquiries.json reference', data.inquiries.map((i) => i.reference)],
    ['privacy-requests.json', data.privacyRequests.map((r) => r.key)],
    ['privacy-requests.json reference', data.privacyRequests.map((r) => r.reference)],
    ['revenue.json', data.revenue.map((r) => `${r.month}:${r.source}`)],
    ['tattoo.json flash', data.tattoo.flash.map((f) => f.key)],
    ['tattoo.json flash number', data.tattoo.flash.map((f) => String(f.number))],
    ['tattoo.json gallery', data.tattoo.gallery.map((g) => g.key)],
    ['tour.json', data.tour.map((t) => t.key)],
    ['logs.json audit', data.logs.audit.map((a) => a.key)],
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
  issues.push(...crossCheckCases(data, now, { mediaKeys, uploadKeys, orderKeys, customerKeys }))
  return issues
}

/** Verweise und Zeitausdrücke der Vorgänge, Tattoo-Daten, Seiten und Protokolle (P8.5–P8.8). */
function crossCheckCases(
  data: SeedData,
  now: Date,
  keys: {
    mediaKeys: Set<string>
    uploadKeys: Set<string>
    orderKeys: Set<string>
    customerKeys: Set<string>
  },
): string[] {
  const issues: string[] = []
  const has = (set: Set<string>, where: string, key: string | undefined) => {
    if (key !== undefined && !set.has(key)) issues.push(`${where}: ${key} fehlt`)
  }
  const time = (where: string, expr: string | undefined) => {
    if (expr === undefined) return
    try {
      resolveSeedTime(expr, { now })
    } catch (e) {
      issues.push(`${where}: ${(e as Error).message}`)
    }
  }
  const customer = (where: string, key: string) => has(keys.customerKeys, where, `customers:${key}`)
  const orderByKey = new Map(data.orders.orders.map((o) => [`orders:${o.key}`, o]))
  const items = (where: string, order: string | undefined, ids: readonly string[] | undefined) => {
    for (const id of ids ?? []) {
      const o = order ? orderByKey.get(order) : undefined
      const n = Number(id.split('-L')[1])
      if (!o || !id.startsWith(`${o.key}-L`) || n < 1 || n > o.items.length) {
        issues.push(`${where}: Position ${id} gibt es nicht`)
      }
    }
  }
  const withdrawalKeys = new Set(data.withdrawals.map((w) => `withdrawals:${w.key}`))
  const inquiryKeys = new Set(data.inquiries.map((i) => `inquiries:${i.key}`))
  const complaintKeys = new Set(data.complaints.map((c) => `complaints:${c.key}`))
  const flashKeys = new Set(data.tattoo.flash.map((f) => `flash:${f.key}`))

  for (const w of data.withdrawals) {
    const where = `withdrawals.json ${w.key}`
    if (w.reference !== `WR-2026-9000${w.key.slice(1)}`) {
      issues.push(`${where}: reference muss WR-2026-9000${w.key.slice(1)} sein (§2.5)`)
    }
    has(keys.orderKeys, where, w.order)
    customer(where, w.customer)
    items(where, w.order, w.affectedItemIds)
    for (const f of [
      'receivedAt',
      'goodsReturnedAt',
      'refundedAt',
      'closedAt',
      'rejectedAt',
    ] as const) {
      time(`${where} ${f}`, w[f])
    }
    time(`${where} spam.markedAt`, w.spam?.markedAt)
    if ((w.matchStatus === 'auto_matched' || w.matchStatus === 'manually_matched') !== !!w.order) {
      issues.push(`${where}: zugeordnet genau dann, wenn eine Bestellung angegeben ist`)
    }
  }
  for (const c of data.complaints) {
    const where = `complaints.json ${c.key}`
    has(keys.orderKeys, where, c.order)
    items(where, c.order, c.affectedItemIds)
    for (const p of c.photos ?? []) has(keys.uploadKeys, where, p)
    for (const f of [
      'receivedAt',
      'repairChoiceSentAt',
      'customerChoiceAt',
      'vsbgNoticeSentAt',
    ] as const) {
      time(`${where} ${f}`, c[f])
    }
  }
  for (const i of data.inquiries) {
    const where = `inquiries.json ${i.key}`
    if (i.reference !== `AA-2026-900${i.key.slice(1)}`) {
      issues.push(`${where}: reference muss AA-2026-900${i.key.slice(1)} sein (§2.5)`)
    }
    customer(where, i.customer)
    for (const p of i.referenceImages ?? []) has(keys.uploadKeys, where, p)
    time(`${where} createdAt`, i.createdAt)
    time(`${where} lastActivityAt`, i.lastActivityAt)
  }
  for (const r of data.privacyRequests) {
    const where = `privacy-requests.json ${r.key}`
    if (r.reference !== `DS-2026-900${r.key.slice(2)}`) {
      issues.push(`${where}: reference muss DS-2026-900${r.key.slice(2)} sein (§2.5)`)
    }
    customer(where, r.customer)
    for (const o of r.matchedOrders ?? []) has(keys.orderKeys, where, o)
    for (const w of r.matchedWithdrawals ?? []) has(withdrawalKeys, where, w)
    for (const f of ['receivedAt', 'identityVerifiedAt', 'answeredAt'] as const) {
      time(`${where} ${f}`, r[f])
    }
  }
  for (const r of data.revenue) time(`revenue.json ${r.month}:${r.source}`, r.month)
  for (const u of data.privateUploads) {
    has(inquiryKeys, `private-uploads.json ${u.key}`, u.relatedInquiry)
    has(complaintKeys, `private-uploads.json ${u.key}`, u.relatedComplaint)
  }
  for (const f of data.tattoo.flash) {
    const where = `tattoo.json ${f.key}`
    if (f.number !== Number(f.key.slice(1)))
      issues.push(`${where}: number muss ${f.key.slice(1)} sein`)
    has(keys.mediaKeys, where, f.image)
    time(`${where} claimedAt`, f.claimedAt)
    if ((f.status === 'claimed') !== !!f.claimedAt) {
      issues.push(`${where}: claimedAt genau bei status = claimed`)
    }
  }
  for (const t of data.tour) {
    const where = `tour.json ${t.key}`
    time(`${where} startsAt`, t.startsAt)
    time(`${where} endsAt`, t.endsAt)
  }
  for (const g of data.tattoo.gallery) {
    const where = `tattoo.json ${g.key}`
    has(keys.mediaKeys, where, g.image)
    has(flashKeys, where, g.flash)
    if (g.showsCustomer && g.consentGiven) {
      issues.push(`${where}: Seed-Galerie hat nie eine Einwilligung (§12.3)`)
    }
  }
  for (const p of data.pages) {
    for (const b of p.layout) {
      const refs =
        b.blockType === 'imageText' ? [b.image] : b.blockType === 'imageGallery' ? b.images : []
      for (const r of refs) has(keys.mediaKeys, `pages.json ${p.key}`, r)
    }
  }
  for (const c of data.logs.consent) {
    for (const o of c.orders ?? []) has(keys.orderKeys, 'logs.json consent', o)
    for (const i of c.inquiries ?? []) has(inquiryKeys, 'logs.json consent', i)
  }
  for (const a of data.logs.audit) time(`logs.json audit ${a.key}`, a.at)
  // Datums-Token in allen Texten (§2.4)
  const { base: _base, ...texts } = data
  for (const expr of new Set(dateTokenExprs(JSON.stringify(texts)))) time(`{{date:${expr}}}`, expr)
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
    faqs: (parse('faqs.json') as FaqsData | undefined) ?? EMPTY.faqs,
    withdrawals: (parse('withdrawals.json') as WithdrawalSeed[] | undefined) ?? EMPTY.withdrawals,
    complaints: (parse('complaints.json') as ComplaintSeed[] | undefined) ?? EMPTY.complaints,
    inquiries: (parse('inquiries.json') as InquirySeed[] | undefined) ?? EMPTY.inquiries,
    privacyRequests:
      (parse('privacy-requests.json') as PrivacyRequestSeed[] | undefined) ?? EMPTY.privacyRequests,
    revenue: (parse('revenue.json') as RevenueData | undefined) ?? EMPTY.revenue,
    tattoo: (parse('tattoo.json') as TattooData | undefined) ?? EMPTY.tattoo,
    tour: (parse('tour.json') as TourSeed[] | undefined) ?? EMPTY.tour,
    logs: (parse('logs.json') as LogsData | undefined) ?? EMPTY.logs,
  }
  if (issues.length === 0) issues.push(...crossCheck(data, options.now))
  if (issues.length > 0) throw new SeedDataError(issues)
  return data
}
