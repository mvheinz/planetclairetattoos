import {
  createLocalReq,
  type Access,
  type CollectionSlug,
  type Field,
  type GlobalSlug,
  type Payload,
  type PayloadRequest,
  type Where,
} from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { adminField } from '@/access'
import { seedPreviewModeActive } from '@/lib/env'

import { lexical } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  createTestImage,
  deleteProducts,
} from '../helpers/products'
import { rest } from '../helpers/rest'
import { COLLECTION_ACCESS, GLOBAL_ACCESS, type PublicContext } from './matrix'

// P1.27 (T-15, DM-P1-03, R-136): jede Zeile der Zugriffsmatrix gegen den laufenden REST-Handler (anonym).

const NOW = '2026-10-15T10:00:00.000Z'
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)
const pdfFile = (name: string) => ({
  data: PDF,
  name,
  mimetype: 'application/pdf',
  size: PDF.length,
})

let payload: Payload
const cleanup: { collection: CollectionSlug; id: number | string }[] = []
/** Je öffentlicher Collection mindestens ein sichtbares und ein verborgenes Fixture (für Filter und Felder). */
const fixtures: Partial<Record<CollectionSlug, { visible: number[]; hidden: number[] }>> = {}

const isInternal = (slug: string) => slug.startsWith('payload-')
const configSlugs = () =>
  payload.config.collections.map((c) => c.slug).filter((s) => !isInternal(s))

async function anonReq(): Promise<PayloadRequest> {
  return createLocalReq({ context: { now: NOW } }, payload)
}

async function track<T extends { id: number | string }>(
  collection: CollectionSlug,
  doc: Promise<T>,
  visible: boolean,
): Promise<T> {
  const d = await doc
  cleanup.push({ collection, id: d.id })
  const entry = (fixtures[collection] ??= { visible: [], hidden: [] })
  entry[visible ? 'visible' : 'hidden'].push(d.id as number)
  return d
}

/** Datenpfade aller Felder, die anonym nicht lesbar sind (`adminField` bzw. Feld-`read` → false). */
async function hiddenPaths(fields: Field[], prefix = ''): Promise<string[]> {
  const req = await anonReq()
  const out: string[] = []
  for (const f of fields) {
    if (f.type === 'tabs') {
      for (const tab of f.tabs) {
        const p = 'name' in tab && tab.name ? `${prefix}${tab.name}.` : prefix
        out.push(...(await hiddenPaths(tab.fields, p)))
      }
      continue
    }
    if (!('name' in f) || !f.name) {
      if ('fields' in f) out.push(...(await hiddenPaths(f.fields, prefix)))
      continue
    }
    const p = `${prefix}${f.name}`
    const read = 'access' in f ? f.access?.read : undefined
    let hidden = read === adminField.read
    if (!hidden && read) {
      try {
        hidden = (await read({ req, data: {}, siblingData: {}, doc: {} } as never)) === false
      } catch {
        hidden = false
      }
    }
    if (hidden) {
      out.push(p)
      continue
    }
    if ('fields' in f && Array.isArray(f.fields))
      out.push(...(await hiddenPaths(f.fields, `${p}.`)))
  }
  return out
}

/** Pfad `a.b` in einem Dokument vorhanden (Arrays: in irgendeinem Element). */
function hasPath(value: unknown, parts: string[]): boolean {
  if (Array.isArray(value)) return value.some((v) => hasPath(v, parts))
  if (!value || typeof value !== 'object') return false
  const [head, ...rest] = parts
  if (!(head! in (value as Record<string, unknown>))) return false
  return rest.length === 0 || hasPath((value as Record<string, unknown>)[head!], rest)
}

const idsOf = (docs: { id: number | string }[]) => docs.map((d) => String(d.id)).sort()

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteProducts(payload, [986, 987])
  // Konto vorhanden: dann ist auch `POST /api/users` anonym gesperrt (Ersteinrichtung vorbei)
  const users = await payload.count({ collection: 'users', overrideAccess: true })
  if (users.totalDocs === 0) {
    await track(
      'users',
      payload.create({
        collection: 'users',
        data: {
          email: 'matrix@example.com',
          password: 'richtig-langes-passwort-2026',
          name: 'Jutta',
          role: 'admin',
        } as never,
        overrideAccess: true,
      }),
      false,
    )
  }

  const fx = await createProductFixtures(payload)
  await track(
    'products',
    createProduct(payload, completeProduct('keramik', 986, fx, { status: 'available' })),
    true,
  )
  await track('products', createProduct(payload, completeProduct('keramik', 987, fx)), false)

  const labReport = await track(
    'private-uploads',
    payload.create({
      collection: 'private-uploads',
      data: { purpose: 'lab_report', complianceCategory: 'keramik' } as never,
      file: pdfFile('labor.pdf'),
      overrideAccess: true,
    }),
    false,
  )
  const declarationPdf = await track(
    'documents',
    payload.create({
      collection: 'documents',
      data: { title: 'Konformitätserklärung Matrix', kind: 'conformity_declaration' } as never,
      file: pdfFile('erklaerung.pdf'),
      overrideAccess: true,
    }),
    true,
  )
  await track(
    'conformity-declarations',
    payload.create({
      collection: 'conformity-declarations',
      data: {
        name: 'Matrix-Glasur',
        glazeManufacturer: 'Botz',
        labName: 'Prüflabor Berlin',
        labReportDate: '2026-08-01T00:00:00.000Z',
        labReport: labReport.id,
        declarationPdf: declarationPdf.id,
        validFrom: '2026-09-01T00:00:00.000Z',
        notes: 'intern',
      } as never,
      overrideAccess: true,
    }),
    true,
  )

  const image = await createTestImage(payload, 'Rose im Skizzenbuch')
  cleanup.push({ collection: 'media', id: image })
  await track(
    'tattoo-gallery',
    payload.create({
      collection: 'tattoo-gallery',
      data: { image, kind: 'fresh', showsCustomer: false, published: true } as never,
      overrideAccess: true,
      context: { now: NOW },
    }),
    true,
  )
  await track(
    'tattoo-gallery',
    payload.create({
      collection: 'tattoo-gallery',
      data: { image, kind: 'fresh', published: false } as never,
      overrideAccess: true,
      context: { now: NOW },
    }),
    false,
  )

  await track(
    'faqs',
    payload.create({
      collection: 'faqs',
      data: {
        question: 'Wie lange heilt ein Tattoo?',
        answer: lexical('Etwa vier Wochen.'),
        published: true,
      } as never,
      overrideAccess: true,
    }),
    true,
  )
  await track(
    'faqs',
    payload.create({
      collection: 'faqs',
      data: {
        question: 'Entwurf: Wie pflege ich Keramik?',
        answer: lexical('Von Hand spülen.'),
        published: false,
      } as never,
      overrideAccess: true,
    }),
    false,
  )
})

afterAll(async () => {
  for (const { collection, id } of [...cleanup].reverse()) {
    if (collection === 'products') continue
    await payload
      .delete({ collection, id, overrideAccess: true, context: { seed: true, skipAudit: true } })
      .catch(() => null)
  }
  await deleteProducts(payload, [986, 987])
  for (const { collection, id } of cleanup.filter((c) => c.collection === 'media')) {
    await payload.delete({ collection, id, overrideAccess: true }).catch(() => null)
  }
})

describe('Zugriffsmatrix (T-15, DM-P1-03)', () => {
  it('DM-P1-03 jede Collection und jedes Global aus payload.config hat genau einen Matrix-Eintrag', () => {
    expect(Object.keys(COLLECTION_ACCESS).sort()).toEqual(configSlugs().sort())
    expect(configSlugs()).toHaveLength(27)
    expect(Object.keys(GLOBAL_ACCESS).sort()).toEqual(
      payload.config.globals.map((g) => g.slug).sort(),
    )
  })

  it('DM-P1-03 eine neue Collection ohne Eintrag ließe den Abgleich scheitern', () => {
    const withNew = [...configSlugs(), 'neue-collection']
    expect(withNew.filter((s) => !(s in COLLECTION_ACCESS))).toEqual(['neue-collection'])
  })

  for (const [slug, entry] of Object.entries(COLLECTION_ACCESS)) {
    it(`DM-P1-03 ${slug}: anonym GET ${entry.get.kind === 'deny' ? '403' : '200 gefiltert'}, POST/PATCH/DELETE 403`, async () => {
      const coll = slug as CollectionSlug
      const config = payload.collections[coll].config
      const ctx: PublicContext = { now: new Date(NOW), preview: seedPreviewModeActive() }

      // Zugriffsfunktion liefert genau den Filter der Matrix
      const access = (await (config.access.read as Access)({ req: await anonReq() })) as
        boolean | Where
      if (entry.get.kind === 'deny') {
        expect(access).toBe(false)
        expect((await rest('GET', `/${slug}`)).status).toBe(403)
        expect((await rest('GET', `/${slug}/1`)).status).toBe(403)
      } else {
        const where = entry.get.where(ctx)
        expect(access === true ? null : access).toEqual(where)
        // REST-Handler (echte Uhr): dieselben Dokumente wie die Abfrage mit dem Matrix-Filter
        const liveWhere = entry.get.where({ ...ctx, now: new Date() })
        const res = await rest('GET', `/${slug}?depth=0&pagination=false`)
        expect(res.status).toBe(200)
        const body = (await res.json()) as { docs: { id: number }[] }
        const expected = await payload.find({
          collection: coll,
          where: liveWhere ?? {},
          depth: 0,
          pagination: false,
          overrideAccess: true,
        })
        expect(idsOf(body.docs)).toEqual(idsOf(expected.docs))
        const fx = fixtures[coll]
        for (const id of fx?.visible ?? []) {
          expect(idsOf(body.docs)).toContain(String(id))
          expect((await rest('GET', `/${slug}/${id}?depth=0`)).status).toBe(200)
        }
        for (const id of fx?.hidden ?? []) {
          expect(idsOf(body.docs)).not.toContain(String(id))
          expect([403, 404]).toContain((await rest('GET', `/${slug}/${id}`)).status)
        }
      }

      const post = await rest('POST', `/${slug}`, { title: 'x' })
      expect(post.status, `POST ${slug}`).toBe(403)
      if (entry.post === 'firstAccountOnly') {
        // Ersteinrichtung: nur solange kein Konto existiert (hier existiert eins)
        expect(
          (await payload.count({ collection: 'users', overrideAccess: true })).totalDocs,
        ).toBeGreaterThan(0)
      }
      const anyId = fixtures[coll]?.visible[0] ?? fixtures[coll]?.hidden[0] ?? 1
      expect(
        (await rest('PATCH', `/${slug}/${anyId}`, { title: 'x' })).status,
        `PATCH ${slug}`,
      ).toBe(403)
      expect((await rest('DELETE', `/${slug}/${anyId}`)).status, `DELETE ${slug}`).toBe(403)
      // Massenänderung/-löschung per Where ebenso
      expect((await rest('PATCH', `/${slug}?where[id][exists]=true`, { title: 'x' })).status).toBe(
        403,
      )
      expect((await rest('DELETE', `/${slug}?where[id][exists]=true`)).status).toBe(403)
    })
  }

  for (const [slug, entry] of Object.entries(GLOBAL_ACCESS)) {
    it(`DM-P1-03 Global ${slug}: anonym GET ${entry.get === 'deny' ? '403' : '200'}, POST 403`, async () => {
      expect((await rest('GET', `/globals/${slug}`)).status).toBe(entry.get === 'deny' ? 403 : 200)
      expect((await rest('POST', `/globals/${slug}`, {})).status).toBe(403)
      const config = payload.config.globals.find((g) => g.slug === (slug as GlobalSlug))!
      expect(await (config.access.update as Access)({ req: await anonReq() })).toBe(false)
    })
  }

  it('R-136 öffentliche Antworten enthalten keine adminField-Felder; die Matrix listet alle', async () => {
    let checked = 0
    for (const [slug, entry] of Object.entries(COLLECTION_ACCESS)) {
      const coll = slug as CollectionSlug
      const derived = await hiddenPaths(payload.collections[coll].config.fields)
      if (entry.get.kind === 'deny') continue
      expect([...entry.hiddenFields].sort(), `versteckte Felder von ${slug}`).toEqual(
        derived.sort(),
      )
      const body = (await (await rest('GET', `/${slug}?depth=1&pagination=false`)).json()) as {
        docs: Record<string, unknown>[]
      }
      const single = fixtures[coll]?.visible[0]
      const docs = [...body.docs]
      if (single !== undefined) {
        docs.push((await (await rest('GET', `/${slug}/${single}?depth=1`)).json()) as never)
      }
      for (const doc of docs) {
        for (const p of entry.hiddenFields) {
          expect(hasPath(doc, p.split('.')), `${slug}.${p} öffentlich sichtbar`).toBe(false)
        }
        checked += 1
      }
    }
    // Stücke, Erklärungen und Galerie haben interne Felder und sichtbare Fixtures
    for (const slug of ['products', 'conformity-declarations', 'tattoo-gallery'] as const) {
      expect(fixtures[slug]?.visible.length, slug).toBeGreaterThan(0)
    }
    expect(checked).toBeGreaterThan(0)
    // Gegenprobe: mit Verwaltungszugriff sind die Felder vorhanden
    const full = await payload.findByID({
      collection: 'conformity-declarations',
      id: fixtures['conformity-declarations']!.visible[0]!,
      overrideAccess: true,
      depth: 0,
    })
    expect(full.labName).toBe('Prüflabor Berlin')
  })
})
