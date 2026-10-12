import { SHORT_LINK_NUMBER_PARAM } from '@/lib/shop/shortLink'

import { resolveShortLink } from './resolve'

// Nummernfeld (404-Seite KONZEPT §3.17, KO-12; seit V-60 auch Shop-Kopf und Menü) ohne JavaScript: das GET-Formular sendet
// `/nr?nummer=17&locale=de`; Antwort wie R31 `/nr/17` (307 auf die Produktseite in der Sprache der Seite bzw. 404).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  return resolveShortLink(request, new URL(request.url).searchParams.get(SHORT_LINK_NUMBER_PARAM))
}
