import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getTestPayload } from '../helpers/payload'
import { createProduct, deleteProducts } from '../helpers/products'
import { rest } from '../helpers/rest'

// P1.17: Objektnummern und Slug (E-12, R-041, DATENMODELL §6.6.4, §6.6.8, §13.3).

const ADMIN = { email: 'admin@example.com', password: 'richtig-langes-passwort-2026' }
let payload: Payload
let token: string

async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as { message?: string; data?: { errors?: { message: string }[] } },
  )
  expect(err, `erwartet Ablehnung mit ${re}`).not.toBeNull()
  const text = [err!.message ?? '', ...(err!.data?.errors ?? []).map((x) => x.message)].join(' | ')
  expect(text).toMatch(re)
}

const draft = (itemNumber: number, extra: Record<string, unknown> = {}) =>
  createProduct(payload, {
    itemNumber,
    category: 'sonstiges',
    title: `Stück ${itemNumber}`,
    priceCents: 2000,
    ...extra,
  })

const byId = (id: number | string, locale: 'de' | 'en') =>
  payload.findByID({ collection: 'products', id, locale, depth: 0, overrideAccess: true })

async function setExampleData(present: boolean) {
  await payload.updateGlobal({
    slug: 'settings',
    data: { seed: { exampleDataPresent: present } } as never,
    overrideAccess: true,
  })
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteProducts(payload)
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'users',
    data: { ...ADMIN, name: 'Jutta', role: 'admin' } as never,
    overrideAccess: true,
  })
  const login = await rest('POST', '/users/login', ADMIN, { 'x-forwarded-for': '198.51.100.17' })
  token = ((await login.json()) as { token: string }).token
})

afterAll(async () => {
  await setExampleData(false)
  await deleteProducts(payload)
})

describe('Objektnummer (DM-PROD-05, R-041)', () => {
  it('R-041 Nummernvorschlag: echte Stücke 1, 2, 17 und Seed 901 → 18; nur Verwaltung', async () => {
    for (const nr of [1, 2, 17]) await draft(nr)
    await draft(901, { seed: true })
    await setExampleData(true)
    const res = await rest('GET', '/products/next-item-number', undefined, {
      authorization: `JWT ${token}`,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ suggestion: 18 })
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect((await rest('GET', '/products/next-item-number')).status).toBe(403)
  })

  it('DM-PROD-05 doppelte itemNumber wird mit nächster freier Nummer abgelehnt', async () => {
    await draft(18)
    await rejects(draft(17), /Nr\. 017 ist schon vergeben – nächste freie: Nr\. 019/)
  })

  it('R-041 ohne Angabe wird der Vorschlag eingetragen', async () => {
    const doc = await createProduct(payload, {
      category: 'sonstiges',
      title: 'Ohne Nummer',
      priceCents: 1500,
    })
    expect(doc.itemNumber).toBe(19)
  })

  it('R-041 901–999 sind für die Verwaltung gesperrt, solange Beispieldaten existieren', async () => {
    const user = (await payload.find({ collection: 'users', limit: 1, overrideAccess: true }))
      .docs[0]!
    const data = { itemNumber: 950, category: 'sonstiges', title: 'Gesperrt', priceCents: 1000 }
    await rejects(
      payload.create({ collection: 'products', data: data as never, user, overrideAccess: true }),
      /901–999 sind für Beispieldaten reserviert/,
    )
    const seeded = await createProduct(payload, { ...data, seed: true }, { seed: true })
    expect(seeded.itemNumber).toBe(950)
    await setExampleData(false)
    const free = await payload.create({
      collection: 'products',
      data: { ...data, itemNumber: 951 } as never,
      user,
      overrideAccess: true,
    })
    expect(free.itemNumber).toBe(951)
  })

  it('DM-PROD-05/AK-7-03 nach der Veröffentlichung unveränderlich – Local API und REST-PATCH', async () => {
    const doc = await draft(40)
    // Entwurf: Nummer frei änderbar, Slug zieht in beiden Sprachen nach.
    const moved = await payload.update({
      collection: 'products',
      id: doc.id,
      data: { itemNumber: 41 },
      overrideAccess: true,
    })
    expect(moved.itemNumber).toBe(41)
    expect(moved.slug).toBe('041-stueck-40')
    expect((await byId(doc.id, 'en')).slug).toBe('041-stueck-40')

    // Stand nach einer ersten Veröffentlichung (Systemfeld; seit P1.19 nur per Übergang bzw. Seed setzbar).
    await payload.update({
      collection: 'products',
      id: doc.id,
      data: { firstPublishedAt: '2026-09-01T10:00:00.000Z' },
      overrideAccess: true,
      context: { seed: true },
    })
    await rejects(
      payload.update({
        collection: 'products',
        id: doc.id,
        data: { itemNumber: 42 },
        overrideAccess: true,
      }),
      /seit der ersten Veröffentlichung fest \(Nr\. 041\)/,
    )
    const res = await rest(
      'PATCH',
      `/products/${doc.id}`,
      { itemNumber: 43 },
      {
        authorization: `JWT ${token}`,
      },
    )
    expect(res.status).toBeLessThan(500)
    expect((await byId(doc.id, 'de')).itemNumber).toBe(41)

    // Seed-Werkzeuge dürfen (Beispieldaten übernehmen/umnummerieren).
    const seeded = await payload.update({
      collection: 'products',
      id: doc.id,
      data: { itemNumber: 44 },
      overrideAccess: true,
      context: { seed: true },
    })
    expect(seeded.itemNumber).toBe(44)
  })
})

describe('Live-Prüfung der Objektnummer (P5.6, ARCHITEKTUR §2.5)', () => {
  const status = (q: string) =>
    rest('GET', `/products/item-number-status?${q}`, undefined, { authorization: `JWT ${token}` })

  it('„✓ frei“ bzw. „✗ vergeben: Nr. 017 Schale mit Hund“; eigenes Stück zählt nicht; nur Verwaltung', async () => {
    await deleteProducts(payload)
    const own = await draft(17, { title: 'Schale mit Hund' })
    const taken = await status('n=17')
    expect(taken.status).toBe(200)
    expect(taken.headers.get('cache-control')).toContain('no-store')
    expect(await taken.json()).toMatchObject({
      n: 17,
      status: 'taken',
      message: '✗ vergeben: Nr. 017 Schale mit Hund',
      product: { id: own.id, itemNumber: 17, title: 'Schale mit Hund' },
      nextFree: 18,
    })
    expect(await (await status('n=017')).json()).toMatchObject({ n: 17, status: 'taken' })
    expect(await (await status('n=18')).json()).toEqual({
      n: 18,
      status: 'free',
      message: '✓ frei',
    })
    expect(await (await status(`n=17&exclude=${own.id}`)).json()).toMatchObject({ status: 'free' })
    expect(await (await status('n=abc')).json()).toMatchObject({ status: 'invalid', n: null })
    expect(await (await status('n=100000')).json()).toMatchObject({ status: 'invalid' })
    expect((await rest('GET', '/products/item-number-status?n=17')).status).toBe(403)
  })

  it('901–999 bei vorhandenen Beispieldaten als gesperrt gemeldet', async () => {
    await setExampleData(true)
    expect(await (await status('n=950')).json()).toMatchObject({
      status: 'reserved',
      nextFree: 1000,
    })
    await setExampleData(false)
    expect(await (await status('n=950')).json()).toMatchObject({ status: 'free' })
  })
})

describe('Slug je Sprache (R-041, §6.6.8)', () => {
  it('„<nr3>-<slugify(titel)>“, EN aus dem EN-Titel, sonst aus dem deutschen', async () => {
    const doc = await draft(17_017, { title: 'Schale „Fuchs“ Nr. 1' })
    expect(doc.slug).toBe('17017-schale-fuchs-nr-1')
    const small = await draft(7, { title: 'Schale „Fuchs“ Nr. 1' })
    expect(small.slug).toBe('007-schale-fuchs-nr-1')
    expect((await byId(small.id, 'en')).slug).toBe('007-schale-fuchs-nr-1')

    await payload.update({
      collection: 'products',
      id: small.id,
      locale: 'en',
      data: { title: 'Fox bowl' },
      overrideAccess: true,
    })
    const en = await byId(small.id, 'en')
    expect(en.slug).toBe('007-fox-bowl')
    expect(en.adminTitle).toBe('Nr. 007 · Fox bowl')
    const de = await byId(small.id, 'de')
    expect(de.slug).toBe('007-schale-fuchs-nr-1')
    expect(de.displayNumber).toBe('007')
  })
})
