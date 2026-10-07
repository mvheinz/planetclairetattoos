import { getTranslations } from 'next-intl/server'
import React from 'react'

import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import type { PublicTourDate } from '@/lib/data/tour'
import type { Locale } from '@/lib/routes/registry'
import { formatBerlin } from '@/lib/time'
import {
  splitTourDates,
  tourDateIso,
  tourDateText,
  tourHoursText,
  tourState,
} from '@/lib/tour/dates'

import styles from './TourDates.module.css'

// „Planet Claire on Tour“ (P12.8, U-20, KONZEPT §3.1a): rechte Spalte der Startseite unter dem Bereich für die
// Vorsitzende (`data-slot="chairwoman"`, ihn füllt P12.6), mobil unter dem Kopf der Seite. Kommende Termine stehen oben,
// vergangene eingeklappt in `<details>` (ohne JavaScript bedienbar); abgesagte Termine sind durchgestrichen und tragen
// zusätzlich den Text „abgesagt“. Adresse und Link sind einfacher Text bzw. Textlink – keine Karte, keine Einbettung,
// keine Anfrage an Dritte. Reines Server-Markup (nicht hydriert); der Zustand folgt dem Datum beim Rendern (ISR ≤ 1 h).

function TourItem({
  item,
  locale,
  now,
  t,
  hero = false,
}: {
  item: PublicTourDate
  locale: Locale
  now: Date
  t: Awaited<ReturnType<typeof getTranslations>>
  hero?: boolean
}) {
  const state = tourState(item, now)
  const hours = tourHoursText(item.timeFrom, item.timeTo, locale)
  const place = [item.place, item.address].filter(Boolean).join(' · ')
  const start = new Date(item.startsAt)
  const month = formatBerlin(start, 'MMM', locale).replace(/\.$/, '')
  const day = formatBerlin(start, 'd', locale)
  return (
    <li
      className={`${styles.item} ${hero ? styles.hero : ''}`}
      data-tour-date={item.id}
      data-tour-state={state}
      data-cancelled={state === 'cancelled' ? '' : undefined}
      data-tour-next={hero ? '' : undefined}
    >
      <span className={styles.pin} aria-hidden="true" />
      {hero ? <span className={styles.next}>{t('next')}</span> : null}
      <div className={`${styles.dateBlock} ${styles.struck}`} aria-hidden="true">
        <span className={styles.day}>{day}</span>
        <span className={styles.month}>{month}</span>
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>
          <span className={styles.struck}>{item.name}</span>
          {state === 'cancelled' ? (
            <span className={styles.badge} data-tour-badge="cancelled">
              {t('cancelled')}
            </span>
          ) : state === 'running' ? (
            <span className={styles.badge} data-tour-badge="running">
              {t('running')}
            </span>
          ) : null}
        </h3>
        <p className={`${styles.when} ${styles.struck}`}>
          <time dateTime={tourDateIso(item)}>{tourDateText(item, locale)}</time>
          {hours ? (
            <>
              {' · '}
              <span className={styles.nowrap}>{hours}</span>
            </>
          ) : null}
        </p>
        <p className={`${styles.where} ${styles.struck}`}>
          {place}
          {item.standNumber ? <span> · {t('stand', { number: item.standNumber })}</span> : null}
        </p>
        {item.note ? <p className={`${styles.note} ${styles.struck}`}>{item.note}</p> : null}
        {item.link ? (
          <p className={styles.link}>
            <a
              href={item.link}
              rel="noopener noreferrer"
              aria-label={t('linkLabel', { name: item.name })}
              data-tour-link=""
            >
              {t('link')}
            </a>
          </p>
        ) : null}
      </div>
      {item.image ? (
        <ResponsiveImage
          media={{ ...item.image, alt: item.image.alt || t('photoAlt', { name: item.name }) }}
          aspectRatio="4 / 3"
          sizes={hero ? '(min-width: 1100px) 20rem, 90vw' : '8rem'}
          srcSizes={['thumb', 'card']}
          className={styles.photo}
        />
      ) : null}
    </li>
  )
}

export async function TourDates({
  items,
  locale,
  now,
}: {
  items: PublicTourDate[]
  locale: Locale
  now: Date
}) {
  const t = await getTranslations({ locale, namespace: 'home.tour' })
  const { upcoming, past } = splitTourDates(items, now)
  return (
    <section className={styles.tour} aria-labelledby="tour-heading" data-tour="">
      <h2 id="tour-heading" className={styles.heading}>
        {t('heading')}
      </h2>
      <div className={styles.board}>
        <p className={styles.intro}>{t('intro')}</p>
        <h3 className={styles.sub}>{t('upcomingHeading')}</h3>
        {upcoming.length > 0 ? (
          <ol className={styles.list} data-tour-upcoming="">
            {upcoming.map((item, i) => (
              <TourItem key={item.id} item={item} locale={locale} now={now} t={t} hero={i === 0} />
            ))}
          </ol>
        ) : (
          <p className={styles.empty} data-tour-empty="">
            {t('empty')}
          </p>
        )}
        {past.length > 0 ? (
          <details className={styles.past} data-tour-past="">
            <summary className={styles.summary}>{t('pastSummary', { count: past.length })}</summary>
            <ol className={styles.list}>
              {past.map((item) => (
                <TourItem key={item.id} item={item} locale={locale} now={now} t={t} />
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </section>
  )
}
