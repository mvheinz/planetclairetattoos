import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload, RequestContext } from 'payload'

import type { ProductCategory } from '@/lib/enums'

// Test-Fixtures für Stücke (Nummern 980–999, CLAUDE.md §3 Nr. 5): vollständige Stücke je Kategorie, die die
// Veröffentlichungsprüfung (DATENMODELL §6.6.6) bestehen, plus Aufräumen.

export const FIXTURE_RANGE = { from: 980, to: 999 } as const
const IMAGE = path.resolve('tests/fixtures/images/landscape-small.jpg')
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)

export interface ProductFixtures {
  mediaId: number
  nickelEvidenceId: number
}

/** Bild mit Alt-Text DE und EN. */
// Eindeutige Dateinamen je Aufruf: Payload macht Namen per „-1, -2 …“ eindeutig, prüft das aber nicht atomar – legen
// parallele E2E-Worker gleichzeitig `schale.jpg` an, scheitert einer am Unique-Index (`filename`).
function uniqueName(base: string, ext: string): string {
  return `${base}-${randomUUID().slice(0, 8)}.${ext}`
}

export async function createTestImage(
  payload: Payload,
  alt = 'Blaue Schale mit Hund',
): Promise<number> {
  const data = await readFile(IMAGE)
  const doc = await payload.create({
    collection: 'media',
    data: { alt } as never,
    file: { data, name: uniqueName('schale', 'jpg'), mimetype: 'image/jpeg', size: data.length },
    overrideAccess: true,
  })
  await payload.update({
    collection: 'media',
    id: doc.id,
    locale: 'en',
    data: { alt: 'Blue bowl with a dog' } as never,
    overrideAccess: true,
  })
  return doc.id as number
}

export async function createProductFixtures(payload: Payload): Promise<ProductFixtures> {
  const mediaId = await createTestImage(payload)
  const evidence = await payload.create({
    collection: 'private-uploads',
    data: { purpose: 'nickel_evidence', complianceCategory: 'schmuck' } as never,
    file: {
      data: PDF,
      name: uniqueName('nickel', 'pdf'),
      mimetype: 'application/pdf',
      size: PDF.length,
    },
    overrideAccess: true,
  })
  return { mediaId, nickelEvidenceId: evidence.id as number }
}

/** Vollständige Angaben je Kategorie (DE); `overrides` ersetzt einzelne Felder. */
export function completeProduct(
  category: ProductCategory,
  itemNumber: number,
  fx: ProductFixtures,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    itemNumber,
    category,
    title: `Teststück ${itemNumber}`,
    description: 'Ein handbemaltes Einzelstück aus dem Atelier in Berlin.',
    priceCents: 4500,
    materials: 'Steinzeug, Unterglasurfarbe',
    weightGrams: 400,
    ownDesignConfirmed: true,
    images: [fx.mediaId],
    dimensions: { diameterCm: 14, heightCm: 6 },
    deviationDecision: 'none',
  }
  const extra: Record<ProductCategory, Record<string, unknown>> = {
    keramik: { foodContact: 'deko' },
    textil: {
      materials: 'Baumwolle, Textilfarbe',
      dimensions: { note: 'Brustweite 52 cm' },
      sizeLabel: 'M',
      condition: 'good',
      fiberComposition: [{ component: 'main', fiber: 'cotton', percent: 100 }],
      blankBrandVisible: false,
    },
    cap: {
      materials: 'Baumwolle, Textilfarbe',
      dimensions: {},
      sizeLabel: 'Einheitsgröße',
      condition: 'very_good',
      fiberComposition: [
        { component: 'main', fiber: 'cotton', percent: 60 },
        { component: 'main', fiber: 'polyester', percent: 40 },
      ],
      blankBrandVisible: false,
    },
    zeichnung: {
      materials: 'Aquarell auf Papier 300 g',
      dimensions: { widthCm: 21, heightCm: 29.7 },
      framed: false,
    },
    schmuck: {
      materials: 'Porzellan, Glasur',
      dimensions: { heightCm: 3 },
      metalPartsMaterial: 'Edelstahl 316L',
      nickelFreeConfirmed: true,
      nickelEvidence: fx.nickelEvidenceId,
      leadFreeGlazeConfirmed: true,
    },
    sonstiges: {},
  }
  return { ...base, ...extra[category], ...overrides }
}

/** Vom System gesetzte Felder: Fixtures mit Endstatus legen wie der Seed an (DATENMODELL §1.5, Seed-Kontext). */
const SYSTEM_FIELDS = [
  'firstPublishedAt',
  'soldAt',
  'soldChannel',
  'archivedAt',
  'reservedUntil',
  'reservationRef',
  'currentOrder',
]

/**
 * Legt ein Stück an. Entwürfe laufen durch den normalen Weg; Fixtures mit Endstatus oder Systemfeldern (seit dem
 * Statusautomaten P1.19 nur über Aktionen erreichbar) nutzen den Seed-Kontext – die Veröffentlichungsprüfung läuft
 * dabei trotzdem (§1.5).
 */
export async function createProduct(
  payload: Payload,
  data: Record<string, unknown>,
  context: RequestContext = {},
) {
  const needsSeed =
    (data.status !== undefined && data.status !== 'draft') ||
    SYSTEM_FIELDS.some((f) => data[f] !== undefined && data[f] !== null)
  return payload.create({
    collection: 'products',
    data: data as never,
    overrideAccess: true,
    context: needsSeed ? { seed: true, ...context } : context,
  })
}

/** Entfernt alle Test-Stücke im Fixture-Bereich (und darunter liegende Tests mit eigenen Nummern). */
export async function deleteProducts(payload: Payload, numbers?: number[]): Promise<void> {
  await payload.delete({
    collection: 'products',
    where: numbers ? { itemNumber: { in: numbers } } : { itemNumber: { greater_than_equal: 1 } },
    overrideAccess: true,
    context: { seed: true },
  })
}
