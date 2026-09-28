import type { APIRequestContext } from '@playwright/test'

import type { Locale } from '../../../src/lib/enums'
import { localizedPath } from '../../../src/lib/routes/paths'
import { LOCALES } from '../../../src/lib/routes/registry'
import { productPath } from '../../../src/lib/shop/format'
import { type FixtureProducts, testPayload } from '../fixtures'
import { refresh } from './fresh'
import { ANCHORS } from './productPage'

// P3.16 Querschnitts-Seiten der Phase 3 (PLAN P3.16): Die Suiten `@privacy` (T-03/T-04), `@a11y` (T-11), der
// Verbotsmuster-Scan und `check:bundle` prüfen neben der Beispiel-Adresse je Route (`samplePath`) auch die Varianten
// und Zustände der neuen Routen R02–R05 – je Kategorie, reserviert, verkauft und die 404-Varianten. Grundlage ist der
// Mini-Beispielbestand (SEED-SPEC): S01 Keramik (verfügbar), S11 Textil, S15 Cap, S20 Zeichnung, S26 Schmuck,
// S27 reserviert, S06 verkauft (im Archiv), S18 Entwurf. Die Variante „Schon ein Zuhause“ (verkauft, nicht im Archiv,
// analog S08) entsteht je Test als Fixture im Block des Projekts (`homeVariant`). Tests, die diese Seiten lesen, halten
// den Listen-Bestand geteilt (`holdListData`), damit exklusive Bestandstests (Archiv-Leerzustand, „Shop pausiert“)
// nie dazwischenfunken.

export interface GatePage {
  /** Kurzname für Testtitel, z. B. `R04 S06 sold de`. */
  name: string
  routeId: 'R02' | 'R03' | 'R04' | 'R05' | 'R28' | 'R31'
  locale: Locale
  path: string
  status: number
}

/** Kategorien der Navigation (Slug je Sprache) plus die im Mini-Bestand leere `sonstiges` (Leerzustand KO-17). */
export const CATEGORY_SLUGS: readonly { key: string; de: string; en: string }[] = [
  { key: 'keramik', de: 'keramik', en: 'ceramics' },
  { key: 'textil', de: 'textil', en: 'textiles' },
  { key: 'cap', de: 'caps', en: 'caps' },
  { key: 'zeichnung', de: 'zeichnungen', en: 'drawings' },
  { key: 'schmuck', de: 'schmuck', en: 'jewellery' },
  { key: 'sonstiges', de: 'sonstiges', en: 'other' },
]

/** Produktseiten je Kategorie und Zustand (Seed-Anker). */
export const PRODUCT_STATES: readonly { key: keyof typeof ANCHORS; label: string }[] = [
  { key: 'S01', label: 'Keramik verfügbar' },
  { key: 'S11', label: 'Textil' },
  { key: 'S15', label: 'Cap' },
  { key: 'S20', label: 'Zeichnung' },
  { key: 'S26', label: 'Schmuck' },
  { key: 'S27', label: 'reserviert' },
  { key: 'S06', label: 'sold' },
]

const byLocale = (fn: (locale: Locale) => Omit<GatePage, 'locale'>): GatePage[] =>
  LOCALES.map((locale) => ({ ...fn(locale), locale }))

/** Alle festen P3-Seiten (ohne die Fixture-Variante „Zuhause“). */
export const P3_PAGES: readonly GatePage[] = [
  // R02 Shop und Variante „nur verfügbare“ (statisch vorgerendert, Spike B-05)
  ...byLocale((l) => ({
    name: `R02 ${l}`,
    routeId: 'R02',
    path: localizedPath('R02', l),
    status: 200,
  })),
  ...byLocale((l) => ({
    name: `R02 nur verfügbare ${l}`,
    routeId: 'R02',
    path: `${localizedPath('R02', l)}?available=1`,
    status: 200,
  })),
  // R03 je Kategorie (inkl. Leerzustand `sonstiges`) und eine Variante
  ...CATEGORY_SLUGS.flatMap((c) =>
    byLocale((l) => ({
      name: `R03 ${c.key} ${l}`,
      routeId: 'R03',
      path: localizedPath('R03', l, { slug: c[l] }),
      status: 200,
    })),
  ),
  ...byLocale((l) => ({
    name: `R03 keramik nur verfügbare ${l}`,
    routeId: 'R03',
    path: `${localizedPath('R03', l, { slug: l === 'de' ? 'keramik' : 'ceramics' })}?available=1`,
    status: 200,
  })),
  // R05 Archiv und Kategorie-Variante
  ...byLocale((l) => ({
    name: `R05 ${l}`,
    routeId: 'R05',
    path: localizedPath('R05', l),
    status: 200,
  })),
  ...byLocale((l) => ({
    name: `R05 keramik ${l}`,
    routeId: 'R05',
    path: `${localizedPath('R05', l)}?category=${l === 'de' ? 'keramik' : 'ceramics'}`,
    status: 200,
  })),
  // R04 je Kategorie und Zustand
  ...PRODUCT_STATES.flatMap((s) =>
    byLocale((l) => ({
      name: `R04 ${s.key} ${s.label} ${l}`,
      routeId: 'R04',
      path: ANCHORS[s.key][l],
      status: 200,
    })),
  ),
  // 404-Varianten: unbekanntes Stück bzw. Entwurf (S18) → „losgerissen“, Seite hinter der letzten Listen-Seite
  ...byLocale((l) => ({
    name: `R04 404 unbekannt ${l}`,
    routeId: 'R28',
    path: `/${l}/shop/9876-gibt-es-nicht`,
    status: 404,
  })),
  ...byLocale((l) => ({
    name: `R04 404 Entwurf S18 ${l}`,
    routeId: 'R28',
    path: `/${l}/shop/918`,
    status: 404,
  })),
  ...byLocale((l) => ({
    name: `R02 404 Seite 99 ${l}`,
    routeId: 'R28',
    path: `${localizedPath('R02', l)}?page=99`,
    status: 404,
  })),
  // R31 Kurzlink (307 → Produktseite) und unbekannte Nummer (404)
  { name: 'R31 /nr/926', routeId: 'R31', locale: 'de', path: '/nr/926', status: 200 },
  { name: 'R31 404 /nr/9876', routeId: 'R31', locale: 'de', path: '/nr/9876', status: 404 },
]

/**
 * Fixture analog S08 (`sold`, `showInArchiveAfterSale = false`) im Block des Projekts → Pfad der 404-Variante
 * „Dieses Stück hat schon ein Zuhause gefunden“ (KO-18) in der Sprache `locale`, frisch erzeugt.
 */
export async function homeVariant(
  fixtureProducts: FixtureProducts,
  request: APIRequestContext,
  locale: Locale,
): Promise<string> {
  const { itemNumber } = await fixtureProducts.create('keramik', {
    status: 'sold',
    firstPublishedAt: '2026-09-01T10:00:00.000Z',
    soldAt: '2026-09-20T10:00:00.000Z',
    soldChannel: 'offline',
    offlineSaleNote: 'Flohmarkt',
    showInArchiveAfterSale: false,
  })
  const payload = await testPayload()
  const doc = (
    await payload.find({
      collection: 'products',
      where: { itemNumber: { equals: itemNumber } },
      locale,
      fallbackLocale: 'de',
      overrideAccess: true,
      limit: 1,
    })
  ).docs[0]!
  const url = productPath({ itemNumber, slug: doc.slug }, locale)
  await refresh(request, [url])
  return url
}
