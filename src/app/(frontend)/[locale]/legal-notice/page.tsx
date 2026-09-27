import { LegalPage } from '@/components/legal/LegalPage'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R21')

// R21 Impressum (KONZEPT §3.14): gültige Fassung aus `legal-texts`, Typ `impressum`.
export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <LegalPage params={params} routeId="R21" types={['impressum']} />
}
