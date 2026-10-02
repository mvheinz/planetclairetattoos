import React from 'react'

import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  LOCALES,
  PRIVACY_REQUEST_CHANNELS,
  PRIVACY_REQUEST_TYPES,
  type PrivacyRequestStatus,
  type PrivacyRequestType,
} from '@/lib/enums'
import { OPEN_PRIVACY_REQUEST_STATUSES, privacyRequestTarget } from '@/lib/privacy/deadlines'
import { addBerlinDays, berlinDateKey, formatBerlin } from '@/lib/time'
import type { PrivacyRequest } from '@/payload-types'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminViewPath } from '../registry'
import { PrivacyIntakeForm } from './PrivacyIntakeForm'

// Ansicht „Datenschutz-Anfragen“ `/export/datenschutz` (PLAN P6.16, KONZEPT §7.15, LOESCHKONZEPT §5): oben „Anfrage
// erfassen“ (Art, Eingangstag, Kanal, Adresse, Sprache), darunter offene Anfragen nach Frist (`extendedDueAt ?? dueAt`,
// ab 7 Tagen vorher rot) und die zuletzt abgeschlossenen. Die Frist läuft auch während der Identitätsprüfung.

const OPEN = new Set<string>(OPEN_PRIVACY_REQUEST_STATUSES)
const date = (iso: string | Date) => formatBerlin(new Date(iso), 'dd.MM.yyyy')

function Card({ r, adminRoute, now }: { r: PrivacyRequest; adminRoute: string; now: Date }) {
  const target = privacyRequestTarget(r)
  const open = OPEN.has(r.status)
  const urgent = open && berlinDateKey(target) <= berlinDateKey(addBerlinDays(now, 7))
  const types = (r.types ?? [])
    .map((t) => ENUM_LABELS.PRIVACY_REQUEST_TYPES[t as PrivacyRequestType].de)
    .join(', ')
  return (
    <li
      className="pc-order__card"
      data-testid="privacy-request-card"
      data-reference={r.reference}
      data-status={r.status}
      data-urgent={urgent ? 'true' : undefined}
    >
      <h3 className="pc-order__cardtitle">
        <a
          href={`${adminRoute}${adminViewPath('datenschutz-anfrage', r.id)}`}
          className="pc-admin-link"
        >
          {r.reference}
        </a>{' '}
        {r.seed ? <StatusBadge tone="info">{adminText('todaySeed')}</StatusBadge> : null}
      </h3>
      <p className="pc-order__meta">{types}</p>
      <p className="pc-order__meta">
        {adminText('privacyReceived', { date: date(r.receivedAt) })} ·{' '}
        {ENUM_LABELS.PRIVACY_REQUEST_CHANNELS[r.channel].de}
      </p>
      <p className="pc-order__meta">
        <StatusBadge tone={open ? 'info' : 'neutral'}>
          {ENUM_LABELS.PRIVACY_REQUEST_STATUSES[r.status as PrivacyRequestStatus].de}
        </StatusBadge>{' '}
        {open ? (
          <span data-testid="privacy-request-due" data-due={berlinDateKey(target)}>
            {urgent ? (
              <StatusBadge tone="error">
                {adminText('privacyDue', { date: date(target) })}
              </StatusBadge>
            ) : (
              adminText('privacyDue', { date: date(target) })
            )}
            {r.extendedDueAt ? ` ${adminText('privacyExtended')}` : ''}
          </span>
        ) : null}
      </p>
    </li>
  )
}

export async function PrivacyRequestsView({ adminRoute, req }: AdminViewBodyProps) {
  const now = new Date()
  const res = await req.payload.find({
    collection: 'privacy-requests',
    sort: 'dueAt',
    limit: 300,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const all = res.docs as PrivacyRequest[]
  const open = all
    .filter((r) => OPEN.has(r.status))
    .sort((a, b) => privacyRequestTarget(a).getTime() - privacyRequestTarget(b).getTime())
  const done = all
    .filter((r) => !OPEN.has(r.status))
    .sort((a, b) => (b.answeredAt ?? '').localeCompare(a.answeredAt ?? ''))
    .slice(0, 30)
  return (
    <div className="pc-order" data-testid="privacy-requests">
      <p className="pc-order__muted">{adminText('privacyIntro')}</p>
      <PrivacyIntakeForm
        today={berlinDateKey(now)}
        types={enumOptions(PRIVACY_REQUEST_TYPES, ENUM_LABELS.PRIVACY_REQUEST_TYPES)}
        channels={enumOptions(PRIVACY_REQUEST_CHANNELS, ENUM_LABELS.PRIVACY_REQUEST_CHANNELS)}
        locales={enumOptions(LOCALES, ENUM_LABELS.LOCALES)}
      />
      <section className="pc-order__section" aria-labelledby="privacy-open">
        <h2 id="privacy-open">{adminText('privacyOpen')}</h2>
        <p role="status" className="pc-order__count" data-testid="privacy-requests-count">
          {open.length === 0
            ? adminText('privacyOpenNone')
            : adminText('privacyOpenCount', { count: open.length })}
        </p>
        <ul className="pc-order__list" data-testid="privacy-open-list">
          {open.map((r) => (
            <Card key={r.id} r={r} adminRoute={adminRoute} now={now} />
          ))}
        </ul>
      </section>
      {done.length > 0 ? (
        <section className="pc-order__section" aria-labelledby="privacy-done">
          <h2 id="privacy-done">{adminText('privacyDone')}</h2>
          <ul className="pc-order__list" data-testid="privacy-done-list">
            {done.map((r) => (
              <Card key={r.id} r={r} adminRoute={adminRoute} now={now} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
