import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import React from 'react'

import { STATION_ART } from '@/art/stations'
import { KnotArt, LeashEndArt } from '@/components/errors/ErrorArt'
import { PlanetMark, StarMark } from '@/components/home/SpaceMarks'
import { loadPublicProductSlugs } from '@/lib/data/products'
import { loadPlaceholderSvgs, loadStationSources } from '@/lib/qa/artSources'
import { productPath } from '@/lib/shop/format'

import { requireArtQa } from '../guard'
import { QaFrame } from '../QaFrame'
import styles from '../qa.module.css'

// `/{locale}/qa/art` (KUNST-QA §3.2, SC-13): Stationszeichnungen neben ihrer Quelle im gleichen Maßstab (gleiche
// Breite), Platzhalter, Weltraum-Motive und Fehlerseiten-Zeichnungen, Wortmarke, Favicon 16/32/180 px, OG-Bilder.

async function productOgImage(pagePath: string): Promise<string | null> {
  const h = await headers()
  const host = h.get('host')
  if (!host) return null
  const proto = h.get('x-forwarded-proto') ?? 'http'
  try {
    const html = await (await fetch(`${proto}://${host}${pagePath}`, { cache: 'no-store' })).text()
    const url = /property="og:image" content="([^"]+)"/.exec(html)?.[1]
    return url
      ? new URL(url.replaceAll('&amp;', '&')).pathname +
          new URL(url.replaceAll('&amp;', '&')).search
      : null
  } catch {
    return null
  }
}

const inlineSvg = (svg: string) =>
  svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" ')

export default async function QaArtPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await requireArtQa(params)
  const t = await getTranslations({ locale, namespace: 'qa' })
  const [sources, placeholders, wordmark, planet, products] = await Promise.all([
    loadStationSources(),
    loadPlaceholderSvgs(),
    readFile(path.join(process.cwd(), 'public', 'art', 'wordmark.svg'), 'utf8'),
    readFile(path.join(process.cwd(), 'src', 'art', 'planet.svg'), 'utf8'),
    loadPublicProductSlugs().catch(() => []),
  ])
  const sample = products[0]
  // OG-Bild der Produktseite: Adresse wie in deren Metadaten (Next hängt eine Kennung an) – vom eigenen Server gelesen.
  const productOg = sample ? await productOgImage(productPath(sample, locale)) : null
  const stationIds = [...new Set([...Object.keys(STATION_ART), ...sources.map((s) => s.id)])]

  return (
    <QaFrame locale={locale} page="art" wide>
      <section className={styles.section} data-qa-section="stations">
        <h2 className={styles.sectionTitle}>{t('stations')}</h2>
        <div className={styles.pairs}>
          {stationIds.map((id) => {
            const src = sources.find((s) => s.id === id)
            const art = STATION_ART[id]
            return (
              <figure key={id} className={styles.pair} data-qa-station={id}>
                <div>
                  {src?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Daten-URI des Quell-Ausschnitts
                    <img src={src.image} alt="" />
                  ) : (
                    <p>{src ? t('derived', { from: src.from }) : '–'}</p>
                  )}
                </div>
                <div
                  className={styles.art}
                  dangerouslySetInnerHTML={{ __html: art ? inlineSvg(art) : '' }}
                />
                <figcaption>
                  {id} · {t('source')}: {src?.from ?? '–'}
                </figcaption>
              </figure>
            )
          })}
        </div>
      </section>

      <section className={styles.section} data-qa-section="placeholders">
        <h2 className={styles.sectionTitle}>{t('placeholders')}</h2>
        <div className={styles.thumbs}>
          {placeholders.map((p) => (
            <figure key={p.id} data-qa-placeholder={p.id}>
              <div dangerouslySetInnerHTML={{ __html: inlineSvg(p.svg) }} />
              <figcaption>{p.id}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={styles.section} data-qa-section="space">
        <h2 className={styles.sectionTitle}>{t('space')}</h2>
        <div className={styles.row}>
          <figure>
            <PlanetMark className={styles.mark} />
            <figcaption>PlanetMark</figcaption>
          </figure>
          <figure>
            <StarMark className={styles.mark} />
            <figcaption>StarMark</figcaption>
          </figure>
          <figure>
            <div className={styles.mark} dangerouslySetInnerHTML={{ __html: inlineSvg(planet) }} />
            <figcaption>planet.svg</figcaption>
          </figure>
          <figure style={{ width: 240 }}>
            <KnotArt />
            <figcaption>500</figcaption>
          </figure>
          <figure style={{ width: 200 }}>
            <LeashEndArt />
            <figcaption>404</figcaption>
          </figure>
        </div>
      </section>

      <section className={styles.section} data-qa-section="wordmark">
        <h2 className={styles.sectionTitle}>{t('wordmark')}</h2>
        <div
          className={styles.wordmark}
          dangerouslySetInnerHTML={{ __html: inlineSvg(wordmark) }}
        />
      </section>

      <section className={styles.section} data-qa-section="favicon">
        <h2 className={styles.sectionTitle}>{t('favicon')}</h2>
        <div className={styles.row}>
          {[16, 32].map((px) => (
            <figure key={px}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Favicon in Originalgröße */}
              <img src="/icon.svg" width={px} height={px} alt="" />
              <figcaption>{px}</figcaption>
            </figure>
          ))}
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- Apple-Icon in Originalgröße */}
            <img src="/apple-icon.png" width={180} height={180} alt="" />
            <figcaption>180</figcaption>
          </figure>
        </div>
      </section>

      <section className={styles.section} data-qa-section="og">
        <h2 className={styles.sectionTitle}>{t('og')}</h2>
        <div
          className={styles.thumbs}
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))' }}
        >
          {[`/${locale}/og-image.png`, '/og/default.png', productOg].flatMap((src) =>
            src ? (
              <figure key={src}>
                {/* eslint-disable-next-line @next/next/no-img-element -- OG-Bild 1200×630 */}
                <img src={src} width={1200} height={630} alt="" />
                <figcaption>{src}</figcaption>
              </figure>
            ) : (
              []
            ),
          )}
        </div>
      </section>
    </QaFrame>
  )
}
