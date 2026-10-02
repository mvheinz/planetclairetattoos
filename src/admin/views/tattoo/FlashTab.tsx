import React from 'react'

import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { getEnv } from '@/lib/env'
import { localizedPath } from '@/lib/routes/paths'
import { suggestFlashNumber } from '@/lib/tattoo/admin'
import { formatFlashNumber } from '@/lib/tattoo/flash'
import { translationAvailability } from '@/lib/translation'
import type { Flash, Media } from '@/payload-types'

import { StatusBadge } from '../../components/StatusBadge'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { loadPhotos } from '../pieces/PieceEditorView'
import { FlashCardActions } from './FlashCardActions'
import { FlashEditor, type FlashFormValues } from './FlashEditor'
import { tattooText } from './tattooText'

// Reiter „Flash“ (PLAN P7.6, KONZEPT §7.12): Liste aller Motive mit Status-Chip („verfügbar ↔ vergeben“ in zwei Taps:
// Chip antippen, bestätigen), „Offline nehmen“ und „Bearbeiten“; „Neuer Flash“ öffnet das Formular mit
// Nummernvorschlag (höchste Nicht-Seed-Nummer + 1).

const idOf = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export async function FlashTab({
  req,
  adminRoute,
  edit,
}: Pick<AdminViewBodyProps, 'req' | 'adminRoute'> & { edit: string | null }) {
  const tabHref = `${adminRoute}/tattoo?reiter=flash`
  const availability = translationAvailability()
  const translateDisabled = availability.enabled ? null : (availability.reason ?? null)

  if (edit) {
    const id = edit === 'neu' ? null : Number(edit)
    let initial: FlashFormValues
    if (id) {
      const read = (locale: 'de' | 'en') =>
        req.payload.findByID({
          collection: 'flash',
          id,
          locale,
          fallbackLocale: false,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
          req,
        }) as Promise<Flash | null>
      const de = await read('de')
      if (!de) return <p>{tattooText('notFound')}</p>
      const en = await read('en')
      const ids = [idOf(de.image), ...((de.extraImages ?? []) as unknown[]).map(idOf)].filter(
        (v): v is number => v !== null,
      )
      initial = {
        id,
        number: String(de.number ?? ''),
        title: { de: de.title ?? '', en: en?.title ?? '' },
        sizeCm: de.sizeCm ? String(de.sizeCm).replace('.', ',') : '',
        sizeNote: { de: de.sizeNote ?? '', en: en?.sizeNote ?? '' },
        price: de.priceCents ? (de.priceCents / 100).toFixed(2).replace('.', ',') : '',
        repeatable: de.repeatable === true,
        published: de.published !== false,
        photos: await loadPhotos(req.payload, ids),
      }
    } else {
      initial = {
        id: null,
        number: String(await suggestFlashNumber(req)),
        title: { de: '', en: '' },
        sizeCm: '',
        sizeNote: { de: '', en: '' },
        price: '',
        repeatable: false,
        published: true,
        photos: [],
      }
    }
    return (
      <FlashEditor initial={initial} backHref={tabHref} translateDisabled={translateDisabled} />
    )
  }

  const result = await req.payload.find({
    collection: 'flash',
    sort: ['-number'],
    depth: 1,
    limit: 200,
    locale: 'de',
    overrideAccess: true,
    req,
  })
  const flashes = result.docs as Flash[]
  const site = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const publicUrl = `${site}${localizedPath('R12', 'de')}`

  return (
    <div className="pc-pieces" data-testid="tattoo-flash">
      <p className="pc-admin-row">
        <a
          className="pc-admin-btn pc-admin-btn--primary"
          href={`${tabHref}&bearbeiten=neu`}
          data-testid="flash-new"
        >
          {tattooText('flashNew')}
        </a>
        <a className="pc-admin-btn pc-admin-btn--secondary" href={publicUrl}>
          {tattooText('flashPublic')}
        </a>
      </p>
      <p className="pc-piece__hint">{tattooText('flashHint')}</p>
      {flashes.length === 0 ? (
        <p data-testid="flash-empty">{tattooText('flashEmpty')}</p>
      ) : (
        <ul className="pc-pieces__list" data-testid="flash-list">
          {flashes.map((f) => {
            const image = typeof f.image === 'object' && f.image ? (f.image as Media) : null
            const thumb = image?.sizes?.thumb?.url ?? image?.url ?? null
            const nr = formatFlashNumber(f.number ?? 0)
            return (
              <li
                key={f.id}
                className="pc-pieces__card"
                data-testid="flash-card"
                data-number={f.number}
                data-status={f.status}
              >
                <div className="pc-pieces__photo">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Vorschau aus der eigenen Medien-API
                    <img src={thumb} alt="" width={80} height={100} loading="lazy" />
                  ) : (
                    <span className="pc-pieces__nophoto">{tattooText('noPhoto')}</span>
                  )}
                </div>
                <div className="pc-pieces__body">
                  <h2 className="pc-pieces__title">
                    <a
                      href={`${tabHref}&bearbeiten=${f.id}`}
                      className="pc-admin-link"
                      data-testid="flash-edit"
                    >
                      <span className="pc-pieces__nr">{nr}</span> {f.title}
                    </a>
                  </h2>
                  <p className="pc-pieces__meta">
                    <MoneyAmount cents={f.priceCents} locale="de" /> ·{' '}
                    {tattooText('flashSize', {
                      size: String(f.sizeCm).replace('.', ','),
                    })}
                    {f.repeatable ? ` · ${tattooText('flashRepeatable')}` : ''}
                  </p>
                  {f.published === false ? (
                    <p className="pc-pieces__meta">
                      <StatusBadge tone="neutral">{tattooText('offline')}</StatusBadge>
                    </p>
                  ) : null}
                  <FlashCardActions
                    id={f.id}
                    nr={nr}
                    status={f.status === 'claimed' ? 'claimed' : 'available'}
                    published={f.published !== false}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
