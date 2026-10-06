import React from 'react'

import { GOLIVE_GROUP_LABELS, type GoliveGroup, type GoliveReport } from '@/lib/golive/checks'
import { requiredProductionAgreements } from '@/lib/legal/services'

import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'

// Einstellungen → System → „Startklar“ (PLAN P10.14, KONZEPT §7.16, R-210): jeder Prüfpunkt grün/rot mit Erklärung in
// Juttas Sprache; dieselbe Prüffunktion wie `pnpm check:golive`. Zusätzlich die AVV-Liste aus der DIENSTE-YAML.

const GROUP_ORDER: GoliveGroup[] = [
  'texts',
  'business',
  'payment',
  'services',
  'data',
  'system',
  'content',
]

export function StartklarSection({
  report,
  signedAgreementIds,
}: {
  report: GoliveReport
  signedAgreementIds: ReadonlySet<string>
}) {
  const open = report.checks.filter((c) => !c.ok).length
  return (
    <section
      className="pc-order__section"
      aria-labelledby="system-startklar"
      data-testid="startklar"
    >
      <h2 id="system-startklar">{adminText('systemStartklar')}</h2>
      <Notice tone={report.ready ? 'success' : 'warning'} data-testid="startklar-summary">
        {report.ready
          ? adminText('systemStartklarGreen')
          : adminText('systemStartklarRed', { n: open, total: report.checks.length })}
      </Notice>
      {GROUP_ORDER.map((group) => {
        const rows = report.checks.filter((c) => c.group === group)
        if (rows.length === 0) return null
        return (
          <div key={group}>
            <h3>{GOLIVE_GROUP_LABELS[group]}</h3>
            <ul className="pc-order__items" data-testid={`startklar-group-${group}`}>
              {rows.map((c) => (
                <li
                  key={c.id}
                  className="pc-order__item"
                  data-testid="startklar-check"
                  data-check={c.id}
                  data-ok={c.ok ? 'true' : 'false'}
                >
                  <StatusBadge tone={c.ok ? 'success' : 'error'}>
                    {adminText(c.ok ? 'systemStartklarOk' : 'systemStartklarOpen')}
                  </StatusBadge>{' '}
                  <strong>{c.title}</strong>
                  <br />
                  <span className="pc-order__muted">{c.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      <h3>{adminText('systemStartklarAvv')}</h3>
      <ul className="pc-order__items" data-testid="startklar-avv">
        {requiredProductionAgreements().map((s) => (
          <li key={s.id} className="pc-order__item" data-avv={s.id}>
            <strong>{s.name}</strong>{' '}
            <StatusBadge tone={signedAgreementIds.has(s.id) ? 'success' : 'error'}>
              {adminText(
                signedAgreementIds.has(s.id) ? 'systemStartklarAvvDone' : 'systemStartklarAvvOpen',
              )}
            </StatusBadge>
          </li>
        ))}
      </ul>
    </section>
  )
}
