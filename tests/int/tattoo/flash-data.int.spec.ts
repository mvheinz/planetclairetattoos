import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { loadFlash, sortFlash } from '@/lib/data/tattoo'
import { resetEnvCache } from '@/lib/env'
import { tattooMailto } from '@/lib/tattoo/mailto'

import { getTestPayload } from '../helpers/payload'
import { createTestImage } from '../helpers/products'

// P7.2 – Daten der Flash-Seite R12 (KONZEPT §9.3): Fixture-Motive 981–985 (analog F-901, F-903, F-905; `seed = true`),
// verfügbare nach `sortOrder`, dann vergebene; offline genommene fehlen; Anker `f-981`; Mail-Betreff AK-9-02.

const NUMBERS = [981, 982, 983, 984, 985]
let payload: Payload
let image: number

async function cleanup() {
  await payload.delete({
    collection: 'flash',
    where: { number: { in: NUMBERS } },
    overrideAccess: true,
    context: { seed: true },
  })
}

beforeAll(async () => {
  payload = await getTestPayload()
  await cleanup()
  image = await createTestImage(payload, 'Kelch mit Schlange, Tusche')
  const base = { image, sizeCm: 9, priceCents: 12000, seed: true }
  const make = (data: Record<string, unknown>) =>
    payload.create({
      collection: 'flash',
      data: { ...base, ...data } as never,
      overrideAccess: true,
      context: { seed: true },
    })
  await make({ number: 983, title: 'Hasen-Trio', status: 'claimed', sortOrder: 1 })
  await make({ number: 981, title: 'Kelch mit Schlange', status: 'available', sortOrder: 30 })
  await make({ number: 985, title: 'Herz mit Beinen', status: 'claimed', sortOrder: 0 })
  await make({
    number: 982,
    title: 'Winziger Planet',
    status: 'available',
    sortOrder: 10,
    repeatable: true,
  })
  await make({ number: 984, title: 'Offline', status: 'available', sortOrder: 5, published: false })
  await payload.update({
    collection: 'flash',
    where: { number: { equals: 981 } },
    locale: 'en',
    data: { title: 'Chalice with snake' } as never,
    overrideAccess: true,
    context: { seed: true },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

afterAll(async () => {
  await cleanup()
  await payload.delete({ collection: 'media', id: image, overrideAccess: true }).catch(() => null)
})

describe('Flash-Daten (P7.2)', () => {
  it('AK-9-02 verfügbare nach sortOrder, dann vergebene; offline fehlt; Anker und Betreff', async () => {
    vi.stubEnv('SEED_PREVIEW_MODE', 'true')
    resetEnvCache()
    const de = (await loadFlash('de')).filter((f) => NUMBERS.includes(f.number))
    expect(de.map((f) => [f.display, f.status])).toEqual([
      ['F-982', 'available'],
      ['F-981', 'available'],
      ['F-985', 'claimed'],
      ['F-983', 'claimed'],
    ])
    const f981 = de.find((f) => f.number === 981)!
    expect(f981).toMatchObject({ anchor: 'f-981', title: 'Kelch mit Schlange', priceCents: 12000 })
    expect(f981.image?.url).toBeTruthy()
    expect(de.find((f) => f.number === 982)?.repeatable).toBe(true)
    const href = tattooMailto('jutta@planetclairetattoos.com', { kind: 'flash', ...f981 }, 'de')!
    expect(href).toContain('subject=Flash-Anfrage%20F-981%20%E2%80%93%20Kelch%20mit%20Schlange&')

    const en = (await loadFlash('en')).find((f) => f.number === 981)!
    expect(en.title).toBe('Chalice with snake')
  })

  it('Seed-Motive erscheinen öffentlich nur im Vorschau-Modus (DATENMODELL §1.4 Regel 4)', async () => {
    vi.stubEnv('SEED_PREVIEW_MODE', 'false')
    resetEnvCache()
    const list = await loadFlash('de')
    expect(list.filter((f) => NUMBERS.includes(f.number))).toEqual([])
  })

  it('sortFlash ist stabil über Nummern bei gleichem sortOrder', () => {
    const list = [
      { status: 'claimed', sortOrder: 1, number: 3 },
      { status: 'available', sortOrder: 2, number: 2 },
      { status: 'available', sortOrder: 2, number: 1 },
    ]
    expect(sortFlash(list).map((f) => f.number)).toEqual([1, 2, 3])
  })
})
