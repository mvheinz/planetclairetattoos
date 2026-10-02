import React from 'react'

import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { PACKING_PHOTOS_UI_MAX } from '@/lib/commerce/packOrder'
import { refundDialogData } from '@/lib/commerce/refundOrder'
import { ENUM_LABELS } from '@/lib/enumLabels'
import { COMPLAINT_KINDS, PACKAGING_MATERIALS } from '@/lib/enums'
import { consentLogsFor } from '@/lib/privacy/logs'

import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { ConsentLogTable } from '../logs/LogTables'
import { AddressCopy } from './AddressCopy'
import { loadOrderComplaints } from './complaintQuery'
import { ComplaintsPanel } from './ComplaintsPanel'
import { loadOrderDetail } from './orderQuery'
import { OrderResend } from './OrderResend'
import { PackingPanel } from './PackingPanel'
import { RefundDialog } from './RefundDialog'
import { HintBadges } from './PackingListView'

/** Gründe für „Erstatten“ aus der Bestellung (O15/O21, KONZEPT §5.3); Widerrufe erstattet Jutta im Widerruf. */
const ORDER_REFUND_REASONS = ['admin_cancellation', 'breakage', 'goodwill', 'complaint'] as const

/** Versanddienste mit Sendungsverfolgung (Carrier-Adapter, P5.14). */
const SHIP_CARRIERS = ['dhl', 'deutsche_post'] as const

// Bestell-Detail `/bestellungen/:id` (PLAN P5.9, KONZEPT §7.6 ff.): gemeinsame Ansicht für Packen, Vorkasse,
// Versendet und Abholung – Positionen mit Foto, `Nr.`, Titel, Preis; Lieferart, Empfänger:in, Zahlart, Beträge,
// Status mit Historie, Hinweise (rote Markierung, Anfechtung mit Vorstatus), interne Notiz, Mail-Protokoll mit
// „erneut senden“ (M01, M02, M05, M06, M07). Bei Versand zusätzlich Packen (Checkliste, Verpackung, Packfotos,
// Gepackt, Versendet melden) und Packzettel.

export async function OrderDetailView({ adminRoute, req, match }: AdminViewBodyProps) {
  const detail = match.id ? await loadOrderDetail(req, Number(match.id)) : null
  if (!detail) {
    return (
      <Notice
        tone="info"
        data-testid="order-not-found"
        action={{ href: `${adminRoute}/collections/orders`, label: adminText('orderOpenAllData') }}
      >
        {adminText('orderNotFound')}
      </Notice>
    )
  }
  const p = detail.packing
  const resend = detail.resend.filter((o) => o.sentBefore)
  const refund = await refundDialogData(req, detail.id)
  const complaints = await loadOrderComplaints(req, detail.id)
  return (
    <div className="pc-order pc-order--detail" data-testid="order-detail">
      <p className="pc-order__meta">
        <span className="pc-order__nr" data-testid="order-number">
          {detail.orderNumber}
        </span>{' '}
        · {adminText('orderPlacedAt', { date: detail.placedAt })} ·{' '}
        <StatusBadge tone="info">{detail.statusLabel}</StatusBadge>
      </p>

      {detail.withdrawalHint || detail.attention || detail.dispute || (p && p.hints.length) ? (
        <section className="pc-order__section" aria-labelledby="order-hints">
          <h2 id="order-hints">{adminText('orderHints')}</h2>
          {detail.attention ? (
            <Notice tone="error" data-testid="order-attention">
              {adminText('orderAttention', { reason: detail.attention.reason ?? '–' })}
              {detail.attention.note ? ` – ${detail.attention.note}` : ''}
            </Notice>
          ) : null}
          {detail.dispute ? (
            <Notice tone="warning" data-testid="order-dispute">
              {adminText('orderDispute', { status: detail.dispute.status })}
              {detail.dispute.before
                ? ` · ${adminText('orderDisputeBefore', { status: detail.dispute.before })}`
                : ''}
            </Notice>
          ) : null}
          {p ? <HintBadges hints={p.hints} /> : null}
        </section>
      ) : null}

      <section className="pc-order__section" aria-labelledby="order-items">
        <h2 id="order-items">{adminText('orderItems')}</h2>
        <ul className="pc-order__items pc-order__items--detail">
          {detail.items.map((item, i) => (
            <li key={i} className="pc-order__item">
              {item.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Vorschau aus der eigenen Medien-API
                <img src={item.thumbUrl} alt="" width={56} height={70} loading="lazy" />
              ) : (
                <span className="pc-order__nophoto" aria-hidden="true" />
              )}
              <span className="pc-order__itembody">
                <span>
                  <span className="pc-order__nr">{item.nr}</span> {item.title}
                </span>
                <span>
                  <MoneyAmount cents={item.priceCents} locale="de" /> · {item.statusLabel}
                </span>
                {item.productId ? (
                  <span className="pc-admin-row">
                    <a className="pc-admin-link" href={`${adminRoute}/stuecke/${item.productId}`}>
                      {adminText('orderToPiece')}
                    </a>
                    <a
                      className="pc-admin-link"
                      href={`/api/products/${item.productId}/label.pdf`}
                      target="_blank"
                      rel="noopener"
                    >
                      {adminText('orderLabel', { nr: item.nr })}
                    </a>
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pc-order__section" aria-labelledby="order-delivery">
        <h2 id="order-delivery">{adminText('orderDelivery')}</h2>
        <dl className="pc-order__facts">
          <dt>{adminText('orderFulfillment')}</dt>
          <dd>
            {detail.fulfillmentLabel}
            {p?.shippingClassLabel ? ` · ${p.shippingClassLabel}` : ''}
          </dd>
          <dt>{adminText('orderCustomer')}</dt>
          <dd>
            {detail.customerName} · {detail.customerEmail}
          </dd>
          <dt>{adminText('orderPayment')}</dt>
          <dd>{detail.paymentLabel}</dd>
          <dt>{adminText('orderLanguage')}</dt>
          <dd>{detail.locale}</dd>
        </dl>
        <h3>{adminText('orderRecipient')}</h3>
        {p && !p.withdrawn ? (
          <AddressCopy
            orderId={detail.id}
            lines={p.addressLines}
            consentActive={p.consentActive}
            consentRevokedAt={p.consentRevokedAt}
          />
        ) : (
          <p>
            {detail.recipient.map((line, i) => (
              <span key={i} className="pc-order__line">
                {line}
              </span>
            ))}
          </p>
        )}
      </section>

      <section className="pc-order__section" aria-labelledby="order-amounts">
        <h2 id="order-amounts">{adminText('orderAmounts')}</h2>
        <dl className="pc-order__facts">
          <dt>{adminText('orderSubtotal')}</dt>
          <dd>
            <MoneyAmount cents={detail.subtotalCents} locale="de" />
          </dd>
          <dt>{adminText('orderShipping')}</dt>
          <dd>
            <MoneyAmount cents={detail.shippingCents} locale="de" />
          </dd>
          <dt>{adminText('orderTotal')}</dt>
          <dd>
            <strong>
              <MoneyAmount cents={detail.totalCents} locale="de" />
            </strong>
          </dd>
          {detail.refundedCents > 0 ? (
            <>
              <dt>{adminText('orderRefunded')}</dt>
              <dd>
                <MoneyAmount cents={detail.refundedCents} locale="de" />
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      {refund.refundable ? (
        <section className="pc-order__section" aria-labelledby="order-refund">
          <h2 id="order-refund">{adminText('refundTitle')}</h2>
          <RefundDialog
            orderId={refund.orderId}
            orderNumber={refund.orderNumber}
            prepayment={refund.prepayment}
            items={refund.items}
            proposal={refund.proposal}
            pending={refund.pending}
            refundable={refund.refundable}
            reasons={ORDER_REFUND_REASONS.map((r) => ({
              value: r,
              label: ENUM_LABELS.REFUND_REASONS[r].de,
            }))}
          />
        </section>
      ) : null}

      {complaints && (complaints.allowed || complaints.complaints.length > 0) ? (
        <section
          className="pc-order__section"
          aria-labelledby="order-complaints-title"
          id="order-complaints"
          data-testid="order-complaints"
        >
          <h2 id="order-complaints-title">{adminText('complaintsTitle')}</h2>
          <ComplaintsPanel
            orderId={detail.id}
            adminRoute={adminRoute}
            allowed={complaints.allowed}
            kinds={COMPLAINT_KINDS.map((k) => ({
              value: k,
              label: ENUM_LABELS.COMPLAINT_KINDS[k].de,
            }))}
            items={complaints.items}
            complaints={complaints.complaints}
          />
        </section>
      ) : null}

      {p ? (
        <section className="pc-order__section" aria-labelledby="order-packing">
          <h2 id="order-packing">{adminText('orderPackingTitle')}</h2>
          <p className="pc-admin-row">
            <a
              className="pc-admin-btn pc-admin-btn--secondary"
              href={`/api/orders/${detail.id}/packing-slip.pdf`}
              target="_blank"
              rel="noopener"
              data-testid="packing-slip-link"
            >
              {adminText('orderPackingSlip')}
            </a>
          </p>
          <PackingPanel
            orderId={detail.id}
            orderNumber={detail.orderNumber}
            status={detail.status}
            canPack={p.canPack}
            canShip={p.canShip}
            ceramic={p.hints.some((h) => h.key === 'ceramic')}
            checklist={p.checklist}
            packaging={p.packaging}
            templates={p.templates}
            materials={PACKAGING_MATERIALS.map((m) => ({
              value: m,
              label: ENUM_LABELS.PACKAGING_MATERIALS[m].de,
            }))}
            photos={p.photos}
            photosMax={PACKING_PHOTOS_UI_MAX}
            carriers={SHIP_CARRIERS.map((c) => ({ value: c, label: ENUM_LABELS.CARRIERS[c].de }))}
            defaultCarrier={p.defaultCarrier}
            trackingNumber={p.trackingNumber}
          />
        </section>
      ) : null}

      <section className="pc-order__section" aria-labelledby="order-history">
        <h2 id="order-history">{adminText('orderHistory')}</h2>
        <ol className="pc-order__history" data-testid="order-history">
          {detail.history.map((h, i) => (
            <li key={i}>
              <span className="pc-order__muted">{h.at}</span> {h.from ? `${h.from} → ` : ''}
              <strong>{h.to}</strong> {adminText('orderHistoryBy', { actor: h.actor })}
              {h.transition ? ` (${h.transition})` : ''}
              {h.note ? ` – ${h.note}` : ''}
            </li>
          ))}
        </ol>
      </section>

      <section className="pc-order__section" aria-labelledby="order-notes">
        <h2 id="order-notes">{adminText('orderNotes')}</h2>
        <p className="pc-order__notes">{detail.notes || adminText('orderNoNotes')}</p>
      </section>

      <section className="pc-order__section" aria-labelledby="order-consents">
        <h2 id="order-consents">{adminText('logsConsentsTitle')}</h2>
        <ConsentLogTable
          rows={await consentLogsFor(req, { order: { equals: detail.id } })}
          adminRoute={adminRoute}
          caption={adminText('logsConsentsTitle')}
          testId="order-consent-log"
        />
      </section>

      <section className="pc-order__section" aria-labelledby="order-emails">
        <h2 id="order-emails">{adminText('orderEmails')}</h2>
        {detail.emails.length === 0 ? (
          <p>{adminText('orderNoEmails')}</p>
        ) : (
          <ul className="pc-order__emails" data-testid="order-emails">
            {detail.emails.map((m) => (
              <li key={m.id} className="pc-order__email" data-template={m.template}>
                <span className="pc-order__muted">{m.at}</span>
                <span>
                  <strong>{m.label}</strong> – {m.subject}
                </span>
                <span>
                  {adminText('orderEmailStatus')}: {m.statusLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
        {resend.length > 0 ? (
          <>
            <h3>{adminText('orderResendTitle')}</h3>
            <OrderResend
              orderId={detail.id}
              options={resend.map((o) => ({
                template: o.template,
                label: o.label,
                available: o.available,
              }))}
            />
          </>
        ) : null}
      </section>
    </div>
  )
}
