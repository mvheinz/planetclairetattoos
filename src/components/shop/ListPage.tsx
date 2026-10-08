import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { JsonLd } from '@/components/seo/JsonLd'
import { PageBlocks } from '@/components/content/PageBlocks'
import { Icon } from '@/components/icons/Icon'
import { StaticHtml } from '@/components/StaticHtml'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { EmptyState } from '@/components/ui/EmptyState'
import { listAllCategories, listNavCategories, type PublicCategory } from '@/lib/data/categories'
import { getPublicPage } from '@/lib/data/pages'
import {
  listArchiveCategoryKeys,
  listArchiveProducts,
  listShopProducts,
  type ProductPage,
} from '@/lib/data/products'
import { getShopDisplaySettings, taxSettingsFor } from '@/lib/data/shopSettings'
import type { Locale } from '@/lib/enums'
import { localizedPath } from '@/lib/routes/paths'
import { breadcrumbItems } from '@/lib/seo/breadcrumbs'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { categoryTile, TILE_SIZE } from '@/lib/shop/categoryTiles'
import { listSearch, variantKey, type ListParams } from '@/lib/shop/listParams'

import styles from './ListPage.module.css'
import { PriceFootnote } from './PriceFootnote'
import { EAGER_CARDS, ProductCard } from './ProductCard'
import { statusLabelAttrs } from './statusLabels'

// Listen-Seiten des Shops (KONZEPT §3.2, §3.3, §3.5; DESIGN KO-07, KO-08, KO-17, §9.7 `shopString`): Shop (R02),
// Kategorie (R03) und Archiv (R05) teilen Aufbau und Verhalten – H1, Einleitung, Filter-Chips als echte Links
// (`aria-current="page"` am aktiven), Hinweis „Shop pausiert“ über dem Raster (die Stücke bleiben sichtbar), Raster aus
// Produktkarten (jede Karte ist eine Rasterzelle der Tuschelinie: Kringel zwischen den Zeilen, Coco läuft mit, U-44), „Mehr zeigen“ als Link
// `?page=n+1`, Preis-Fußnote einmal je Seite (R-030) und Lieferzeile. Leerzustände nach KO-17. Ohne JavaScript voll
// bedienbar. Seiten > letzte Seite → 404. JSON-LD `BreadcrumbList` (Start → Shop → Kategorie bzw. Start → Archiv,
// P3.13).

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
  const [t, tRoutes, settings, content] = await Promise.all([
    getTranslations({ locale }),
    getTranslations({ locale, namespace: 'common.routes' }),
    getShopDisplaySettings(locale),
    routeId === 'R03' ? Promise.resolve(null) : getPublicPage(archive ? 'archive' : 'shop', locale),
  ])

  let result: ProductPage
  let chips: Chip[]
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
    const [res, navCategories] = await Promise.all([
      listShopProducts({
        locale,
        categoryKeys: category ? [category.key] : undefined,
        availableOnly: list.available === true,
        page,
      }),
      listNavCategories(locale),
    ])
    result = res
    const keep = listSearch({ available: list.available })
    chips = [
      {
        key: 'all',
        label: t('shop.list.all'),
        href: `${localizedPath('R02', locale)}${keep}`,
        current: routeId === 'R02',
      },
      ...navCategories.map((c) => ({
        key: c.key,
        label: c.name,
        href: `${localizedPath('R03', locale, { slug: c.slug })}${keep}`,
        current: category?.key === c.key,
      })),
    ]
  }
  if (page > result.totalPages) notFound()

  const base = basePath(routeId, locale, category)
  const title = routeId === 'R03' && category ? category.name : tRoutes(routeId)
  const availableHref = `${base}${listSearch({ available: list.available ? undefined : true })}`
  const moreHref = result.hasNextPage
    ? `${base}${listSearch({ ...list, category: archiveCategory?.slug, page: page + 1 })}`
    : null
  const hasCards = result.docs.length > 0
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
        {!archive ? (
          <ul className={styles.options}>
            <li>
              <a
                className={`${styles.chip} ${styles.toggle}`}
                href={availableHref}
                data-chip="available"
                data-active={list.available ? '' : undefined}
              >
                <span className={styles.box} aria-hidden="true">
                  {list.available ? <Icon name="check" size={16} /> : null}
                </span>
                {t('shop.list.availableOnly')}
                {list.available ? (
                  <span className="u-sr-only"> {t('shop.list.filterOn')}</span>
                ) : null}
              </a>
            </li>
          </ul>
        ) : null}
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
              {result.docs.map((product, index) =>
                // Karten mit faulen Fotos als statisches HTML (nicht hydriert, TBT P7); die ersten (eager, KO-07)
                // bleiben normal gerendert, damit ihre Vorlade-Hinweise im <head> bleiben.
                index < EAGER_CARDS ? (
                  <li key={product.id} data-leash-anchor="tag">
                    <ProductCard product={product} locale={locale} index={index} />
                  </li>
                ) : (
                  <StaticHtml as="li" key={product.id} data-leash-anchor="tag">
                    <ProductCard product={product} locale={locale} index={index} />
                  </StaticHtml>
                ),
              )}
            </ul>
          </div>
          {moreHref ? (
            <div className={styles.more}>
              <Button variant="secondary" href={moreHref}>
                {t('shop.list.more')}
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

      {hasCards || !archive ? (
        <footer className={styles.notes}>
          {hasCards ? (
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
    </div>
  )
}
