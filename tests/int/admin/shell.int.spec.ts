import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getStatusHistory } from '@/lib/audit'

import { resetAdmin } from '../helpers/admin'
import { deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P5.1 – Verwaltungs-Aktionen zustandsbasiert idempotent (ARCHITEKTUR §2.4: Zielzustand schon erreicht → 200
// `{ unchanged: true }`, keine zweite Wirkung) und „Alle Daten“ ohne Lösch-Knopf für veröffentlichte Stücke
// (KONZEPT §7.16: Lösch-Recht nur für nie veröffentlichte Entwürfe).

let payload: Payload
let fx: ProductFixtures
let token: string
let nr = 990

const auth = () => ({ authorization: `JWT ${token}` })
const draft = () => createProduct(payload, completeProduct('keramik', nr++, fx))

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  token = (await resetAdmin(payload, '198.51.100.51')).token
})

afterAll(async () => {
  await deleteProducts(payload)
})

describe('Verwaltungs-Gerüst (P5.1)', () => {
  it('Doppeltipp „Online stellen“: zweite Anfrage 200 { unchanged: true } ohne zweiten Übergang', async () => {
    const p = await draft()
    const first = await rest('POST', `/products/${p.id}/publish`, {}, auth())
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ unchanged: false, doc: { status: 'available' } })
    const second = await rest('POST', `/products/${p.id}/publish`, {}, auth())
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({ unchanged: true, doc: { status: 'available' } })
    const history = await getStatusHistory('products', p.id, { payload })
    expect(history.filter((h) => h.to === 'available')).toHaveLength(1)
    // Ein Übergang aus einem fremden Zustand bleibt 409 (kein stilles „unchanged“).
    const wrong = await rest('POST', `/products/${p.id}/restore`, {}, auth())
    expect(wrong.status).toBe(409)
  })

  it('„Alle Daten“: veröffentlichte Stücke nicht löschbar (kein Lösch-Recht), Entwürfe schon', async () => {
    const published = await draft()
    await rest('POST', `/products/${published.id}/publish`, {}, auth())
    const denied = await rest('DELETE', `/products/${published.id}`, undefined, auth())
    expect(denied.status).not.toBe(200)
    expect(
      await payload.findByID({ collection: 'products', id: published.id, overrideAccess: true }),
    ).toMatchObject({ id: published.id })

    const fresh = await draft()
    const ok = await rest('DELETE', `/products/${fresh.id}`, undefined, auth())
    expect(ok.status).toBe(200)
  })
})
