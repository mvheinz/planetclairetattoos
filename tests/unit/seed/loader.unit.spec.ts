import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { loadSeedData, SeedDataError } from '@/lib/seed/loader'
import { CANONICAL_SEED_NOW } from '@/lib/seed/time'

// P1.28: Der Lader prüft alle Datendateien, bevor irgendetwas geschrieben wird (alles oder nichts, SEED-SPEC §1.7).

const now = new Date(CANONICAL_SEED_NOW)
let dir: string | undefined

async function withFiles(files: Record<string, unknown>): Promise<string> {
  dir = await mkdtemp(path.join(tmpdir(), 'seed-data-'))
  for (const [name, value] of Object.entries(files)) {
    await writeFile(path.join(dir, name), typeof value === 'string' ? value : JSON.stringify(value))
  }
  return dir
}

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = undefined
})

describe('Seed-Lader (P1.28)', () => {
  it('ohne Datendateien: leerer Beispielbestand; base.json nur bei Bedarf Pflicht', async () => {
    const d = await withFiles({})
    const data = await loadSeedData({ dir: d, now })
    expect(data.base).toBeNull()
    expect(data.products).toEqual([])
    await expect(loadSeedData({ dir: d, now, requireBase: true })).rejects.toThrow(
      /base.json fehlt/,
    )
  })

  it('eine ungültige Datendatei bricht vor dem ersten Schreiben ab – alle Fehler auf einmal', async () => {
    const d = await withFiles({
      'products.json': [{ key: 'S01', itemNumber: 17, category: 'vase' }],
      'pages.json': '{ kein JSON',
    })
    const err = await loadSeedData({ dir: d, now }).then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(SeedDataError)
    const issues = (err as SeedDataError).issues.join('\n')
    expect(issues).toMatch(/pages.json/)
    expect(issues).toMatch(/products.json 0.itemNumber/)
    expect(issues).toMatch(/products.json 0.category/)
  })

  it('Verweise und Zeitausdrücke werden dateiübergreifend geprüft', async () => {
    const d = await withFiles({
      'orders.json': {
        checkouts: [
          {
            key: 'KS2',
            status: 'open',
            locale: 'de',
            items: ['products:S27'],
            fulfillmentMethod: 'shipping',
            reservationRef: '00000000-0000-4000-8000-000000090102',
            createdAt: 'N-6min',
            displayExpiresAt: 'N+24min',
            expiresAt: 'D-2@25:00',
            stripe: {
              checkoutSessionId: 'cs_seed_ks2',
              sessionExpiresAt: 'N+25min',
              sessionSeq: 1,
            },
          },
        ],
        orders: [],
        reservations: [],
      },
    })
    const err = (await loadSeedData({ dir: d, now }).catch((e: unknown) => e)) as SeedDataError
    expect(err).toBeInstanceOf(SeedDataError)
    expect(err.issues.join('\n')).toMatch(/products:S27 fehlt/)
    expect(err.issues.join('\n')).toMatch(/expiresAt: Ungültige Uhrzeit/)
  })
})
