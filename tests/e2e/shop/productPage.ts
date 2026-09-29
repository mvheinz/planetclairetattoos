import type { APIRequestContext, Locator, Page } from '@playwright/test'
import type { Payload } from 'payload'

import type { Locale } from '../../../src/lib/enums'
import { productPath } from '../../../src/lib/shop/format'
import { holdConformityData, type ReleaseLock } from '../../helpers/adminSessionLock'
import { expect, testPayload } from '../fixtures'
import { freshPage, refresh } from './fresh'

// Gemeinsame Helfer der Produktseiten-Tests (P3.8): kanonische Pfade der Seed-Anker, veröffentlichte Fixture-Stücke,
// DOM-Reihenfolge per `compareDocumentPosition` und eine eigene Konformitätserklärung (der Seed hat keine).

/** Kanonische Pfade der Seed-Anker (Mini-Beispielbestand, SEED-SPEC). */
export const ANCHORS = {
  S01: { de: '/de/shop/901-schale-langohr-wuschel', en: '/en/shop/901-bowl-long-ears-fluff' },
  S06: { de: '/de/shop/906-fliese-auftritt', en: '/en/shop/906-tile-on-stage' },
  S11: {
    de: '/de/shop/911-t-shirt-coco-fliegt-zum-mond',
    en: '/en/shop/911-t-shirt-coco-flies-to-the-moon',
  },
  S15: { de: '/de/shop/915-pinke-cap-sometimes', en: '/en/shop/915-pink-cap-sometimes' },
  S20: { de: '/de/shop/920-zwei-figuren-tusche', en: '/en/shop/920-two-figures-ink' },
  S26: { de: '/de/shop/926-fuchs-anhaenger', en: '/en/shop/926-fox-pendant' },
  S27: {
    de: '/de/shop/927-anhaenger-coco-mit-planetenring',
    en: '/en/shop/927-pendant-coco-with-a-planet-ring',
  },
} as const

/** Veröffentlicht (`available`) – Systemfelder setzt der Seed-Kontext der Fixture. */
export const PUBLISHED = { status: 'available', firstPublishedAt: '2026-09-01T10:00:00.000Z' }

/** Kanonischer Pfad eines Stücks aus der Datenbank (Slug der Sprache). */
export async function pathOf(itemNumber: number, locale: Locale): Promise<string> {
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
  return productPath({ itemNumber, slug: doc.slug }, locale)
}

/** Seite frisch öffnen (Daten-Cache umgehen bzw. neu erzeugen) und Status 200 prüfen. */
export async function openProduct(page: Page, request: APIRequestContext, url: string) {
  await freshPage(page)
  await refresh(request, [url])
  const res = await page.goto(url)
  expect(res?.status(), url).toBe(200)
  await expect(page.locator('[data-product-page]')).toBeVisible()
}

/** `true`, wenn `a` im DOM vor `b` steht. */
export async function isBefore(a: Locator, b: Locator): Promise<boolean> {
  const handle = await b.elementHandle()
  return a.evaluate(
    (x, y) => !!y && (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    handle,
  )
}

/** Kaufknopf bzw. Verkauft-Text (Ende der Pflichtangaben). */
export const buyTarget = (page: Page): Locator =>
  page.locator('[data-add-to-cart], [data-sold-text]').first()

export interface Declaration {
  id: number
  release: ReleaseLock
  cleanup: () => Promise<void>
}

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)
const file = (name: string) => ({ data: PDF, name, mimetype: 'application/pdf', size: PDF.length })

/**
 * Aktive Konformitätserklärung für eine Test-Fixture „Keramik lebensmittelecht“ (SEED-SPEC §0.3: der Seed hat keine).
 * Hält `holdConformityData('exclusive')`, bis `cleanup()` alles entfernt hat.
 */
export async function createDeclaration(payload: Payload): Promise<Declaration> {
  const release = await holdConformityData('exclusive')
  const labReport = (
    await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'lab_report', complianceCategory: 'keramik' } as never,
      file: file('labor-e2e.pdf'),
      overrideAccess: true,
    })
  ).id as number
  const declarationPdf = (
    await payload.create({
      collection: 'documents',
      data: { title: 'Konformitätserklärung E2E', kind: 'conformity_declaration' } as never,
      file: file('erklaerung-e2e.pdf'),
      overrideAccess: true,
    })
  ).id as number
  const doc = await payload.create({
    collection: 'conformity-declarations',
    data: {
      name: 'E2E-Glasur transparent',
      glazeManufacturer: 'Botz',
      labName: 'Prüflabor Berlin',
      labReportDate: '2026-08-01T00:00:00.000Z',
      labReport,
      declarationPdf,
      validFrom: '2026-09-01T00:00:00.000Z',
    } as never,
    overrideAccess: true,
  })
  const id = doc.id as number
  return {
    id,
    release,
    async cleanup() {
      try {
        await payload
          .delete({ collection: 'conformity-declarations', id, overrideAccess: true })
          .catch(() => null)
        await payload
          .delete({ collection: 'documents', id: declarationPdf, overrideAccess: true })
          .catch(() => null)
        await payload
          .delete({ collection: 'private-uploads', id: labReport, overrideAccess: true })
          .catch(() => null)
      } finally {
        await release()
      }
    },
  }
}

/** Stück sofort entfernen (vor der Erklärung, auf die es verweist). */
export async function removeProduct(payload: Payload, itemNumber: number): Promise<void> {
  await payload.delete({
    collection: 'products',
    where: { itemNumber: { equals: itemNumber } },
    overrideAccess: true,
    context: { seed: true },
  })
}
