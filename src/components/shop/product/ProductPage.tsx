import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Station } from '@/components/leash/Station'
import { Badge } from '@/components/shop/Badge'
// Alias: der Streichpreis-Scan (V-20) prüft den Quelltext auf das HTML-Tag für Streichungen.
import { DeliveryTime as LeadTime } from '@/components/shop/DeliveryTime'
import { PriceFootnote } from '@/components/shop/PriceFootnote'
import { PriceTag } from '@/components/shop/PriceTag'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { listAllCategories } from '@/lib/data/categories'
import {
  getUntranslatedFields,
  type ProductTextField,
  type PublicProduct,
} from '@/lib/data/products'
import { getShopDisplaySettings, taxSettingsFor } from '@/lib/data/shopSettings'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import type { FiberRow } from '@/lib/products/fibers'
import { localizedPath } from '@/lib/routes/paths'
import { buyState, canAddToCart, foodContactDisplay } from '@/lib/shop/productState'
import {
  formatCondition,
  formatDimensions,
  formatFibers,
  formatItemNumber,
} from '@/lib/shop/format'

import styles from './ProductPage.module.css'

// Produktseite R04, Blöcke 2–6 (KONZEPT §3.4) in verbindlicher DOM-Reihenfolge – Pflichtangaben stehen vor dem
// Kaufknopf und nie hinter einem Klick (AK-3-05, AK-3-07): H1 → Kurzdaten (`Nr. 017` · „Unikat“ · Kategorie · Maße) →
// Preisschild `pinned` mit Steuer-/Versandhinweis und Lieferzeit (R-030, R-031, R-035) → Pflichtangaben je Kategorie
// (R-043 bis R-046, Bausteine `product.*`) → Abweichungs-Kasten (R-048 Nr. 1) → Kaufbereich je Zustand samt Satz zum
// Liefergebiet (R-036). Fehlt ein EN-Text, steht der DE-Text mit `lang="de"`. Tuschelinie `product` (DESIGN §9.7):
// Start unter der H1 (Unterstreichung), Haken (`hook`) am Knopf „In den Korb“; daneben die reservierte Coco-Box
// 48 × 40 am Preisschild (Coco-Hüpfer MI-01 folgt in P9). „In den Korb“ bekommt seine Aktion in P3.11.

function Row({
  label,
  children,
  lang,
  name,
}: {
  label: string
  children: React.ReactNode
  lang?: string
  name: string
}) {
  return (
    <div className={styles.row} data-legal-row={name}>
      <dt>{label}</dt>
      <dd lang={lang}>{children}</dd>
    </div>
  )
}

function Note({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <p className={styles.note} data-legal-note={name}>
      {children}
    </p>
  )
}

export async function ProductPage({ product, locale }: { product: PublicProduct; locale: Locale }) {
  const [t, tBadges, tList, settings, categories, untranslated] = await Promise.all([
    getTranslations({ locale, namespace: 'shop.product' }),
    getTranslations({ locale, namespace: 'shop.badges' }),
    getTranslations({ locale, namespace: 'shop.list' }),
    getShopDisplaySettings(locale),
    listAllCategories(locale),
    getUntranslatedFields(product.itemNumber, locale),
  ])
  const de = (field: ProductTextField) =>
    locale !== 'de' && untranslated.includes(field) ? 'de' : undefined

  const state = buyState(product.status)
  const category = categories.find((c) => c.key === product.category)
  const label = ENUM_LABELS.PRODUCT_CATEGORIES[product.category]
  const categoryName = category?.name || ((locale === 'en' ? label.en : undefined) ?? label.de)
  const dims = formatDimensions(product.dimensions, locale)
  const dimsLang = product.dimensions?.note ? de('dimensionsNote') : undefined
  const now = new Date()
  const closed = !settings.isOpen && state !== 'sold'
  const textile = product.category === 'textil' || product.category === 'cap'
  // Ohne aktive Erklärung nie „lebensmittelecht“ – dann gilt die Deko-Kennzeichnung (konservativ, E-15).
  const food = foodContactDisplay(product)
  const condition = formatCondition(product.condition, locale)
  const conditionFull = formatCondition(product.condition, locale, product.conditionNote)
  const fibers = formatFibers(product.fiberComposition as FiberRow[] | null | undefined, locale)
  const similarHref = category
    ? localizedPath('R03', locale, { slug: category.slug })
    : localizedPath('R02', locale)

  return (
    <article
      className={`u-container ${styles.page}`}
      data-product-page=""
      data-item-number={product.itemNumber}
      data-status={state}
      data-category={product.category}
    >
      {/* 2. Titel */}
      <header className={styles.head}>
        <h1 className={styles.title} lang={de('title')} data-product-title="">
          {product.title}
        </h1>
        <div className={styles.titleLine} aria-hidden="true">
          <span className={styles.lineStart} data-leash-anchor="start" />
          <Station id="title" as="span" className={styles.lineEnd} />
        </div>
      </header>

      {/* 3. Kurzdaten */}
      <ul className={styles.facts} aria-label={t('factsLabel')} data-product-facts="">
        <li className={styles.nr}>{formatItemNumber(product.itemNumber, locale)}</li>
        <li>
          <Badge kind="unique" />
        </li>
        <li>{categoryName}</li>
        {dims ? (
          <li className={styles.dims} lang={dimsLang}>
            {dims}
          </li>
        ) : null}
      </ul>

      {/* 4. Preisschild mit Steuer-/Versandhinweis und Lieferzeit */}
      <div className={styles.price} data-product-price="">
        <div className={styles.tagRow}>
          <PriceTag
            itemNumber={product.itemNumber}
            priceCents={product.priceCents}
            locale={locale}
            variant="pinned"
            sold={state === 'sold'}
          />
          <span className={styles.cocoSlot} data-product-coco="" aria-hidden="true" />
        </div>
        <PriceFootnote
          locale={locale}
          settings={taxSettingsFor(settings.taxMode)}
          at={now}
          vatCategory={product.vatCategory}
        />
        <LeadTime
          locale={locale}
          deliveryTime={settings.deliveryTimeText}
          shippingClass={product.shippingClass}
          className={styles.delivery}
        />
      </div>

      {/* 5. Pflichtangaben je Kategorie */}
      <section className={styles.legal} aria-label={t('detailsLabel')} data-product-legal="">
        {food ? (
          food.kind === 'foodSafe' ? (
            <>
              <Badge
                kind="foodSafe"
                href={`${localizedPath('R27', locale)}#glaze-${food.declaration.id}`}
              />
              <Note name="ceramicsFoodSafe">
                {getSnippet('product.ceramicsFoodSafe', locale).text}
              </Note>
            </>
          ) : (
            <>
              <Badge kind="decorative" />
              <Note name="ceramicsDecorative">
                {getSnippet('product.ceramicsDecorative', locale).text}
              </Note>
            </>
          )
        ) : null}

        {textile ? (
          <>
            <dl className={styles.rows}>
              <Row name="fibers" label={t('fibers')}>
                {fibers}
                {product.labelMissing && product.fiberFreeText ? (
                  <span className={styles.labelMissing} data-label-missing="">
                    {' '}
                    <span lang={de('fiberFreeText')}>
                      {t('labelMissing', { text: product.fiberFreeText })}
                    </span>
                  </span>
                ) : null}
              </Row>
              {product.sizeLabel ? (
                <Row name="size" label={t('size')} lang={de('sizeLabel')}>
                  {product.sizeLabel}
                </Row>
              ) : null}
              {conditionFull ? (
                <Row
                  name="condition"
                  label={t('condition')}
                  lang={product.conditionNote ? de('conditionNote') : undefined}
                >
                  {conditionFull}
                </Row>
              ) : null}
            </dl>
            {product.labelMissing ? (
              <Note name="textileLabelMissing">
                {getSnippet('product.textileLabelMissing', locale).text}
              </Note>
            ) : null}
            {product.isSecondHand ? (
              <>
                <Badge kind="secondHand" />
                {condition ? (
                  <Note name="textileSecondHand">
                    {getSnippet('product.textileSecondHand', locale, { condition }).text}
                  </Note>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {product.category === 'schmuck' ? (
          <>
            {product.metalPartsMaterial ? (
              <dl className={styles.rows}>
                <Row name="metalParts" label={t('metalParts')} lang={de('metalPartsMaterial')}>
                  {product.metalPartsMaterial}
                </Row>
              </dl>
            ) : null}
            {product.nickelFreeConfirmed && product.metalPartsMaterial ? (
              <Note name="jewelryNickel">
                {
                  getSnippet('product.jewelryNickel', locale, {
                    metalMaterial: product.metalPartsMaterial,
                  }).text
                }
              </Note>
            ) : null}
            <Badge kind="smallParts" />
            <Note name="jewelrySmallParts">
              {getSnippet('product.jewelrySmallParts', locale).text}
            </Note>
          </>
        ) : null}

        {product.category === 'zeichnung' ? (
          <>
            <dl className={styles.rows}>
              {product.materials ? (
                <Row name="technique" label={t('technique')} lang={de('materials')}>
                  {product.materials}
                </Row>
              ) : null}
              {dims ? (
                <Row name="dimensions" label={t('dimensions')} lang={dimsLang}>
                  {dims}
                </Row>
              ) : null}
            </dl>
            {product.framed && product.frameHasGlass ? (
              <Note name="glassFrame">{getSnippet('product.glassFrame', locale).text}</Note>
            ) : null}
          </>
        ) : null}
      </section>

      {/* Abweichende Beschaffenheit (R-048 Nr. 1) */}
      {product.hasDeviation && product.deviationDescription ? (
        <div className={styles.deviation} data-deviation="">
          <Callout variant="deviation">
            <p lang={de('deviationDescription')}>{product.deviationDescription}</p>
          </Callout>
        </div>
      ) : null}

      {/* 6. Kaufbereich je Zustand */}
      <div className={styles.buy} data-buy-area="" data-buy-state={closed ? 'closed' : state}>
        {closed ? (
          <div data-shop-closed="">
            <Callout variant="info">
              <p>{settings.closedMessage ?? tList('closedFallback')}</p>
            </Callout>
          </div>
        ) : null}
        {state === 'sold' ? (
          <>
            <p className={styles.soldText} data-sold-text="">
              {t('soldText')}
            </p>
            <ul className={styles.soldLinks}>
              <li>
                <Button variant="secondary" href={similarHref}>
                  {t('similar')}
                </Button>
              </li>
              <li>
                <Button variant="secondary" href={localizedPath('R05', locale)}>
                  {t('archive')}
                </Button>
              </li>
            </ul>
          </>
        ) : (
          <span
            className={styles.cta}
            id="add-to-cart"
            data-add-to-cart=""
            data-leash-anchor="target"
            data-leash-loop="hook"
          >
            <Button variant="primary" disabled={!canAddToCart(state, settings.isOpen)}>
              {state === 'reserved' ? tBadges('reservedLong') : t('addToCart')}
            </Button>
          </span>
        )}
        <p className={styles.area} data-delivery-area="">
          {settings.pickupEnabled
            ? t('deliveryArea', { city: settings.pickupCity ?? 'Berlin' })
            : t('deliveryAreaNoPickup')}
        </p>
      </div>
    </article>
  )
}
