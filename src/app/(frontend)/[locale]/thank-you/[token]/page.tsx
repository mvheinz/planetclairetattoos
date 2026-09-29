import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import React from 'react'

import { Coco } from '@/components/Coco'
import { BankDetails } from '@/components/order/BankDetails'
import { ExampleNote } from '@/components/order/ExampleNote'
import styles from '@/components/order/Order.module.css'
import { OrderSummary } from '@/components/order/OrderSummary'
import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { PriceFootnote } from '@/components/shop/PriceFootnote'
import { Button } from '@/components/ui/Button'
import { CART_COOKIE } from '@/lib/commerce/cartCookie'
import { CHECKOUT_COOKIE } from '@/lib/commerce/checkout'
import { statusTokenOf, type OrderView } from '@/lib/commerce/orderView'
import type { ThanksState } from '@/lib/commerce/thanksState'
import { loadThanksPage } from '@/lib/data/tokenPages'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { tokenPageMetadata } from '@/lib/seo/metadata'
import { taxSettingsFor } from '@/lib/shop/displaySettings'
import { formatBerlin } from '@/lib/time'

import { ClearOrderCookies } from './ClearOrderCookies'

export const generateMetadata = tokenPageMetadata('R08')

// R08 Danke-Seite (KONZEPT §4.12, DESIGN KO-19, PLAN P4.17): dynamisch, `noindex`; Header `Referrer-Policy: no-referrer`,
// `Cache-Control: private, no-store` und `X-Robots-Tag` setzt der Proxy (Kontext `dynamic`, Token-Seite). Rate-Limit
// `token_pages`. Token zuerst gegen die Kasse, dann gegen den Status-Token der Bestellung (`getThanksState`, dieselbe
// Funktion wie `GET /api/checkout/[token]/state`); unbekannt → 404. Zustände: wartet, bezahlt, Vorkasse, leider schon
// weg, nicht bezahlt. Mit Bestellung werden `pc_cart` und `pc_checkout` gelöscht (`ClearOrderCookies`).
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  await connection()
  const { locale: raw, token } = await params
  const locale = raw as Locale
  setRequestLocale(locale)
  const [requestHeaders, jar] = await Promise.all([headers(), cookies()])
  const result = await loadThanksPage(token, locale, requestHeaders, new Date())
  const t = await getTranslations({ locale, namespace: 'thanks' })
  if (result.kind === 'rate_limited') {
    const o = await getTranslations({ locale, namespace: 'order' })
    return (
      <div className="u-container" data-thanks-page="" data-thanks-state="rate_limited">
        <div className={styles.page}>
          <h1 className={styles.h1}>{t('waitingTitle')}</h1>
          <p>{o('rateLimited')}</p>
        </div>
      </div>
    )
  }
  if (result.kind === 'not_found') notFound()
  const { state, view } = result
  const orderState = 'order' in state ? state : null
  const seed = view ? view.seed : state.checkout?.seed === true
  const clearCookies = view !== null && (jar.has(CART_COOKIE) || jar.has(CHECKOUT_COOKIE))

  return (
    <div
      className="u-container"
      data-thanks-page=""
      data-thanks-state={state.code}
      data-behavior={state.code === 'paid' ? 'thanks-moment' : undefined}
    >
      <div className={styles.page}>
        {seed ? <ExampleNote locale={locale} /> : null}
        {orderState && view ? (
          <OrderStates state={orderState} view={view} token={token} locale={locale} />
        ) : state.code === 'waiting' || state.code === 'unpaid' ? (
          <CheckoutStates state={state} token={token} locale={locale} />
        ) : null}
      </div>
      {clearCookies ? <ClearOrderCookies token={token} /> : null}
    </div>
  )
}

function CocoSpot({
  pose,
  heart,
  animated = false,
}: {
  pose: 'sitzen' | 'kopfschief'
  heart: boolean
  animated?: boolean
}) {
  return (
    <div className={styles.cocoSpot} data-thanks-coco-spot="">
      <Coco
        pose={pose}
        size="xxl"
        data={animated ? { 'data-thanks-coco': '' } : { 'data-thanks-coco-static': '' }}
      />
      <span
        className={styles.heartAnchor}
        data-leash-anchor="end"
        data-leash-loop={heart ? 'heart' : 'none'}
        aria-hidden="true"
      />
    </div>
  )
}

async function CheckoutStates({
  state,
  token,
  locale,
}: {
  state: Extract<ThanksState, { code: 'waiting' | 'unpaid' }>
  token: string
  locale: Locale
}) {
  const t = await getTranslations({ locale, namespace: 'thanks' })
  if (state.code === 'waiting') {
    return (
      <section className={styles.hero}>
        <div className={styles.block}>
          <h1 className={styles.h1}>{t('waitingTitle')}</h1>
          <div
            data-behavior="thanks-poll"
            data-state="waiting"
            data-state-url={`/api/checkout/${token}/state`}
            className={styles.block}
          >
            <p className={styles.lede} data-thanks-waiting="">
              {t('waitingText')}
            </p>
            <div aria-live="polite">
              <p data-thanks-long="" hidden>
                {t('waitingLong')}
              </p>
            </div>
            <p>
              <a href={localizedPath('R08', locale, { token })} data-thanks-reload="">
                {t('reload')}
              </a>
            </p>
          </div>
        </div>
        <CocoSpot pose="sitzen" heart={false} />
      </section>
    )
  }
  return (
    <section className={styles.hero}>
      <div className={styles.block}>
        <h1 className={styles.h1}>{t('unpaidTitle')}</h1>
        <p className={styles.lede}>{t('unpaidText')}</p>
        <p>{state.backToCheckout ? t('unpaidRetry') : t('unpaidCart')}</p>
        <div className={styles.actions}>
          {state.backToCheckout ? (
            <Button href={localizedPath('R07', locale)}>{t('backToCheckout')}</Button>
          ) : (
            <Button href={localizedPath('R06', locale)}>{t('toCart')}</Button>
          )}
        </div>
      </div>
      <CocoSpot pose="kopfschief" heart={false} />
    </section>
  )
}

async function OrderStates({
  state,
  view,
  token,
  locale,
}: {
  state: Extract<ThanksState, { code: 'paid' | 'prepayment' | 'gone' }>
  view: OrderView
  token: string
  locale: Locale
}) {
  const t = await getTranslations({ locale, namespace: 'thanks' })
  const o = await getTranslations({ locale, namespace: 'order' })
  const orderNumber = (
    <p data-thanks-order-number="">
      {o('orderNumber')}: <span className={styles.orderNumber}>{view.orderNumber}</span>
    </p>
  )

  if (state.code === 'gone') {
    const many = state.order.items.length > 1
    return (
      <section className={styles.hero}>
        <div className={styles.block}>
          <h1 className={styles.h1}>{t('goneTitle')}</h1>
          <p className={styles.lede}>{many ? t('goneIntroMany') : t('goneIntroOne')}</p>
          <p>
            {t.rich('goneRefund', {
              amount: () => <MoneyAmount cents={view.totalCents} locale={locale} />,
            })}
          </p>
          {orderNumber}
          <p>{t('goneMail')}</p>
          <div className={styles.actions}>
            <Button href={localizedPath('R02', locale)}>{t('toShop')}</Button>
          </div>
        </div>
        <CocoSpot pose="kopfschief" heart={false} />
      </section>
    )
  }

  // Link zum Bestellstatus R09: mit dem Status-Token (bei Aufruf über den Status-Token ist es derselbe).
  const statusToken = state.via === 'order' ? token : statusTokenOf(state.order)
  const prepayment = state.code === 'prepayment'
  const due = view.bank?.dueAt ?? state.order.prepayment?.dueAt ?? null
  const dueText = due
    ? formatBerlin(new Date(due), locale === 'de' ? 'dd.MM.yyyy' : 'd MMMM yyyy', locale)
    : ''
  const next = prepayment
    ? t('nextPrepayment', { date: dueText })
    : view.shownStatus !== 'paid'
      ? t('nextOther')
      : view.fulfillmentMethod === 'pickup'
        ? t('nextPickup')
        : t('nextShipping')
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.block}>
          <h1 className={styles.h1}>{t('paidTitle')}</h1>
          <p className={styles.lede}>{prepayment ? t('prepaymentReceived') : t('received')}</p>
          {orderNumber}
        </div>
        <CocoSpot pose="sitzen" heart animated={state.code === 'paid'} />
      </section>
      <OrderSummary view={view} locale={locale} variant="tags" stamps={state.code === 'paid'} />
      {prepayment && view.bank ? <BankDetails bank={view.bank} locale={locale} /> : null}
      <section className={styles.block} aria-labelledby="next-heading" data-thanks-next="">
        <h2 id="next-heading" className={styles.h2}>
          {t('nextHeading')}
        </h2>
        <p>{next}</p>
        <p>{t('mailHint')}</p>
        <div className={styles.actions}>
          {statusToken ? (
            <Button href={localizedPath('R09', locale, { token: statusToken })} variant="secondary">
              {t('statusLink')}
            </Button>
          ) : null}
          <Button
            href={`${localizedPath('R26', locale)}?order=${encodeURIComponent(view.orderNumber)}`}
            variant="secondary"
          >
            {WITHDRAWAL_LINK_LABEL[locale]}
          </Button>
        </div>
      </section>
      <PriceFootnote
        locale={locale}
        settings={taxSettingsFor(view.taxMode)}
        at={new Date(view.placedAt)}
      />
    </>
  )
}
