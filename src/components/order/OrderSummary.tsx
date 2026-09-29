import { getTranslations } from 'next-intl/server'
import React from 'react'

import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { PriceTag } from '@/components/shop/PriceTag'
import type { OrderView } from '@/lib/commerce/orderView'
import type { Locale } from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'

import styles from './Order.module.css'

// Positionen, Versand, Summe und Zahlart einer Bestellung (KONZEPT §4.12). Danke-Seite: Mini-Preisschilder (KO-05 `mini`)
// mit verborgenem Stempel für den Knall im Verkaufsmoment (MI-03, `thanks-moment` + `sold-stamp`). Statusseite: Foto,
// Titel, Nr., Preis. Nur Beträge aus dem Snapshot der Bestellung.
export async function OrderSummary({
  view,
  locale,
  variant,
  stamps = false,
}: {
  view: OrderView
  locale: Locale
  variant: 'tags' | 'rows'
  /** Stempel-Platz an den Mini-Schildern (nur „bezahlt“). */
  stamps?: boolean
}) {
  const t = await getTranslations({ locale, namespace: 'order' })
  const methodKey = (
    view.paymentMethod === 'prepayment'
      ? 'prepayment'
      : view.paymentMethodType &&
          ['apple_pay', 'google_pay', 'paypal'].includes(view.paymentMethodType)
        ? view.paymentMethodType
        : view.paymentMethod
  ) as 'card' | 'paypal' | 'apple_pay' | 'google_pay' | 'prepayment'
  const money = (cents: number) => <MoneyAmount cents={cents} locale={locale} />
  return (
    <section className={styles.summary} aria-labelledby="order-items-heading" data-order-summary="">
      <h2 id="order-items-heading" className={styles.h2}>
        {t('itemsHeading')}
      </h2>
      <ul
        className={variant === 'tags' ? styles.tagItems : styles.rowItems}
        data-behavior={variant === 'tags' && stamps ? 'sold-stamp' : undefined}
      >
        {view.items.map((item) => (
          <li
            key={item.id ?? item.itemNumber}
            className={styles.item}
            data-order-item={item.itemNumber}
            data-product-id={
              variant === 'tags' && stamps && item.productId ? item.productId : undefined
            }
          >
            {variant === 'tags' ? (
              <PriceTag
                itemNumber={item.itemNumber}
                priceCents={item.priceCents}
                locale={locale}
                variant="mini"
                stampSlot={stamps}
              />
            ) : item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Bild aus dem Snapshot (`coverImageUrl`), feste Größe
              <img
                className={styles.photo}
                src={item.imageUrl}
                alt=""
                width={64}
                height={80}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className={styles.photo} aria-hidden="true" />
            )}
            <span className={styles.itemText}>
              <span className={styles.itemTitle}>{item.title}</span>
              <span className={styles.itemNr}>{formatItemNumber(item.itemNumber, locale)}</span>
            </span>
            <span className={styles.itemPrice}>{money(item.priceCents)}</span>
          </li>
        ))}
      </ul>
      <dl className={styles.totals}>
        <dt>{view.fulfillmentMethod === 'pickup' ? t('pickup') : t('shipping')}</dt>
        <dd>{money(view.shippingCents)}</dd>
        <dt className={styles.totalLabel}>{t('total')}</dt>
        <dd className={styles.totalValue} data-order-total="">
          {money(view.totalCents)}
        </dd>
        <dt>{t('delivery')}</dt>
        <dd data-order-delivery={view.fulfillmentMethod}>
          {view.fulfillmentMethod === 'pickup' ? t('deliveryPickup') : t('deliveryShipping')}
        </dd>
        <dt>{t('paymentMethod')}</dt>
        <dd data-order-payment={methodKey}>{t(`method.${methodKey}`)}</dd>
      </dl>
      {view.unavailable.length > 0 ? (
        <div className={styles.unavailable} data-order-unavailable="">
          <h3 className={styles.h3}>{t('unavailableHeading')}</h3>
          <ul>
            {view.unavailable.map((u) => (
              <li key={u.itemNumber}>
                {t.rich('unavailableLine', {
                  item: formatItemNumber(u.itemNumber, locale),
                  amount: () => money(u.refundedCents),
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
