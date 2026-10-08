import { getTranslations } from 'next-intl/server'
import React from 'react'

import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import type { PublicTourDate } from '@/lib/data/tour'
import type { Locale } from '@/lib/routes/registry'
import { formatBerlin } from '@/lib/time'
import {
  isTourMultiDay,
  splitTourDates,
  tourDateIso,
  tourDateText,
  tourHoursText,
  tourState,
} from '@/lib/tour/dates'

import styles from './TourDates.module.css'

// „Planet Claire on Tour“ (P12.8 U-20, P13.3 U-42, KONZEPT §3.1a): schmaler, kompakter Schaukasten oben rechts auf der
// Startseite direkt neben Koko (mobil darunter). Auf der Tafel stehen nur die nächsten drei Termine als kleine Zettel
// (Datumsblock · Name · eine Zeile Ort und Uhrzeit), der erste mit Reiter „als Nächstes“. Alle weiteren kommenden und die
// vergangenen Termine liegen ausführlich (Uhrzeit, Ort, Stand, Notiz, Link, Foto) in einem `<details>` darunter (ohne
// JavaScript bedienbar). Abgesagte Termine sind durchgestrichen und tragen zusätzlich den Text „abgesagt“. Adresse und
// Link sind einfacher Text bzw. Textlink – keine Karte, keine Einbettung, keine Anfrage an Dritte. Reines Server-Markup
// (nicht hydriert); der Zustand folgt dem Datum beim Rendern (ISR ≤ 1 h).

/** So viele kommende Termine stehen direkt auf der Tafel (U-42: „nächste 2–3“). */
export const TOUR_ON_BOARD = 3

type T = Awaited<ReturnType<typeof getTranslations>>

/** Kurzer Tag für den Datumsblock: „14“ bzw. mehrtägig im selben Monat „14–16“. */
function dayLabel(item: PublicTourDate, locale: Locale): string {
  const start = new Date(item.startsAt)
  const day = formatBerlin(start, 'd', locale)
  if (!isTourMultiDay(item)) return day
  const end = new Date(new Date(item.endsAt).getTime() - 1)
  return formatBerlin(start, 'yyyy-MM') === formatBerlin(end, 'yyyy-MM')
    ? `${day}–${formatBerlin(end, 'd', locale)}`
    : day
}

function Badge({ state, t }: { state: ReturnType<typeof tourState>; t: T }) {
  if (state === 'cancelled')
    return (
      <span className={styles.badge} data-tour-badge="cancelled">
        {t('cancelled')}
      </span>
    )
  if (state === 'running')
    return (
      <span className={styles.badge} data-tour-badge="running">
        {t('running')}
      </span>
    )
  return null
}

function DateBlock({ item, locale }: { item: PublicTourDate; locale: Locale }) {
  const label = dayLabel(item, locale)
  const month = formatBerlin(new Date(item.startsAt), 'MMM', locale).replace(/\.$/, '')
  return (
    <div className={`${styles.dateBlock} ${styles.struck}`} aria-hidden="true" data-badge="">
      <span className={`${styles.day} ${label.length > 2 ? styles.dayRange : ''}`}>{label}</span>
      <span className={styles.month}>{month}</span>
    </div>
  )
}

/** Zettel auf der Tafel: Datumsblock, Name, eine Zeile (Ort · Uhrzeit); das volle Datum für Screenreader. */
function BoardItem({
  item,
  locale,
  now,
  t,
  next,
}: {
  item: PublicTourDate
  locale: Locale
  now: Date
  t: T
  next: boolean
}) {
  const state = tourState(item, now)
  const hours = tourHoursText(item.timeFrom, item.timeTo, locale)
  return (
    <li
      className={`${styles.item} ${next ? styles.next : ''}`}
      data-tour-date={item.id}
      data-tour-state={state}
      data-cancelled={state === 'cancelled' ? '' : undefined}
      data-tour-next={next ? '' : undefined}
    >
      <span className={styles.pin} aria-hidden="true" />
      {next ? <span className={styles.nextTab}>{t('next')}</span> : null}
      <DateBlock item={item} locale={locale} />
      <div className={styles.body}>
        <h3 className={styles.name}>
          <span className={styles.struck}>{item.name}</span>
          <Badge state={state} t={t} />
        </h3>
        <p className={`${styles.line} ${styles.struck}`}>
          <time className="u-sr-only" dateTime={tourDateIso(item)}>
            {tourDateText(item, locale)},{' '}
          </time>
          {item.place}
          {hours ? (
            <>
              {' · '}
              <span className={styles.nowrap}>{hours}</span>
            </>
          ) : null}
        </p>
      </div>
    </li>
  )
}

/** Ausführlicher Eintrag im aufklappbaren Teil (weitere und vergangene Termine). */
function FullItem({
  item,
  locale,
  now,
  t,
}: {
  item: PublicTourDate
  locale: Locale
  now: Date
  t: T
}) {
  const state = tourState(item, now)
  const hours = tourHoursText(item.timeFrom, item.timeTo, locale)
  const place = [item.place, item.address].filter(Boolean).join(' · ')
  return (
    <li
      className={`${styles.item} ${styles.full}`}
      data-tour-date={item.id}
      data-tour-state={state}
      data-cancelled={state === 'cancelled' ? '' : undefined}
    >
      <DateBlock item={item} locale={locale} />
      <div className={styles.body}>
        <h4 className={styles.name}>
          <span className={styles.struck}>{item.name}</span>
          <Badge state={state} t={t} />
        </h4>
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
          sizes="(min-width: 1100px) 14rem, 90vw"
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
  const onBoard = upcoming.slice(0, TOUR_ON_BOARD)
  const later = upcoming.slice(TOUR_ON_BOARD)
  const more = later.length + past.length
  const summary =
    later.length > 0 && past.length > 0
      ? t('moreSummary', { count: more })
      : later.length > 0
        ? t('laterSummary', { count: more })
        : t('pastSummary', { count: more })
  return (
    <section className={styles.tour} aria-labelledby="tour-heading" data-tour="">
      <h2 id="tour-heading" className={styles.heading}>
        {t('heading')}
      </h2>
      <div className={styles.board}>
        {onBoard.length > 0 ? (
          <ol className={styles.list} data-tour-upcoming="">
            {onBoard.map((item, i) => (
              <BoardItem key={item.id} item={item} locale={locale} now={now} t={t} next={i === 0} />
            ))}
          </ol>
        ) : (
          <p className={styles.empty} data-tour-empty="">
            {t('empty')}
          </p>
        )}
        {more > 0 ? (
          <details className={styles.more} data-tour-more="">
            <summary className={styles.summary}>{summary}</summary>
            <div className={styles.moreBody}>
              <p className={styles.intro}>{t('intro')}</p>
              {later.length > 0 ? (
                <>
                  <h3 className={styles.sub}>{t('laterHeading')}</h3>
                  <ol className={styles.list} data-tour-later="">
                    {later.map((item) => (
                      <FullItem key={item.id} item={item} locale={locale} now={now} t={t} />
                    ))}
                  </ol>
                </>
              ) : null}
              {past.length > 0 ? (
                <>
                  <h3 className={styles.sub}>{t('pastHeading')}</h3>
                  <ol className={`${styles.list} ${styles.past}`} data-tour-past="">
                    {past.map((item) => (
                      <FullItem key={item.id} item={item} locale={locale} now={now} t={t} />
                    ))}
                  </ol>
                </>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  )
}
