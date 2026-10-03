import React from 'react'

import { JOB_TASKS } from '@/jobs/index'
import { isResendable } from '@/lib/commerce/resendEmail'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { EmailTemplate } from '@/lib/enums'
import { getEnv } from '@/lib/env'
import { jobAlarm } from '@/lib/jobs/alarm'
import { JOB_RUN_RETENTION_DAYS, listJobRuns, poolDb } from '@/lib/jobs/runLog'
import { formatBerlin } from '@/lib/time'

import { Notice } from '../../components/Notice'
import { StatusBadge, type StatusTone } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminView } from '../registry'
import { FailedMailAction, RunTaskButton } from './SystemActions'

// Einstellungen → System `/einstellungen/system` (PLAN P5.22, ARCHITEKTUR §11.5, KONZEPT §8.1 Nr. 4): App-Version,
// `APP_ENV`, letzter voller Job-Lauf und nächster Weckzeitpunkt, „Jetzt ausführen“ je Task, Lauf-Protokoll der
// letzten 90 Tage (`job_runs`), fehlgeschlagene Mails (Kund:innen-Mails einer Bestellung lassen sich erneut senden),
// nicht verarbeitete Webhook-Ereignisse. Startklar-Prüfung folgt in P10.

const RUN_LIMIT = 100
const fmt = (d: Date | string | null | undefined) =>
  d ? formatBerlin(new Date(d), 'dd.MM.yyyy HH:mm') : '–'
const RUN_TONE: Record<string, StatusTone> = { ok: 'success', failed: 'error', skipped: 'neutral' }

export async function SystemView({ adminRoute, req }: AdminViewBodyProps) {
  const env = getEnv()
  const now = new Date()
  const alarm = await jobAlarm.read().catch(() => ({ nextDueAt: null, lastFullRunAt: null }))
  const since = new Date(now.getTime() - JOB_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const runs = await listJobRuns(poolDb(req.payload), { since, limit: RUN_LIMIT })
  const tasks = JOB_TASKS.map((t) => ({ slug: t.slug, label: String(t.label ?? t.slug) }))

  const failed = await req.payload.find({
    collection: 'email-log',
    where: { status: { equals: 'failed' } },
    sort: '-createdAt',
    limit: 30,
    depth: 0,
    overrideAccess: true,
    req,
  })
  // Schon erneut eingereiht? (neuere Zeile derselben Bestellung und Vorlage)
  const resentAt = new Map<number, string>()
  for (const mail of failed.docs) {
    const order = typeof mail.order === 'object' ? mail.order?.id : mail.order
    if (!order) continue
    const newer = await req.payload.find({
      collection: 'email-log',
      where: {
        and: [
          { order: { equals: order } },
          { template: { equals: mail.template } },
          { createdAt: { greater_than: mail.createdAt } },
        ],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (newer.docs[0]) resentAt.set(mail.id, newer.docs[0].createdAt)
  }

  const webhooks = await req.payload.find({
    collection: 'webhook-events',
    where: { status: { in: ['processing', 'failed'] } },
    sort: '-receivedAt',
    limit: 30,
    depth: 0,
    overrideAccess: true,
    req,
  })

  return (
    <div className="pc-order pc-settings" data-testid="settings-system-view">
      <section className="pc-order__section" aria-labelledby="system-state">
        <h2 id="system-state">{adminText('systemState')}</h2>
        <dl className="pc-order__facts">
          <dt>{adminText('systemVersion')}</dt>
          <dd data-testid="system-version">
            {env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? adminText('systemVersionLocal')}
          </dd>
          <dt>{adminText('systemEnv')}</dt>
          <dd data-testid="system-env">{env.APP_ENV}</dd>
          <dt>{adminText('systemLastFullRun')}</dt>
          <dd data-testid="system-last-full-run">{fmt(alarm.lastFullRunAt)}</dd>
          <dt>{adminText('systemNextWake')}</dt>
          <dd>{fmt(alarm.nextDueAt)}</dd>
        </dl>
        <Notice tone="info">{adminText('systemStartklarLater')}</Notice>
      </section>

      <section className="pc-order__section" aria-labelledby="system-tasks">
        <h2 id="system-tasks">{adminText('systemTasks')}</h2>
        <p className="pc-order__muted">{adminText('systemTasksHint')}</p>
        <ul className="pc-order__items" data-testid="system-tasks">
          {tasks.map((t) => (
            <li key={t.slug} className="pc-order__item pc-settings__task">
              <span>
                <strong>{t.label}</strong> <span className="pc-order__muted">({t.slug})</span>
              </span>
              <RunTaskButton task={t.slug} label={t.label} />
            </li>
          ))}
        </ul>
      </section>

      <section className="pc-order__section" aria-labelledby="system-runs">
        <h2 id="system-runs">{adminText('systemRuns', { days: JOB_RUN_RETENTION_DAYS })}</h2>
        {runs.length === 0 ? (
          <p>{adminText('systemRunsNone')}</p>
        ) : (
          <ul className="pc-order__items" data-testid="system-runs">
            {runs.map((r) => (
              <li key={r.id} className="pc-order__item" data-testid={`system-run-row-${r.task}`}>
                <span>
                  <strong>{r.task}</strong> · {fmt(r.startedAt)}{' '}
                  <StatusBadge tone={RUN_TONE[r.status] ?? 'neutral'}>
                    {adminText(
                      r.status === 'ok'
                        ? 'systemRunOk'
                        : r.status === 'failed'
                          ? 'systemRunFailed'
                          : 'systemRunSkipped',
                    )}
                  </StatusBadge>
                  {r.finishedAt ? (
                    <span className="pc-order__muted">
                      {' '}
                      ·{' '}
                      {adminText('systemRunDuration', {
                        seconds: Math.max(
                          0,
                          Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000),
                        ),
                      })}
                    </span>
                  ) : null}
                  {r.error ? <span className="pc-order__muted"> · {r.error}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {runs.length === RUN_LIMIT ? (
          <p className="pc-order__muted">{adminText('systemRunsLimited', { n: RUN_LIMIT })}</p>
        ) : null}
      </section>

      <section className="pc-order__section" aria-labelledby="system-mails">
        <h2 id="system-mails">{adminText('systemFailedMails')}</h2>
        {failed.docs.length === 0 ? (
          <p data-testid="system-failed-mails-none">{adminText('systemFailedMailsNone')}</p>
        ) : (
          <ul className="pc-order__items" data-testid="system-failed-mails">
            {failed.docs.map((m) => {
              const orderId = typeof m.order === 'object' ? m.order?.id : m.order
              const label =
                ENUM_LABELS.EMAIL_TEMPLATES[m.template as EmailTemplate]?.de ?? m.template
              const resent = resentAt.get(m.id)
              return (
                <li key={m.id} className="pc-order__item pc-settings__task">
                  <span>
                    <strong>{label}</strong> · {fmt(m.createdAt)}
                    {orderId ? (
                      <>
                        {' '}
                        ·{' '}
                        <a
                          className="pc-admin-link"
                          href={`${adminRoute}${adminView('bestellung').path.replace(':id', String(orderId))}`}
                        >
                          {adminText('systemOrder', { id: orderId })}
                        </a>
                      </>
                    ) : null}
                    {m.lastError ? (
                      <span className="pc-order__muted"> · {m.lastError.slice(0, 200)}</span>
                    ) : null}
                  </span>
                  <FailedMailAction
                    orderId={orderId}
                    template={m.template}
                    label={label}
                    resentText={
                      resent ? adminText('systemResent', { date: fmt(resent) }) : undefined
                    }
                    resentTestId={`system-resent-${m.id}`}
                    notHereText={
                      orderId && isResendable(m.template)
                        ? undefined
                        : adminText('systemResendNotHere')
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="pc-order__section" aria-labelledby="system-webhooks">
        <h2 id="system-webhooks">{adminText('systemWebhooks')}</h2>
        {webhooks.docs.length === 0 ? (
          <p>{adminText('systemWebhooksNone')}</p>
        ) : (
          <ul className="pc-order__items" data-testid="system-webhooks">
            {webhooks.docs.map((w) => (
              <li key={w.id} className="pc-order__item">
                <span>
                  <strong>{w.type}</strong> · {fmt(w.receivedAt)}{' '}
                  <StatusBadge tone={w.status === 'failed' ? 'error' : 'warning'}>
                    {ENUM_LABELS.WEBHOOK_EVENT_STATUSES?.[w.status]?.de ?? w.status}
                  </StatusBadge>
                  {w.lastError ? (
                    <span className="pc-order__muted"> · {w.lastError.slice(0, 200)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
