import 'server-only'

import { createLocalReq, type CollectionSlug, type Payload, type Where } from 'payload'

import { writeAudit } from '@/lib/audit'
import { findMediaReferences } from '@/lib/media/references'
import type { Clock } from '@/lib/time'

import { seedOp, seedStep } from './context'
import { SeedGuardError } from './guard'
import { findSeedReferences, formatSeedReference } from './references'
import { SeedReport } from './report'

// Beispieldaten entfernen (DATENMODELL §13.5, SEED-SPEC §18). Eine Transaktion je Schritt, Seed-Kontext (keine Mails,
// kein Audit je Dokument), Grund-Seed wird nie gelöscht. `keepTexts` (Standard): nicht übernommene Seiten/FAQ und die
// Medien, auf die sie verweisen, werden übernommen (`seed = false`) statt gelöscht. Echte Sequenzen und die Zähler
// `RE`/`GS` bleiben unberührt; die Zählerzeilen `BSP-RE`/`BSP-GS` werden gelöscht.

export interface RemoveOptions {
  keepTexts?: boolean
  clock: Clock
}

type Step =
  | { kind: 'delete'; collection: string; where?: Where }
  | { kind: 'counters' }
  | { kind: 'texts' }
  | { kind: 'media' }
  | { kind: 'carts' }

/** Reihenfolge laut DATENMODELL §13.5 (Collections, die es noch nicht gibt, werden übersprungen). */
export const REMOVE_ORDER: readonly Step[] = [
  { kind: 'delete', collection: 'email-log' },
  { kind: 'delete', collection: 'consent-log' },
  { kind: 'delete', collection: 'privacy-requests' },
  { kind: 'delete', collection: 'webhook-events' },
  { kind: 'delete', collection: 'withdrawals' },
  { kind: 'delete', collection: 'invoices', where: { type: { equals: 'credit_note' } } },
  { kind: 'delete', collection: 'invoices' },
  { kind: 'counters' },
  { kind: 'delete', collection: 'reservations' },
  { kind: 'delete', collection: 'complaints' },
  { kind: 'delete', collection: 'orders' },
  { kind: 'delete', collection: 'checkouts' },
  // Echte Kassen und Reservierungen mit Beispiel-Stücken (z. B. aus einem Korb in der Vorschau): Zwischenstände von
  // 30 Minuten ohne Bestellung – sie würden das Löschen der Stücke blockieren (Pflicht-Verweis) und werden mitgelöscht.
  { kind: 'carts' },
  { kind: 'delete', collection: 'inquiries' },
  { kind: 'delete', collection: 'revenue-entries' },
  { kind: 'delete', collection: 'tattoo-gallery' },
  { kind: 'delete', collection: 'flash' },
  { kind: 'texts' },
  { kind: 'delete', collection: 'products' },
  { kind: 'delete', collection: 'conformity-declarations' },
  { kind: 'delete', collection: 'private-uploads' },
  { kind: 'delete', collection: 'documents' },
  { kind: 'media' },
  { kind: 'delete', collection: 'audit-log' },
]

/** Collections mit Seed-Kennzeichnung (`seedField()`), die es in dieser Konfiguration gibt. */
export function seedCollections(payload: Payload): CollectionSlug[] {
  return Object.values(payload.collections)
    .filter((c) => c.config.flattenedFields.some((f) => 'name' in f && f.name === 'seed'))
    .map((c) => c.config.slug as CollectionSlug)
}

function hasSeedField(payload: Payload, slug: string): boolean {
  return seedCollections(payload).includes(slug as CollectionSlug)
}

const SEED_WHERE: Where = { seed: { equals: true } }

async function deleteWhere(
  payload: Payload,
  collection: CollectionSlug,
  where: Where,
  report: SeedReport,
): Promise<void> {
  await seedStep(payload, async (req) => {
    const res = await req.payload.delete({ collection, where, ...seedOp(req) })
    if (res.errors.length > 0) {
      throw new Error(
        `${collection}: ${res.errors.length} Dokument(e) nicht gelöscht – ${res.errors
          .map((e) => e.message)
          .join('; ')}`,
      )
    }
    if (res.docs.length > 0) report.add(collection, 'deleted', res.docs.length)
  })
}

async function idsOf(payload: Payload, collection: CollectionSlug, where: Where) {
  const res = await payload.find({
    collection,
    where,
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs.map((d) => d.id as number)
}

/** Mengenvorschau (ohne `--yes` bzw. `GET /api/admin/seed/summary`): Dokumente mit `seed = true` je Collection. */
export async function seedSummary(payload: Payload): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const slug of seedCollections(payload)) {
    const { totalDocs } = await payload.count({
      collection: slug,
      where: SEED_WHERE,
      overrideAccess: true,
    })
    if (totalDocs > 0) out[slug] = totalDocs
  }
  if (payload.collections['invoice-counters']) {
    const { totalDocs } = await payload.count({
      collection: 'invoice-counters',
      where: { series: { in: ['BSP-RE', 'BSP-GS'] } },
      overrideAccess: true,
    })
    if (totalDocs > 0) out['invoice-counters'] = totalDocs
  }
  return out
}

export async function removeSeedData(
  payload: Payload,
  options: RemoveOptions,
): Promise<SeedReport> {
  const report = new SeedReport()
  const keepTexts = options.keepTexts ?? true

  // Echte Bestellungen mit Beispiel-Stücken werden nie gelöscht (Aufbewahrung) – dann bleibt alles, wie es ist.
  const seedProductIds = await idsOf(payload, 'products', SEED_WHERE)
  if (seedProductIds.length > 0) {
    const orders = await payload.find({
      collection: 'orders',
      where: { and: [{ seed: { not_equals: true } }, { 'items.product': { in: seedProductIds } }] },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
    if (orders.totalDocs > 0)
      throw new SeedGuardError(
        `Beispieldaten nicht entfernt: ${orders.totalDocs} echte Bestellung(en) enthalten Beispiel-Stücke (${orders.docs
          .map((o) => o.orderNumber ?? o.id)
          .join(', ')}). Bitte zuerst klären – echte Bestellungen werden nie gelöscht.`,
      )
  }

  // Verweise echter (und gleich übernommener) Dokumente auf Seed-Dokumente – vor dem ersten Löschschritt erfassen;
  // die Datenbank entfernt sie beim Löschen des Ziels (Fremdschlüssel), der Bericht listet sie.
  const texts = keepTexts ? (['pages', 'faqs'] as const) : []
  for (const hit of await findSeedReferences(payload, { keep: texts, adopted: texts })) {
    report.add(hit.source, 'unlinked')
    report.note(formatSeedReference(hit))
  }

  for (const step of REMOVE_ORDER) {
    if (step.kind === 'delete') {
      if (!hasSeedField(payload, step.collection)) continue
      const where = step.where ? { and: [SEED_WHERE, step.where] } : SEED_WHERE
      await deleteWhere(payload, step.collection as CollectionSlug, where, report)
    } else if (step.kind === 'counters') {
      if (!payload.collections['invoice-counters']) continue
      await deleteWhere(
        payload,
        'invoice-counters',
        { series: { in: ['BSP-RE', 'BSP-GS'] } },
        report,
      )
    } else if (step.kind === 'carts') {
      if (seedProductIds.length === 0) continue
      const notSeed: Where = { seed: { not_equals: true } }
      const checkoutIds = await idsOf(payload, 'checkouts', {
        and: [
          notSeed,
          {
            or: [
              { 'items.product': { in: seedProductIds } },
              { 'deviationAgreements.product': { in: seedProductIds } },
            ],
          },
        ],
      })
      const reservationWhere: Where = {
        and: [
          notSeed,
          {
            or: [
              { product: { in: seedProductIds } },
              ...(checkoutIds.length > 0 ? [{ checkout: { in: checkoutIds } }] : []),
            ],
          },
        ],
      }
      await deleteWhere(payload, 'reservations', reservationWhere, report)
      if (checkoutIds.length > 0)
        await deleteWhere(payload, 'checkouts', { id: { in: checkoutIds } }, report)
    } else if (step.kind === 'texts') {
      for (const collection of ['faqs', 'pages'] as const) {
        if (!hasSeedField(payload, collection)) continue
        if (!keepTexts) {
          await deleteWhere(payload, collection, SEED_WHERE, report)
          continue
        }
        await seedStep(payload, async (req) => {
          const res = await req.payload.update({
            collection,
            where: SEED_WHERE,
            data: { seed: false } as never,
            ...seedOp(req),
          })
          if (res.errors.length > 0) throw new Error(`${collection}: Übernahme fehlgeschlagen`)
          if (res.docs.length > 0) report.add(collection, 'adopted', res.docs.length)
        })
      }
    } else {
      // Medien: nur löschen, wenn kein verbleibendes Dokument darauf verweist; sonst übernehmen (Instagram-Bilder
      // gehören Jutta, Seiten mit „Texte behalten“ zeigen sie weiter).
      await seedStep(payload, async (req) => {
        const res = await req.payload.find({
          collection: 'media',
          where: SEED_WHERE,
          limit: 0,
          pagination: false,
          ...seedOp(req),
        })
        for (const media of res.docs) {
          const refs = await findMediaReferences(req.payload, media.id, req)
          if (refs.length > 0) {
            await req.payload.update({
              collection: 'media',
              id: media.id,
              data: { seed: false } as never,
              ...seedOp(req),
            })
            report.add('media', 'adopted')
            report.note(
              `Bild ${media.seedKey ?? media.id} übernommen – verwendet von: ${refs
                .map((r) => `${r.label} ${r.title ?? r.id}`)
                .join(', ')}`,
            )
          } else {
            await req.payload.delete({ collection: 'media', id: media.id, ...seedOp(req) })
            report.add('media', 'deleted')
          }
        }
      })
    }
  }

  // settings.seed und zusammenfassender Audit-Eintrag (keine deletion-log-Einträge, L-22)
  const now = options.clock.now()
  await seedStep(payload, (req) =>
    req.payload.updateGlobal({
      slug: 'settings',
      data: { seed: { exampleDataPresent: false, removedAt: now.toISOString() } } as never,
      ...seedOp(req),
    }),
  )
  // Eigener Request ohne `skipAudit`: genau ein zusammenfassender Eintrag.
  const req = await createLocalReq({ context: { seed: true } }, payload)
  const counts = Object.fromEntries(
    [...report.counts]
      .map(([c, row]) => [c, row.deleted + row.adopted] as const)
      .filter(([, n]) => n > 0),
  )
  await writeAudit(req, {
    action: 'seed_removed',
    entityCollection: 'settings',
    entityId: 'settings',
    summary: `Beispieldaten entfernt${keepTexts ? ' (Texte behalten)' : ''}: ${
      Object.entries(counts)
        .map(([c, n]) => `${c} ${n}`)
        .join(', ') || 'nichts'
    }`,
    changes: { counts: [null, counts] },
    actorType: 'seed',
  })
  return report
}
