import { LegalPage } from '@/components/legal/LegalPage'
import { ProcessorTable } from '@/components/legal/ProcessorTable'
import type { Locale } from '@/lib/enums'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R22')

// R22 Datenschutz (KONZEPT §3.14): gültige Fassung aus `legal-texts`, Typ `datenschutz`; darunter die generierte
// Auftragsverarbeiter-Tabelle (P6.21, kein Token – steht auch beim Platzhalter-Text).
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return (
    <LegalPage params={params} routeId="R22" types={['datenschutz']}>
      <ProcessorTable locale={locale as Locale} />
    </LegalPage>
  )
}
