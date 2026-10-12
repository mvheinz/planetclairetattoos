import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { JsonLd } from '@/components/seo/JsonLd'
import { FaqList } from '@/components/content/FaqList'
import { PageBlocks } from '@/components/content/PageBlocks'
import { StaticHtml } from '@/components/StaticHtml'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { EmptyState } from '@/components/ui/EmptyState'
import { listAllCategories, listNavCategories, type PublicCategory } from '@/lib/data/categories'
import { getPublicPage } from '@/lib/data/pages'
import {
  listArchiveCategoryKeys,
  listArchiveProducts,
  listCategoryKeysWithContent,
  listShopProducts,
  type ProductPage,
  type PublicProduct,
} from '@/lib/data/products'
import { getShopDisplaySettings, taxSettingsFor } from '@/lib/data/shopSettings'
import { listFaqs } from '@/lib/data/tattoo'
import type { Locale } from '@/lib/enums'
import { localizedPath } from '@/lib/routes/paths'
import { breadcrumbItems } from '@/lib/seo/breadcrumbs'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { categoryTile, TILE_SIZE } from '@/lib/shop/categoryTiles'
import {
  listSearch,
  pageAnchor,
  SHOP_FAQ_ANCHOR,
  variantKey,
  type ListParams,
} from '@/lib/shop/listParams'

import styles from './ListPage.module.css'
import { PriceFootnote } from './PriceFootnote'
import { EAGER_CARDS, ProductCard } from './ProductCard'
import { statusLabelAttrs } from './statusLabels'

// Listen-Seiten des Shops (KONZEPT §3.2, §3.3, §3.5; DESIGN KO-07, KO-08, KO-17, §9.7 `shopString`): Shop (R02),
// Kategorie (R03) und Archiv (R05) teilen Aufbau und Verhalten – H1, Einleitung, Kategorie-Kacheln als echte Links
// (`aria-current="page"` am aktiven; im Shop nur Kategorien mit Inhalt, V-11), Hinweis „Shop pausiert“ über dem Raster
// (die Stücke bleiben sichtbar), Raster aus Produktkarten (jede Karte ist eine Rasterzelle der Tuschelinie: Kringel
// zwischen den Zeilen, Coco läuft mit, U-44), „Mehr zeigen“ als Link `?page=n+1` – die Liste wird länger (V-12: Seite n
// zeigt 1 bis n × 24, der Link springt per Anker zum ersten neuen Stück und sagt, wie viele noch kommen), Preis-Fußnote
// einmal je Seite (R-030) und Lieferzeile. Leerzustände nach KO-17. Ohne JavaScript voll bedienbar. Seiten > letzte
// Seite → 404. Verkaufte Stücke (R02/R03) nur als kurze Reihe unter der letzten Seite mit Link „Archiv ansehen“
// (U-57 c). Ganz unten im Shop (R02) die Fragen zum Shop (V-19, FAQ-Kategorie `shop`). JSON-LD `BreadcrumbList`
// (Start → Shop → Kategorie bzw. Start → Archiv, P3.13).

export type ListRoute = 'R02' | 'R03' | 'R05'

export interface ListPageProps {
  routeId: ListRoute
  locale: Locale
  list: ListParams
  /** R03: die Kategorie der Seite. */
  category?: PublicCategory | null
}

interface Chip {
  key: string
  label: string
  href: string
  current: boolean
}

function basePath(routeId: ListRoute, locale: Locale, category?: PublicCategory | null): string {
  return routeId === 'R03' && category
    ? localizedPath('R03', locale, { slug: category.slug })
    : localizedPath(routeId, locale)
}

export async function ListPage({ routeId, locale, list, category }: ListPageProps) {
  const archive = routeId === 'R05'
  const page = list.page ?? 1
  const [t, tRoutes, settings, content, shopFaqs] = await Promise.all([
    getTranslations({ locale }),
    getTranslations({ locale, namespace: 'common.routes' }),
    getShopDisplaySettings(locale),
    routeId === 'R03' ? Promise.resolve(null) : getPublicPage(archive ? 'archive' : 'shop', locale),
    routeId === 'R02' ? listFaqs('shop', locale) : Promise.resolve([]),
  ])
  const shopFaqCount = shopFaqs.length

  let result: ProductPage
  let chips: Chip[]
  // U-57 c: kurze Reihe verkaufter Stücke unter den verfügbaren (nur letzte Seite), dann „Archiv ansehen“.
  let soldRow: PublicProduct[] = []
  let archiveCategory: PublicCategory | null = null
  if (archive) {
    const [all, keys] = await Promise.all([listAllCategories(locale), listArchiveCategoryKeys()])
    const withItems = all.filter((c) => keys.includes(c.key))
    // Unbekannte oder leere Kategorie wird ignoriert (AK-3-09): ganze Liste.
    archiveCategory = withItems.find((c) => c.slug === list.category) ?? null
    result = await listArchiveProducts({
      locale,
      categoryKey: archiveCategory?.key,
      page,
    })
    const base = localizedPath('R05', locale)
    chips = [
      { key: 'all', label: t('shop.list.all'), href: base, current: !archiveCategory },
      ...withItems.map((c) => ({
        key: c.key,
        label: c.name,
        href: `${base}${listSearch({ category: c.slug })}`,
        current: archiveCategory?.key === c.key,
      })),
    ]
  } else {
    const [res, navCategories, withContent] = await Promise.all([
      listShopProducts({
        locale,
        categoryKeys: category ? [category.key] : undefined,
        page,
      }),
      listNavCategories(locale),
      listCategoryKeysWithContent(),
    ])
    result = res
    soldRow = res.sold
    chips = [
      {
        key: 'all',
        label: t('shop.list.all'),
        href: localizedPath('R02', locale),
        current: routeId === 'R02',
      },
      // V-11: nur Kategorien mit Inhalt; die gerade offene (auch leer) bleibt stehen, damit man sieht, wo man ist.
      ...navCategories
        .filter((c) => withContent.includes(c.key) || category?.key === c.key)
        .map((c) => ({
          key: c.key,
          label: c.name,
          href: localizedPath('R03', locale, { slug: c.slug }),
          current: category?.key === c.key,
        })),
    ]
  }
  if (page > result.totalPages) notFound()

  const base = basePath(routeId, locale, category)
  const title = routeId === 'R03' && category ? category.name : tRoutes(routeId)
  // V-12: „Mehr zeigen“ verlängert die Liste und springt zum ersten neuen Stück (ohne JavaScript per Anker).
  const moreHref = result.hasNextPage
    ? `${base}${listSearch({ ...list, category: archiveCategory?.slug, page: page + 1 })}#${pageAnchor(page + 1)}`
    : null
  // Sofort laden: auf Seite 1 die ersten Karten, auf Folgeseiten die ersten neuen (dorthin springt der Anker).
  const eagerFrom = page > 1 ? result.firstOfPage : 0
  const isEager = (index: number) => index >= eagerFrom && index < eagerFrom + EAGER_CARDS
  const hasCards = result.docs.length > 0
  const hasSoldRow = soldRow.length > 0
  const archiveHref = `${localizedPath('R05', locale)}${listSearch({
    category: routeId === 'R03' ? category?.slug : undefined,
  })}`
  const now = new Date()

  return (
    <div
      className={`u-container ${styles.page}`}
      data-list-page={routeId}
      data-list-variant={variantKey(list)}
    >
      <JsonLd
        data={breadcrumbJsonLd(
          breadcrumbItems(
            routeId === 'R03' && category
              ? { routeId, category: { name: category.name, slug: category.slug } }
              : { routeId: routeId === 'R05' ? 'R05' : 'R02' },
            locale,
          ),
        )}
      />
      <header className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
        {archive ? <p className={styles.intro}>{t('archive.lead')}</p> : null}
        {routeId === 'R03' ? (
          category?.intro ? (
            <p className={styles.intro}>{category.intro}</p>
          ) : null
        ) : content?.layout?.length ? (
          <div className={styles.intro}>
            <PageBlocks blocks={content.layout} locale={locale} />
          </div>
        ) : !archive ? (
          <p className={styles.intro}>{t('shop.list.intro')}</p>
        ) : null}
      </header>

      <nav
        className={styles.filters}
        aria-label={archive ? t('archive.filterLabel') : t('shop.list.filterLabel')}
      >
        {/* Coco läuft am Seitenanfang einmal um die Kategorie-Bilder (U-44, ab 768 px; mobil ein Kringel) */}
        <ul
          className={`${styles.chips} u-leash-room-wide`}
          data-leash-station="kategorien"
          data-leash-loop="contour"
        >
          {chips.map((chip) => {
            const tile = categoryTile(chip.key)
            return (
              <li key={chip.key}>
                <a
                  className={styles.card}
                  href={chip.href}
                  aria-current={chip.current ? 'page' : undefined}
                  data-chip={chip.key}
                >
                  {/* Dekorativ: Das Etikett daneben benennt den Link. Feste Größe → kein CLS. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.tile}
                    src={tile.src}
                    width={TILE_SIZE}
                    height={TILE_SIZE}
                    alt=""
                    decoding="async"
                    style={{ objectPosition: tile.position }}
                    data-tile={chip.key}
                  />
                  <span className={styles.cardLabel}>{chip.label}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      {!archive && !settings.isOpen ? (
        <div className={styles.closed} data-shop-closed="">
          <Callout variant="info">
            <p>{settings.closedMessage ?? t('shop.list.closedFallback')}</p>
          </Callout>
        </div>
      ) : null}

      {hasCards ? (
        <section className={styles.listing} aria-labelledby="list-heading">
          <h2 id="list-heading" className="u-sr-only">
            {t('shop.list.heading')}
          </h2>
          <div className={styles.gridWrap}>
            {/* Shop/Kategorie: Live-Zustand der Karten nach dem Laden (`product-status`, P3.11) mit Stempel-Knall;
                Ziel der Sprachlinks bei sprachabhängigem Slug (`language-targets`, U-47). */}
            <ul
              className={styles.grid}
              data-behavior={
                archive
                  ? 'price-tag-swing'
                  : 'price-tag-swing sold-stamp product-status language-targets'
              }
              {...(archive ? {} : statusLabelAttrs((key) => t(`shop.card.${key}`)))}
            >
              {result.docs.map((product, index) => {
                // Erstes neues Stück einer Folgeseite: Sprungziel von „Mehr zeigen“ (V-12).
                const id = page > 1 && index === result.firstOfPage ? pageAnchor(page) : undefined
                // Karten mit faulen Fotos als statisches HTML (nicht hydriert, TBT P7); die sofort geladenen (eager,
                // KO-07) bleiben normal gerendert, damit ihre Vorlade-Hinweise im <head> bleiben.
                const card = (
                  <ProductCard
                    product={product}
                    locale={locale}
                    index={isEager(index) ? 0 : EAGER_CARDS}
                  />
                )
                return isEager(index) ? (
                  <li key={product.id} id={id} className={styles.cell} data-leash-anchor="tag">
                    {card}
                  </li>
                ) : (
                  <StaticHtml
                    as="li"
                    key={product.id}
                    id={id}
                    className={styles.cell}
                    data-leash-anchor="tag"
                  >
                    {card}
                  </StaticHtml>
                )
              })}
            </ul>
          </div>
          {moreHref ? (
            <div className={styles.more}>
              <Button variant="secondary" href={moreHref} data={{ 'data-list-more': '' }}>
                {t('shop.list.more')}{' '}
                <span className={styles.moreCount}>
                  {t('shop.list.moreCount', { count: result.remaining })}
                </span>
              </Button>
            </div>
          ) : null}
        </section>
      ) : archive ? (
        <EmptyState
          pose="sitzen"
          title={t('archive.emptyTitle')}
          text={t('archive.emptyText')}
          action={{ href: localizedPath('R02', locale), label: t('archive.emptyAction') }}
        />
      ) : routeId === 'R03' ? (
        <EmptyState
          pose="kopfschief"
          title={t('shop.category.emptyTitle')}
          text={t('shop.category.emptyText')}
          action={{ href: localizedPath('R02', locale), label: t('shop.category.emptyAction') }}
        />
      ) : (
        <EmptyState
          pose="sitzen"
          title={t('shop.list.empty')}
          text={t('shop.list.emptyText')}
          action={{ href: localizedPath('R05', locale), label: t('shop.list.emptyAction') }}
        />
      )}

      {hasSoldRow ? (
        <section className={styles.soldRow} aria-labelledby="sold-heading" data-sold-row="">
          <h2 id="sold-heading" className={styles.soldHeading}>
            {t('shop.list.soldHeading')}
          </h2>
          <div className={styles.gridWrap}>
            <ul className={styles.grid} data-behavior="price-tag-swing">
              {soldRow.map((product, index) => (
                <StaticHtml as="li" key={product.id} data-leash-anchor="tag">
                  {/* Immer faul geladen (statisches HTML, unter dem Raster) */}
                  <ProductCard
                    product={product}
                    locale={locale}
                    index={EAGER_CARDS + result.docs.length + index}
                  />
                </StaticHtml>
              ))}
            </ul>
          </div>
          <div className={styles.more}>
            <Button variant="secondary" href={archiveHref} data={{ 'data-archive-link': '' }}>
              {t('shop.list.archiveLink')}
            </Button>
          </div>
        </section>
      ) : null}

      {hasCards || !archive ? (
        <footer className={styles.notes}>
          {hasCards || hasSoldRow ? (
            <PriceFootnote locale={locale} settings={taxSettingsFor(settings.taxMode)} at={now} />
          ) : null}
          {!archive ? (
            <p data-delivery-line="">
              {settings.pickupEnabled
                ? t('shop.list.delivery', { city: settings.pickupCity ?? 'Berlin' })
                : t('shop.list.deliveryNoPickup')}
            </p>
          ) : null}
        </footer>
      ) : null}

      {/* V-19: Fragen zum Shop ganz unten (eigener Platz, nicht die Seitenblöcke im Kopf); gepflegt wie alle Fragen
          unter Texte → Fragen, Kategorie „Shop“. Ohne veröffentlichte Frage entfällt der Abschnitt. */}
      {routeId === 'R02' && shopFaqCount > 0 ? (
        <StaticHtml as="div" className={styles.faq}>
          <FaqList
            id={SHOP_FAQ_ANCHOR}
            category="shop"
            heading={t('shop.list.faqHeading')}
            locale={locale}
            data={{ 'data-shop-faq': '' }}
          />
        </StaticHtml>
      ) : null}
    </div>
  )
}
