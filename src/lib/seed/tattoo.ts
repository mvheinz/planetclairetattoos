import 'server-only'

import type { CollectionSlug, PayloadRequest } from 'payload'

import type { SeedData } from './loader'
import type { SeedReport } from './report'
import { resolveSeedDate } from './time'
import { findBySeedKey, upsertBySeedKey } from './upsert'

// Tattoo-Bestand (SEED-SPEC §12, PLAN P8.6): Flash F901–F910 → Angebote TO1–TO3 → Galerie G1–G6 (§1.7 Schritt 4).
// Gruppe „Inhalt“ (§1.3): übernommene Einträge (`seed = false`) überspringen, sonst Texte, Bilder und Sortierung
// aktualisieren – nie `number`, `status`/`claimedAt` (Flash). G1/G2 zeigen Kund:innen ohne Einwilligung: angelegt im
// Seed-Kontext, öffentlich nur bei wirksamem SEED_PREVIEW_MODE (Lesezugriff `tattoo-gallery`, Medien `restricted`).

type Obj = Record<string, unknown>

export interface TattooImportOptions {
  report: SeedReport
  now: Date
}

function compact<T extends Obj>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
  return o
}

async function idOf(req: PayloadRequest, seedKey: string): Promise<number | string> {
  const collection = seedKey.slice(0, seedKey.indexOf(':')) as CollectionSlug
  const doc = await findBySeedKey(req, collection, seedKey)
  if (!doc) throw new Error(`Verweis ${seedKey} fehlt – bitte zuerst ${collection} importieren.`)
  return doc.id
}

export async function importFlash(
  req: PayloadRequest,
  data: SeedData,
  options: TattooImportOptions,
): Promise<void> {
  for (const f of data.tattoo.flash) {
    const content = async () =>
      compact({
        title: f.title.de,
        image: await idOf(req, f.image),
        sizeCm: f.sizeCm,
        sizeNote: f.sizeNote?.de,
        priceCents: f.priceCents,
        repeatable: f.repeatable,
        sortOrder: f.sortOrder,
      })
    const en = compact({ title: f.title.en, sizeNote: f.sizeNote?.en })
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'flash',
      seedKey: `flash:${f.key}`,
      group: 'content',
      create: async () =>
        compact({
          ...(await content()),
          number: f.number,
          status: f.status,
          claimedAt: f.claimedAt
            ? resolveSeedDate(f.claimedAt, options.now).toISOString()
            : undefined,
          published: true,
        }),
      en,
      update: async () => ({ de: await content(), en }),
    })
  }
}

export async function importOffers(
  req: PayloadRequest,
  data: SeedData,
  options: TattooImportOptions,
): Promise<void> {
  for (const o of data.tattoo.offers) {
    const content = async () =>
      compact({
        type: o.type,
        title: o.title.de,
        description: o.description.de,
        startsAt: resolveSeedDate(o.startsAt, options.now).toISOString(),
        endsAt: resolveSeedDate(o.endsAt, options.now).toISOString(),
        priceNote: o.priceNote?.de,
        flashes: await Promise.all(o.flashes.map((k) => idOf(req, k))),
      })
    const en = compact({
      title: o.title.en,
      description: o.description.en,
      priceNote: o.priceNote?.en,
    })
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'tattoo-offers',
      seedKey: `tattoo-offers:${o.key}`,
      group: 'content',
      // `locationNote` leer → Standard „Privatstudio in {Bezirk}“ (Hook, §12.2)
      create: async () => ({ ...(await content()), published: true }),
      en,
      update: async () => ({ de: await content(), en }),
    })
  }
}

export async function importGallery(
  req: PayloadRequest,
  data: SeedData,
  options: TattooImportOptions,
): Promise<void> {
  for (const g of data.tattoo.gallery) {
    const content = async () =>
      compact({
        image: await idOf(req, g.image),
        kind: g.kind,
        healedDurationMonths: g.healedDurationMonths,
        healedLabel: g.healedLabel?.de,
        caption: g.caption.de,
        placement: g.placement.de,
        flash: g.flash ? await idOf(req, g.flash) : undefined,
        showsCustomer: g.showsCustomer,
        featured: g.featured,
        sortOrder: g.sortOrder,
      })
    const en = compact({
      healedLabel: g.healedLabel?.en,
      caption: g.caption.en,
      placement: g.placement.en,
    })
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'tattoo-gallery',
      seedKey: `tattoo-gallery:${g.key}`,
      group: 'content',
      create: async () => ({
        ...(await content()),
        consentGiven: g.consentGiven,
        published: g.published,
      }),
      en,
      update: async () => ({ de: await content(), en }),
    })
  }
}
