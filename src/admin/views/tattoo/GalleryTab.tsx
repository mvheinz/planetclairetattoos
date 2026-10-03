import React from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { berlinDateKey, formatBerlin } from '@/lib/time'
import type { Media, PrivateUpload, TattooGallery } from '@/payload-types'

import { StatusBadge } from '../../components/StatusBadge'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { loadPhotos } from '../pieces/PieceEditorView'
import { GalleryEditor, type GalleryFormValues } from './GalleryEditor'
import { GalleryWithdraw } from './GalleryWithdraw'
import { tattooText } from './tattooText'

// Reiter „Galerie“ (PLAN P7.8, KONZEPT §7.12, E-42, R-172): Liste mit Einwilligungs-Häkchen je Foto, „Bearbeiten“ und
// „Einwilligung widerrufen“ (sofort offline, Bilder gesperrt). Das Formular sperrt „Online“ ohne vollständige
// Einwilligung, solange das Foto eine Kundin/einen Kunden zeigt.

const idOf = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

const day = (v: string | null | undefined) => (v ? formatBerlin(new Date(v), 'dd.MM.yyyy') : '')

export async function GalleryTab({
  req,
  adminRoute,
  edit,
}: Pick<AdminViewBodyProps, 'req' | 'adminRoute'> & { edit: string | null }) {
  const tabHref = `${adminRoute}/tattoo?reiter=galerie`

  if (edit) {
    const id = edit === 'neu' ? null : Number(edit)
    let initial: GalleryFormValues
    if (id) {
      const read = (locale: 'de' | 'en') =>
        req.payload.findByID({
          collection: 'tattoo-gallery',
          id,
          locale,
          fallbackLocale: false,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
          req,
        }) as Promise<TattooGallery | null>
      const de = await read('de')
      if (!de) return <p>{tattooText('notFound')}</p>
      const en = await read('en')
      const ids = [idOf(de.image), ...((de.extraImages ?? []) as unknown[]).map(idOf)].filter(
        (v): v is number => v !== null,
      )
      const evidenceId = idOf(de.consentEvidence)
      const evidence = evidenceId
        ? ((await req.payload.findByID({
            collection: 'private-uploads',
            id: evidenceId,
            depth: 0,
            overrideAccess: true,
            disableErrors: true,
            req,
          })) as PrivateUpload | null)
        : null
      initial = {
        id,
        kind: de.kind === 'healed' ? 'healed' : 'fresh',
        healedDurationMonths: de.healedDurationMonths ? String(de.healedDurationMonths) : '',
        healedLabel: { de: de.healedLabel ?? '', en: en?.healedLabel ?? '' },
        caption: { de: de.caption ?? '', en: en?.caption ?? '' },
        placement: { de: de.placement ?? '', en: en?.placement ?? '' },
        showsCustomer: de.showsCustomer !== false,
        consentGiven: de.consentGiven === true,
        consentScope: de.consentScope === 'with_face' ? 'with_face' : 'tattoo_only',
        consentDate: de.consentDate ? berlinDateKey(new Date(de.consentDate)) : '',
        consentNote: de.consentNote ?? '',
        consentEvidence: evidenceId,
        consentEvidenceName: evidence?.filename ?? (evidenceId ? `#${evidenceId}` : null),
        consentWithdrawnAt: de.consentWithdrawnAt ? day(de.consentWithdrawnAt) : null,
        creditHandleAllowed: de.creditHandleAllowed === true,
        creditHandle: de.creditHandle ?? '',
        published: de.published === true,
        featured: de.featured === true,
        photos: await loadPhotos(req.payload, ids),
      }
    } else {
      initial = {
        id: null,
        kind: 'fresh',
        healedDurationMonths: '',
        healedLabel: { de: '', en: '' },
        caption: { de: '', en: '' },
        placement: { de: '', en: '' },
        showsCustomer: true,
        consentGiven: false,
        consentScope: 'tattoo_only',
        consentDate: '',
        consentNote: '',
        consentEvidence: null,
        consentEvidenceName: null,
        consentWithdrawnAt: null,
        creditHandleAllowed: false,
        creditHandle: '',
        published: false,
        featured: false,
        photos: [],
      }
    }
    return <GalleryEditor initial={initial} backHref={tabHref} />
  }

  const entries = (
    await req.payload.find({
      collection: 'tattoo-gallery',
      sort: ['sortOrder', '-id'],
      depth: 1,
      limit: 200,
      locale: 'de',
      overrideAccess: true,
      req,
    })
  ).docs as TattooGallery[]

  return (
    <div className="pc-pieces" data-testid="tattoo-gallery">
      <p className="pc-admin-row">
        <a
          className="pc-admin-btn pc-admin-btn--primary"
          href={`${tabHref}&bearbeiten=neu`}
          data-testid="gallery-new"
        >
          {tattooText('galleryNew')}
        </a>
      </p>
      <p className="pc-piece__hint">{tattooText('galleryHint')}</p>
      {entries.length === 0 ? (
        <p data-testid="gallery-empty">{tattooText('galleryEmpty')}</p>
      ) : (
        <ul className="pc-pieces__list" data-testid="gallery-list">
          {entries.map((g) => {
            const image = typeof g.image === 'object' && g.image ? (g.image as Media) : null
            const thumb = image?.sizes?.thumb?.url ?? image?.url ?? null
            const title = g.caption?.trim() || tattooText('galleryUntitled', { id: g.id })
            const consentOk = !g.showsCustomer || g.consentGiven === true
            return (
              <li
                key={g.id}
                id={`galerie-${g.id}`}
                className="pc-pieces__card"
                data-testid="gallery-card"
                data-id={g.id}
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
                    <a href={`${tabHref}&bearbeiten=${g.id}`} className="pc-admin-link">
                      {title}
                    </a>
                  </h2>
                  <p className="pc-pieces__meta">
                    {ENUM_LABELS.TATTOO_PHOTO_KINDS[g.kind]?.de ?? g.kind}
                    {g.showsCustomer ? '' : ` · ${tattooText('galleryNoCustomer')}`}
                  </p>
                  <p className="pc-pieces__meta" data-testid="gallery-consent">
                    {g.showsCustomer ? (
                      <StatusBadge tone={g.consentGiven ? 'success' : 'warning'}>
                        <span aria-hidden="true">{g.consentGiven ? '✓ ' : '✗ '}</span>
                        {g.consentGiven
                          ? tattooText('galleryConsentYes', { date: day(g.consentDate) })
                          : g.consentWithdrawnAt
                            ? tattooText('galleryConsentWithdrawn', {
                                date: day(g.consentWithdrawnAt),
                              })
                            : tattooText('galleryConsentNo')}
                      </StatusBadge>
                    ) : null}{' '}
                    <StatusBadge tone={g.published && consentOk ? 'success' : 'neutral'}>
                      {g.published ? tattooText('online') : tattooText('offline')}
                    </StatusBadge>
                  </p>
                  {g.showsCustomer && g.consentGiven ? (
                    <GalleryWithdraw id={g.id} title={title} />
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
