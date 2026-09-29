import { resolveShortLink } from './resolve'

// Nummernfeld der 404-Seite (KONZEPT §3.17, KO-12) ohne JavaScript: das GET-Formular sendet `/nr?nummer=17`; Antwort wie
// R31 `/nr/17` (307 auf die Produktseite bzw. 404).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  return resolveShortLink(request, new URL(request.url).searchParams.get('nummer'))
}
