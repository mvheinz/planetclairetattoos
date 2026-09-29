import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import React from 'react'

import { CartLine } from '@/components/cart/CartLine'
import { Coco } from '@/components/Coco'
import { DeliveryTime } from '@/components/shop/DeliveryTime'
import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { PriceNote } from '@/components/shop/PriceNote'
import { WarrantyNotice } from '@/components/shop/WarrantyNotice'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Radio } from '@/components/ui/Choice'
import { EmptyState } from '@/components/ui/EmptyState'
import { evaluateCart, readCart } from '@/lib/commerce/cart'
import { CART_COOKIE } from '@/lib/commerce/cartCookie'
import { CHECKOUT_COOKIE, parseCartNotice, type CartNotice } from '@/lib/commerce/checkout'
import type { CartBlocker } from '@/lib/commerce/evaluateCart'
import { getCartMedia } from '@/lib/data/cart'
import { getShopDisplaySettings, taxSettingsFor } from '@/lib/data/shopSettings'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { localizedPath } from '@/lib/routes/paths'
import { formatItemNumber } from '@/lib/shop/format'
import { routeMetadata } from '@/lib/seo/metadata'

import { setDeliveryMethod, startCheckoutAction } from './actions'
import styles from './page.module.css'

export const generateMetadata = routeMetadata('R06')

// R06 Warenkorb (KONZEPT §3.6/§4.2, DESIGN KO-13, PLAN P4.8): dynamisch (Registry: `noindex`, CSP-Kontext `dynamic`,
// `Cache-Control: private, no-store` im Proxy), kein Stripe.js. Liest `pc_cart`/`pc_checkout` nur – der Seitenaufruf
// setzt nie ein Cookie und reserviert nichts (EK-04); jede Position prüft `evaluateCart` serverseitig neu. Alle
// Bedienelemente sind POST-Formulare mit Server-Actions (ohne JavaScript 303 zurück auf den Korb, ggf. mit Hinweis
// `?hinweis=…`). Zahlarten und Liefergebiet (Baustein `cart.paymentAndDeliveryInfo`, R-036) stehen vor „Zur Kasse“.
// Preset `calm`: keine Animation; Coco sitzt statisch neben der Summe. Den Countdown KO-15 ergänzt P4.9.

type Search = Promise<Record<string, string | string[] | undefined>>

function toSearchParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out.set(k, v)
    else if (Array.isArray(v) && v[0] !== undefined) out.set(k, v[0])
  }
  return out
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
  searchParams: Search
}) {
  await connection()
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const [jar, search, t, tNotes, display] = await Promise.all([
    cookies(),
    searchParams,
    getTranslations({ locale, namespace: 'cart' }),
    getTranslations({ locale, namespace: 'cart.notes' }),
    getShopDisplaySettings(locale),
  ])
  const now = new Date()
  const cart = readCart(jar.get(CART_COOKIE)?.value)
  const evaluation = await evaluateCart(cart, now, {
    locale,
    checkoutToken: jar.get(CHECKOUT_COOKIE)?.value ?? null,
  })
  const notice = parseCartNotice(toSearchParams(search))
  const numbers = (list: readonly number[]) =>
    listFormat(
      locale,
      list.map((n) => formatItemNumber(n, locale)),
    )
  const noticeText = (n: CartNotice) =>
    tNotes(n.code, {
      items: numbers(n.itemNumbers),
      count: n.itemNumbers.length,
      max: n.max ?? evaluation.maxItemsPerCheckout,
    })
  const closedText = evaluation.closedMessage ?? tNotes('shop_closed')
  const noticeBlock = notice ? (
    <div role="status" data-cart-notice={notice.code}>
      <Callout variant="warn">
        <p>{noticeText(notice)}</p>
      </Callout>
    </div>
  ) : null

  if (evaluation.lines.length === 0) {
    return (
      <div className={`u-container ${styles.page}`} data-cart-page="" data-cart-empty="">
        <h1 className={styles.title}>{t('title')}</h1>
        {noticeBlock}
        <EmptyState
          pose="schnueffeln"
          title={t('empty.title')}
          text={t('empty.text')}
          action={{ href: localizedPath('R02', locale), label: t('empty.action') }}
        />
      </div>
    )
  }

  const media = await getCartMedia(
    evaluation.lines.flatMap((l) => (l.product?.imageId ? [l.product.imageId] : [])),
  )
  const city = display.pickupCity ?? 'Berlin'
  const totals = evaluation.totals
  const pickupOnly = evaluation.pickupOnly.length > 0
  const delivery = evaluation.delivery
  const highest = totals?.shippingClass ?? null
  const carrier = highest === 'brief' ? 'Deutsche Post' : 'DHL'
  const classLabel = highest ? ENUM_LABELS.SHIPPING_CLASSES[highest] : null
  const className = classLabel
    ? ((locale === 'en' ? classLabel.en : undefined) ?? classLabel.de)
    : null
  const blockerText = (b: CartBlocker) =>
    b === 'shop_closed' ? closedText : t(`blocked.${b}`, { max: evaluation.maxItemsPerCheckout })
  const deliveryAction = setDeliveryMethod as unknown as (formData: FormData) => Promise<void>
  const pickupOnlyHint = pickupOnly
    ? tNotes('pickup_only', {
        items: numbers(evaluation.pickupOnly),
        count: evaluation.pickupOnly.length,
      })
    : undefined

  return (
    <div className={`u-container ${styles.page}`} data-cart-page="">
      <h1 className={styles.title}>{t('title')}</h1>
      {noticeBlock}
      {!evaluation.shopOpen ? (
        <div data-shop-closed="">
          <Callout variant="info">
            <p>{closedText}</p>
          </Callout>
        </div>
      ) : null}

      <section aria-labelledby="cart-items">
        <h2 id="cart-items" className="u-sr-only">
          {t('itemsHeading')}
        </h2>
        <ul className={styles.lines} data-cart-lines="">
          {evaluation.lines.map((line) => (
            <CartLine
              key={line.id}
              line={line}
              locale={locale}
              media={(line.product?.imageId && media.get(line.product.imageId)) || null}
            />
          ))}
        </ul>
      </section>

      {totals || pickupOnly ? (
        <form action={deliveryAction} className={styles.delivery} data-cart-delivery="">
          <input type="hidden" name="locale" value={locale} />
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t('deliveryLegend')}</legend>
            <Radio
              id="cart-delivery-shipping"
              name="method"
              value="shipping"
              checked={delivery === 'shipping'}
              disabled={pickupOnly}
              hint={pickupOnlyHint}
              label={
                <span data-delivery-option="shipping">
                  {t('deliveryShipping', { carrier })}
                  {evaluation.shippingQuoteCents !== null ? (
                    <>
                      {' – '}
                      <MoneyAmount cents={evaluation.shippingQuoteCents} locale={locale} />
                    </>
                  ) : null}
                </span>
              }
            />
            <Radio
              id="cart-delivery-pickup"
              name="method"
              value="pickup"
              checked={delivery === 'pickup'}
              label={
                <span data-delivery-option="pickup">
                  {t('deliveryPickup', { city })}
                  {' – '}
                  <MoneyAmount cents={0} locale={locale} />
                </span>
              }
            />
          </fieldset>
          {!pickupOnly ? (
            <Button variant="secondary" type="submit">
              {t('deliveryApply')}
            </Button>
          ) : null}
          {className ? (
            <p className={styles.small} data-shipping-class-line={highest ?? ''}>
              {t('shippingClassLine', { shippingClass: className })}
            </p>
          ) : null}
        </form>
      ) : null}

      <section aria-labelledby="cart-summary" className={styles.summary} data-cart-summary="">
        <h2 id="cart-summary" className="u-sr-only">
          {t('summaryHeading')}
        </h2>
        <div className={styles.sums}>
          <dl className={styles.totals}>
            <div className={styles.row} data-cart-subtotal="">
              <dt>{t('subtotal')}</dt>
              <dd>
                <MoneyAmount cents={totals?.subtotalCents ?? 0} locale={locale} />
              </dd>
            </div>
            <div className={styles.row} data-cart-shipping="">
              <dt>{t('shipping')}</dt>
              <dd>
                {totals ? (
                  <MoneyAmount cents={totals.shippingCents} locale={locale} />
                ) : (
                  t('shippingUnknown')
                )}
              </dd>
            </div>
            <div className={`${styles.row} ${styles.total}`} data-cart-total="">
              <dt>{t('total')}</dt>
              <dd>
                <MoneyAmount cents={totals?.totalCents ?? 0} locale={locale} />
              </dd>
            </div>
          </dl>
          <div className={styles.coco} data-coco-slot="" data-coco-pose="sitzen" aria-hidden="true">
            <Coco pose="sitzen" size="m" />
          </div>
        </div>
        <PriceNote
          locale={locale}
          settings={taxSettingsFor(display.taxMode)}
          at={now}
          className={styles.small}
        />
        <DeliveryTime
          locale={locale}
          deliveryTime={display.deliveryTimeText}
          shippingClass={delivery === 'pickup' ? 'nur_abholung' : null}
          className={styles.small}
        />
        <div className={styles.info} data-cart-payment-info="">
          <p data-snippet="cart.paymentAndDeliveryInfo">
            {getSnippet('cart.paymentAndDeliveryInfo', locale).text}
          </p>
          <p className={styles.methods} data-payment-methods="">
            {t('paymentMethods')}
          </p>
        </div>
        <form action={startCheckoutAction} className={styles.checkout} data-cart-checkout="">
          <input type="hidden" name="locale" value={locale} />
          <Button
            variant="primary"
            type="submit"
            ariaDisabled={!evaluation.canCheckout}
            describedBy={evaluation.canCheckout ? undefined : 'cart-checkout-hint'}
          >
            {t('toCheckout')}
          </Button>
          {!evaluation.canCheckout ? (
            <div id="cart-checkout-hint" className={styles.hint} data-cart-checkout-hint="">
              {evaluation.blockers.map((b) => (
                <p key={b} data-blocker={b}>
                  {blockerText(b)}
                </p>
              ))}
            </div>
          ) : null}
        </form>
      </section>

      <WarrantyNotice locale={locale} />
    </div>
  )
}
