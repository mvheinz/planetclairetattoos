import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { LegalPage } from '@/components/legal/LegalPage'
import { DeliveryTime } from '@/components/shop/DeliveryTime'
import { ShippingTable } from '@/components/shop/ShippingTable'
import { WarrantyNotice } from '@/components/shop/WarrantyNotice'
import type { ShippingSettings } from '@/lib/commerce/shipping'
import { getShippingPaymentSettings } from '@/lib/data/shopSettings'
import { getSnippet } from '@/lib/legal/snippets'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { routeMetadata } from '@/lib/seo/metadata'

import styles from './page.module.css'

export const generateMetadata = routeMetadata('R25')

// R25 Versand & Zahlung (KONZEPT §3.15, PLAN P4.3; Preset `legal`): Einleitung aus der gültigen `legal-texts`-Fassung
// `versand-zahlung` (Tokens `{{shippingTable}}`, `{{deliveryTime}}`, `{{vorkasseDays}}` ersetzt der Renderer aus P1;
// Band „PLATZHALTER – nicht rechtsverbindlich“, solange die Fassung nicht von der Kanzlei stammt, R-002), danach die
// Versandtabelle aus `settings.shipping.rates` über `computeShipping` (eine Quelle mit Korb und Kasse, E-25, R-031),
// Regel „höchste Versandklasse“, Lieferzeit (E-31, R-035), Liefergebiet (E-24), Zahlarten (E-20, E-23), Zeitpunkt der
// Belastung, Transportschäden (ohne Rügefrist, V-10/V-11), Rücksendekosten (E-27), Link R24 und die harmonisierte
// Mitteilung zur Gewährleistung (R-049). Statisch mit Tag `settings` (neuer Klassenpreis nach ≤ 60 s sichtbar).

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'shippingPayment' }),
    getShippingPaymentSettings(locale),
  ])
  const city = settings.pickupCity ?? 'Berlin'
  const withdrawalLink = (chunks: React.ReactNode) => (
    <a href={localizedPath('R24', locale)} data-withdrawal-policy-link="">
      {chunks}
    </a>
  )

  return (
    <LegalPage params={params} routeId="R25" types={['versand-zahlung']}>
      <div className={styles.sections} data-shipping-payment="">
        <section aria-labelledby="sp-costs" data-section="costs">
          <h2 id="sp-costs">{t('costsHeading')}</h2>
          <ShippingTable
            locale={locale}
            settings={{ shipping: settings.shipping } as ShippingSettings}
            pickupEnabled={settings.pickupEnabled}
            pickupCity={city}
          />
          <p data-highest-class-rule="">{t('highestClassRule')}</p>
        </section>

        <section aria-labelledby="sp-time" data-section="delivery-time">
          <h2 id="sp-time">{t('deliveryTimeHeading')}</h2>
          <DeliveryTime locale={locale} deliveryTime={settings.deliveryTimeText} />
          {settings.pickupEnabled ? (
            <DeliveryTime
              locale={locale}
              deliveryTime={settings.deliveryTimeText}
              shippingClass="nur_abholung"
            />
          ) : null}
        </section>

        <section aria-labelledby="sp-area" data-section="area">
          <h2 id="sp-area">{t('areaHeading')}</h2>
          <p data-delivery-area="">
            {settings.pickupEnabled ? t('area', { city }) : t('areaNoPickup')}
          </p>
        </section>

        <section aria-labelledby="sp-payment" data-section="payment">
          <h2 id="sp-payment">{t('paymentHeading')}</h2>
          <ul className={styles.list} data-payment-methods="">
            <li data-payment-method="stripe">{t('paymentStripe')}</li>
            {settings.prepaymentEnabled ? (
              <li data-payment-method="prepayment">
                {t('paymentPrepayment', { days: settings.prepaymentDays })}
              </li>
            ) : null}
          </ul>
          <p>{t('noSurcharge')}</p>
        </section>

        <section aria-labelledby="sp-charge" data-section="charge">
          <h2 id="sp-charge">{t('chargeHeading')}</h2>
          <p data-charge="stripe">{t('chargeStripe')}</p>
          {settings.prepaymentEnabled ? (
            <p data-charge="prepayment">{t('chargePrepayment')}</p>
          ) : null}
        </section>

        <section aria-labelledby="sp-damage" data-section="damage">
          <h2 id="sp-damage">{t('damageHeading')}</h2>
          <p data-transport-damage="">{t('damage')}</p>
        </section>

        <section aria-labelledby="sp-return" data-section="return">
          <h2 id="sp-return">{t('returnHeading')}</h2>
          <p data-return-costs="">{getSnippet('withdrawal.returnCostsNote', locale).text}</p>
          <p>{t.rich('withdrawalLink', { link: withdrawalLink })}</p>
        </section>

        <WarrantyNotice locale={locale} />
      </div>
    </LegalPage>
  )
}
