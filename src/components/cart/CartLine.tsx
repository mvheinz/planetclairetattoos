import { getTranslations } from 'next-intl/server'
import React from 'react'

import { removeFromCart } from '@/app/(frontend)/[locale]/cart/actions'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { MoneyAmount } from '@/components/shop/MoneyAmount'
import type { CartLine as CartLineData } from '@/lib/commerce/evaluateCart'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale, ProductCategory } from '@/lib/enums'
import { formatItemNumber, productPath } from '@/lib/shop/format'
import type { Media } from '@/payload-types'

import styles from './CartLine.module.css'

// Korbzeile (DESIGN KO-13): Foto 64×80 (4:5), Titel als Link, `Nr. 017 · Keramik` (Mono, `--ink-2`), Preis rechts
// (`MoneyAmount`), Text-Knopf „Entfernen“ (POST-Formular, ohne JavaScript 303 zurück auf den Korb). Nicht kaufbar →
// Zeile gedämpft, Hinweis als Text („Gerade reserviert …“ bzw. Stempel-Text „sold“ in `--fox` ≥ 24 px + „Leider schon
// verkauft“), aus der Summe ausgeschlossen. „Preis wurde aktualisiert“, wenn der DB-Preis vom Preis beim Hinzufügen
// abweicht (angezeigt wird immer der DB-Preis).

const removeAction = removeFromCart as unknown as (formData: FormData) => Promise<void>

export async function CartLine({
  line,
  locale,
  media,
}: {
  line: CartLineData
  locale: Locale
  media: Media | null
}) {
  const t = await getTranslations({ locale, namespace: 'cart' })
  const product = line.product
  const number = line.itemNumber !== null ? formatItemNumber(line.itemNumber, locale) : null
  const category = product?.category
    ? ENUM_LABELS.PRODUCT_CATEGORIES[product.category as ProductCategory]
    : null
  const categoryName = category
    ? ((locale === 'en' ? category.en : undefined) ?? category.de)
    : null
  const title =
    product?.title?.trim() ||
    (number ? t('unknownTitle', { number }) : t('unknownTitle', { number: '' }))
  const href =
    product && product.slug && line.itemNumber !== null
      ? productPath({ itemNumber: line.itemNumber, slug: product.slug }, locale)
      : null
  const stateNote =
    line.state === 'reserved' || line.state === 'sold' || line.state === 'reserved_by_you'
      ? t(`state.${line.state}`)
      : null

  return (
    <li
      className={line.purchasable ? styles.line : `${styles.line} ${styles.muted}`}
      data-cart-line={line.id}
      data-state={line.state}
      data-purchasable={line.purchasable ? 'true' : 'false'}
    >
      <div className={styles.photo}>
        <ResponsiveImage
          media={media}
          aspectRatio="4 / 5"
          sizes="64px"
          srcSizes={['thumb']}
          frameSize="thumb"
        />
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{href ? <a href={href}>{title}</a> : <span>{title}</span>}</p>
        {number ? (
          <p className={styles.meta} data-cart-line-meta="">
            {categoryName ? t('meta', { number, category: categoryName }) : number}
          </p>
        ) : null}
        {line.state === 'sold' ? (
          <p className={styles.soldRow}>
            <span className={styles.stamp} aria-hidden="true">
              {t('soldStamp')}
            </span>
            <span className={styles.note} data-cart-line-note="sold">
              {stateNote}
            </span>
          </p>
        ) : stateNote ? (
          <p className={styles.note} data-cart-line-note={line.state}>
            {stateNote}
          </p>
        ) : null}
        {line.priceChanged && line.purchasable ? (
          <p className={styles.note} data-cart-line-note="price-changed">
            {t('state.priceChanged')}
          </p>
        ) : null}
        <form action={removeAction} className={styles.remove}>
          <input type="hidden" name="productId" value={line.id} />
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className={styles.removeButton}
            aria-label={t('removeLabel', { title })}
            data-cart-remove={line.id}
          >
            {t('remove')}
          </button>
        </form>
      </div>
      <div className={styles.price} data-cart-line-price="">
        {line.priceCents !== null ? <MoneyAmount cents={line.priceCents} locale={locale} /> : null}
      </div>
    </li>
  )
}
