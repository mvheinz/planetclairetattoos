import { getTranslations } from 'next-intl/server'
import React from 'react'

import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { deliveryTimeText } from '@/components/shop/DeliveryTime'
import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { PriceNote } from '@/components/shop/PriceNote'
import { taxSettingsFor } from '@/lib/data/shopSettings'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale, ProductCategory, ShippingClass } from '@/lib/enums'
import { formatItemNumber } from '@/lib/shop/format'
import type { ShopDisplaySettings } from '@/lib/shop/displaySettings'
import type { Checkout, Media } from '@/payload-types'

import styles from './Checkout.module.css'

// Übersicht der Kasse, fester Teil (KONZEPT §4.5 Nr. 1–4, R-063; DESIGN KO-14): Positionen aus dem Kassen-Snapshot
// (Foto 48×60, Titel, Nr., wesentliche Eigenschaften `characteristicsDe/En`, Preis), Versand (Klasse + Preis bzw.
// „Abholung in Berlin 0,00 €“), Gesamtpreis mit `PriceNote`, Lieferzeit. Adressen, E-Mail und Zahlart ergänzt die
// Kassen-Komponente live aus den Eingaben.

const label = (value: { de: string; en?: string } | undefined, locale: Locale) =>
  value ? ((locale === 'en' ? value.en : undefined) ?? value.de) : ''

const idOf = (v: unknown): number =>
  typeof v === 'object' && v !== null ? (v as { id: number }).id : (v as number)

export async function CheckoutSummaryItems({
  checkout,
  locale,
  media,
  imageOf,
}: {
  checkout: Checkout
  locale: Locale
  media: Map<number, Media>
  imageOf: Map<number, number>
}) {
  return (
    <ul className={styles.items} data-overview-items="">
      {checkout.items.map((item) => {
        const productId = idOf(item.product)
        const imageId = imageOf.get(productId)
        const title = (locale === 'en' ? item.titleEn : undefined) ?? item.titleDe
        const category = label(
          ENUM_LABELS.PRODUCT_CATEGORIES[item.category as ProductCategory],
          locale,
        )
        const characteristics =
          (locale === 'en' ? item.characteristicsEn : item.characteristicsDe) ??
          item.characteristicsDe
        return (
          <li key={productId} className={styles.item} data-overview-item={item.itemNumber}>
            <div className={styles.itemPhoto}>
              <ResponsiveImage
                media={(imageId && media.get(imageId)) || null}
                aspectRatio="4 / 5"
                sizes="48px"
                srcSizes={['thumb']}
              />
            </div>
            <div className={styles.itemBody}>
              <p className={styles.itemTitle}>{title}</p>
              <p className={styles.itemMeta} data-overview-item-number="">
                {formatItemNumber(item.itemNumber, locale)}
                {category ? ` · ${category}` : ''}
              </p>
              {characteristics ? (
                <p className={styles.itemFacts} data-overview-characteristics="">
                  {characteristics}
                </p>
              ) : null}
            </div>
            <p className={styles.itemPrice} data-overview-price="">
              <MoneyAmount cents={item.priceCents} locale={locale} />
            </p>
          </li>
        )
      })}
    </ul>
  )
}

export async function CheckoutSummaryTotals({
  checkout,
  locale,
  display,
  now,
}: {
  checkout: Checkout
  locale: Locale
  display: ShopDisplaySettings
  now: Date
}) {
  const t = await getTranslations({ locale, namespace: 'checkout.overview' })
  const city = display.pickupCity ?? 'Berlin'
  const pickup = checkout.fulfillmentMethod === 'pickup'
  const shippingClass = checkout.shippingClass as ShippingClass | null | undefined
  const carrier = shippingClass === 'brief' ? 'Deutsche Post' : 'DHL'
  const className = shippingClass ? label(ENUM_LABELS.SHIPPING_CLASSES[shippingClass], locale) : ''
  return (
    <div className={styles.totals} data-overview-totals="">
      <dl className={styles.sumList}>
        <div className={styles.sumRow} data-overview-shipping={checkout.fulfillmentMethod}>
          <dt>
            {pickup
              ? t('pickupLine', { city })
              : t('shippingLine', { shippingClass: className, carrier })}
          </dt>
          <dd>
            <MoneyAmount cents={checkout.shippingCents} locale={locale} />
          </dd>
        </div>
        <div className={`${styles.sumRow} ${styles.sumTotal}`} data-overview-total="">
          <dt>{t('total')}</dt>
          <dd>
            <MoneyAmount cents={checkout.totalCents} locale={locale} />
          </dd>
        </div>
      </dl>
      <PriceNote
        locale={locale}
        settings={taxSettingsFor(display.taxMode)}
        at={now}
        className={styles.small}
      />
      <div className={styles.sumRow} data-overview-delivery-time="">
        <span className={styles.sumLabel}>{t('deliveryTime')}</span>
        <span className={styles.small}>
          {deliveryTimeText(locale, display.deliveryTimeText, pickup ? 'nur_abholung' : null)}
        </span>
      </div>
    </div>
  )
}
