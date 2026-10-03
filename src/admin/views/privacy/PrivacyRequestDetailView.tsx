import { notFound } from 'next/navigation'
import React from 'react'

import { PRIVACY_REQUEST_TRANSITIONS } from '@/collections/PrivacyRequests'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  IDENTITY_CHECK_METHODS,
  type IdentityCheckMethod,
  type PrivacyRequestStatus,
  type PrivacyRequestType,
} from '@/lib/enums'
import {
  OPEN_PRIVACY_REQUEST_STATUSES,
  privacyRequestMaxExtendedDueAt,
  privacyRequestTarget,
} from '@/lib/privacy/deadlines'
import { berlinDateKey, formatBerlin } from '@/lib/time'
import type { PrivacyRequest } from '@/payload-types'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { PrivacyRequestEditor } from './PrivacyRequestEditor'
import { PrivacyRequestSections } from './PrivacyRequestSections'

// Detail einer Datenschutz-Anfrage `/export/datenschutz/:id` (PLAN P6.16–P6.19, KONZEPT §7.15, LOESCHKONZEPT §5):
// Eckdaten mit Frist (`extendedDueAt ?? dueAt`), Bearbeiten (Status, Identität, Verlängerung, Abschluss), darunter die
// Werkzeuge Personensuche/Auskunft (P6.17), Löschen/Einschränken und Berichtigung (P6.18) sowie die Mails zur Anfrage
// (P6.19).

const OPEN = new Set<string>(OPEN_PRIVACY_REQUEST_STATUSES)
const date = (iso: string | Date) => formatBerlin(new Date(iso), 'dd.MM.yyyy')
const dayKey = (iso: string | null | undefined) => (iso ? berlinDateKey(new Date(iso)) : null)

export async function PrivacyRequestDetailView(props: AdminViewBodyProps) {
  const { match, req } = props
  const id = Number(match.id)
  const r = (await req.payload.findByID({
    collection: 'privacy-requests',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as PrivacyRequest | null
  if (!r) notFound()
  const now = new Date()
  const status = r.status as PrivacyRequestStatus
  const target = privacyRequestTarget(r)
  const rows: [string, React.ReactNode][] = [
    [
      adminText('privacyTypes'),
      (r.types ?? [])
        .map((t) => ENUM_LABELS.PRIVACY_REQUEST_TYPES[t as PrivacyRequestType].de)
        .join(', '),
    ],
    [adminText('privacyChannel'), ENUM_LABELS.PRIVACY_REQUEST_CHANNELS[r.channel].de],
    [adminText('privacyReceivedAt'), date(r.receivedAt)],
    [
      adminText('privacyDueLabel'),
      <span key="due" data-testid="privacy-detail-due" data-due={berlinDateKey(target)}>
        {date(target)}
        {r.extendedDueAt ? ` ${adminText('privacyExtendedFrom', { date: date(r.dueAt) })}` : ''}
      </span>,
    ],
    [
      adminText('privacyStatus'),
      <StatusBadge key="st" tone={OPEN.has(status) ? 'info' : 'neutral'}>
        {ENUM_LABELS.PRIVACY_REQUEST_STATUSES[status].de}
      </StatusBadge>,
    ],
    [adminText('privacyContactEmail'), r.contactEmail],
    [adminText('privacyContactName'), r.contactName ?? '–'],
    [adminText('privacyLocale'), ENUM_LABELS.LOCALES[r.locale].de],
    [
      adminText('privacyIdentityTitle'),
      r.identityVerified
        ? `${ENUM_LABELS.IDENTITY_CHECK_METHODS[r.identityMethod as IdentityCheckMethod]?.de ?? '–'}${r.identityVerifiedAt ? ` (${date(r.identityVerifiedAt)})` : ''}`
        : adminText('privacyIdentityOpen'),
    ],
  ]
  if (r.answeredAt) rows.push([adminText('privacyAnsweredAt'), date(r.answeredAt)])
  if (r.resultNote) rows.push([adminText('privacyResultNote'), r.resultNote])

  return (
    <div className="pc-order" data-testid="privacy-request" data-status={status}>
      <section className="pc-order__section" aria-labelledby="privacy-facts">
        <h2 id="privacy-facts">
          {r.reference}{' '}
          {r.seed ? <StatusBadge tone="info">{adminText('todaySeed')}</StatusBadge> : null}
        </h2>
        <dl className="pc-order__facts">
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </section>
      <PrivacyRequestEditor
        id={r.id}
        status={status}
        transitions={PRIVACY_REQUEST_TRANSITIONS[status].map((s) => ({
          value: s,
          label: ENUM_LABELS.PRIVACY_REQUEST_STATUSES[s].de,
        }))}
        identityVerified={r.identityVerified === true}
        identityMethod={r.identityMethod ?? null}
        identityMethods={enumOptions(IDENTITY_CHECK_METHODS, ENUM_LABELS.IDENTITY_CHECK_METHODS)}
        extendedDueAt={dayKey(r.extendedDueAt)}
        extensionReason={r.extensionReason ?? null}
        extensionNotifiedAt={dayKey(r.extensionNotifiedAt)}
        maxExtendedDueAt={berlinDateKey(privacyRequestMaxExtendedDueAt(new Date(r.receivedAt)))}
        answeredAt={dayKey(r.answeredAt)}
        resultNote={r.resultNote ?? null}
        today={berlinDateKey(now)}
      />
      <PrivacyRequestSections {...props} request={r} now={now} />
    </div>
  )
}
