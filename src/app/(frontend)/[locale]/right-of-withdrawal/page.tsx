import React from 'react'

import { LegalPage } from '@/components/legal/LegalPage'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R24')

// R24 Widerrufsbelehrung (KONZEPT §3.14): Belehrung (`widerrufsbelehrung`) und Muster-Widerrufsformular
// (`widerrufsformular`) als Text, darunter der Link „Vertrag widerrufen“ (R-090). PDF-Downloads folgen in P6.
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale
  return (
    <LegalPage params={params} routeId="R24" types={['widerrufsbelehrung', 'widerrufsformular']}>
      <p>
        <a href={localizedPath('R26', locale)} data-withdraw-cta="">
          {WITHDRAWAL_LINK_LABEL[locale]}
        </a>
      </p>
    </LegalPage>
  )
}
