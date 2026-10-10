// Bestand der Vorschau-Datei (U-76, PLAN P16.3): Standard ist Juttas echter Bestand (`content/bestand`, über
// `pnpm bestand:import --preview` sofort „verfügbar“); der Demo-Bestand des Beispielbestands (SEED-SPEC) erscheint nur
// noch mit `PREVIEW_INVENTORY=demo` – für Prüfungen, die die Seed-Anker brauchen (Danke- und Statusseiten, verkauftes
// Stück S08). Mit echtem Bestand bleiben aus dem Beispielbestand nur Seiten, Bilder der Seiten, Tattoo, Termine und FAQ.
// Rein bis auf das Lesen der Datendateien.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { buildProductSlug } from '../../src/lib/products/itemNumber'
import { localizedPath } from '../../src/lib/routes/paths'
import { LOCALES, type Locale } from '../../src/lib/routes/registry'

export const PREVIEW_INVENTORIES = ['bestand', 'demo'] as const
export type PreviewInventory = (typeof PREVIEW_INVENTORIES)[number]

/** Schritte von `seed:example` beim echten Bestand: alles außer Stücken und den Vorgängen, die Stücke brauchen. */
export const BESTAND_SEED_STEPS = [
  'media',
  'flash',
  'tattoo-gallery',
  'tour-dates',
  'pages',
  'faqs',
] as const

/** `PREVIEW_INVENTORY` (Standard `bestand`); andere Werte sind ein Fehler. */
export function resolveInventory(
  env: Readonly<Record<string, string | undefined>>,
): PreviewInventory {
  const value = env.PREVIEW_INVENTORY?.trim() || 'bestand'
  if (!(PREVIEW_INVENTORIES as readonly string[]).includes(value)) {
    throw new Error(`PREVIEW_INVENTORY „${value}“ ungültig (bestand oder demo).`)
  }
  return value as PreviewInventory
}

/** Ein öffentliches Stück der Vorschau. */
export interface PreviewPiece {
  key: string
  itemNumber: number
  category: string
  title: { de: string; en?: string }
  priceCents: number
  /** Fotos in der Galerie der Produktseite (inkl. Foto zum Größenvergleich). */
  photos: number
  deviation: boolean
}

interface SeedPiece {
  key: string
  itemNumber: number
  category: string
  title: { de: string; en?: string }
  priceCents: number
  images: unknown[]
  deviationDecision?: string
  hasDeviation?: boolean
  state: { status: string; showInArchiveAfterSale?: boolean }
}

interface BestandPiece {
  key: string
  itemNumber: number
  category: string
  title: { de: string; en: string }
  priceCents: number
  images: unknown[]
  scalePhoto?: unknown
  deviationDecision: string
}

const readJson = <T>(root: string, file: string): T =>
  JSON.parse(readFileSync(path.resolve(root, file), 'utf8')) as T

/** Öffentliche Stücke (verfügbar, reserviert, verkauft mit Archiv) nach Nummer. */
export function previewPieces(inventory: PreviewInventory, root = process.cwd()): PreviewPiece[] {
  const pieces =
    inventory === 'demo'
      ? readJson<SeedPiece[]>(root, 'content/seed/data/products.json')
          .filter(
            (p) =>
              ['available', 'reserved'].includes(p.state.status) ||
              (p.state.status === 'sold' && p.state.showInArchiveAfterSale === true),
          )
          .map((p) => ({
            key: p.key,
            itemNumber: p.itemNumber,
            category: p.category,
            title: p.title,
            priceCents: p.priceCents,
            photos: p.images.length,
            deviation: p.deviationDecision === 'described' || p.hasDeviation === true,
          }))
      : readJson<BestandPiece[]>(root, 'content/bestand/products.json').map((p) => ({
          key: p.key,
          itemNumber: p.itemNumber,
          category: p.category,
          title: p.title,
          priceCents: p.priceCents,
          photos: p.images.length + (p.scalePhoto ? 1 : 0),
          deviation: p.deviationDecision === 'described',
        }))
  return pieces.sort((a, b) => a.itemNumber - b.itemNumber)
}

/**
 * Zwei Stücke im Korb der Vorschau (PLAN P4.25): eine Keramik mit mindestens zwei Fotos (Galerie-Prüfung) und ein
 * Textil-/Cap-Stück mit beschriebener Abweichung (Häkchen „Abweichung bestätigen“ an der Kasse). Demo: S01 und S11.
 */
export function cartAnchors(
  inventory: PreviewInventory,
  root = process.cwd(),
): [PreviewPiece, PreviewPiece] {
  const pieces = previewPieces(inventory, root)
  const byNumber = (nr: number) => pieces.find((p) => p.itemNumber === nr)
  const ceramic =
    inventory === 'demo'
      ? byNumber(901)
      : pieces.find((p) => p.category === 'keramik' && p.photos >= 2 && !p.deviation)
  const textile =
    inventory === 'demo'
      ? byNumber(911)
      : pieces.find((p) => (p.category === 'textil' || p.category === 'cap') && p.deviation)
  if (!ceramic || !textile)
    throw new Error(`Korb-Stücke der Vorschau (${inventory}) nicht gefunden.`)
  return [ceramic, textile]
}

/** Pfad der Produktseite R04 eines Stücks in `lang`. */
export function piecePath(piece: Pick<PreviewPiece, 'itemNumber' | 'title'>, lang: Locale): string {
  const [nummer, ...rest] = buildProductSlug(
    piece.itemNumber,
    piece.title[lang] || piece.title.de,
  ).split('-')
  return localizedPath('R04', lang, { nummer: nummer!, slug: rest.join('-') })
}

/** Pfade der Produktseite je Sprache. */
export function piecePaths(
  piece: Pick<PreviewPiece, 'itemNumber' | 'title'>,
): Record<Locale, string> {
  return Object.fromEntries(LOCALES.map((l) => [l, piecePath(piece, l)])) as Record<Locale, string>
}
