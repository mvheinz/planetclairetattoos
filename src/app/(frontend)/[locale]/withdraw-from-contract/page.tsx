import { getMessages, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import React from 'react'

import { WithdrawalFlow } from '@/components/legal/WithdrawalFlow'
import {
  WithdrawalView,
  type WithdrawalMessages,
  type WithdrawalViewFlow,
} from '@/components/legal/WithdrawalView'
import { getContactInfo } from '@/lib/data/contact'
import { WITHDRAWAL_CONFIRM_LABEL, WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'
import { initialWithdrawalState } from '@/lib/legal/withdrawalForm'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R26')

// R26 Vertrag widerrufen (KONZEPT §3.16, PLAN P6.8, § 356a BGB): Preset `calm`, `noindex, follow` (Registry), dynamisch
// gerendert (CSP-Kontext `dynamic`, ARCHITEKTUR §8.1). Zweistufige Widerrufsfunktion als Server Action
// (`WithdrawalFlow`; die Erstansicht `WithdrawalView` rendert der Server), funktioniert ohne JavaScript; Vorbelegung
// nur der Bestellnummer über `?order=`. Daneben der Link zur Widerrufsbelehrung und die E-Mail-Adresse als zweiter Weg
// (auch deren Eingang zählt).
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const [messages, contact, search] = await Promise.all([
    getMessages({ locale }),
    getContactInfo(),
    searchParams,
  ])
  const m = (messages as unknown as { withdraw: WithdrawalMessages }).withdraw
  const order = typeof search.order === 'string' ? search.order : null
  const flow: WithdrawalViewFlow = {
    locale,
    messages: m,
    confirmLabel: WITHDRAWAL_CONFIRM_LABEL[locale],
    privacyHref: `${localizedPath('R22', locale)}#widerruf`,
    contactEmail: contact.email,
  }
  const initial = initialWithdrawalState(order)

  return (
    <div className="u-container u-stack" data-withdraw-page="">
      <h1>{WITHDRAWAL_LINK_LABEL[locale]}</h1>
      <p data-withdraw-aside="">{m.intro}</p>
      <WithdrawalFlow
        {...flow}
        initial={initial}
        initialView={{
          pre: <WithdrawalView part="pre" state={initial} flow={flow} />,
          form: <WithdrawalView part="form" state={initial} flow={flow} />,
        }}
      />
      <div className="u-stack" data-withdraw-aside="">
        <p>
          <a href={localizedPath('R24', locale)} data-withdraw-policy-link="">
            {m.policyLink}
          </a>
        </p>
        {contact.email ? (
          <p>
            {m.emailAlternative}{' '}
            <a href={`mailto:${contact.email}`} data-withdraw-email="">
              {contact.email}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  )
}
