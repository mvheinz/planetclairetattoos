import { toLocale } from '@/components/shop/listRoutes'
import { getOgProduct } from '@/lib/data/ogProduct'
import { getPublicProductByItemNumber } from '@/lib/data/products'
import { createLogger } from '@/lib/monitoring/logger'
import { OG_CONTENT_TYPE, productOgAlt, renderProductOg } from '@/og/render'
import { OG_SIZE } from '@/og/templates'
import { parseProductSegment } from '@/lib/shop/format'

// OG-Bild der Produktseite R04 (P3.14, DESIGN §12.6, KONZEPT §3.0.5): PNG 1200 × 630 mit erstem Foto, Titel,
// Preisschild, `Nr. 017`, Wortmarke; verkauft mit Stempel „sold“. Next setzt `og:image` (absolut über `metadataBase`),
// `og:image:alt`, `og:image:width`, `og:image:height` und `og:image:type` selbst – die Metadaten der Produktseite
// lassen dafür `openGraph.images` weg. Statisch je Stück, Erneuerung über den Tag `product:<id>` (ARCHITEKTUR §9.1).

export const revalidate = 3600
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

// Bild-Kennung in der URL (`…/opengraph-image-<hash>/stueck`).
const OG_IMAGE_ID = 'stueck'

type Params = { locale: string; product: string }

const log = createLogger()

async function publicProduct(params: Params) {
  const nr = parseProductSegment(decodeURIComponent(params.product))
  return nr === null ? null : getPublicProductByItemNumber(nr, toLocale(params.locale))
}

/** Alt-Text je Stück und Sprache; unbekannte oder nicht öffentliche Stücke haben kein Bild. */
export async function generateImageMetadata({ params }: { params: Params | Promise<Params> }) {
  const p = await params
  try {
    const product = await publicProduct(p)
    if (!product) return []
    return [
      {
        id: OG_IMAGE_ID,
        alt: productOgAlt(product, toLocale(p.locale)),
        size: OG_SIZE,
        contentType: OG_CONTENT_TYPE,
      },
    ]
  } catch (err) {
    log.warn('og.metadata_failed', { reason: (err as Error).message })
    return []
  }
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const p = await params
  const locale = toLocale(p.locale)
  const hit = await publicProduct(p)
  const product = hit ? await getOgProduct(hit.id, locale) : null
  if (!product) return new Response('Not Found', { status: 404 })
  return renderProductOg(product, locale)
}
