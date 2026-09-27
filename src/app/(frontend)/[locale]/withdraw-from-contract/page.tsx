import { getTranslations, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import React from 'react'

import { Callout } from '@/components/ui/Callout'
import { getContactInfo } from '@/lib/data/contact'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R26')

// R26 Vertrag widerrufen (KONZEPT §3.16, Gerüst P2.14): Preset `calm`, `noindex, follow` (Registry). Dynamisch
// gerendert (Registry `rendering: dynamic`), damit Next die Nonce des CSP-Kontexts `dynamic` an seine Skripte hängt
// (ARCHITEKTUR §8.1). Bis P6 nur Überschrift, Hinweis „noch ohne Funktion“, Link zur Widerrufsbelehrung und die
// E-Mail-Adresse als Alternative; das zweistufige Formular (§ 356a BGB, R-091 ff.) folgt in P6.
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await connection()
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const [t, contact] = await Promise.all([
    getTranslations({ locale, namespace: 'withdraw' }),
    getContactInfo(),
  ])

  return (
    <div className="u-container u-stack" data-withdraw-page="">
      <h1>{WITHDRAWAL_LINK_LABEL[locale]}</h1>
      <Callout variant="warn">
        <p data-withdraw-preview-notice="">{t('previewNotice')}</p>
      </Callout>
      <p>
        <a href={localizedPath('R24', locale)} data-withdraw-policy-link="">
          {t('policyLink')}
        </a>
      </p>
      {contact.email ? (
        <p>
          {t('emailAlternative')}{' '}
          <a href={`mailto:${contact.email}`} data-withdraw-email="">
            {contact.email}
          </a>
        </p>
      ) : null}
    </div>
  )
}
