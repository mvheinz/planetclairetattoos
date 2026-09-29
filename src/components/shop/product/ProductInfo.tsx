import { getTranslations } from 'next-intl/server'
import React from 'react'

import { ProductCard, EAGER_CARDS } from '@/components/shop/ProductCard'
import type { ProductTextField, PublicProduct } from '@/lib/data/products'
import type { ProductInfoSettings } from '@/lib/data/shopSettings'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { localizedPath } from '@/lib/routes/paths'
import { formatItemNumber } from '@/lib/shop/format'
import {
  paragraphs,
  productDetailRows,
  shippingPriceText,
  type BusinessInfo,
} from '@/lib/shop/productInfo'

import styles from './ProductPage.module.css'

// Produktseite R04, Blöcke 7–11 (KONZEPT §3.4), alle ohne Interaktion sichtbar (kein `<details>`, keine Tabs):
// 7 Beschreibung (+ „Jutta sagt“), 8 Details-Tabelle (DESIGN KO-09b), 9 „Herstellerin & Sicherheit“ (GPSR, R-040 – die
// Privatadresse steht öffentlich nur hier, V-31), 10 „Versand & Rückgabe kurz“ (R-031; Widerrufshinweis ohne Werbung mit
// Selbstverständlichkeiten, V-19; Rücksendekosten per Baustein `withdrawal.returnCostsNote`, E-27), 11 „Mehr aus …“.

type LangOf = (field: ProductTextField) => 'de' | undefined

function Paragraphs({
  text,
  lang,
  name,
}: {
  text: string | null | undefined
  lang?: string
  name?: string
}) {
  return (
    <>
      {paragraphs(text).map((p, i) => (
        <p key={i} lang={lang} data-paragraph={name}>
          {p}
        </p>
      ))}
    </>
  )
}

export async function ProductDescription({
  product,
  locale,
  langOf,
}: {
  product: PublicProduct
  locale: Locale
  langOf: LangOf
}) {
  if (!paragraphs(product.description).length && !paragraphs(product.juttaSays).length) return null
  const t = await getTranslations({ locale, namespace: 'shop.product' })
  return (
    <section
      className={styles.block}
      aria-labelledby="product-description"
      data-product-description=""
    >
      <h2 id="product-description" className={styles.blockTitle}>
        {t('descriptionHeading')}
      </h2>
      <div className={styles.prose}>
        <Paragraphs text={product.description} lang={langOf('description')} />
      </div>
      {paragraphs(product.juttaSays).length ? (
        <figure className={styles.jutta} data-jutta-says="">
          <figcaption className={styles.juttaLabel}>{t('juttaSays')}</figcaption>
          <blockquote className={styles.juttaQuote}>
            <Paragraphs text={product.juttaSays} lang={langOf('juttaSays')} />
          </blockquote>
        </figure>
      ) : null}
    </section>
  )
}

export async function ProductDetails({
  product,
  locale,
  langOf,
}: {
  product: PublicProduct
  locale: Locale
  langOf: LangOf
}) {
  const rows = productDetailRows(product, locale)
  if (rows.length === 0) return null
  const t = await getTranslations({ locale, namespace: 'shop.product' })
  return (
    <section className={styles.block} aria-labelledby="product-details" data-product-details="">
      <h2 id="product-details" className={styles.blockTitle}>
        {t('detailsHeading')}
      </h2>
      <dl className={styles.details}>
        {rows.map((row) => (
          <div key={row.key} className={styles.detailRow} data-detail={row.key}>
            <dt>{t(`details.${row.key}`)}</dt>
            <dd
              lang={row.field ? langOf(row.field) : undefined}
              className={row.key === 'weight' || row.key === 'dimensions' ? styles.num : undefined}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function address(b: BusinessInfo, missing: string): string[] {
  const cityLine = [b.postalCode, b.city].filter(Boolean).join(' ')
  return [b.street ?? missing, cityLine || missing, ...(b.country ? [b.country] : [])]
}

export async function ProductSafetyBlock({
  product,
  locale,
  business,
  categoryName,
  warnings,
}: {
  product: PublicProduct
  locale: Locale
  business: BusinessInfo
  categoryName: string
  /** Warnhinweise: Deutsch immer, auf `/en` zusätzlich Englisch (R-040). */
  warnings: { de: string[]; en: string[] }
}) {
  const t = await getTranslations({ locale, namespace: 'shop.product.safety' })
  const missing = t('missing')
  const secondLanguage = warnings.en.length > 0
  return (
    <section className={styles.block} aria-labelledby="product-safety" data-product-safety="">
      <h2 id="product-safety" className={styles.blockTitle}>
        {t('heading')}
      </h2>
      <dl className={styles.details}>
        <div className={styles.detailRow} data-safety="maker">
          <dt>{t('maker')}</dt>
          <dd>
            {business.legalName ?? missing}
            {business.tradeName ? (
              <>
                <br />
                {business.tradeName}
              </>
            ) : null}
          </dd>
        </div>
        <div className={styles.detailRow} data-safety="address">
          <dt>{t('address')}</dt>
          <dd>
            {address(business, missing).map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 ? <br /> : null}
                {line}
              </React.Fragment>
            ))}
          </dd>
        </div>
        <div className={styles.detailRow} data-safety="email">
          <dt>{t('email')}</dt>
          <dd>
            {business.email ? <a href={`mailto:${business.email}`}>{business.email}</a> : missing}
          </dd>
        </div>
        <div className={styles.detailRow} data-safety="type">
          <dt>{t('productType')}</dt>
          <dd>{categoryName}</dd>
        </div>
        <div className={styles.detailRow} data-safety="id">
          <dt>{t('productId')}</dt>
          <dd className={styles.num}>{formatItemNumber(product.itemNumber, locale)}</dd>
        </div>
        <div className={styles.detailRow} data-safety="warnings">
          <dt>{t('warnings')}</dt>
          <dd>
            {secondLanguage ? (
              <div data-warnings-lang="en">
                {warnings.en.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : null}
            <div lang={locale === 'de' ? undefined : 'de'} data-warnings-lang="de">
              {secondLanguage ? <p className={styles.warningsDe}>{t('warningsDe')}</p> : null}
              {warnings.de.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </dd>
        </div>
      </dl>
    </section>
  )
}

export async function ProductShipping({
  product,
  locale,
  settings,
  pickupEnabled,
  pickupCity,
}: {
  product: PublicProduct
  locale: Locale
  settings: ProductInfoSettings
  pickupEnabled: boolean
  pickupCity: string
}) {
  const t = await getTranslations({ locale, namespace: 'shop.product.shipping' })
  const cls = product.shippingClass
  const price = shippingPriceText(settings.shippingRates, cls, locale)
  const label = ENUM_LABELS.SHIPPING_CLASSES[cls]
  const className = (locale === 'en' ? label.en : undefined) ?? label.de
  const r25 = localizedPath('R25', locale)
  const link = (href: string) =>
    function RichLink(chunks: React.ReactNode) {
      return <a href={href}>{chunks}</a>
    }
  return (
    <section className={styles.block} aria-labelledby="product-shipping" data-product-shipping="">
      <h2 id="product-shipping" className={styles.blockTitle}>
        {t('heading')}
      </h2>
      <div className={styles.prose}>
        {cls === 'nur_abholung' ? (
          <p data-shipping-class="nur_abholung">{t('pickupOnly', { city: pickupCity })}</p>
        ) : price ? (
          <p data-shipping-class={cls}>{t('parcel', { shippingClass: className, price })}</p>
        ) : (
          <p data-shipping-class={cls}>{t.rich('noRate', { link: link(r25) })}</p>
        )}
        {cls !== 'nur_abholung' && pickupEnabled ? (
          <p data-pickup="">{t('pickup', { city: pickupCity })}</p>
        ) : null}
        <p data-withdrawal-note="">
          {t.rich('withdrawal', { link: link(localizedPath('R24', locale)) })}{' '}
          {getSnippet('withdrawal.returnCostsNote', locale).text}{' '}
          <a href={r25} data-shipping-link="">
            {t('costsLink')}
          </a>
        </p>
      </div>
    </section>
  )
}

export async function MoreFromCategory({
  products,
  locale,
  categoryName,
  categoryHref,
}: {
  products: PublicProduct[]
  locale: Locale
  categoryName: string
  categoryHref: string
}) {
  if (products.length === 0) return null
  const t = await getTranslations({ locale, namespace: 'shop.product' })
  return (
    <section className={styles.block} aria-labelledby="product-more" data-product-more="">
      <h2 id="product-more" className={styles.blockTitle}>
        <a href={categoryHref}>{t('more', { category: categoryName })}</a>
      </h2>
      <ul className={styles.moreGrid} data-behavior="price-tag-swing">
        {products.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} locale={locale} index={EAGER_CARDS} />
          </li>
        ))}
      </ul>
    </section>
  )
}
