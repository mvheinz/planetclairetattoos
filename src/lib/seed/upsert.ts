import 'server-only'

import type { CollectionSlug, PayloadRequest } from 'payload'

import { seedOp } from './context'
import type { SeedReport } from './report'

// Idempotenz über `seedKey` (SEED-SPEC §1.3). Gruppen:
// - `content` (media, products, flash, tattoo-*, pages, faqs): vorhandenes Dokument mit `seed = false` (übernommen) →
//   überspringen, sonst Inhaltsfelder aktualisieren (die Aufrufer liefern nur erlaubte Felder).
// - `process` (Kassen, Bestellungen, Reservierungen, Belege, private Dateien, Logs …): nur anlegen, nie ändern.

export type SeedGroup = 'content' | 'process'

type Doc = Record<string, unknown> & { id: number | string }
export type SeedPatch = { de?: Record<string, unknown>; en?: Record<string, unknown> }

export interface UpsertInput {
  req: PayloadRequest
  report: SeedReport
  collection: CollectionSlug
  /** Vollständiger Schlüssel `<collection>:<schlüssel>`. */
  seedKey: string
  group: SeedGroup
  /** Daten zum Anlegen (DE bzw. nicht lokalisiert). `seed`/`seedKey` ergänzt der Helfer. */
  create: () => Promise<Record<string, unknown>> | Record<string, unknown>
  /** Englische Werte der lokalisierten Felder (zweiter Schreibvorgang mit `locale: 'en'`). */
  en?: Record<string, unknown> | null
  /** Inhaltsfelder für eine Aktualisierung (nur Gruppe `content`); `null` = nichts ändern. */
  update?: (existing: Doc) => Promise<SeedPatch | null> | SeedPatch | null
  /** Datei für Uploads (media, private-uploads). */
  file?: () => Promise<{ data: Buffer; mimetype: string; name: string; size: number }>
}

export interface UpsertResult {
  doc: Doc
  outcome: 'created' | 'updated' | 'skipped' | 'unchanged'
}

export async function findBySeedKey(
  req: PayloadRequest,
  collection: CollectionSlug,
  seedKey: string,
): Promise<Doc | null> {
  const res = await req.payload.find({
    collection,
    where: { seedKey: { equals: seedKey } },
    limit: 1,
    pagination: false,
    ...seedOp(req),
  })
  return (res.docs[0] as Doc | undefined) ?? null
}

export async function upsertBySeedKey(input: UpsertInput): Promise<UpsertResult> {
  const { req, report, collection, seedKey } = input
  if (!seedKey.startsWith(`${collection}:`)) {
    throw new Error(`seedKey ${seedKey} gehört nicht zu ${collection}`)
  }
  const existing = await findBySeedKey(req, collection, seedKey)
  if (existing) {
    if (existing.seed !== true) {
      report.add(collection, 'skipped')
      return { doc: existing, outcome: 'skipped' }
    }
    if (input.group === 'process' || !input.update) {
      report.add(collection, 'unchanged')
      return { doc: existing, outcome: 'unchanged' }
    }
    const patch = await input.update(existing)
    if (!patch || (!patch.de && !patch.en)) {
      report.add(collection, 'unchanged')
      return { doc: existing, outcome: 'unchanged' }
    }
    let doc = existing
    if (patch.de && Object.keys(patch.de).length > 0) {
      doc = (await req.payload.update({
        collection,
        id: existing.id,
        data: patch.de as never,
        locale: 'de',
        ...seedOp(req),
      })) as unknown as Doc
    }
    if (patch.en && Object.keys(patch.en).length > 0) {
      doc = (await req.payload.update({
        collection,
        id: existing.id,
        data: patch.en as never,
        locale: 'en',
        ...seedOp(req),
      })) as unknown as Doc
    }
    report.add(collection, 'updated')
    return { doc, outcome: 'updated' }
  }

  const data = { ...(await input.create()), seed: true, seedKey }
  const file = input.file ? await input.file() : undefined
  let doc = (await req.payload.create({
    collection,
    data: data as never,
    locale: 'de',
    ...(file ? { file } : {}),
    ...seedOp(req),
  })) as unknown as Doc
  if (input.en && Object.keys(input.en).length > 0) {
    doc = (await req.payload.update({
      collection,
      id: doc.id,
      data: input.en as never,
      locale: 'en',
      ...seedOp(req),
    })) as unknown as Doc
  }
  report.add(collection, 'created')
  return { doc, outcome: 'created' }
}
