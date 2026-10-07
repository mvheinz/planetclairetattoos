import React from 'react'

import { getEnv } from '@/lib/env'
import { localizedPath } from '@/lib/routes/paths'
import { translationAvailability } from '@/lib/translation'
import { splitTourDates, tourDateText, tourHoursText, tourInputFromRange } from '@/lib/tour/dates'
import { systemClock } from '@/lib/time'
import type { TourDate } from '@/payload-types'

import { StatusBadge } from '../../components/StatusBadge'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { loadPhotos } from '../pieces/PieceEditorView'
import { TourCardActions } from './TourCardActions'
import { TourEditor, type TourFormValues } from './TourEditor'
import { tattooText } from './tattooText'

// Reiter „Termine“ (P12.8, U-20, KONZEPT §7.12): Liste „Planet Claire on Tour“ – kommende Termine oben, vergangene
// darunter –, „Neuer Termin“, „Absagen“/„Wieder geplant“, „Offline nehmen“ und „Bearbeiten“. Funktioniert mobil: Karten
// untereinander, Knöpfe ≥ 44 px.

const idOf = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export async function TourTab({
  req,
  adminRoute,
  edit,
}: Pick<AdminViewBodyProps, 'req' | 'adminRoute'> & { edit: string | null }) {
  const tabHref = `${adminRoute}/tattoo?reiter=termine`
  const availability = translationAvailability()
  const translateDisabled = availability.enabled ? null : (availability.reason ?? null)

  if (edit) {
    const id = edit === 'neu' ? null : Number(edit)
    let initial: TourFormValues
    if (id) {
      const read = (locale: 'de' | 'en') =>
        req.payload.findByID({
          collection: 'tour-dates',
          id,
          locale,
          fallbackLocale: false,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
          req,
        }) as Promise<TourDate | null>
      const de = await read('de')
      if (!de) return <p>{tattooText('notFound')}</p>
      const en = await read('en')
      const imageId = idOf(de.image)
      const range = tourInputFromRange({ startsAt: de.startsAt, endsAt: de.endsAt ?? de.startsAt })
      initial = {
        id,
        name: { de: de.name ?? '', en: en?.name ?? '' },
        place: { de: de.place ?? '', en: en?.place ?? '' },
        note: { de: de.note ?? '', en: en?.note ?? '' },
        startDate: range.startDate,
        endDate: range.endDate === range.startDate ? '' : range.endDate,
        timeFrom: de.timeFrom ?? '',
        timeTo: de.timeTo ?? '',
        address: de.address ?? '',
        link: de.link ?? '',
        standNumber: de.standNumber ?? '',
        status: de.status,
        published: de.published !== false,
        photos: imageId ? await loadPhotos(req.payload, [imageId]) : [],
      }
    } else {
      initial = {
        id: null,
        name: { de: '', en: '' },
        place: { de: '', en: '' },
        note: { de: '', en: '' },
        startDate: '',
        endDate: '',
        timeFrom: '',
        timeTo: '',
        address: '',
        link: '',
        standNumber: '',
        status: 'planned',
        published: true,
        photos: [],
      }
    }
    return <TourEditor initial={initial} backHref={tabHref} translateDisabled={translateDisabled} />
  }

  const result = await req.payload.find({
    collection: 'tour-dates',
    sort: ['startsAt'],
    depth: 0,
    limit: 300,
    pagination: false,
    locale: 'de',
    overrideAccess: true,
    req,
  })
  const docs = result.docs as TourDate[]
  const now = systemClock.now()
  const items = docs.map((d) => ({ ...d, endsAt: d.endsAt ?? d.startsAt }))
  const { upcoming, past } = splitTourDates(items, now, 200)
  const site = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const publicUrl = `${site}${localizedPath('R01', 'de')}`

  const card = (d: (typeof items)[number], over: boolean) => {
    const hours = tourHoursText(d.timeFrom, d.timeTo, 'de')
    const label =
      d.status === 'cancelled'
        ? 'tourStatusCancelled'
        : over
          ? 'tourStatusPast'
          : 'tourStatusPlanned'
    return (
      <li
        key={d.id}
        className="pc-pieces__card"
        data-testid="tour-card"
        data-status={d.status}
        data-over={over ? '' : undefined}
      >
        <div className="pc-pieces__body">
          <h3 className="pc-pieces__title">
            <a
              href={`${tabHref}&bearbeiten=${d.id}`}
              className="pc-admin-link"
              data-testid="tour-edit"
            >
              {d.name}
            </a>
          </h3>
          <p className="pc-pieces__meta">
            {tourDateText(d, 'de')}
            {hours ? ` · ${hours}` : ''} · {d.place}
          </p>
          <p className="pc-pieces__meta">
            <StatusBadge tone={d.status === 'cancelled' ? 'warning' : over ? 'neutral' : 'success'}>
              {tattooText(label)}
            </StatusBadge>{' '}
            {d.published === false ? (
              <StatusBadge tone="neutral">{tattooText('offline')}</StatusBadge>
            ) : null}
          </p>
          <TourCardActions
            id={d.id}
            name={d.name}
            status={d.status}
            published={d.published !== false}
            over={over}
          />
        </div>
      </li>
    )
  }

  return (
    <div className="pc-pieces" data-testid="tattoo-tour">
      <p className="pc-admin-row">
        <a
          className="pc-admin-btn pc-admin-btn--primary"
          href={`${tabHref}&bearbeiten=neu`}
          data-testid="tour-new"
        >
          {tattooText('tourNew')}
        </a>
        <a className="pc-admin-btn pc-admin-btn--secondary" href={publicUrl}>
          {tattooText('tourPublic')}
        </a>
      </p>
      <p className="pc-piece__hint">{tattooText('tourHint')}</p>
      {items.length === 0 ? (
        <p data-testid="tour-empty">{tattooText('tourEmpty')}</p>
      ) : (
        <>
          <h2 className="pc-piece__heading">{tattooText('tourUpcoming')}</h2>
          {upcoming.length === 0 ? (
            <p>{tattooText('tourEmpty')}</p>
          ) : (
            <ul className="pc-pieces__list" data-testid="tour-list">
              {upcoming.map((d) => card(d, false))}
            </ul>
          )}
          {past.length > 0 ? (
            <>
              <h2 className="pc-piece__heading">{tattooText('tourPast')}</h2>
              <ul className="pc-pieces__list" data-testid="tour-list-past">
                {past.map((d) => card(d, true))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
