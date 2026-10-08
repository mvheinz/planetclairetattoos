import { getTranslations } from 'next-intl/server'
import React from 'react'

import { addToCart } from '@/app/(frontend)/[locale]/shop/[product]/actions'

import { coil } from '@/components/leash/Station'
import { Badge } from '@/components/shop/Badge'
// Alias: der Streichpreis-Scan (V-20) prüft den Quelltext auf das HTML-Tag für Streichungen.
import { DeliveryTime as LeadTime } from '@/components/shop/DeliveryTime'
import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { IpNotice } from '@/components/legal/IpNotice'
import { PriceFootnote } from '@/components/shop/PriceFootnote'
import { PriceTag } from '@/components/shop/PriceTag'
import { statusLabelAttrs } from '@/components/shop/statusLabels'
import { WarrantyNotice } from '@/components/shop/WarrantyNotice'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { StaticHtml } from '@/components/StaticHtml'
import { listAllCategories } from '@/lib/data/categories'
import {
  getPublicProductByItemNumber,
  getUntranslatedFields,
  listRelatedProducts,
  type ProductTextField,
  type PublicProduct,
} from '@/lib/data/products'
import {
  getProductInfoSettings,
  getShopDisplaySettings,
  taxSettingsFor,
} from '@/lib/data/shopSettings'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import type { FiberRow } from '@/lib/products/fibers'
import { localizedPath } from '@/lib/routes/paths'
import { BUY_NOTE_CODES, BUY_NOTE_FRAGMENTS, IN_CART_FRAGMENT } from '@/lib/shop/buyArea'
import { buyState, canAddToCart, foodContactDisplay } from '@/lib/shop/productState'
import {
  formatCondition,
  formatDimensions,
  formatFibers,
  formatItemNumber,
} from '@/lib/shop/format'
import { safetyWarningTexts } from '@/lib/shop/productInfo'

import { ProductGallery } from './ProductGallery'
import {
  MoreFromCategory,
  ProductDescription,
  ProductDetails,
  ProductSafetyBlock,
  ProductShipping,
} from './ProductInfo'
import styles from './ProductPage.module.css'

// Produktseite R04, Blöcke 2–11 (KONZEPT §3.4) in verbindlicher DOM-Reihenfolge – Pflichtangaben stehen vor dem
// Kaufknopf und nie hinter einem Klick (AK-3-05, AK-3-07): H1 → Kurzdaten (`Nr. 017` · „Unikat“ · Kategorie · Maße) →
// Preisschild `pinned` mit Steuer-/Versandhinweis und Lieferzeit (R-030, R-031, R-035) → Pflichtangaben je Kategorie
// (R-043 bis R-046, Bausteine `product.*`) → Abweichungs-Kasten (R-048 Nr. 1) → Kaufbereich je Zustand samt Satz zum
// Liefergebiet (R-036). Fehlt ein EN-Text, steht der DE-Text mit `lang="de"`. Tuschelinie `product` (DESIGN §9.7,
// U-44): wie im Shop in der Rinne links, Coco läuft an der Leine mit, Kringel an Titel, Preis und den Abschnitten; der
// Coco-Hüpfer MI-01 (Modul `add-to-cart`) springt mit der Leinen-Coco. „In den Korb“ ist ein Formular
// mit der Server-Action `addToCart` (P3.11): ohne JavaScript 303 zurück mit `#in-cart` bzw. Meldung (CSS `:target`), mit
// JavaScript ohne Seitenwechsel (`add-to-cart`); Live-Zustand per `product-status` (+ `sold-stamp`). Direkt nach
// dem Kaufbereich die harmonisierte Mitteilung zur Gewährleistung (R-049, Bereich Preis/Produktangaben), danach die
// Blöcke 7–11 aus `ProductInfo.tsx` (Beschreibung, Details, „Herstellerin & Sicherheit“, Versand & Rückgabe, „Mehr aus …“).

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

export async function ProductPage({
  product,
  locale,
  preview = false,
}: {
  product: PublicProduct
  locale: Locale
  /** Entwurfs-Vorschau in der Verwaltung (PLAN P5.6): Kaufknopf gesperrt, keine Kauf-Leiste. */
  preview?: boolean
}) {
  const [t, tBadges, tList, tCard, settings, categories, untranslated, info, related, german] =
    await Promise.all([
      getTranslations({ locale, namespace: 'shop.product' }),
      getTranslations({ locale, namespace: 'shop.badges' }),
      getTranslations({ locale, namespace: 'shop.list' }),
      getTranslations({ locale, namespace: 'shop.card' }),
      getShopDisplaySettings(locale),
      listAllCategories(locale),
      getUntranslatedFields(product.itemNumber, locale),
      getProductInfoSettings(locale),
      listRelatedProducts(product, 4, locale),
      // Warnhinweise stehen immer auch auf Deutsch (R-040).
      locale === 'de' ? product : getPublicProductByItemNumber(product.itemNumber, 'de'),
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
  const pickupCity = settings.pickupCity ?? 'Berlin'
  const warnings = safetyWarningTexts(
    {
      ...product,
      de: german?.safetyWarnings ?? product.safetyWarnings,
      translated: de('safetyWarnings') ? null : product.safetyWarnings,
    },
    locale,
    food?.kind === 'decorative'
      ? {
          de: getSnippet('product.ceramicsDecorative', 'de').text,
          en: getSnippet('product.ceramicsDecorative', 'en').text,
        }
      : {},
    product.category === 'schmuck' || product.category === 'keramik'
      ? {}
      : {
          de: getSnippet('product.noSpecialWarnings', 'de').text,
          en: getSnippet('product.noSpecialWarnings', 'en').text,
        },
  )
  const similarHref = category
    ? localizedPath('R03', locale, { slug: category.slug })
    : localizedPath('R02', locale)
  const cartHref = localizedPath('R06', locale)
  const checkoutHref = localizedPath('R07', locale)
  const canAdd = !preview && canAddToCart(state, settings.isOpen)
  // Server-Action als Formular-Aktion: ohne JavaScript leitet sie per 303 um (Rückgabe nur für `add-to-cart`).
  const formAction = addToCart as unknown as (formData: FormData) => Promise<void>
  const cartFields = (
    <>
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="itemNumber" value={product.itemNumber} />
      <input type="hidden" name="locale" value={locale} />
    </>
  )
  const soldView = (
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
  )

  return (
    <article
      className={`u-container ${styles.page}`}
      data-product-page=""
      data-behavior="product-status sold-stamp"
      data-product-id={product.id}
      data-item-number={product.itemNumber}
      data-status={state}
      data-category={product.category}
      {...statusLabelAttrs(tCard)}
    >
      {/* 1. Galerie (KO-09) */}
      <ProductGallery
        images={product.images}
        title={product.title ?? categoryName}
        locale={locale}
      />

      {/* 2. Titel */}
      <header className={styles.head} {...coil('title', 0)} data-leash-pose="sitzen">
        <h1 className={styles.title} lang={de('title')} data-product-title="">
          {product.title}
        </h1>
      </header>

      {/* 3. Kurzdaten */}
      <ul className={styles.facts} aria-label={t('factsLabel')} data-product-facts="">
        <li className={styles.nr}>{formatItemNumber(product.itemNumber, locale)}</li>
        <li>
          <Badge locale={locale} kind="unique" />
        </li>
        <li>{categoryName}</li>
        {dims ? (
          <li className={styles.dims} lang={dimsLang}>
            {dims}
          </li>
        ) : null}
      </ul>

      {/* 4. Preisschild mit Steuer-/Versandhinweis und Lieferzeit */}
      <div className={styles.price} data-product-price="" {...coil('price', 1)}>
        <div className={styles.tagRow}>
          <PriceTag
            itemNumber={product.itemNumber}
            priceCents={product.priceCents}
            locale={locale}
            variant="pinned"
            sold={state === 'sold'}
            stampSlot
          />
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
                locale={locale}
                kind="foodSafe"
                href={`${localizedPath('R27', locale)}#glaze-${food.declaration.id}`}
              />
              <Note name="ceramicsFoodSafe">
                {getSnippet('product.ceramicsFoodSafe', locale).text}
              </Note>
            </>
          ) : (
            <>
              <Badge locale={locale} kind="decorative" />
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
                <Badge locale={locale} kind="secondHand" />
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
            <Badge locale={locale} kind="smallParts" />
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
          soldView
        ) : (
          <>
            {/* Ohne JavaScript per `:target` sichtbar (303 mit `#in-cart`), sonst durch `add-to-cart`. */}
            <p id={IN_CART_FRAGMENT} className={styles.inCart} data-in-cart="" hidden>
              <span>{t('inCart')}</span>
              <a className={styles.toCart} href={cartHref}>
                {t('toCart')}
              </a>
            </p>
            {/* P4.7: Stück liegt in der eigenen laufenden Kasse (`reservedByYou`, Modul `product-status`). */}
            <p className={styles.inCart} data-in-checkout="" hidden>
              <span>{t('inCheckout')}</span>
              <a className={styles.toCart} href={checkoutHref}>
                {t('toCheckout')}
              </a>
            </p>
            <form
              action={formAction}
              className={styles.cta}
              id="add-to-cart"
              data-add-to-cart=""
              data-behavior="add-to-cart"
              data-product-id={product.id}
              data-text-add={t('addToCart')}
              data-text-reserved={tBadges('reservedLong')}
              data-closed={closed ? '' : undefined}
            >
              {cartFields}
              <Button variant="primary" type="submit" disabled={!canAdd}>
                {state === 'reserved' ? tBadges('reservedLong') : t('addToCart')}
              </Button>
            </form>
            <div className={styles.notes} data-buy-notes="" aria-live="polite">
              <p className={styles.confirm} data-buy-confirm="" hidden>
                {t('added')}
              </p>
              {BUY_NOTE_CODES.map((code) => (
                <p
                  key={code}
                  id={BUY_NOTE_FRAGMENTS[code]}
                  className={styles.buyNote}
                  data-buy-note={code}
                  hidden
                >
                  {t(`notes.${code}`)}
                </p>
              ))}
            </div>
            <div className={styles.soldView} data-sold-view="" hidden>
              {soldView}
            </div>
          </>
        )}
        <p className={styles.area} data-delivery-area="">
          {settings.pickupEnabled
            ? t('deliveryArea', { city: pickupCity })
            : t('deliveryAreaNoPickup')}
        </p>
      </div>

      {/* Ab hier reines Server-Markup ohne Formulare: statisches HTML, nicht hydriert (`StaticHtml`, TBT P7). */}

      {/* Kaufklausel: nur das Unikat, keine Rechte am Motiv (U-22 b, Baustein `ip.purchaseClause`) */}
      <IpNotice locale={locale} kind="purchase" />

      {/* Harmonisierte Mitteilung zur Gewährleistung (R-049) */}
      <StaticHtml>
        <WarrantyNotice locale={locale} />
      </StaticHtml>

      {/* 7. Beschreibung und „Jutta sagt“ */}
      <StaticHtml {...coil('description', 0, 'spiral')}>
        <ProductDescription product={product} locale={locale} langOf={de} />
      </StaticHtml>

      {/* 8. Details-Tabelle */}
      <StaticHtml>
        <ProductDetails product={product} locale={locale} langOf={de} />
      </StaticHtml>

      {/* 9. Herstellerin & Sicherheit (GPSR) */}
      <StaticHtml {...coil('safety', 1)}>
        <ProductSafetyBlock
          product={product}
          locale={locale}
          business={info.business}
          categoryName={categoryName}
          warnings={warnings}
        />
      </StaticHtml>

      {/* 10. Versand & Rückgabe kurz */}
      <StaticHtml>
        <ProductShipping
          product={product}
          locale={locale}
          settings={info}
          pickupEnabled={settings.pickupEnabled}
          pickupCity={pickupCity}
        />
      </StaticHtml>

      {/* 11. Mehr aus {Kategorie} */}
      <StaticHtml {...coil('more', 0)}>
        <MoreFromCategory
          products={related.filter((p) => p.status !== 'sold' && p.id !== product.id)}
          locale={locale}
          categoryName={categoryName}
          categoryHref={similarHref}
        />
      </StaticHtml>

      {/* Kauf-Leiste mobil (KO-09a): nur bei `available`; eingeblendet vom Modul `buy-bar`, ohne JavaScript verborgen. */}
      {state === 'available' && !preview ? (
        <div
          className={styles.buyBar}
          data-behavior="buy-bar"
          data-buy-bar=""
          role="region"
          aria-label={t('buyBar')}
          hidden
        >
          <MoneyAmount cents={product.priceCents} locale={locale} className={styles.buyBarPrice} />
          <form
            action={formAction}
            className={styles.buyBarForm}
            data-behavior="add-to-cart"
            data-product-id={product.id}
            data-text-add={t('addToCart')}
            data-text-reserved={tBadges('reservedLong')}
            data-closed={closed ? '' : undefined}
          >
            {cartFields}
            <Button variant="primary" type="submit" disabled={!canAdd}>
              {t('addToCart')}
            </Button>
          </form>
          <a className={styles.buyBarCart} href={cartHref} data-in-cart="" hidden>
            {t('toCart')}
          </a>
          <a className={styles.buyBarCart} href={checkoutHref} data-in-checkout="" hidden>
            {t('toCheckout')}
          </a>
        </div>
      ) : null}
    </article>
  )
}
