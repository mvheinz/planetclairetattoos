import React from 'react'

import { getSnippet } from '@/lib/legal/snippets'
import { emailLogsFor } from '@/lib/privacy/logs'

import { CopyButton } from '../../components/CopyButton'

import { NotesEditor } from '../../components/NotesEditor'
import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { EmailLogTable } from '../logs/LogTables'
import { adminView, adminViewPath } from '../registry'
import { InquiryReplyAndDelete, InquiryStatusButtons } from './InquiryActions'
import { inquiryOfferHref, inquiryReplyHref, loadInquiryDetail } from './inquiryQuery'

// Anfrage-Detail `/anfragen/:id` (PLAN P5.20, KONZEPT §7.11): alle Angaben, Referenzbilder (nur angemeldete
// Dateiroute), interne Notizen, Status-Knöpfe (KONZEPT §5.5) mit Statusverlauf (Audit, DM-21), „Antworten“ (`mailto:`)
// und „Jetzt löschen“. Statuswechsel und Notizen setzen „zuletzt bearbeitet“, nie die Löschfrist (L-10). Mail-Protokoll
// zur Anfrage (P6.19). Abschnitt „Angebot“ (R-161, P7.14): Vorlage `commission.offer` (Platzhalter bis zum Kanzleitext)
// zum Kopieren bzw. als `mailto:` mit Referenz im Betreff, dazu der Hinweis auf die Monatssumme im Umsatz-Wächter (R-125).

export const INQUIRY_NOTES_MAX = 3000

export async function InquiryDetailView({ adminRoute, req, match }: AdminViewBodyProps) {
  const detail = match.id ? await loadInquiryDetail(req, Number(match.id)) : null
  const listHref = `${adminRoute}${adminViewPath('anfragen')}`
  if (!detail) {
    return (
      <Notice
        tone="info"
        data-testid="inquiry-not-found"
        action={{ href: listHref, label: adminText('inquiryBack') }}
      >
        {adminText('inquiryNotFound')}
      </Notice>
    )
  }
  const { card } = detail
  const offer = getSnippet('commission.offer', detail.locale)
  const offerSubject = adminText(
    detail.locale === 'en' ? 'inquiryOfferSubjectEn' : 'inquiryOfferSubjectDe',
    { reference: card.reference },
  )
  const offerText = `${offerSubject}\n\n${offer.text}`
  return (
    <div className="pc-order pc-order--detail" data-testid="inquiry-detail">
      <p className="pc-order__meta">
        <span className="pc-order__nr" data-testid="inquiry-reference">
          {card.reference}
        </span>{' '}
        · {card.createdAt} ·{' '}
        <StatusBadge tone={card.status === 'new' ? 'info' : 'neutral'}>
          <span data-testid="inquiry-status">{card.statusLabel}</span>
        </StatusBadge>
      </p>
      <p className="pc-order__muted" data-testid="inquiry-delete-after">
        {adminText('inquiryDeleteAfter', { date: card.deleteAfter })} ·{' '}
        {adminText('inquiryLastActivity', { date: detail.lastActivityAt })}
      </p>

      <InquiryReplyAndDelete
        inquiryId={card.id}
        reference={card.reference}
        replyHref={inquiryReplyHref(detail.email, card.reference, detail.locale)}
        transitions={detail.transitions}
        legalHold={detail.legalHold}
        listHref={listHref}
      />

      <section className="pc-order__section" aria-labelledby="inquiry-data">
        <h2 id="inquiry-data">{adminText('inquiryData')}</h2>
        <dl className="pc-order__facts" data-testid="inquiry-data">
          <dt>{adminText('withdrawalName')}</dt>
          <dd>{card.name}</dd>
          <dt>{adminText('withdrawalEmail')}</dt>
          <dd>{detail.email}</dd>
          <dt>{adminText('inquiryObject')}</dt>
          <dd>{card.objectLabel}</dd>
          <dt>{adminText('inquiryIdea')}</dt>
          <dd className="pc-order__notes">{detail.idea}</dd>
          <dt>{adminText('inquiryTimeframe')}</dt>
          <dd>{detail.desiredTimeframe || '–'}</dd>
          <dt>{adminText('inquiryBudget')}</dt>
          <dd>{detail.budget || '–'}</dd>
          <dt>{adminText('withdrawalLanguage')}</dt>
          <dd>{detail.localeLabel}</dd>
        </dl>
      </section>

      <section className="pc-order__section" aria-labelledby="inquiry-images">
        <h2 id="inquiry-images">{adminText('inquiryImages')}</h2>
        {detail.images.length === 0 ? (
          <p className="pc-order__muted">{adminText('inquiryNoImages')}</p>
        ) : (
          <ul className="pc-order__photos" data-testid="inquiry-images">
            {detail.images.map((img, i) => (
              <li key={img.id}>
                <a href={img.url} target="_blank" rel="noopener" className="pc-admin-link">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private Datei über die angemeldete Dateiroute */}
                  <img
                    src={img.thumbUrl}
                    alt={adminText('inquiryImageAlt', { n: i + 1 })}
                    width={96}
                    height={96}
                    loading="lazy"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="pc-order__section"
        aria-labelledby="inquiry-offer"
        data-testid="inquiry-offer"
      >
        <h2 id="inquiry-offer">{adminText('inquiryOfferTitle')}</h2>
        <p className="pc-order__muted">{adminText('inquiryOfferIntro')}</p>
        {offer.origin === 'placeholder' ? (
          <p className="pc-order__muted" data-testid="inquiry-offer-placeholder">
            {adminText('inquiryOfferPlaceholder')}
          </p>
        ) : null}
        <div className="pc-admin-row">
          <CopyButton
            text={offerText}
            label={adminText('inquiryOfferCopy')}
            data-testid="inquiry-offer-copy"
          />
          <a
            className="pc-admin-btn pc-admin-btn--secondary"
            href={inquiryOfferHref(detail.email, offerSubject, offer.text)}
            data-testid="inquiry-offer-mail"
          >
            {adminText('inquiryOfferMail')}
          </a>
        </div>
        <p data-testid="inquiry-revenue-hint">
          {adminText('inquiryRevenueHint')}{' '}
          <a className="pc-admin-link" href={`${adminRoute}${adminView('umsatz-waechter').path}`}>
            {adminText('inquiryRevenueLink')}
          </a>
        </p>
      </section>

      <section className="pc-order__section" aria-labelledby="inquiry-status-title">
        <h2 id="inquiry-status-title">{adminText('inquiryStatusTitle')}</h2>
        <InquiryStatusButtons inquiryId={card.id} transitions={detail.transitions} />
        {detail.history.length > 0 ? (
          <ol className="pc-order__history" data-testid="inquiry-history">
            {detail.history.map((h, i) => (
              <li key={i}>
                <span className="pc-order__muted">{h.at}</span> {h.from ? `${h.from} → ` : ''}
                <strong>{h.to}</strong> {adminText('orderHistoryBy', { actor: h.actor })}
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section className="pc-order__section" aria-labelledby="inquiry-emails">
        <h2 id="inquiry-emails">{adminText('logsMailsTitle')}</h2>
        <EmailLogTable
          rows={await emailLogsFor(req, { inquiry: { equals: card.id } })}
          adminRoute={adminRoute}
          caption={adminText('logsMailsTitle')}
          testId="inquiry-email-log"
        />
      </section>

      <section className="pc-order__section" aria-labelledby="inquiry-notes">
        <h2 id="inquiry-notes">{adminText('notesTitle')}</h2>
        <NotesEditor
          url={`/api/inquiries/${card.id}/notes`}
          initial={detail.adminNotes}
          maxLength={INQUIRY_NOTES_MAX}
        />
      </section>
    </div>
  )
}
