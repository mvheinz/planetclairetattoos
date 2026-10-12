import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { toSaveData, formFromDoc, pieceLocks } from '@/admin/views/pieces/pieceForm'
import { parsePiecesQuery, queryPieces } from '@/admin/views/pieces/piecesQuery'
import { getTodaySummary } from '@/lib/admin/today'
import { transitionProduct } from '@/lib/commerce/productTransitions'

import { adminReq, resetAdmin } from '../helpers/admin'
import { createOrder, dbOf, deleteCommerce, orderData } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P20.6 (U-93) – Verwaltung, Teil 1:
// V-31 „Bitte prüfen“ direkt am Stück abhaken: „Erledigt“ löscht nur Markierungen von Hand (Stück und Bestellung),
//      erstes Online-Stellen löscht die Import-Markierung, „Heute“ zeigt EINE gelbe Sammelzeile mit Live-Zahl und Link
//      auf den Filter „zu prüfen“, Systemgründe bleiben einzeln rot; Speichern im Formular ändert die Markierung nie.
// V-32 „was fehlt noch?“ je Entwurf (dieselbe Prüfung wie beim Online-Stellen) und „Alle fertigen online stellen“ ohne
//      Bestätigungen zu setzen (R-047). V-15 „Bitte erst nachmessen“ sperrt das Online-Stellen.

let payload: Payload
let fx: ProductFixtures
let token: string
let req: PayloadRequest
let nr = 980

const auth = () => ({ authorization: `JWT ${token}` })
const MANUAL = { flag: true, reason: 'manual', note: 'Bitte prüfen: aus deinen Fotos angelegt.' }
const byId = (id: number) =>
  payload.findByID({ collection: 'products', id, depth: 0, overrideAccess: true })
const draft = async (overrides: Record<string, unknown> = {}, category = 'keramik' as const) => {
  const p = await createProduct(payload, completeProduct(category, nr++, fx, overrides))
  return { id: p.id as number, itemNumber: p.itemNumber as number }
}
const flag = (id: number, reason: string) =>
  dbOf(payload).execute(
    sql`UPDATE products SET admin_attention_flag = true, admin_attention_reason = ${reason}, admin_attention_note = 'Notiz' WHERE id = ${id}`,
  )
const run = (params: Record<string, string>) => queryPieces(req, parsePiecesQuery(params))
const clean = async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  const acc = await resetAdmin(payload, '198.51.100.130')
  token = acc.token
  req = await adminReq(payload, acc.userId)
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('V-31 Markierung „zu prüfen“', () => {
  it('„Heute“: eine gelbe Sammelzeile mit Live-Zahl und Link auf den Filter; Systemgrund bleibt einzeln rot', async () => {
    await clean()
    const a = await draft({ adminAttention: MANUAL })
    const b = await draft({ adminAttention: MANUAL })
    const c = await draft({ adminAttention: MANUAL })
    const revoked = await draft()
    await flag(revoked.id, 'conformity_revoked')
    const hints = (await getTodaySummary(new Date(), payload)).hints
    const review = hints.filter((h) => h.id === 'products-review')
    expect(review).toEqual([
      {
        id: 'products-review',
        tone: 'warning',
        text: '3 Stücke warten auf deine Prüfung.',
        href: '/stuecke?pruefen=1',
        linkLabel: 'Zu prüfen ansehen',
      },
    ])
    for (const p of [a, b, c]) {
      expect(hints.find((h) => h.id === `attention-product-${p.id}`)).toBeUndefined()
    }
    expect(hints.find((h) => h.id === `attention-product-${revoked.id}`)).toMatchObject({
      tone: 'error',
    })
    // rote Hinweise stehen vor der gelben Sammelzeile
    const order = hints.map((h) => h.id)
    expect(order.indexOf(`attention-product-${revoked.id}`)).toBeLessThan(
      order.indexOf('products-review'),
    )

    // Filter „zu prüfen“: genau die drei, mit Markierung an der Karte
    const filtered = await run({ pruefen: '1' })
    expect(filtered.cards.map((x) => x.id).sort()).toEqual([a.id, b.id, c.id].sort())
    expect(filtered.cards[0]!.attention).toMatchObject({ manual: true, note: MANUAL.note })
    const all = await run({})
    expect(all.cards.find((x) => x.id === revoked.id)!.attention).toMatchObject({
      manual: false,
      label: 'Konformitätserklärung widerrufen',
    })

    // „Erledigt“ am Stück → Zahl sinkt live
    const done = await rest('POST', `/products/${a.id}/attention-done`, {}, auth())
    expect(done.status).toBe(200)
    expect((await byId(a.id)).adminAttention).toMatchObject({ flag: false })
    const after = (await getTodaySummary(new Date(), payload)).hints
    expect(after.find((h) => h.id === 'products-review')!.text).toBe(
      '2 Stücke warten auf deine Prüfung.',
    )
    // zweimal tippen: nichts mehr zu tun
    const again = await rest('POST', `/products/${a.id}/attention-done`, {}, auth())
    expect(await again.json()).toMatchObject({ unchanged: true })
    // Systemgrund lässt sich so nicht abhaken
    const refused = await rest('POST', `/products/${revoked.id}/attention-done`, {}, auth())
    expect(refused.status).toBe(409)
    expect((await byId(revoked.id)).adminAttention).toMatchObject({
      flag: true,
      reason: 'conformity_revoked',
    })
    // nur Verwaltung
    expect((await rest('POST', `/products/${b.id}/attention-done`, {})).status).toBe(403)
  })

  it('erstes Online-Stellen löscht die Markierung von Hand; Speichern im Formular ändert sie nie', async () => {
    const p = await draft({ adminAttention: MANUAL })
    // Formular speichern (DE und EN): Markierung bleibt
    const de = await byId(p.id)
    const form = formFromDoc(de as unknown as Record<string, unknown>, null)
    const save = await rest(
      'PATCH',
      `/products/${p.id}?locale=de&depth=0`,
      toSaveData(form, { priceCents: 4500, images: [fx.mediaId], locks: pieceLocks('draft', null) }),
      auth(),
    )
    expect(save.status).toBe(200)
    expect((await byId(p.id)).adminAttention).toMatchObject({ flag: true, reason: 'manual' })
    // erstes Online-Stellen
    const pub = await rest('POST', `/products/${p.id}/publish`, {}, auth())
    expect(pub.status).toBe(200)
    expect((await byId(p.id)).adminAttention).toMatchObject({ flag: false })
    // Speichern eines erledigten Stücks setzt nichts wieder
    const save2 = await rest(
      'PATCH',
      `/products/${p.id}?locale=de&depth=0`,
      toSaveData(formFromDoc((await byId(p.id)) as unknown as Record<string, unknown>, null), {
        priceCents: 4500,
        images: [fx.mediaId],
        locks: pieceLocks('available', '2026-10-12'),
      }),
      auth(),
    )
    expect(save2.status).toBe(200)
    expect((await byId(p.id)).adminAttention).toMatchObject({ flag: false })
  })

  it('Bestellung: „Erledigt“ nur für Markierung von Hand, Systemgrund bleibt (409)', async () => {
    const p = await draft()
    const manual = await createOrder(
      payload,
      orderData(90_131, [p], {
        seed: true,
        adminAttention: { flag: true, reason: 'manual', note: 'Kasse per Vorkasse abgeschlossen' },
      }),
      { seed: true },
    )
    const system = await createOrder(
      payload,
      orderData(90_132, [p], {
        seed: true,
        adminAttention: { flag: true, reason: 'refund_failed' },
      }),
      { seed: true },
    )
    const ok = await rest('POST', `/orders/${manual.id}/attention-done`, {}, auth())
    expect(ok.status).toBe(200)
    const doc = await payload.findByID({
      collection: 'orders',
      id: manual.id as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(doc.adminAttention).toMatchObject({ flag: false })
    const no = await rest('POST', `/orders/${system.id}/attention-done`, {}, auth())
    expect(no.status).toBe(409)
  })
})

describe('V-32 „was fehlt noch?“ und „Alle fertigen online stellen“', () => {
  it('Karte: „fertig“ bzw. Stichworte; V-15 nachmessen; Schmuck-Tipp „Foto an der Hand“ sperrt nicht', async () => {
    await clean()
    const ready = await draft()
    const missing = await draft({ ownDesignConfirmed: false, weightGrams: null })
    const estimated = await draft({
      dimensions: { diameterCm: 8, heightCm: 5, note: 'ca. 8 cm – geschätzt' },
    })
    const jewel = await draft({}, 'schmuck' as never)
    const cards = new Map((await run({ status: 'draft' })).cards.map((c) => [c.id, c]))
    expect(cards.get(ready.id)!.readiness).toMatchObject({ ready: true, missing: [] })
    expect(cards.get(missing.id)!.readiness).toMatchObject({
      ready: false,
      missing: ['Gewicht', 'Häkchen „eigene Figuren“'],
    })
    expect(cards.get(estimated.id)!.readiness).toMatchObject({
      ready: false,
      missing: ['nachmessen'],
    })
    expect(cards.get(jewel.id)!.readiness).toMatchObject({
      ready: true,
      hints: [{ id: 'scalePhotoHand', label: 'Foto an der Hand' }],
    })
    // dieselbe Prüfung wie beim Online-Stellen: „nachmessen“ sperrt mit „Bitte erst nachmessen“
    const blocked = await rest('POST', `/products/${estimated.id}/publish`, {}, auth())
    expect(blocked.status).toBe(400)
    const body = (await blocked.json()) as { errors: { path: string; message: string }[] }
    expect(body.errors.map((e) => e.path)).toEqual(['dimensions.note'])
    expect(body.errors[0]!.message).toMatch(/^Bitte erst nachmessen/)
    // nicht für Entwürfe aus anderen Status
    const online = await draft()
    await transitionProduct(req, online.id, 'publish')
    expect((await run({})).cards.find((c) => c.id === online.id)!.readiness).toBeNull()
  })

  it('EN-Maß-Hinweis mit „estimated“ sperrt auch beim Speichern eines Stücks im Shop (beide Sprachen)', async () => {
    const p = await draft({ dimensions: { diameterCm: 8, note: 'ca. 8 cm' } })
    await transitionProduct(req, p.id, 'publish')
    const res = await rest(
      'PATCH',
      `/products/${p.id}?locale=en&depth=0`,
      { dimensions: { note: 'approx. 8 cm – estimated' } },
      auth(),
    )
    expect(res.status).toBe(400)
    // DE speichern lässt den EN-Text nicht unbemerkt durch: Prüfung sieht beide Sprachen
    await dbOf(payload).execute(
      sql`UPDATE products_locales SET dimensions_note = 'approx. 8 cm – estimated' WHERE _parent_id = ${p.id} AND _locale = 'en'`,
    )
    const de = await rest(
      'PATCH',
      `/products/${p.id}?locale=de&depth=0`,
      { dimensions: { diameterCm: 8, note: 'ca. 8 cm, gemessen' } },
      auth(),
    )
    expect(de.status).toBe(400)
  })

  it('Sammelaktion: zählt fertige, stellt nur sie online, setzt nie Bestätigungen, meldet Erfolge', async () => {
    await clean()
    const ok1 = await draft({ adminAttention: MANUAL })
    const ok2 = await draft()
    const notMine = await draft({ ownDesignConfirmed: false })
    const noNickel = await draft({ nickelFreeConfirmed: false }, 'schmuck' as never)

    expect((await rest('GET', '/products/publish-ready')).status).toBe(403)
    const count = await rest('GET', '/products/publish-ready', undefined, auth())
    const counted = (await count.json()) as { drafts: number; ready: { id: number }[] }
    expect(counted.drafts).toBe(4)
    expect(counted.ready.map((r) => r.id).sort()).toEqual([ok1.id, ok2.id].sort())

    const res = await rest('POST', '/products/publish-ready', {}, auth())
    expect(res.status).toBe(200)
    const report = (await res.json()) as {
      published: { id: number }[]
      failed: unknown[]
      remaining: number
    }
    expect(report.published.map((r) => r.id).sort()).toEqual([ok1.id, ok2.id].sort())
    expect(report).toMatchObject({ failed: [], remaining: 0 })
    expect((await byId(ok1.id)).status).toBe('available')
    expect((await byId(ok1.id)).adminAttention).toMatchObject({ flag: false })
    const a = await byId(notMine.id)
    const b = await byId(noNickel.id)
    expect(a).toMatchObject({ status: 'draft', ownDesignConfirmed: false })
    expect(b).toMatchObject({ status: 'draft', nickelFreeConfirmed: false })

    // nichts mehr fertig → leerer Bericht (zweiter Tipp ohne Wirkung)
    const again = (await (await rest('POST', '/products/publish-ready', {}, auth())).json()) as {
      published: unknown[]
    }
    expect(again.published).toEqual([])
  })
})
