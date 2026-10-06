import 'server-only'

import type { CollectionSlug, PayloadRequest } from 'payload'

import type { SeedData } from './loader'
import type { SeedReport } from './report'
import { resolveSeedDate } from './time'
import { findBySeedKey, upsertBySeedKey } from './upsert'

// Tattoo-Bestand (SEED-SPEC §12, PLAN P8.6): Flash F901–F910 → Galerie G1–G6 (§1.7 Schritt 4).
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

/** „Planet Claire on Tour“ (SEED-SPEC §12.4): Termine mit Datum relativ zu N; übernommene (`seed = false`) bleiben unberührt. */
export async function importTourDates(
  req: PayloadRequest,
  data: SeedData,
  options: TattooImportOptions,
): Promise<void> {
  for (const t of data.tour) {
    const content = () =>
      compact({
        name: t.name.de,
        startsAt: resolveSeedDate(t.startsAt, options.now).toISOString(),
        endsAt: resolveSeedDate(t.endsAt, options.now).toISOString(),
        place: t.place.de,
        address: t.address,
        link: t.link,
        standNumber: t.standNumber,
        timeFrom: t.timeFrom,
        timeTo: t.timeTo,
        note: t.note?.de,
        status: t.status,
      })
    const en = compact({ name: t.name.en, place: t.place.en, note: t.note?.en })
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'tour-dates',
      seedKey: `tour-dates:${t.key}`,
      group: 'content',
      create: async () => ({ ...content(), published: true }),
      en,
      update: async () => ({ de: content(), en }),
    })
  }
}
