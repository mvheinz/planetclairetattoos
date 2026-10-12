import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ATTENTION_NOTE, bestandSourceRef, importBestand } from '@/lib/bestand/import'
import { loadBestand, photosOf, type BestandProduct } from '@/lib/bestand/schema'

import { getTestPayload } from '../helpers/payload'
import { deleteProducts } from '../helpers/products'

// P16.2 (U-76): `pnpm bestand:import` – echte Stücke als Entwürfe mit Vermerk „bitte prüfen“, Fotos als Medien,
// wiederholbar ohne Doppel, Nummernkollision ohne Schreiben, Vorschau-Modus „verfügbar“. Stichprobe aus jeder
// Kategorie: Textil B001, Schmuck B017, Keramik mit Abweichung B044, Keramik mit Größenvergleich-Foto B073.

const KEYS = ['B001', 'B017', 'B044', 'B073'] as const
const SLOW = 180_000

let payload: Payload
let all: BestandProduct[]
let sample: BestandProduct[]

async function cleanup(): Promise<void> {
  await deleteProducts(
    payload,
    all.map((p) => p.itemNumber),
  )
  await payload.delete({
    collection: 'media',
    where: { sourceRef: { like: 'bestand:' } },
    overrideAccess: true,
    context: { seed: true },
  })
}

const productOf = async (p: BestandProduct, locale: 'de' | 'en' = 'de') =>
  (
    await payload.find({
      collection: 'products',
      where: { itemNumber: { equals: p.itemNumber } },
      locale,
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
    })
  ).docs[0]

beforeAll(async () => {
  payload = await getTestPayload()
  all = await loadBestand()
  sample = all.filter((p) => (KEYS as readonly string[]).includes(p.key))
  await cleanup()
})

afterAll(async () => {
  await cleanup()
})

describe('bestand:import (P16.2)', () => {
  it(
    'legt Fotos und Stücke als Entwurf an: echte Daten, Vermerk „bitte prüfen“, Prüfpunkte als Notiz, DE/EN',
    async () => {
      const res = await importBestand(payload, all, { only: KEYS })
      expect(res.created).toEqual([...KEYS])
      expect(res.existing).toEqual([])
      expect(res.skipped).toEqual([])
      expect(res.media.created).toBe(sample.reduce((n, p) => n + photosOf(p).length, 0))

      for (const p of sample) {
        const doc = (await productOf(p))!
        expect(doc, p.key).toBeDefined()
        expect(doc.status).toBe('draft')
        expect(doc.seed).toBe(false)
        expect(doc.title).toBe(p.title.de)
        expect(doc.category).toBe(p.category)
        expect(doc.priceCents).toBe(p.priceCents)
        expect(doc.ownDesignConfirmed).toBe(false)
        expect(doc.adminAttention).toMatchObject({
          flag: true,
          reason: 'manual',
          note: ATTENTION_NOTE,
        })
        expect(doc.internalNote).toContain(p.review[0])
        expect(doc.internalNote!.length).toBeLessThanOrEqual(1000)
        // Kategorie-Vorlage der Warnhinweise wie beim Anlegen in der Verwaltung
        expect(doc.safetyWarnings?.trim()).toBeTruthy()
        expect(doc.images).toHaveLength(p.images.length)
        expect(Boolean(doc.scalePhoto)).toBe(Boolean(p.scalePhoto))

        const en = (await productOf(p, 'en'))!
        expect(en.title).toBe(p.title.en)
        expect(en.description).toBe(p.description.en)
        expect(en.safetyWarnings?.trim()).toBeTruthy()
        expect(en.i18n?.enStatus).toBe('machine')

        const firstId = doc.images![0] as number
        const media = await payload.findByID({
          collection: 'media',
          id: firstId,
          locale: 'all',
          depth: 0,
          overrideAccess: true,
        })
        expect(media.sourceRef).toBe(bestandSourceRef(p.images[0]!.file))
        expect(media.source).toBe('upload')
        expect(media.showsPerson).toBe('none')
        expect(media.alt).toEqual(p.images[0]!.alt)
      }
      const b044 = (await productOf(sample.find((p) => p.key === 'B044')!))!
      expect(b044.hasDeviation).toBe(true)
      expect(b044.foodContact).toBe('deko')
      const b017 = (await productOf(sample.find((p) => p.key === 'B017')!))!
      expect(b017.smallPartsWarning).toBe(true)
    },
    SLOW,
  )

  it('zweiter Lauf: nichts doppelt, Fotos nicht neu – auch nach geänderter Nummer und geändertem Titel', async () => {
    const b001 = sample[0]!
    const doc = (await productOf(b001))!
    await payload.update({
      collection: 'products',
      id: doc.id,
      data: { itemNumber: 7, title: 'Tanktop mit Fuchs' },
      locale: 'de',
      overrideAccess: true,
    })
    const res = await importBestand(payload, all, { only: KEYS })
    expect(res.created).toEqual([])
    expect(res.existing).toEqual([...KEYS])
    expect(res.media).toEqual({ created: 0, reused: 0 })
    const count = await payload.count({
      collection: 'products',
      where: { title: { like: 'Fuchs' } },
      overrideAccess: true,
    })
    expect(count.totalDocs).toBe(1)
    await deleteProducts(payload, [7])
  })

  it(
    'Nummer schon vergeben: Stück wird übersprungen (Meldung), Fotos bleiben wiederverwendbar',
    async () => {
      const b001 = sample[0]!
      // B001 wurde im Test davor gelöscht; ein anderes Stück belegt jetzt seine Nummer.
      const other = (await productOf(sample[1]!))!
      await payload.update({
        collection: 'products',
        id: other.id,
        data: { itemNumber: b001.itemNumber },
        locale: 'de',
        overrideAccess: true,
      })
      const res = await importBestand(payload, all, { only: ['B001'] })
      expect(res.created).toEqual([])
      expect(res.skipped).toEqual([
        { key: 'B001', reason: 'Nr. 101 ist schon an ein anderes Stück vergeben' },
      ])
      expect(res.media.created).toBe(0)
      await payload.update({
        collection: 'products',
        id: other.id,
        data: { itemNumber: sample[1]!.itemNumber },
        locale: 'de',
        overrideAccess: true,
      })
      const again = await importBestand(payload, all, { only: ['B001'] })
      expect(again.created).toEqual(['B001'])
      expect(again.media).toEqual({ created: 0, reused: photosOf(b001).length })
    },
    SLOW,
  )

  it(
    'Vorschau (--preview): Stück sofort „verfügbar“, Zeitpunkt aus SEED_NOW minus Position',
    async () => {
      await cleanup()
      const now = new Date('2026-10-01T08:00:00.000Z')
      const res = await importBestand(payload, all, { only: ['B044'], previewPublish: { now } })
      expect(res.created).toEqual(['B044'])
      const doc = (await productOf(all[43]!))!
      expect(doc.status).toBe('available')
      expect(doc.seed).toBe(false)
      expect(doc.firstPublishedAt).toBe(new Date(now.getTime() - 43 * 60_000).toISOString())
    },
    SLOW,
  )

  it(
    'aus der Excel-Liste (U-85, U-86, V-11): verkauft → Markt-Verkauf (auch in der Vorschau), ins Archiv nur mit Häkchen, Notiz, Metallteile',
    async () => {
      await cleanup()
      const now = new Date('2026-10-12T08:00:00.000Z')
      const chain = all.find((p) => p.key === 'B017')!
      const bowl = all.find((p) => p.key === 'B044')!
      const edited: BestandProduct[] = all.map((p) =>
        p.key === chain.key
          ? {
              ...p,
              metalPartsMaterial: { de: 'Edelstahl', en: 'Stainless steel' },
              ownerNote: 'Kette kürzen?',
            }
          : p.key === bowl.key
            ? { ...p, sold: { date: '2026-10-11', priceCents: 3500, note: 'Markt Kreuzberg' } }
            : p,
      )
      const res = await importBestand(payload, edited, {
        only: [chain.key, bowl.key],
        previewPublish: { now },
      })
      expect(res.created).toEqual([chain.key, bowl.key])

      const c = (await productOf(chain))!
      expect(c.status).toBe('available')
      expect(c.metalPartsMaterial).toBe('Edelstahl')
      expect((await productOf(chain, 'en'))!.metalPartsMaterial).toBe('Stainless steel')
      expect(c.internalNote).toMatch(/^Deine Notiz: Kette kürzen\?\n\nAus deinen Fotos angelegt/)

      const b = (await productOf(bowl))!
      expect(b).toMatchObject({
        status: 'sold',
        soldChannel: 'offline',
        soldAt: '2026-10-11T12:00:00.000Z',
        offlineSaleNote: 'Markt Kreuzberg',
        offlineSalePriceCents: 3500,
        showInArchiveAfterSale: false,
        seed: false,
      })
      expect(b.firstPublishedAt ?? null).toBeNull()
      const audit = await payload.find({
        collection: 'audit-log',
        where: {
          and: [
            { action: { equals: 'product_offline_sold' } },
            { entityId: { equals: String(b.id) } },
          ],
        },
        overrideAccess: true,
      })
      expect(audit.docs).toHaveLength(1)
      // Notiz nicht im Protokoll (könnte Namen enthalten, Datenminimierung)
      expect(audit.docs[0]!.summary).toMatch(/offline verkauft \(aus der Excel-Liste\)$/)
      expect(audit.docs[0]!.summary).not.toContain('Kreuzberg')

      // ohne Datum und Preis: jetzt, Listenpreis
      await cleanup()
      const noDate = all.map((p) => (p.key === bowl.key ? { ...p, sold: {} } : p))
      await importBestand(payload, noDate, { only: [bowl.key], now })
      const d = (await productOf(bowl))!
      expect(d.status).toBe('sold')
      expect(d.soldAt).toBe(now.toISOString())
      expect(d.offlineSalePriceCents).toBe(bowl.priceCents)
      expect(d.offlineSaleNote ?? null).toBeNull()
      expect(d.showInArchiveAfterSale).toBe(false)

      // V-11: mit Häkchen „ins Archiv“ steht der Markt-Verkauf mit sold-Stempel im Archiv
      await cleanup()
      const archived = all.map((p) =>
        p.key === bowl.key ? { ...p, sold: { date: '2026-10-11', archive: true as const } } : p,
      )
      await importBestand(payload, archived, { only: [bowl.key], now })
      const a = (await productOf(bowl))!
      expect(a).toMatchObject({ status: 'sold', showInArchiveAfterSale: true })
    },
    SLOW,
  )
})
