import React from 'react'

import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { ENUM_LABELS } from '@/lib/enumLabels'
import { PRODUCT_CATEGORIES, PRODUCT_STATUSES, type ProductStatus } from '@/lib/enums'
import { getEnv } from '@/lib/env'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { productPath } from '@/lib/shop/format'
import { systemClock } from '@/lib/time'
import { missingLine } from '@/lib/products/readiness'
import { loadTourSaleOptions } from '@/lib/tour/saleOptions'

import { AttentionDoneButton } from '../../components/AttentionDoneButton'
import { StatusBadge, type StatusTone } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { PieceCardActions } from './PieceCardActions'
import { parsePiecesQuery, queryPieces, type PieceCard, type PiecesQuery } from './piecesQuery'
import { PublishReadyButton } from './PublishReadyButton'

// Ansicht „Meine Stücke“ `/stuecke` (PLAN P5.8, KONZEPT §7.5): Suche (Nummer exakt, Titel enthält), Filter Status,
// Kategorie und „zu prüfen“ (V-31) als einfaches GET-Formular (funktioniert ohne JavaScript), Karten mit Foto, `Nr. 017`,
// Titel, Preis, Status, Markierung „zu prüfen“ mit „Erledigt“ (V-31), bei Entwürfen „fertig“ bzw. „fehlt: …“ (V-32)
// und den Knöpfen je Status (Client-Komponente `PieceCardActions`), seitenweise 20; oben „Alle fertigen online
// stellen“ (V-32), sobald es Entwürfe gibt.

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
  if (query.review) q.set('pruefen', '1')
  if (page > 1) q.set('page', String(page))
  const s = q.toString()
  return `${adminRoute}/stuecke${s ? `?${s}` : ''}`
}

/** Markierung und „was fehlt noch?“ einer Karte (V-31, V-32). */
function CardChecks({ card }: { card: PieceCard }) {
  const { attention, readiness } = card
  if (!attention && !readiness) return null
  return (
    <div className="pc-pieces__checks">
      {attention ? (
        <p className="pc-pieces__meta" data-testid="piece-attention" data-manual={attention.manual}>
          <StatusBadge tone={attention.manual ? 'warning' : 'error'}>
            {attention.manual ? adminText('piecesAttentionReview') : attention.label}
          </StatusBadge>
          {attention.note ? <span className="pc-pieces__note"> {attention.note}</span> : null}
        </p>
      ) : null}
      {attention?.manual ? (
        <AttentionDoneButton
          url={`/api/products/${card.id}/attention-done`}
          data-testid="piece-attention-done"
        />
      ) : null}
      {readiness ? (
        <p className="pc-pieces__meta" data-testid="piece-readiness" data-ready={readiness.ready}>
          {readiness.ready ? (
            <StatusBadge tone="success">{adminText('piecesReady')}</StatusBadge>
          ) : (
            <span className="pc-pieces__missing">
              {adminText('piecesMissing', { list: missingLine(readiness.missing) })}
            </span>
          )}
          {readiness.hints.length > 0 ? (
            <span className="pc-pieces__tip" data-testid="piece-readiness-hint">
              {' '}
              {adminText('piecesHints', { list: readiness.hints.map((h) => h.label).join(', ') })}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

export async function PiecesListView({ adminRoute, req, searchParams }: AdminViewBodyProps) {
  const query = parsePiecesQuery(searchParams)
  const result = await queryPieces(req, query)
  // V-32: „Alle fertigen online stellen“ nur, wenn es überhaupt Entwürfe gibt.
  const drafts = await req.payload
    .count({ collection: 'products', where: { status: { equals: 'draft' } }, overrideAccess: true })
    .then((r) => r.totalDocs)
  // U-60 (P14.11): „Verkauft (Markt/privat)“ kann einen Markt-Termin zuordnen.
  const tourOptions = result.cards.some((c) =>
    c.actions.some((a) => a === 'sellOffline' || a === 'sellOfflineReserved'),
  )
    ? await loadTourSaleOptions(req, systemClock.now())
    : []
  const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')

  return (
    <div className="pc-pieces">
      {/* `div` statt `p`: der Dialog von „Alle fertigen online stellen“ darf nicht in einem Absatz stehen. */}
      <div className="pc-admin-row">
        <a className="pc-admin-btn pc-admin-btn--primary" href={`${adminRoute}/neues-stueck`}>
          {adminText('shellNewPiece')}
        </a>
        {drafts > 0 ? <PublishReadyButton /> : null}
      </div>
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
        <div className="pc-field pc-field--check">
          <label className="pc-choice" htmlFor="pieces-review">
            <input
              id="pieces-review"
              name="pruefen"
              type="checkbox"
              value="1"
              defaultChecked={query.review}
              data-testid="pieces-review-filter"
            />
            <span>{adminText('piecesReviewFilter')}</span>
          </label>
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
              data-review={card.attention?.manual ? 'true' : undefined}
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
                <CardChecks card={card} />
                <PieceCardActions
                  id={card.id}
                  nr={nr}
                  status={card.status}
                  actions={card.actions}
                  adminRoute={adminRoute}
                  publicUrl={publicUrl}
                  orderId={card.orderId}
                  showInArchive={card.showInArchiveAfterSale}
                  tourOptions={tourOptions}
                  offlinePriceCents={card.offlineSalePriceCents}
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
