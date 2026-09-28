import { LegalPage } from '@/components/legal/LegalPage'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R25')

// R25 Versand & Zahlung (KONZEPT §3.15): vorerst nur der Text aus `legal-texts` (Typ `versand-zahlung`); die Tabelle
// der Versandklassen aus den Einstellungen folgt in P4.
export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <LegalPage params={params} routeId="R25" types={['versand-zahlung']} />
}
