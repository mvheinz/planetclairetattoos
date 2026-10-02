import React from 'react'

import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { ENUM_LABELS } from '@/lib/enumLabels'
import { PRODUCT_CATEGORIES, PRODUCT_STATUSES, type ProductStatus } from '@/lib/enums'
import { getEnv } from '@/lib/env'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { productPath } from '@/lib/shop/format'

import { StatusBadge, type StatusTone } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { PieceCardActions } from './PieceCardActions'
import { parsePiecesQuery, queryPieces, type PiecesQuery } from './piecesQuery'

// Ansicht „Meine Stücke“ `/stuecke` (PLAN P5.8, KONZEPT §7.5): Suche (Nummer exakt, Titel enthält), Filter Status und
// Kategorie als einfaches GET-Formular (funktioniert ohne JavaScript), Karten mit Foto, `Nr. 017`, Titel, Preis,
// Status und den Knöpfen je Status (Client-Komponente `PieceCardActions`), seitenweise 20.

const STATUS_TONE: Record<ProductStatus, StatusTone> = {
  draft: 'neutral',
  available: 'success',
  reserved: 'warning',
  sold: 'info',
  archived: 'neutral',
}

function pageHref(adminRoute: string, query: PiecesQuery, page: number): string {
  const q = new URLSearchParams()
  if (query.q) q.set('q', query.q)
  if (query.status) q.set('status', query.status)
  if (query.category) q.set('category', query.category)
  if (page > 1) q.set('page', String(page))
  const s = q.toString()
  return `${adminRoute}/stuecke${s ? `?${s}` : ''}`
}

export async function PiecesListView({ adminRoute, req, searchParams }: AdminViewBodyProps) {
  const query = parsePiecesQuery(searchParams)
  const result = await queryPieces(req, query)
  const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')

  return (
    <div className="pc-pieces">
      <p className="pc-admin-row">
        <a className="pc-admin-btn pc-admin-btn--primary" href={`${adminRoute}/neues-stueck`}>
          {adminText('shellNewPiece')}
        </a>
      </p>
      <form
        method="get"
        action={`${adminRoute}/stuecke`}
        className="pc-pieces__filter"
        role="search"
      >
        <div className="pc-field">
          <label htmlFor="pieces-q" className="pc-field__label">
            {adminText('piecesSearch')}
          </label>
          <input
            id="pieces-q"
            name="q"
            type="search"
            defaultValue={query.q}
            autoComplete="off"
            aria-describedby="pieces-q-hint"
          />
          <p id="pieces-q-hint" className="pc-piece__hint">
            {adminText('piecesSearchHint')}
          </p>
        </div>
        <div className="pc-field">
          <label htmlFor="pieces-status" className="pc-field__label">
            {adminText('piecesStatus')}
          </label>
          <select id="pieces-status" name="status" defaultValue={query.status ?? ''}>
            <option value="">{adminText('piecesAll')}</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ENUM_LABELS.PRODUCT_STATUSES[s].de}
              </option>
            ))}
          </select>
        </div>
        <div className="pc-field">
          <label htmlFor="pieces-category" className="pc-field__label">
            {adminText('pieceField_category')}
          </label>
          <select id="pieces-category" name="category" defaultValue={query.category ?? ''}>
            <option value="">{adminText('piecesAll')}</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ENUM_LABELS.PRODUCT_CATEGORIES[c].de}
              </option>
            ))}
          </select>
        </div>
        <p className="pc-admin-row">
          <button type="submit" className="pc-admin-btn pc-admin-btn--primary">
            {adminText('piecesApply')}
          </button>
          <a className="pc-admin-btn pc-admin-btn--secondary" href={`${adminRoute}/stuecke`}>
            {adminText('piecesReset')}
          </a>
        </p>
      </form>

      <p role="status" className="pc-pieces__count" data-testid="pieces-count">
        {adminText(result.totalDocs === 1 ? 'piecesCountOne' : 'piecesCount', {
          count: result.totalDocs,
        })}
      </p>

      <ul className="pc-pieces__list" data-testid="pieces-list">
        {result.cards.map((card) => {
          const nr = formatItemNumber(card.itemNumber, 'de')
          const publicUrl = `${siteUrl}${productPath({ itemNumber: card.itemNumber, slug: card.slug ?? undefined }, 'de')}`
          return (
            <li
              key={card.id}
              className="pc-pieces__card"
              data-testid="piece-card"
              data-item-number={card.itemNumber}
              data-status={card.status}
            >
              <div className="pc-pieces__photo">
                {card.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Vorschau aus der eigenen Medien-API
                  <img src={card.thumbUrl} alt="" width={80} height={100} loading="lazy" />
                ) : (
                  <span className="pc-pieces__nophoto">{adminText('piecesNoPhoto')}</span>
                )}
              </div>
              <div className="pc-pieces__body">
                <h2 className="pc-pieces__title">
                  <a href={`${adminRoute}/stuecke/${card.id}`} className="pc-admin-link">
                    <span className="pc-pieces__nr">{nr}</span>{' '}
                    {card.title ?? adminText('piecesUntitled')}
                  </a>
                </h2>
                <p className="pc-pieces__meta">
                  <MoneyAmount cents={card.priceCents} locale="de" /> ·{' '}
                  {ENUM_LABELS.PRODUCT_CATEGORIES[card.category]?.de ?? card.category}
                </p>
                <p className="pc-pieces__meta">
                  <StatusBadge tone={STATUS_TONE[card.status]}>
                    {ENUM_LABELS.PRODUCT_STATUSES[card.status].de}
                  </StatusBadge>
                  {card.reservationText ? (
                    <span className="pc-pieces__reservation" data-testid="piece-reservation">
                      {' '}
                      {card.reservationText}
                    </span>
                  ) : null}
                </p>
                <PieceCardActions
                  id={card.id}
                  nr={nr}
                  status={card.status}
                  actions={card.actions}
                  adminRoute={adminRoute}
                  publicUrl={publicUrl}
                  orderId={card.orderId}
                  showInArchive={card.showInArchiveAfterSale}
                />
              </div>
            </li>
          )
        })}
      </ul>

      {result.totalPages > 1 ? (
        <nav className="pc-admin-row pc-pieces__pages" aria-label={adminText('piecesPages')}>
          {result.page > 1 ? (
            <a
              className="pc-admin-btn pc-admin-btn--secondary"
              href={pageHref(adminRoute, query, result.page - 1)}
            >
              {adminText('piecesPrev')}
            </a>
          ) : null}
          <span className="pc-pieces__pageinfo">
            {adminText('piecesPageOf', { page: result.page, pages: result.totalPages })}
          </span>
          {result.page < result.totalPages ? (
            <a
              className="pc-admin-btn pc-admin-btn--secondary"
              href={pageHref(adminRoute, query, result.page + 1)}
            >
              {adminText('piecesNext')}
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  )
}
