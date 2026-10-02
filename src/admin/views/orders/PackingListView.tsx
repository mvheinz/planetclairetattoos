import React from 'react'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { AddressCopy } from './AddressCopy'
import { loadPackingList, type PackingCard } from './orderQuery'
import { PackedButton } from './PackedButton'

// Ansicht „Zu packen“ `/packen` (PLAN P5.10, KONZEPT §7.6): Versandbestellungen `paid` und `packed`, älteste zuerst –
// Bestellnummer, Datum, Fotos und `Nr.` der Stücke, Versandklasse, Name und Ort, Hinweise (wörtlich KONZEPT §7.6),
// „Adresse kopieren“ mit Kopier-Symbol je Zeile, Packzettel, „Gepackt“. Details (Checkliste, Verpackung, Packfotos,
// Versenden) im Bestell-Detail.

export function HintBadges({ hints }: { hints: PackingCard['hints'] }) {
  return (
    <ul className="pc-order__hints" data-testid="packing-hints">
      {hints.map((h) => (
        <li key={h.key} data-hint={h.key}>
          <StatusBadge tone={h.tone === 'info' ? 'neutral' : h.tone}>{h.text}</StatusBadge>
        </li>
      ))}
    </ul>
  )
}

export function ItemThumbs({ items }: { items: PackingCard['items'] }) {
  return (
    <ul className="pc-order__items">
      {items.map((item, i) => (
        <li key={i} className="pc-order__item">
          {item.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Vorschau aus der eigenen Medien-API
            <img src={item.thumbUrl} alt="" width={56} height={70} loading="lazy" />
          ) : (
            <span className="pc-order__nophoto" aria-hidden="true" />
          )}
          <span>
            <span className="pc-order__nr">{item.nr}</span> {item.title}
          </span>
        </li>
      ))}
    </ul>
  )
}

export async function PackingListView({ adminRoute, req }: AdminViewBodyProps) {
  const cards = await loadPackingList(req)
  return (
    <div className="pc-order">
      <p role="status" className="pc-order__count" data-testid="packing-count">
        {cards.length === 0
          ? adminText('packingEmpty')
          : adminText(cards.length === 1 ? 'packingCountOne' : 'packingCount', {
              count: cards.length,
            })}
      </p>
      <ul className="pc-order__list" data-testid="packing-list">
        {cards.map((card) => (
          <li
            key={card.id}
            className="pc-order__card"
            data-testid="packing-card"
            data-order-number={card.orderNumber}
            data-status={card.status}
          >
            <h2 className="pc-order__cardtitle">
              <a href={`${adminRoute}/bestellungen/${card.id}`} className="pc-admin-link">
                {card.orderNumber}
              </a>
            </h2>
            <p className="pc-order__meta">
              {adminText('orderPlacedAt', { date: card.placedAt })}
              {card.shippingClassLabel ? ` · ${card.shippingClassLabel}` : ''} ·{' '}
              <StatusBadge tone={card.status === 'packed' ? 'success' : 'neutral'}>
                {card.statusLabel}
              </StatusBadge>
            </p>
            <p className="pc-order__meta">
              {card.name}
              {card.city ? `, ${card.city}` : ''}
            </p>
            <ItemThumbs items={card.items} />
            <HintBadges hints={card.hints} />
            {card.withdrawn ? null : (
              <AddressCopy
                orderId={card.id}
                lines={card.addressLines}
                consentActive={card.consentActive}
                consentRevokedAt={card.consentRevokedAt}
              />
            )}
            <div className="pc-admin-row">
              <a
                className="pc-admin-btn pc-admin-btn--secondary"
                href={`/api/orders/${card.id}/packing-slip.pdf`}
                target="_blank"
                rel="noopener"
                data-testid="packing-slip-link"
              >
                {adminText('orderPackingSlip')}
              </a>
              {card.status === 'paid' ? <PackedButton orderId={card.id} /> : null}
              <a
                className="pc-admin-btn pc-admin-btn--secondary"
                href={`${adminRoute}/bestellungen/${card.id}`}
              >
                {adminText('orderOpen')}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
