import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PRODUCT_CATEGORIES } from '@/lib/enums'

import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P1.15: Collection `categories` (DATENMODELL §6.5). Slugs kommen hier aus Testdaten, nie aus dem Anwendungscode.

const ADMIN = { email: 'admin@example.com', password: 'richtig-langes-passwort-2026' }
const SLUGS: Record<string, { de: string; en: string }> = {
  keramik: { de: 'keramik', en: 'ceramics' },
  textil: { de: 'textil', en: 'textiles' },
  cap: { de: 'caps', en: 'caps' },
  zeichnung: { de: 'zeichnungen', en: 'drawings' },
  schmuck: { de: 'schmuck', en: 'jewellery' },
  sonstiges: { de: 'sonstiges', en: 'other' },
}

let payload: Payload
const ids: Record<string, number> = {}
const SEED = { seed: true, skipAudit: true }

async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as { message?: string; data?: { errors?: { message: string }[] } },
  )
  expect(err, `erwartet Ablehnung mit ${re}`).not.toBeNull()
  const text = [err!.message ?? '', ...(err!.data?.errors ?? []).map((x) => x.message)].join(' | ')
  expect(text).toMatch(re)
}

async function removeAll() {
  await payload.delete({
    collection: 'categories',
    where: { id: { exists: true } },
    overrideAccess: true,
    context: SEED,
  })
}

async function adminHeaders() {
  const login = await rest('POST', '/users/login', ADMIN, { 'x-forwarded-for': '198.51.100.21' })
  return { authorization: `JWT ${((await login.json()) as { token: string }).token}` }
}

beforeAll(async () => {
  payload = await getTestPayload()
  await removeAll()
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'users',
    data: { ...ADMIN, name: 'Jutta', role: 'admin' },
    overrideAccess: true,
  })
  for (const [i, key] of PRODUCT_CATEGORIES.entries()) {
    const doc = await payload.create({
      collection: 'categories',
      data: { key, slug: SLUGS[key]!.de, sortOrder: (i + 1) * 10 } as never,
      locale: 'de',
      overrideAccess: true,
      context: SEED,
    })
    await payload.update({
      collection: 'categories',
      id: doc.id,
      data: { slug: SLUGS[key]!.en, name: undefined } as never,
      locale: 'en',
      overrideAccess: true,
      context: SEED,
    })
    ids[key] = doc.id as number
  }
})

afterAll(async () => {
  await removeAll()
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
})

describe('categories – feste sechs Kategorien (DATENMODELL §6.5)', () => {
  it('Grund-Seed legt 6 an: Namen aus §4, Slugs je Sprache, sonstiges nicht in der Navigation', async () => {
    const de = await payload.find({ collection: 'categories', locale: 'de', sort: 'sortOrder' })
    expect(de.docs.map((d) => d.key)).toEqual([...PRODUCT_CATEGORIES])
    expect(de.docs.map((d) => d.name)).toEqual([
      'Keramik',
      'Textil',
      'Caps',
      'Zeichnungen',
      'Schmuck',
      'Sonstiges',
    ])
    const en = await payload.findByID({ collection: 'categories', id: ids.schmuck!, locale: 'en' })
    expect(en.slug).toBe('jewellery')
    const nav = Object.fromEntries(de.docs.map((d) => [d.key, d.showInNavigation]))
    expect(nav.sonstiges).toBe(false)
    expect(nav.keramik).toBe(true)
  })

  it('das Anlegen einer 7. Kategorie scheitert per Local API ohne context.seed und per REST', async () => {
    await rejects(
      payload.create({
        collection: 'categories',
        data: { key: 'keramik', slug: 'neu', sortOrder: 70 } as never,
        overrideAccess: true,
      }),
      /fest vorgegeben/,
    )
    // Auch mit Seed-Kontext bleibt es bei 6 (Schlüssel eindeutig)
    await expect(
      payload.create({
        collection: 'categories',
        data: { key: 'keramik', slug: 'keramik-zwei', sortOrder: 70 } as never,
        overrideAccess: true,
        context: SEED,
      }),
    ).rejects.toThrow()
    const body = { key: 'sonstiges', name: 'Neu', slug: 'neu', sortOrder: 70 }
    expect((await rest('POST', '/categories', body)).status).toBe(403)
    expect((await rest('POST', '/categories', body, await adminHeaders())).status).toBe(403)
    expect((await payload.count({ collection: 'categories' })).totalDocs).toBe(6)
  })

  it('zwei gleiche DE-Slugs werden abgelehnt; key ist unveränderlich', async () => {
    await rejects(
      payload.update({
        collection: 'categories',
        id: ids.textil!,
        data: { slug: 'keramik' } as never,
        locale: 'de',
        overrideAccess: true,
      }),
      /Slug/,
    )
    await rejects(
      payload.update({
        collection: 'categories',
        id: ids.textil!,
        data: { slug: 'Textil Neu' } as never,
        locale: 'de',
        overrideAccess: true,
      }),
      /Kleinbuchstaben/,
    )
    await rejects(
      payload.update({
        collection: 'categories',
        id: ids.textil!,
        data: { key: 'cap' } as never,
        overrideAccess: true,
      }),
      /unveränderlich/,
    )
    // Gleicher Slug in DE und EN derselben Kategorie ist erlaubt (caps)
    const cap = await payload.findByID({ collection: 'categories', id: ids.cap!, locale: 'en' })
    expect(cap.slug).toBe('caps')
  })

  it('Verwaltung darf Texte ändern, aber nicht löschen; öffentlich lesbar', async () => {
    const headers = await adminHeaders()
    const res = await rest(
      'PATCH',
      `/categories/${ids.keramik}?locale=de`,
      { intro: 'Neuer Text' },
      headers,
    )
    expect(res.status).toBe(200)
    expect((await rest('DELETE', `/categories/${ids.keramik}`, undefined, headers)).status).toBe(
      403,
    )
    await rejects(
      payload.delete({ collection: 'categories', id: ids.keramik!, overrideAccess: true }),
      /gelöscht/,
    )
    expect((await rest('PATCH', `/categories/${ids.keramik}`, { intro: 'x' })).status).toBe(403)
    const pub = await rest('GET', '/categories?locale=en&sort=sortOrder')
    expect(pub.status).toBe(200)
    const list = (await pub.json()) as { docs: { slug: string }[] }
    expect(list.docs.map((d) => d.slug)).toContain('jewellery')
  })
})
