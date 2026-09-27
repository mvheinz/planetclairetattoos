import { LegalPage } from '@/components/legal/LegalPage'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R22')

// R22 Datenschutz (KONZEPT §3.14): gültige Fassung aus `legal-texts`, Typ `datenschutz`.
export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <LegalPage params={params} routeId="R22" types={['datenschutz']} />
}
