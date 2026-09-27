import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CONFORMITY_REVOKE_TRANSITION } from '@/collections/ConformityDeclarations'
import { PRODUCT_CATEGORIES, type ProductCategory } from '@/lib/enums'
import { MANDATORY_WARNING_TEXTS } from '@/lib/products/warnings'

import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P1.18: Veröffentlichungsprüfung im Speicher-Hook (DATENMODELL §6.6.6, R-042–R-048, AK-7-01).

const ADMIN = { email: 'admin@example.com', password: 'richtig-langes-passwort-2026' }
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)
const pdf = (name: string) => ({ data: PDF, name, mimetype: 'application/pdf', size: PDF.length })

let payload: Payload
let fx: ProductFixtures
let token: string
let activeDeclaration: number
let revokedDeclaration: number
let nextNumber = 1

type Err = { message?: string; data?: { errors?: { path: string; message: string }[] } }

/** Erwartet eine Ablehnung, die das Feld nennt (Pfad und Gesamtmeldung). */
async function rejectsWith(promise: Promise<unknown>, field: string, re?: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as Err,
  )
  expect(err, `erwartet Ablehnung wegen ${field}`).not.toBeNull()
  const errors = err!.data?.errors ?? []
  expect(
    errors.map((e) => e.path),
    err!.message,
  ).toContain(field)
  expect(err!.message).toContain(field)
  if (re) expect(errors.find((e) => e.path === field)!.message).toMatch(re)
}

const publish = (id: number | string, data: Record<string, unknown> = {}) =>
  payload.update({
    collection: 'products',
    id,
    data: { status: 'available', ...data },
    overrideAccess: true,
    context: { transition: 'publish' },
  })

async function draftOf(category: ProductCategory, overrides: Record<string, unknown> = {}) {
  return createProduct(payload, completeProduct(category, nextNumber++, fx, overrides))
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
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
  const login = await rest('POST', '/users/login', ADMIN, { 'x-forwarded-for': '198.51.100.18' })
  token = ((await login.json()) as { token: string }).token

  const labReport = await payload.create({
    collection: 'private-uploads',
    data: { purpose: 'lab_report', complianceCategory: 'keramik' } as never,
    file: pdf('labor.pdf'),
    overrideAccess: true,
  })
  const declarationPdf = await payload.create({
    collection: 'documents',
    data: { title: 'Konformitätserklärung Seladon', kind: 'conformity_declaration' } as never,
    file: pdf('erklaerung.pdf'),
    overrideAccess: true,
  })
  const declaration = (name: string) =>
    payload.create({
      collection: 'conformity-declarations',
      data: {
        name,
        labName: 'Prüflabor Berlin',
        labReportDate: '2026-08-01T00:00:00.000Z',
        labReport: labReport.id,
        declarationPdf: declarationPdf.id,
        validFrom: '2026-09-01T00:00:00.000Z',
      } as never,
      overrideAccess: true,
    })
  activeDeclaration = (await declaration('Seladon blau')).id as number
  const revoked = await declaration('Seladon grün')
  await payload.update({
    collection: 'conformity-declarations',
    id: revoked.id,
    data: { status: 'revoked' } as never,
    overrideAccess: true,
    context: { transition: CONFORMITY_REVOKE_TRANSITION },
  })
  revokedDeclaration = revoked.id as number
})

afterAll(async () => {
  await deleteProducts(payload)
})

describe('DM-PROD-01 / R-042 je Kategorie', () => {
  it.each(PRODUCT_CATEGORIES)(
    'R-042 %s: vollständig → veröffentlichbar (Local API)',
    async (category) => {
      const doc = await draftOf(category)
      const live = await publish(doc.id)
      expect(live.status).toBe('available')
    },
  )

  const MISSING: [ProductCategory, string, Record<string, unknown>][] = [
    ['keramik', 'description', { description: null }],
    ['keramik', 'foodContact', { foodContact: null }],
    ['textil', 'sizeLabel', { sizeLabel: null }],
    ['textil', 'condition', { condition: null }],
    ['cap', 'fiberComposition', { fiberComposition: [] }],
    ['zeichnung', 'dimensions', { dimensions: { widthCm: null, heightCm: null } }],
    ['zeichnung', 'materials', { materials: null }],
    ['schmuck', 'metalPartsMaterial', { metalPartsMaterial: null }],
    ['sonstiges', 'images', { images: [] }],
    ['sonstiges', 'weightGrams', { weightGrams: null }],
    ['sonstiges', 'ownDesignConfirmed', { ownDesignConfirmed: false }],
  ]
  it.each(MISSING)(
    'R-042 %s ohne %s wird abgelehnt (Feldname in der Meldung)',
    async (category, field, patch) => {
      // Erst vollständig anlegen, dann die Angabe entfernen (Voreinstellungen greifen nur beim Anlegen).
      const doc = await draftOf(category)
      await payload.update({
        collection: 'products',
        id: doc.id,
        data: patch,
        overrideAccess: true,
      })
      await rejectsWith(publish(doc.id), field)
      const again = await payload.findByID({
        collection: 'products',
        id: doc.id,
        overrideAccess: true,
      })
      expect(again.status).toBe('draft')
    },
  )

  it('R-042 auch per REST: PATCH auf „available“ ohne Titel → 400 mit Feldname', async () => {
    const doc = await draftOf('sonstiges', { weightGrams: null })
    const res = await rest(
      'PATCH',
      `/products/${doc.id}`,
      { status: 'available' },
      { authorization: `JWT ${token}` },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { errors: { data?: { errors?: { path: string }[] } }[] }
    expect(JSON.stringify(body)).toContain('weightGrams')
  })

  it('R-042 jedes Speichern eines freien Stücks wird geprüft', async () => {
    const doc = await draftOf('keramik')
    await publish(doc.id)
    await rejectsWith(
      payload.update({
        collection: 'products',
        id: doc.id,
        data: { weightGrams: null },
        overrideAccess: true,
      }),
      'weightGrams',
    )
  })

  it('R-042 Bild ohne englischen Alt-Text wird abgelehnt', async () => {
    const data = fx.mediaId
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Nur deutscher Alt-Text' } as never,
      file: await (async () => {
        const { readFile } = await import('node:fs/promises')
        const buf = await readFile('tests/fixtures/images/landscape-small.jpg')
        return { data: buf, name: 'nur-de.jpg', mimetype: 'image/jpeg', size: buf.length }
      })(),
      overrideAccess: true,
    })
    const doc = await draftOf('keramik', { images: [data, media.id] })
    await rejectsWith(publish(doc.id), 'images', /Foto 2.*Englisch/)
  })
})

describe('DM-PROD-02 / R-043 Faserangaben', () => {
  it('R-043 Summe 99 % und 101 % abgelehnt, 60/40 angenommen', async () => {
    const rows = (a: number, b: number) => [
      { component: 'main', fiber: 'cotton', percent: a },
      { component: 'main', fiber: 'polyester', percent: b },
    ]
    await rejectsWith(
      publish((await draftOf('textil', { fiberComposition: rows(60, 39) })).id),
      'fiberComposition',
      /Summe 99 %/,
    )
    await rejectsWith(
      publish((await draftOf('textil', { fiberComposition: rows(60, 41) })).id),
      'fiberComposition',
      /Summe 101 %/,
    )
    expect(
      (await publish((await draftOf('textil', { fiberComposition: rows(60, 40) })).id)).status,
    ).toBe('available')
  })

  it('R-043 labelMissing ohne fiberFreeText bzw. ohne Faserangabe abgelehnt', async () => {
    await rejectsWith(publish((await draftOf('cap', { labelMissing: true })).id), 'fiberFreeText')
    await rejectsWith(
      publish(
        (
          await draftOf('cap', {
            labelMissing: true,
            fiberFreeText: 'wohl Baumwolle',
            fiberComposition: [],
          })
        ).id,
      ),
      'fiberComposition',
    )
    const ok = await draftOf('cap', { labelMissing: true, fiberFreeText: 'wohl Baumwolle' })
    expect((await publish(ok.id)).status).toBe('available')
  })
})

describe('DM-PROD-03 / AK-7-01 / R-044 lebensmittelecht', () => {
  it('AK-7-01 ohne Erklärung schon als Entwurf nicht speicherbar', async () => {
    await rejectsWith(
      draftOf('keramik', { foodContact: 'lebensmittelecht' }),
      'conformityDeclarations',
    )
  })

  it('AK-7-01 mit widerrufener Erklärung nicht speicherbar', async () => {
    const doc = await draftOf('keramik')
    await rejectsWith(
      payload.update({
        collection: 'products',
        id: doc.id,
        data: { foodContact: 'lebensmittelecht', conformityDeclarations: [revokedDeclaration] },
        overrideAccess: true,
      }),
      'conformityDeclarations',
    )
  })

  it('AK-7-01 mit aktiver Erklärung gespeichert und veröffentlichbar', async () => {
    const doc = await draftOf('keramik', {
      foodContact: 'lebensmittelecht',
      conformityDeclarations: [activeDeclaration],
    })
    expect(doc.foodContact).toBe('lebensmittelecht')
    expect((await publish(doc.id)).status).toBe('available')
  })

  it('R-044 Deko-Keramik mit Lebensmittel-Versprechen im Text wird nicht veröffentlicht (V-13)', async () => {
    const doc = await draftOf('keramik', {
      description: 'Spülmaschinenfeste Schale für jeden Tag.',
    })
    await rejectsWith(publish(doc.id), 'description', /spülmaschinenfest/)
  })
})

describe('DM-PROD-04 / R-045 Schmuck', () => {
  it.each([
    ['nickelFreeConfirmed', { nickelFreeConfirmed: false }],
    ['nickelEvidence', { nickelEvidence: null }],
    ['leadFreeGlazeConfirmed', { leadFreeGlazeConfirmed: false }],
  ] as const)('R-045 ohne %s abgelehnt', async (field, patch) => {
    const doc = await draftOf('schmuck', patch)
    await rejectsWith(publish(doc.id), field)
  })

  it('R-045 Kleinteile-Hinweis nach Speichern vorhanden', async () => {
    const doc = await draftOf('schmuck')
    expect(doc.safetyWarnings).toContain(MANDATORY_WARNING_TEXTS['product.jewelrySmallParts'].de)
  })
})

describe('DM-PROD-09 / R-046–R-048', () => {
  it('R-046 Zeichnung mit Glasrahmen enthält nach dem Speichern den Glas-Hinweis und ist veröffentlichbar', async () => {
    const doc = await draftOf('zeichnung', { framed: true, frameHasGlass: true })
    expect(doc.safetyWarnings).toContain(MANDATORY_WARNING_TEXTS['product.glassFrame'].de)
    expect((await publish(doc.id)).status).toBe('available')
  })

  it('R-048 textil/cap ohne deviationDecision nicht veröffentlicht', async () => {
    for (const category of ['textil', 'cap'] as const) {
      await rejectsWith(
        publish((await draftOf(category, { deviationDecision: null })).id),
        'deviationDecision',
      )
    }
    await rejectsWith(
      publish(
        (await draftOf('textil', { deviationDecision: 'described', deviationDescription: null }))
          .id,
      ),
      'deviationDescription',
    )
  })

  it('R-047 textil/cap mit blankBrandVisible nicht veröffentlicht, solange nicht erlaubt', async () => {
    for (const category of ['textil', 'cap'] as const) {
      await rejectsWith(
        publish((await draftOf(category, { blankBrandVisible: true })).id),
        'blankBrandVisible',
      )
    }
  })

  it('R-047 „Godzilla“ im Titel wird abgelehnt', async () => {
    const doc = await draftOf('keramik', { title: 'Godzilla-Schale' })
    await rejectsWith(publish(doc.id), 'title', /Godzilla/)
  })
})
