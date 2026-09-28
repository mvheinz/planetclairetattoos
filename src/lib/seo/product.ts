import type { Locale } from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'

// SEO-Texte der Produktseite R04 (KONZEPT §3.4 SEO/OG, P3.13) – reine Funktionen.

/** Höchstlänge der Beschreibung (KONZEPT §3.4: erste 155 Zeichen der Beschreibung). */
export const PRODUCT_DESCRIPTION_MAX = 155

const plain = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()

/**
 * `meta description`: `seo.metaDescription` aus dem CMS, sonst die ersten 155 Zeichen der Beschreibung – an einer
 * Wortgrenze gekürzt (nicht vor Zeichen 120), ohne Satzzeichen am Schnitt, mit „…“. Ohne beides `undefined` (dann
 * Vorlage je Seitentyp).
 */
export function productMetaDescription(product: {
  description?: string | null
  seo?: { metaDescription?: string | null } | null
}): string | undefined {
  const cms = plain(product.seo?.metaDescription)
  if (cms) return cms
  const text = plain(product.description)
  if (!text) return undefined
  if (text.length <= PRODUCT_DESCRIPTION_MAX) return text
  const cut = text.slice(0, PRODUCT_DESCRIPTION_MAX - 1)
  const words = cut.slice(0, Math.max(cut.lastIndexOf(' '), 120))
  return `${words.replace(/[\s.,;:!?–-]+$/u, '')}…`
}

/** Seitentitel ohne Markenzusatz: `seo.metaTitle` oder „{Titel} – Nr. 017“ (EN „– No. 017“). */
export function productPageTitle(
  product: {
    title?: string | null
    itemNumber: number
    seo?: { metaTitle?: string | null } | null
  },
  locale: Locale,
): string {
  const cms = plain(product.seo?.metaTitle)
  if (cms) return cms
  const title = plain(product.title)
  const nr = formatItemNumber(product.itemNumber, locale)
  return title ? `${title} – ${nr}` : nr
}
