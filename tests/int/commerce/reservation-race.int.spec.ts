import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { startCheckout, type StartCheckoutResult } from '@/lib/commerce/checkout'
import type { PaymentsAdapter } from '@/lib/payments'
import { __setSystemFilesForTests } from '@/lib/storage/systemFiles'

import { cartOf, piece, useMemorySystemFiles } from '../helpers/checkout'
import { dbOf, deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import { createProductFixtures, deleteProducts } from '../helpers/products'

// AK-4-07 / T-01 / EK-03 (KONZEPT §4.6, DATENMODELL §8.1): 20 gleichzeitige Kassenstarts für dasselbe Stück über 20
// getrennte DB-Verbindungen (eigene Transaktion je Start, Pool ≥ 25) → genau 1 Erfolg, 19 „gerade reserviert“; 100
// Wiederholungen. Der CHECK `products_reserved_consistent` und der partielle UNIQUE-Index würden jede Verletzung als
// Fehler melden – es darf keiner auftreten.

vi.hoisted(() => {
  process.env.DB_POOL_MAX = '25'
})

const PARALLEL = 20
const ROUNDS = 100
const NOW = new Date('2026-09-28T10:00:00.000Z')

let payload: Payload
let productId: number

/** Zahlungsanbieter ohne DB-Zugriff: der Test misst nur das Rennen um die Reservierung. */
const payments = {
  driver: 'mock',
  mode: 'mock',
  createCheckoutSession: async (i: { checkoutRef: string; expiresAt: Date }) => ({
    sessionId: `cs_mock_race_${i.checkoutRef}`,
    clientSecret: 'mock_secret_race',
    expiresAt: i.expiresAt,
  }),
  expireCheckoutSession: async () => 'expired' as const,
} as unknown as PaymentsAdapter

beforeAll(async () => {
  payload = await getTestPayload()
  useMemorySystemFiles()
  const fx = await createProductFixtures(payload)
  productId = await piece(payload, fx, 980)
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload, [980])
  __setSystemFilesForTests(undefined)
})

async function resetRound(): Promise<void> {
  await deleteCommerce(payload)
  await dbOf(payload).execute(sql`
    UPDATE products SET status = 'available', reserved_until = NULL, reservation_ref = NULL WHERE id = ${productId}
  `)
}

describe('AK-4-07 Wettlauf um ein Stück', () => {
  it('der Pool hat mindestens 25 Verbindungen (DB_POOL_MAX)', () => {
    const pool = (payload.db as unknown as { pool: { options: { max: number } } }).pool
    expect(pool.options.max).toBeGreaterThanOrEqual(25)
  })

  it(`T-01/EK-03 ${PARALLEL} gleichzeitige Starts → genau 1 Erfolg, ${PARALLEL - 1} „gerade reserviert“ (${ROUNDS} Runden)`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await resetRound()
      const results: StartCheckoutResult[] = await Promise.all(
        Array.from({ length: PARALLEL }, () =>
          startCheckout(
            { cart: cartOf([{ id: productId }]), locale: 'de', existingToken: null, now: NOW },
            { payload, payments },
          ),
        ),
      )
      const wins = results.filter((r) => r.ok)
      const reserved = results.filter((r) => !r.ok && r.code === 'reserved')
      expect(wins, `Runde ${round}`).toHaveLength(1)
      expect(reserved, `Runde ${round}`).toHaveLength(PARALLEL - 1)
      for (const r of reserved)
        expect(r).toEqual({ ok: false, code: 'reserved', itemNumbers: [980] })

      const db = dbOf(payload)
      const counts = await db.execute(sql`
          SELECT (SELECT count(*)::int FROM checkouts) AS checkouts,
                 (SELECT count(*)::int FROM reservations WHERE status = 'active') AS active,
                 (SELECT reservation_ref FROM products WHERE id = ${productId}) AS ref
        `)
      const row = counts.rows[0]!
      expect(row.checkouts, `Runde ${round}: keine verwaisten Kassen`).toBe(1)
      expect(row.active).toBe(1)
      expect(row.ref).toBe(wins[0]!.ok ? wins[0]!.reservationRef : null)
    }
  }, 600_000)
})
