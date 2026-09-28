import { LegalPage } from '@/components/legal/LegalPage'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R23')

// R23 AGB (KONZEPT §3.14): gültige Fassung aus `legal-texts`, Typ `agb`.
export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <LegalPage params={params} routeId="R23" types={['agb']} />
}
