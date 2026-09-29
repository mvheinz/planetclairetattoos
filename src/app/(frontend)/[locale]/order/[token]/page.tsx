import { getTranslations, setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import React from 'react'

import { BankDetails } from '@/components/order/BankDetails'
import { ExampleNote } from '@/components/order/ExampleNote'
import styles from '@/components/order/Order.module.css'
import { OrderStatusLine } from '@/components/order/OrderStatusLine'
import { OrderSummary } from '@/components/order/OrderSummary'
import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { Button } from '@/components/ui/Button'
import { getContactInfo } from '@/lib/data/contact'
import { loadOrderStatusPage } from '@/lib/data/tokenPages'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { tokenPageMetadata } from '@/lib/seo/metadata'
import { formatBerlin } from '@/lib/time'

export const generateMetadata = tokenPageMetadata('R09')

// R09 Bestellstatus (KONZEPT §4.12, DESIGN KO-16, DATENMODELL §6.8.2, PLAN P4.23): Preset `calm`, keine Animation;
// Header `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store` setzt der
// Proxy (Kontext `dynamic`, Token-Seite). Rate-Limit `token_pages`. Suche über `statusTokenHash`, Vergleich in
// konstanter Zeit; unbekannt → 404. Personenbezogen nur Name, PLZ + Ort und die maskierte E-Mail – keine Straße.
// Dokumente nur AGB und Widerrufsbelehrung inkl. Muster-Formular in der Fassung der Bestellung, **keine** Rechnung und
// keine Gutschrift (R-067, C-24).
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  await connection()
  const { locale: raw, token } = await params
  const locale = raw as Locale
  setRequestLocale(locale)
  const result = await loadOrderStatusPage(token, locale, await headers(), new Date())
  const [t, o] = await Promise.all([
    getTranslations({ locale, namespace: 'orderStatus' }),
    getTranslations({ locale, namespace: 'order' }),
  ])
  if (result.kind === 'rate_limited') {
    return (
      <div className="u-container" data-order-status-page="" data-rate-limited="">
        <div className={styles.page}>
          <h1 className={styles.h1}>{t('title')}</h1>
          <p>{o('rateLimited')}</p>
        </div>
      </div>
    )
  }
  if (result.kind === 'not_found') notFound()
  const { view, documents } = result
  const contact = await getContactInfo()
  const date = (iso: string) =>
    formatBerlin(new Date(iso), locale === 'de' ? 'dd.MM.yyyy' : 'd MMMM yyyy', locale)
  const docHref = (file: string) =>
    `/api/orders/${encodeURIComponent(token)}/documents/${encodeURIComponent(file)}`
  const place = [view.customer.postalCode, view.customer.city].filter(Boolean).join(' ')

  return (
    <div className="u-container" data-order-status-page="" data-order-status={view.shownStatus}>
      <div className={styles.page}>
        {view.seed ? <ExampleNote locale={locale} /> : null}
        <header className={styles.block}>
          <h1 className={styles.h1}>{t('title')}</h1>
          <p data-order-number="">
            {o('orderNumber')}: <span className={styles.orderNumber}>{view.orderNumber}</span>
          </p>
          <p>{o('orderedAt', { date: date(view.placedAt) })}</p>
        </header>

        <section className={styles.panel} aria-labelledby="status-heading">
          <h2 id="status-heading" className={styles.h2}>
            {t('statusHeading')}
          </h2>
          <OrderStatusLine steps={view.steps} locale={locale} />
          {view.refundedCents > 0 ? (
            <p data-order-refunded="">
              {t.rich('refunded', {
                amount: () => <MoneyAmount cents={view.refundedCents} locale={locale} />,
              })}
            </p>
          ) : null}
        </section>

        {view.tracking ? (
          <section
            className={styles.block}
            aria-labelledby="tracking-heading"
            data-order-tracking=""
          >
            <h2 id="tracking-heading" className={styles.h2}>
              {t('trackingHeading')}
            </h2>
            <p>
              {t('trackingNumber')}:{' '}
              <span className={styles.mono} data-tracking-number="">
                {view.tracking.number}
              </span>
            </p>
            {view.tracking.url ? (
              <p>
                <a
                  href={view.tracking.url}
                  rel="noopener noreferrer external"
                  target="_blank"
                  data-tracking-link=""
                >
                  {t('trackingLink')}
                </a>
              </p>
            ) : null}
          </section>
        ) : null}

        <OrderSummary view={view} locale={locale} variant="rows" />

        {view.bank ? <BankDetails bank={view.bank} locale={locale} /> : null}

        <section className={styles.block} aria-labelledby="customer-heading" data-order-customer="">
          <h2 id="customer-heading" className={styles.h2}>
            {t('customerHeading')}
          </h2>
          <dl className={styles.dl}>
            {view.customer.name ? (
              <>
                <dt>{t('name')}</dt>
                <dd>{view.customer.name}</dd>
              </>
            ) : null}
            {place ? (
              <>
                <dt>{t('place')}</dt>
                <dd>{place}</dd>
              </>
            ) : null}
            {view.customer.email ? (
              <>
                <dt>{t('email')}</dt>
                <dd data-masked-email="">{view.customer.email}</dd>
              </>
            ) : null}
          </dl>
        </section>

        <section
          className={styles.block}
          aria-labelledby="documents-heading"
          data-order-documents=""
        >
          <h2 id="documents-heading" className={styles.h2}>
            {t('documentsHeading')}
          </h2>
          <ul>
            {documents.map((d) => (
              <li key={d.kind}>
                <a href={docHref(d.file)} data-order-document={d.kind} type="application/pdf">
                  {t(d.kind === 'agb' ? 'docAgb' : 'docWithdrawal', { version: d.version })}
                </a>
              </li>
            ))}
          </ul>
          <p>{t('invoiceHint')}</p>
        </section>

        <section className={styles.block} aria-labelledby="withdraw-heading">
          <h2 id="withdraw-heading" className="u-sr-only">
            {WITHDRAWAL_LINK_LABEL[locale]}
          </h2>
          <p>{t('withdrawText')}</p>
          <div className={styles.actions}>
            <Button
              href={`${localizedPath('R26', locale)}?order=${encodeURIComponent(view.orderNumber)}`}
              variant="secondary"
            >
              {WITHDRAWAL_LINK_LABEL[locale]}
            </Button>
          </div>
        </section>

        <section className={styles.block} aria-labelledby="contact-heading">
          <h2 id="contact-heading" className={styles.h2}>
            {t('contactHeading')}
          </h2>
          {contact.email ? (
            <p>
              {t('contactText')} <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </p>
          ) : (
            <p>
              <a href={localizedPath('R20', locale)}>{t('contactFallback')}</a>
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
