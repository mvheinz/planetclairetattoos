import React from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { requestNow } from '@/lib/payload/context'
import { formatFlashNumber } from '@/lib/tattoo/flash'
import {
  offerDateBadge,
  offerInputFromTimes,
  offerState,
  offerTimeParts,
} from '@/lib/tattoo/offers'
import { translationAvailability } from '@/lib/translation'
import type { Flash, TattooOffer } from '@/payload-types'

import { StatusBadge, type StatusTone } from '../../components/StatusBadge'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { loadPhotos } from '../pieces/PieceEditorView'
import { OfferEditor, type OfferFormValues } from './OfferEditor'
import { tattooText } from './tattooText'

// Reiter „Angebote“ (PLAN P7.7, KONZEPT §7.12, DATENMODELL §6.15): Liste mit abgeleitetem Zustand kommt/läuft/abgelaufen
// (abgelaufen grau, kein gespeicherter Status) und „Neues Angebot“/„Bearbeiten“.

const STATE_TONE = {
  upcoming: 'info',
  running: 'success',
  ended: 'neutral',
} as const satisfies Record<string, StatusTone>
const STATE_LABEL = {
  upcoming: 'offerUpcoming',
  running: 'offerRunning',
  ended: 'offerEnded',
} as const

const idOf = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export async function OffersTab({
  req,
  adminRoute,
  edit,
}: Pick<AdminViewBodyProps, 'req' | 'adminRoute'> & { edit: string | null }) {
  const tabHref = `${adminRoute}/tattoo?reiter=angebote`
  const now = requestNow(req)

  if (edit) {
    const id = edit === 'neu' ? null : Number(edit)
    const flashes = (
      await req.payload.find({
        collection: 'flash',
        sort: ['-number'],
        depth: 0,
        limit: 300,
        locale: 'de',
        overrideAccess: true,
        req,
      })
    ).docs as Flash[]
    const availability = translationAvailability()
    let initial: OfferFormValues
    if (id) {
      const read = (locale: 'de' | 'en') =>
        req.payload.findByID({
          collection: 'tattoo-offers',
          id,
          locale,
          fallbackLocale: false,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
          req,
        }) as Promise<TattooOffer | null>
      const de = await read('de')
      if (!de) return <p>{tattooText('notFound')}</p>
      const en = await read('en')
      const imageId = idOf(de.image)
      initial = {
        id,
        type: de.type === 'aktion' ? 'aktion' : 'flash_day',
        title: { de: de.title ?? '', en: en?.title ?? '' },
        description: { de: de.description ?? '', en: en?.description ?? '' },
        ...offerInputFromTimes(de),
        locationNote: { de: de.locationNote ?? '', en: en?.locationNote ?? '' },
        priceNote: { de: de.priceNote ?? '', en: en?.priceNote ?? '' },
        flashes: ((de.flashes ?? []) as unknown[]).map(idOf).filter((v): v is number => v !== null),
        published: de.published !== false,
        photos: imageId ? await loadPhotos(req.payload, [imageId]) : [],
      }
    } else {
      initial = {
        id: null,
        type: 'flash_day',
        title: { de: '', en: '' },
        description: { de: '', en: '' },
        startDate: '',
        endDate: '',
        startTime: '',
        endTime: '',
        locationNote: { de: '', en: '' },
        priceNote: { de: '', en: '' },
        flashes: [],
        published: true,
        photos: [],
      }
    }
    return (
      <OfferEditor
        initial={initial}
        backHref={tabHref}
        flashOptions={flashes.map((f) => ({
          id: f.id,
          label: `${formatFlashNumber(f.number ?? 0)} ${f.title}`,
        }))}
        translateDisabled={availability.enabled ? null : (availability.reason ?? null)}
      />
    )
  }

  const offers = (
    await req.payload.find({
      collection: 'tattoo-offers',
      sort: ['-startsAt'],
      depth: 0,
      limit: 200,
      locale: 'de',
      overrideAccess: true,
      req,
    })
  ).docs as TattooOffer[]

  return (
    <div className="pc-pieces" data-testid="tattoo-offers">
      <p className="pc-admin-row">
        <a
          className="pc-admin-btn pc-admin-btn--primary"
          href={`${tabHref}&bearbeiten=neu`}
          data-testid="offer-new"
        >
          {tattooText('offerNew')}
        </a>
      </p>
      <p className="pc-piece__hint">{tattooText('offerHint')}</p>
      {offers.length === 0 ? (
        <p data-testid="offer-empty">{tattooText('offerEmpty')}</p>
      ) : (
        <ul className="pc-pieces__list" data-testid="offer-list">
          {offers.map((o) => {
            const state = offerState(o, now)
            const time = offerTimeParts(o, 'de')
            return (
              <li
                key={o.id}
                className={`pc-pieces__card pc-tattoo__card--nophoto${state === 'ended' ? ' pc-tattoo__card--ended' : ''}`}
                data-testid="offer-card"
                data-state={state}
                data-id={o.id}
              >
                <div className="pc-pieces__body">
                  <h2 className="pc-pieces__title">
                    <a href={`${tabHref}&bearbeiten=${o.id}`} className="pc-admin-link">
                      {o.title}
                    </a>
                  </h2>
                  <p className="pc-pieces__meta">
                    {ENUM_LABELS.TATTOO_OFFER_TYPES[o.type]?.de ?? o.type} ·{' '}
                    {offerDateBadge(o, 'de')}
                    {time ? ` · ${tattooText('offerTime', { from: time.from, to: time.to })}` : ''}
                  </p>
                  <p className="pc-pieces__meta">
                    <StatusBadge tone={STATE_TONE[state]}>
                      {tattooText(STATE_LABEL[state])}
                    </StatusBadge>
                    {o.published === false ? (
                      <>
                        {' '}
                        <StatusBadge tone="neutral">{tattooText('offline')}</StatusBadge>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
