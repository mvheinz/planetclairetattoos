import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { CartCookie } from '@/lib/commerce/cartCookie'
import { __setPaymentsAdapterForTests } from '@/lib/payments'
import { createMockPaymentsAdapter, type MockPaymentsAdapter } from '@/lib/payments/mock'
import { __setSystemFilesForTests } from '@/lib/storage/systemFiles'
import type { SystemFileStore } from '@/lib/storage/types'
import type { Checkout } from '@/payload-types'

import { dbOf } from './commerce'
import { completeProduct, createProduct, type ProductFixtures } from './products'

// Hilfen für Kassenstart-Tests (P4.6/P4.7): verstellbare Uhr für den Mock-Zahlungsanbieter, Job-Wecker im Speicher,
// Stücke im Bereich 980–999 und Lesen des Zustands direkt aus der DB.

export interface TestClock {
  now(): Date
  set(iso: string | Date): void
}

export function testClock(start: string | Date): TestClock {
  let current = new Date(start)
  return {
    now: () => new Date(current),
    set: (iso) => {
      current = new Date(iso)
    },
  }
}

/** Mock-Anbieter mit injizierter Uhr (APP_ENV test, Test-API aktiv) als aktiver Adapter. */
export function useMockPayments(clock: TestClock): MockPaymentsAdapter {
  const adapter = createMockPaymentsAdapter({ clock, appEnv: 'test' })
  __setPaymentsAdapterForTests(adapter)
  return adapter
}

/** Job-Wecker & Co. im Speicher statt `.data/`. */
export function useMemorySystemFiles(): Map<string, unknown> {
  const files = new Map<string, unknown>()
  const store: SystemFileStore = {
    driver: 'local',
    readJson: async <T>(key: string) => (files.has(key) ? (files.get(key) as T) : null),
    writeJson: async (key, value) => {
      files.set(key, JSON.parse(JSON.stringify(value)))
    },
    remove: async (key) => {
      files.delete(key)
    },
  }
  __setSystemFilesForTests(store)
  return files
}

export const day = (d: number) => new Date(Date.UTC(2026, 8, d, 10)).toISOString()

export async function piece(
  payload: Payload,
  fx: ProductFixtures,
  nr: number,
  extra: Record<string, unknown> = {},
): Promise<number> {
  const doc = await createProduct(
    payload,
    completeProduct('keramik', nr, fx, {
      status: 'available',
      firstPublishedAt: day(1),
      ...extra,
    }),
  )
  return doc.id as number
}

export const cartOf = (
  items: { id: number; p?: number }[],
  delivery: CartCookie['delivery'] = 'shipping',
): CartCookie => ({ v: 1, items: items.map((i) => ({ id: i.id, p: i.p ?? 4500 })), delivery })

export interface ProductRow {
  status: string
  reserved_until: Date | null
  reservation_ref: string | null
}

export async function productRow(payload: Payload, id: number): Promise<ProductRow> {
  const res = await dbOf(payload).execute(
    sql`SELECT status, reserved_until, reservation_ref FROM products WHERE id = ${id}`,
  )
  return res.rows[0] as unknown as ProductRow
}

export async function reservationsOf(payload: Payload, productId: number) {
  const res = await dbOf(payload).execute(
    sql`SELECT ref, status, source, release_reason, expires_at, checkout_id FROM reservations
         WHERE product_id = ${productId} ORDER BY id`,
  )
  return res.rows as {
    ref: string
    status: string
    source: string
    release_reason: string | null
    expires_at: Date
    checkout_id: number
  }[]
}

export async function checkoutById(payload: Payload, id: number): Promise<Checkout> {
  return (await payload.findByID({
    collection: 'checkouts',
    id,
    depth: 0,
    overrideAccess: true,
  })) as Checkout
}

export async function countCheckouts(payload: Payload): Promise<number> {
  const res = await dbOf(payload).execute(sql`SELECT count(*)::int AS n FROM checkouts`)
  return Number(res.rows[0]?.n ?? 0)
}

/** Shop-Einstellungen ändern (ohne Revalidierung); liefert die Rücknahme. */
export async function setShop(payload: Payload, shop: Record<string, unknown>) {
  const before = await payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 0 })
  await payload.updateGlobal({
    slug: 'settings',
    data: { shop: { ...before.shop, ...shop } } as never,
    overrideAccess: true,
    locale: 'de',
    context: { seed: true },
  })
  return async () => {
    await payload.updateGlobal({
      slug: 'settings',
      data: { shop: before.shop } as never,
      overrideAccess: true,
      locale: 'de',
      context: { seed: true },
    })
  }
}

export interface SubmitForTestOptions {
  email?: string
  now: Date
  /** Nach dem Absenden `confirming` (Stripe-Weg, KONZEPT §4.10). */
  confirming?: boolean
  carrierEmailConsent?: boolean
  legal: Record<string, number>
}

/**
 * Kasse wie nach „Zahlungspflichtig bestellen“ (P4.10a folgt): Eingaben, Rechtsstand, `submittedAt`, optional
 * `confirming` über `transitionCheckout`.
 */
export async function submitForTest(
  payload: Payload,
  checkoutId: number,
  o: SubmitForTestOptions,
): Promise<Checkout> {
  const { createLocalReq } = await import('payload')
  const { transitionCheckout } = await import('@/lib/commerce/checkoutTransitions')
  const current = await checkoutById(payload, checkoutId)
  const shipping = current.fulfillmentMethod === 'shipping'
  await payload.update({
    collection: 'checkouts',
    id: checkoutId,
    data: {
      paymentChoice: 'stripe',
      customer: { email: o.email ?? 'kundin@planetclaire.local' },
      ...(shipping
        ? {
            shippingAddress: {
              name: 'Erika Beispiel',
              addressLine1: 'Musterstraße 1',
              postalCode: '10115',
              city: 'Berlin',
              country: 'DE',
            },
          }
        : {
            billingAddress: {
              name: 'Erika Beispiel',
              addressLine1: 'Musterstraße 1',
              postalCode: '10115',
              city: 'Berlin',
              country: 'DE',
            },
          }),
      carrierEmailConsent: shipping && o.carrierEmailConsent !== false,
      legalTextVersions: o.legal,
      legalSnippetVersions: {
        'checkout.legalNotice': { version: 'draft-1', sha256: 'a'.repeat(64) },
      },
      submittedAt: o.now.toISOString(),
    } as never,
    depth: 0,
    overrideAccess: true,
    context: { system: true, now: o.now.toISOString() },
  })
  if (o.confirming) {
    const req = await createLocalReq({ context: { system: true } }, payload)
    await transitionCheckout(req, checkoutId, 'confirming', { now: o.now })
  }
  return checkoutById(payload, checkoutId)
}

/** Zeile aus `webhook_events` zur Ereignis-ID. */
export async function webhookRow(payload: Payload, eventId: string) {
  const res = await dbOf(payload).execute(
    sql`SELECT status, attempts, last_error, related_checkout_id, related_order_id, type, provider
          FROM webhook_events WHERE event_id = ${eventId}`,
  )
  return res.rows[0] as
    | {
        status: string
        attempts: string | number
        last_error: string | null
        related_checkout_id: number | null
        related_order_id: number | null
        type: string
        provider: string
      }
    | undefined
}
