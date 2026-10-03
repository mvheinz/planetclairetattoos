import { randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, RequestContext } from 'payload'

import { createToken, hashToken } from '@/lib/security/tokens'

import { ensureLegalTextFixtures } from './legal'

// Test-Fixtures für Kassen, Reservierungen und Bestellungen (Nummern im Bereich 980–999, CLAUDE.md §3 Nr. 5).
// Die Services (startCheckout, createOrderFromCheckout) folgen in P4; bis dahin legen die Tests direkt an.

type Db = { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> }
export const dbOf = (payload: Payload) => (payload.db as unknown as { drizzle: Db }).drizzle

/** System-Kontext der Anlage (O1): so legt createOrderFromCheckout() ab P4 an. */
export const SYSTEM: RequestContext = { system: true, transition: 'O1' }

export interface ItemInput {
  id: number
  itemNumber: number
  priceCents?: number
  shippingClass?: 'brief' | 'paket_klein' | 'keramik' | 'nur_abholung'
}

export function itemSnapshot(p: ItemInput) {
  return {
    product: p.id,
    itemNumber: p.itemNumber,
    titleDe: `Teststück ${p.itemNumber}`,
    category: 'keramik',
    characteristicsDe: 'Keramik · Ø 14 cm',
    priceCents: p.priceCents ?? 4500,
    vatCategory: 'standard',
    shippingClass: p.shippingClass ?? 'keramik',
  }
}

export function orderData(
  number: number,
  items: ItemInput[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const rows = items.map(itemSnapshot)
  const subtotal = rows.reduce((n, r) => n + r.priceCents, 0)
  return {
    orderNumber: `PC-2026-${String(number).padStart(5, '0')}`,
    status: 'paid',
    locale: 'de',
    customer: { name: 'Erika Beispiel', email: 'Erika@Example.com' },
    fulfillmentMethod: 'shipping',
    shippingAddress: {
      name: 'Erika Beispiel',
      addressLine1: 'Musterstraße 1',
      postalCode: '10115',
      city: 'Berlin',
      country: 'DE',
    },
    shippingZone: 'DE',
    shippingClass: 'keramik',
    items: rows,
    subtotalCents: subtotal,
    shippingCents: 890,
    totalCents: subtotal + 890,
    taxModeAtOrder: 'kleinunternehmer',
    paymentMethod: 'card',
    paymentProvider: 'mock',
    legalSnippetVersions: {
      'checkout.legalNotice': { version: 'draft-1', sha256: 'a'.repeat(64) },
    },
    carrierEmailConsent: false,
    timestamps: { placedAt: '2026-09-27T10:00:00.000Z' },
    ...overrides,
  }
}

export async function createOrder(
  payload: Payload,
  data: Record<string, unknown>,
  context: RequestContext = SYSTEM,
) {
  // Rechtstext-Fassungen sind an Bestellungen Pflicht (P1.22): fehlen sie, gelten die aktiven Test-Fassungen.
  const full =
    'legalTextVersions' in data
      ? data
      : { ...data, legalTextVersions: await ensureLegalTextFixtures(payload) }
  return payload.create({
    collection: 'orders',
    data: full as never,
    overrideAccess: true,
    context,
  })
}

export function checkoutData(items: ItemInput[], overrides: Record<string, unknown> = {}) {
  const rows = items.map((p) => {
    const { characteristicsDe: _c, ...rest } = itemSnapshot(p)
    return rest
  })
  const subtotal = rows.reduce((n, r) => n + r.priceCents, 0)
  const token = createToken()
  return {
    token,
    data: {
      tokenHash: hashToken(token),
      status: 'open',
      locale: 'de',
      reservationRef: randomUUID(),
      items: rows,
      fulfillmentMethod: 'shipping',
      subtotalCents: subtotal,
      shippingCents: 890,
      totalCents: subtotal + 890,
      expiresAt: '2026-09-27T10:36:00.000Z',
      displayExpiresAt: '2026-09-27T10:30:00.000Z',
      ...overrides,
    } as Record<string, unknown>,
  }
}

/** Entfernt Bestellungen, Kassen, Reservierungen und Belege der Tests (echte Bestellungen sind sonst unlöschbar). */
export async function deleteCommerce(payload: Payload): Promise<void> {
  const db = dbOf(payload)
  await db.execute(sql`UPDATE products SET current_order_id = NULL`)
  for (const table of [
    'webhook_events',
    'complaints',
    'withdrawals',
    'invoices',
    'invoice_counters',
    'reservations',
    'checkouts',
    'orders',
  ]) {
    const exists = await db.execute(sql`SELECT to_regclass(${table}) AS t`)
    if (!exists.rows[0]?.t) continue
    if (table === 'invoices') {
      // Der GoBD-Trigger (§9.4) sperrt DELETE echter Belege: nur im Test in einem Statement kurz aussetzen
      await db.execute(
        sql.raw(`DO $$ BEGIN
          ALTER TABLE invoices DISABLE TRIGGER USER;
          DELETE FROM invoices;
          ALTER TABLE invoices ENABLE TRIGGER USER;
        END $$`),
      )
    } else await db.execute(sql.raw(`DELETE FROM "${table}"`))
  }
}
