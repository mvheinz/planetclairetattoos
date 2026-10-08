import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import React from 'react'

import { ReservationCountdown } from '@/components/checkout/ReservationCountdown'
import { Coco } from '@/components/Coco'
import { HomeStation } from '@/components/home/HomeStation'
import { PlanetMark } from '@/components/home/SpaceMarks'
import { NotFoundContent } from '@/components/layout/NotFoundContent'
import menuStyles from '@/components/layout/MenuOverlay.module.css'
import header from '@/components/layout/SiteHeader.module.css'
import { Station } from '@/components/leash/Station'
import orderStyles from '@/components/order/Order.module.css'
import { QaReplay } from '@/components/qa/QaReplay'
import cardStyles from '@/components/shop/ProductCard.module.css'
import { PriceTag } from '@/components/shop/PriceTag'
import productStyles from '@/components/shop/product/ProductPage.module.css'
import { Button } from '@/components/ui/Button'
import { getHomeView } from '@/lib/data/home'
import { QA_MICROS, qaMicro } from '@/lib/qa/microInteractions'
import type { Locale } from '@/lib/routes/registry'

import { requireArtQa } from '../guard'
import { LeashSandbox } from '../LeashSandbox'
import { QaFrame } from '../QaFrame'
import styles from '../qa.module.css'

// `/{locale}/qa/motion?mi=MI-xx` (KUNST-QA §3.2, SC-14): jede Mikro-Interaktion isoliert auf einer Bühne mit
// „Abspielen“ – Produkt-Komponenten, -CSS und -Verhaltensmodule (`QaReplay` bindet sie im Modus `preview`).

const QA_ID = 'qa-mi'

async function Demo({ mi, locale }: { mi: string; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'qa' })
  switch (mi) {
    case 'MI-01':
      return (
        <div data-buy-area="" style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
          <div data-product-coco="">
            <Coco pose="sitzen" size="s" />
          </div>
          <form data-behavior="add-to-cart" data-product-id={QA_ID}>
            <Button variant="primary" type="submit">
              {t('demoButton')}
            </Button>
          </form>
          <p data-in-cart="" hidden>
            {t('cartCount')}
          </p>
        </div>
      )
    case 'MI-02':
      return (
        <div data-behavior="price-tag-swing" style={{ display: 'flex', gap: 32, paddingTop: 24 }}>
          {[981, 982, 983].map((n, i) => (
            <PriceTag key={n} itemNumber={n} priceCents={4500 + i * 1000} locale={locale} />
          ))}
        </div>
      )
    case 'MI-03':
      return (
        <div data-behavior="sold-stamp" style={{ paddingTop: 24 }}>
          <div data-product-id={QA_ID} style={{ display: 'inline-block' }}>
            <PriceTag itemNumber={984} priceCents={6500} locale={locale} stampSlot />
          </div>
        </div>
      )
    case 'MI-04':
      return (
        <div style={{ position: 'relative', height: 280 }}>
          <Coco pose="rennen" size="leash" data={{ 'data-leash-coco': '', 'data-placed': '' }} />
        </div>
      )
    case 'MI-05':
    case 'MI-16':
      return (
        <Button variant="primary" type="button">
          {t('demoButton')}
        </Button>
      )
    case 'MI-06':
      return (
        <p>
          <Button variant="link" href="#qa-underline" underlineSeed="qa-mi06">
            {t('linkLabel')}
          </Button>
        </p>
      )
    case 'MI-07':
      return (
        <a href="#qa-cart" className={`${header.link} ${header.cart}`} data-behavior="cart-count">
          <span>{t('cartCount')}</span>
          <span className={header.countSlot}>
            <span data-cart-count="" className={`${header.count} t-num`} hidden />
          </span>
        </a>
      )
    case 'MI-08': {
      const now = new Date()
      return (
        <ReservationCountdown
          locale={locale}
          now={now}
          displayExpiresAt={new Date(now.getTime() + (10 * 60 + 5) * 1000)}
        />
      )
    }
    case 'MI-09':
      return (
        <LeashSandbox preset="thanks" routeKey="qa/MI-09">
          <div data-behavior="thanks-moment sold-stamp" style={{ display: 'grid', gap: 24 }}>
            <span data-leash-anchor="start" />
            <div data-product-id={QA_ID} style={{ display: 'inline-block' }}>
              <PriceTag itemNumber={985} priceCents={3900} locale={locale} stampSlot />
            </div>
            <div className={orderStyles.cocoSpot} data-thanks-coco-spot="">
              <Coco pose="sitzen" size="xxl" data={{ 'data-thanks-coco': '' }} />
              <span
                className={orderStyles.heartAnchor}
                data-leash-anchor="end"
                data-leash-loop="heart"
                aria-hidden="true"
              />
            </div>
          </div>
        </LeashSandbox>
      )
    case 'MI-10':
      return (
        <LeashSandbox preset="journey" routeKey="qa/MI-10">
          <div className="u-container">
            <h2 className={styles.sectionTitle}>
              <Station
                id="planet-claire"
                as="span"
                pose="sitzen"
                loop="orbit"
                className={styles.mark}
              >
                <PlanetMark />
              </Station>{' '}
              Planet Claire
            </h2>
            <div style={{ height: 240 }} />
          </div>
        </LeashSandbox>
      )
    case 'MI-11':
      return (
        <LeashSandbox preset="lost" routeKey="qa/MI-11">
          <NotFoundContent locale={locale} variant="lost" marker={false} />
        </LeashSandbox>
      )
    case 'MI-12':
    case 'MI-13':
    case 'MI-14': {
      const home = await getHomeView(locale).catch(() => null)
      const want: Record<string, readonly string[]> = {
        // P13.1 (U-40): „hallo“ entfiel – Textil trägt jetzt den Stern, Keramik den Planeten
        'MI-12': ['keramik', 'textil'],
        'MI-13': ['zeichnungen'],
        'MI-14': ['tattoo'],
      }
      const stations = (home?.stations ?? []).filter((s) => want[mi]!.includes(s.stationId))
      return (
        <div className="u-container">
          {stations.map((s) => (
            <HomeStation key={s.stationId} station={s} locale={locale} />
          ))}
        </div>
      )
    }
    case 'MI-15':
      return (
        <div className={productStyles.buyBar} data-buy-bar="" hidden>
          <Button variant="primary" type="button">
            {t('demoButton')}
          </Button>
        </div>
      )
    case 'MI-17':
      return (
        <a href="#qa-card" className={cardStyles.card} style={{ width: 240 }} data-qa-hover="">
          <span
            className={cardStyles.photo}
            style={{ height: 200, background: 'var(--paper-2)', border: '1.5px solid var(--ink)' }}
          />
          <span className={cardStyles.title}>{t('demoCard')}</span>
        </a>
      )
    case 'MI-18':
      return (
        <a href="#qa-menu" className={menuStyles.mainLink} data-qa-hover="">
          {t('linkLabel')}
        </a>
      )
    case 'MI-19':
      return (
        <div data-buy-area="" style={{ display: 'grid', gap: 16, justifyItems: 'start' }}>
          <form data-behavior="add-to-cart" data-product-id={QA_ID}>
            <Button variant="primary" type="submit">
              {t('demoButton')}
            </Button>
          </form>
          <p className={productStyles.confirm} data-buy-confirm="" hidden>
            {t('cartCount')}
          </p>
        </div>
      )
    default:
      return null
  }
}

export default async function QaMotionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locale = await requireArtQa(params)
  const sp = await searchParams
  const micro = qaMicro(Array.isArray(sp.mi) ? sp.mi[0] : sp.mi)
  const t = await getTranslations({ locale, namespace: 'qa' })
  return (
    <QaFrame locale={locale} page="motion" wide>
      <nav aria-label={t('miIndex')}>
        <ol className={styles.miList}>
          {QA_MICROS.map((m) => (
            <li key={m.id}>
              <Link
                href={`/${locale}/qa/motion?mi=${m.id}`}
                aria-current={m.id === micro?.id ? 'page' : undefined}
              >
                {m.id} · {m.name}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      {micro ? (
        <section className={styles.section} data-qa-mi={micro.id}>
          <h2 className={styles.sectionTitle}>
            {micro.id} · {micro.name}
          </h2>
          <p className={styles.note}>
            {micro.press ? t('pressHint') : micro.hover ? t('hoverHint') : t('miHint')}
          </p>
          <QaReplay mi={micro.id} label={t('play')} className={styles.stage}>
            <Demo mi={micro.id} locale={locale} />
          </QaReplay>
        </section>
      ) : (
        <p className={styles.note}>{t('miMissing')}</p>
      )}
    </QaFrame>
  )
}
