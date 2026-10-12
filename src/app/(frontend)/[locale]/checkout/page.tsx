import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import React from 'react'

import {
  CheckoutForm,
  type CheckoutMessages,
  type CountryOption,
} from '@/components/checkout/CheckoutForm'
import { CheckoutSummaryItems, CheckoutSummaryTotals } from '@/components/checkout/CheckoutSummary'
import { LegalNotice } from '@/components/checkout/LegalNotice'
import { ReservationCountdown } from '@/components/checkout/ReservationCountdown'
import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { Callout } from '@/components/ui/Callout'
import { CHECKOUT_COOKIE, cartNoticeSearch } from '@/lib/commerce/checkout'
import type { CheckoutChoice } from '@/lib/commerce/checkoutSchema'
import { deviationSnippet } from '@/lib/commerce/submitCheckout'
import { loadCheckoutPage } from '@/lib/data/checkout'
import { BILLING_COUNTRY_CODES, type Locale } from '@/lib/enums'
import { ORDER_BUTTON_LABEL } from '@/lib/legal/constants'
import { getSnippet } from '@/lib/legal/snippets'
import { localizedPath } from '@/lib/routes/paths'
import { formatItemNumber } from '@/lib/shop/format'
import { routeMetadata } from '@/lib/seo/metadata'
import { formatBerlin } from '@/lib/time'

import styles from './page.module.css'

export const generateMetadata = routeMetadata('R07')

// R07 Kasse (KONZEPT §3.7/§4.4–§4.8, DESIGN KO-14/KO-15; PLAN P4.9/P4.10): dynamisch (Registry: `noindex`, CSP-Kontext
// `checkout`, `Cache-Control: private, no-store` im Proxy). Ohne gültiges `pc_checkout` oder bei Kasse `expired`/
// `cancelled`/`completed`/`failed` → 307 auf den Korb R06 mit Hinweis. Stripe.js lädt nur hier und nur bei
// `PAYMENTS_DRIVER=stripe` (R-062); mit `mock` erscheint das Test-Zahlungsfeld, mit `PREVIEW_EXPORT=true` ein Platzhalter.
// Preset `calm`: keine Animation, nur der Countdown wechselt seinen Text.

const NOTICE_RE = /^[a-z_]{2,40}$/

/** Länder der Rechnungsadresse (V-17): Deutschland zuerst, dann alphabetisch in der Sprache der Seite. */
function billingCountryOptions(locale: Locale): CountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  const collator = new Intl.Collator(locale)
  return BILLING_COUNTRY_CODES.map((c) => ({ value: c, label: names.of(c) ?? c })).sort((a, b) =>
    a.value === 'DE' ? -1 : b.value === 'DE' ? 1 : collator.compare(a.label, b.label),
  )
}

const listFormat = (locale: Locale, items: string[]) =>
  new Intl.ListFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
    style: 'long',
    type: 'conjunction',
  }).format(items)

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
  const [jar, requestHeaders, search, t, messages] = await Promise.all([
    cookies(),
    headers(),
    searchParams,
    getTranslations({ locale, namespace: 'checkout' }),
    getMessages({ locale }),
  ])
  const now = new Date()
  const token = jar.get(CHECKOUT_COOKIE)?.value ?? null
  const data = await loadCheckoutPage({ token, locale, now })
  if (data.state === 'redirect') {
    redirect(
      `${localizedPath('R06', locale)}${cartNoticeSearch(data.notice, { itemNumbers: data.itemNumbers })}`,
    )
  }
  const { checkout, display } = data
  const rawNotice = typeof search.hinweis === 'string' ? search.hinweis : null
  const notice = rawNotice && NOTICE_RE.test(rawNotice) ? rawNotice : null

  const city = display.pickupCity ?? 'Berlin'
  const pickupOnlyNumbers = checkout.items
    .filter((i) => i.shippingClass === 'nur_abholung')
    .map((i) => formatItemNumber(i.itemNumber, locale))
  const highest = checkout.items.some((i) => i.shippingClass !== 'brief') ? 'DHL' : 'Deutsche Post'
  // Die Beschriftungen gehen als Elemente an die Client-Komponente (RSC-Grenze) und landen dort in der Kinderliste des
  // Labels – mit Schlüssel, sonst meldet React im Browser „Each child in a list should have a unique key“ (saubere Konsole,
  // ARCHITEKTUR §7.2).
  const deliveryLabels = {
    shipping: (
      <span key="shipping" data-delivery-option="shipping">
        {t('fields.deliveryShipping', { carrier: highest })}
        {data.quotes.shipping !== null ? (
          <>
            {' – '}
            <MoneyAmount cents={data.quotes.shipping} locale={locale} />
          </>
        ) : null}
      </span>
    ),
    pickup: (
      <span key="pickup" data-delivery-option="pickup">
        {t('fields.deliveryPickup', { city })}
        {' – '}
        <MoneyAmount cents={0} locale={locale} />
      </span>
    ),
  }
  const dueText = data.prepaymentDueAt
    ? formatBerlin(
        data.prepaymentDueAt,
        locale === 'en' ? 'EEE d MMM yyyy' : 'EEE dd.MM.yyyy',
        locale,
      )
    : null
  const shippingDefaults = checkout.shippingAddress ?? {}
  const billingDefaults = checkout.billingAddress ?? {}
  const userAgent = requestHeaders.get('user-agent') ?? ''

  return (
    <div
      className={`u-container ${styles.page}`}
      data-checkout-page=""
      data-checkout-status={checkout.status}
    >
      <h1 className={styles.title}>{t('title')}</h1>
      {notice === 'cart_changed' ? (
        <div role="status" data-checkout-notice={notice}>
          <Callout variant="warn">
            <p>
              {t('errors.codes.cart_changed')}{' '}
              <a href={localizedPath('R06', locale)}>{t('fields.toCart')}</a>
            </p>
          </Callout>
        </div>
      ) : null}
      <ReservationCountdown
        locale={locale}
        displayExpiresAt={new Date(checkout.displayExpiresAt)}
        now={now}
      />
      <CheckoutForm
        locale={locale}
        messages={(messages as unknown as { checkout: CheckoutMessages }).checkout}
        orderLabel={ORDER_BUTTON_LABEL[locale]}
        fulfillmentMethod={checkout.fulfillmentMethod}
        pickupOnlyNote={
          pickupOnlyNumbers.length > 0
            ? t('fields.deliveryPickupOnly', { items: listFormat(locale, pickupOnlyNumbers) })
            : null
        }
        deliveryLabels={deliveryLabels}
        pickupAvailable={data.pickupAvailable}
        pickupCity={city}
        district={data.studioDistrict}
        billingCountries={billingCountryOptions(locale)}
        defaults={{
          email: checkout.customer?.email ?? '',
          shippingAddress: shippingDefaults,
          billingAddressDiffers: checkout.billingAddressDiffers === true,
          billingAddress: billingDefaults,
          paymentChoice: (checkout.paymentChoice as CheckoutChoice | null | undefined) ?? null,
        }}
        paymentChoices={data.options.choices}
        payment={data.payment}
        prepaymentEnabled={data.options.prepaymentEnabled}
        instagram={userAgent.includes('Instagram')}
        dhlConsentText={getSnippet('checkout.dhlEmailConsent', locale).text}
        vorkasseInfoText={
          getSnippet('checkout.vorkasseInfo', locale, { vorkasseDays: data.options.prepaymentDays })
            .text
        }
        prepaymentDueText={dueText}
        deviations={checkout.items
          .filter((i) => !!i.deviationText)
          .map((i) => ({
            productId: typeof i.product === 'number' ? i.product : i.product.id,
            text: deviationSnippet(i, locale).text,
          }))}
        summaryItems={
          <CheckoutSummaryItems
            checkout={checkout}
            locale={locale}
            media={data.media}
            imageOf={data.imageOf}
          />
        }
        summaryTotals={
          <CheckoutSummaryTotals checkout={checkout} locale={locale} display={display} now={now} />
        }
        legalNotice={<LegalNotice locale={locale} />}
        compactCountdown={
          <ReservationCountdown
            locale={locale}
            displayExpiresAt={new Date(checkout.displayExpiresAt)}
            now={now}
            variant="compact"
          />
        }
        expired={data.expired}
        paymentRunning={data.paymentRunning}
        notice={notice && notice !== 'cart_changed' ? notice : null}
        // R-138: Link direkt auf den Abschnitt „Bestellung“ der Datenschutzerklärung (Anker aus src/lib/legal/anchors.ts)
        privacyHref={`${localizedPath('R22', locale)}#bestellung`}
        cartHref={localizedPath('R06', locale)}
      />
    </div>
  )
}
