import 'server-only'

import { getPublicProductByItemNumber } from '@/lib/data/products'
import { logger } from '@/lib/monitoring/logger'
import { productPath } from '@/lib/shop/format'
import { SHORT_LINK_HEADERS, parseShortLinkNumber, shortLinkLocale } from '@/lib/shop/shortLink'
import type { Locale } from '@/lib/routes/registry'

// R31 Kurzlink (KONZEPT §2.4): `/nr/17` → 307 auf die kanonische Produktseite in der per `Accept-Language` erkannten
// Sprache; unbekannt oder nicht öffentlich → 404. `Vary: Accept-Language`, `Cache-Control: no-store`, nie ein Cookie.
// Die 404 zeigt die normale 404-Seite (R28 mit Nummernfeld und Fußbereich): Route Handler können nicht auf eine Seite
// umschreiben, deshalb holt die Antwort deren HTML einmal vom eigenen Server (`/{locale}/nr` hat keine Seite).

async function notFoundPage(request: Request, locale: Locale): Promise<Response> {
  try {
    const res = await fetch(new URL(`/${locale}/nr`, request.url), {
      cache: 'no-store',
      redirect: 'manual',
      headers: { accept: 'text/html', 'accept-language': locale },
    })
    const type = res.headers.get('content-type') ?? ''
    if (res.status === 404 && type.startsWith('text/html')) {
      return new Response(await res.text(), {
        status: 404,
        headers: { 'content-type': type, ...SHORT_LINK_HEADERS },
      })
    }
  } catch (err) {
    logger.warn('nr.not_found_page_unavailable', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...SHORT_LINK_HEADERS },
  })
}

export async function resolveShortLink(request: Request, raw: string | null): Promise<Response> {
  const locale = shortLinkLocale(request.headers.get('accept-language'))
  const nr = parseShortLinkNumber(raw)
  const product = nr === null ? null : await getPublicProductByItemNumber(nr, locale)
  if (!product) return notFoundPage(request, locale)
  return new Response(null, {
    status: 307,
    headers: {
      location: new URL(productPath(product, locale), request.url).toString(),
      ...SHORT_LINK_HEADERS,
    },
  })
}
