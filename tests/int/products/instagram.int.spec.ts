import sharp from 'sharp'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// V-39 (U-93, P20.6): „Für Instagram“ – Story-Bild 1080 × 1920 (satori/OG-Renderer) und das erste Foto als JPEG
// 1080 × 1350 zum Teilen, nur für die Verwaltung, `private, no-store`, ohne Meta-Schnittstelle.

let payload: Payload
let fx: ProductFixtures
let token: string
let withPhoto: number
let noPhoto: number

const auth = () => ({ authorization: `JWT ${token}` })

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  token = (await resetAdmin(payload, '198.51.100.72')).token
  withPhoto = (await createProduct(payload, completeProduct('keramik', 991, fx))).id as number
  noPhoto = (await createProduct(payload, completeProduct('keramik', 992, fx, { images: [] })))
    .id as number
})

afterAll(async () => {
  await deleteProducts(payload)
})

describe('Für Instagram (V-39)', () => {
  it('Story-Bild: nur Verwaltung, PNG 1080 × 1920, Dateiname mit Nummer, nicht zwischengespeichert', async () => {
    const url = `/products/${withPhoto}/instagram-story.png`
    expect((await rest('GET', url)).status).toBe(403)
    const res = await rest('GET', url, undefined, auth())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('content-disposition')).toContain('planet-claire-nr-991-story.png')
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta).toMatchObject({ format: 'png', width: 1080, height: 1920 })
  }, 60_000)

  it('Foto zum Teilen: JPEG 1080 × 1350; ohne Foto 404; unbekanntes Stück 404', async () => {
    const res = await rest('GET', `/products/${withPhoto}/instagram-photo.jpg`, undefined, auth())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta).toMatchObject({ format: 'jpeg', width: 1080, height: 1350 })
    expect(
      (await rest('GET', `/products/${noPhoto}/instagram-photo.jpg`, undefined, auth())).status,
    ).toBe(404)
    expect(
      (await rest('GET', `/products/999999/instagram-story.png`, undefined, auth())).status,
    ).toBe(404)
    expect((await rest('GET', `/products/${withPhoto}/instagram-photo.jpg`)).status).toBe(403)
  }, 60_000)
})
