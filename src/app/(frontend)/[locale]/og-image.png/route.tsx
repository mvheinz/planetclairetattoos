import { LOCALES } from '@/lib/enums'
import { isLocale } from '@/lib/routes/paths'
import { renderDefaultOg } from '@/og/render'

// Standard-OG-Bild (P3.14, DESIGN §12.6, KONZEPT §3.0.5) für alle Seiten außer der Produktseite: `/de/og-image.png`,
// `/en/og-image.png` – Linienpapier, Planet-Marke, Wortmarke, Zeile „Tattoos & Unikate aus Berlin“, Coco. Beim Build
// statisch erzeugt; scheitert das Erzeugen, liefert die Route `public/og/default.png`. `buildMetadata` verweist absolut
// hierher.

export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) return new Response('Not Found', { status: 404 })
  return renderDefaultOg(locale)
}
