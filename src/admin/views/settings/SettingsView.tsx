import Link from 'next/link'
import React from 'react'

import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { COUNTRY_CODES, LEGAL_TEXT_TYPES, TAX_MODES, type TaxMode } from '@/lib/enums'
import { getPaymentsAdapter } from '@/lib/payments'
import { berlinDateKey, formatBerlin } from '@/lib/time'
import type { Setting } from '@/payload-types'

import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminView } from '../registry'
import { getPath, SETTINGS_SECTIONS, type SettingsSectionKey } from './settingsForm'
import { PasswordForm, SettingsSectionForm, TaxModeForm } from './SettingsForms'

// Ansicht „Einstellungen“ `/einstellungen` (PLAN P5.21, KONZEPT §7.14): Bereiche als Handy-Formulare über dem Global
// `settings` – Stammdaten & Impressum, Steuer (Modus-Verlauf mit „gilt ab“, Aufbewahrung 8/10 Jahre), Zahlung
// (Bankdaten; Zahlungsanbieter und Vorkasse-Fristen nur Anzeige), Benachrichtigungen, Rechtstexte (Übersicht, P6),
// Konto (Passwort ändern, Abmelden). Versand, Beispieldaten und System folgen in P5.22.

const AREAS = [
  ['stammdaten', 'settingsAreaBusiness'],
  ['steuer', 'settingsAreaTax'],
  ['zahlung', 'settingsAreaPayment'],
  ['benachrichtigungen', 'settingsAreaNotifications'],
  ['rechtstexte', 'settingsAreaLegal'],
  ['konto', 'settingsAreaAccount'],
] as const

function initialOf(settings: Setting, section: SettingsSectionKey): Record<string, string> {
  return Object.fromEntries(
    SETTINGS_SECTIONS[section].map((s) => {
      const v = getPath(settings, s.path)
      return [s.path, v === null || v === undefined ? '' : String(v)]
    }),
  )
}

function paymentsModeLabel(): string {
  try {
    const mode = getPaymentsAdapter().mode
    return adminText(
      mode === 'live'
        ? 'settingsPaymentsLive'
        : mode === 'test'
          ? 'settingsPaymentsTest'
          : 'settingsPaymentsMock',
    )
  } catch {
    return adminText('settingsPaymentsUnknown')
  }
}

export async function SettingsView({ adminRoute, req }: AdminViewBodyProps) {
  const settings = (await req.payload.findGlobal({
    slug: 'settings',
    depth: 0,
    locale: 'de',
    overrideAccess: true,
    req,
  })) as Setting
  const now = new Date()
  const modes = [...(settings.tax?.modes ?? [])]
  const payment = settings.payment ?? {}
  const countries = enumOptions(COUNTRY_CODES, ENUM_LABELS.COUNTRY_CODES)

  return (
    <div className="pc-order pc-settings" data-testid="settings">
      <nav aria-label={adminText('settingsAreas')}>
        <ul className="pc-settings__areas">
          {AREAS.map(([id, key]) => (
            <li key={id}>
              <a href={`#${id}`} className="pc-admin-link">
                {adminText(key)}
              </a>
            </li>
          ))}
          <li>
            <Link
              href={`${adminRoute}${adminView('produktsicherheit').path}`}
              prefetch={false}
              className="pc-admin-link"
              data-testid="settings-product-safety"
            >
              {adminText('settingsProductSafety')}
            </Link>
          </li>
        </ul>
      </nav>

      <section id="stammdaten" className="pc-order__section" aria-labelledby="settings-business">
        <h2 id="settings-business">{adminText('settingsAreaBusiness')}</h2>
        <p className="pc-order__muted">{adminText('settingsBusinessIntro')}</p>
        <SettingsSectionForm
          section="business"
          initial={initialOf(settings, 'business')}
          options={{ 'business.country': countries }}
        />
      </section>

      <section id="steuer" className="pc-order__section" aria-labelledby="settings-tax">
        <h2 id="settings-tax">{adminText('settingsAreaTax')}</h2>
        <h3>{adminText('settingsTaxHistory')}</h3>
        <ul className="pc-order__items" data-testid="settings-tax-modes">
          {modes.map((m, i) => {
            const from = m.validFrom ? new Date(m.validFrom) : null
            const current =
              from !== null &&
              from <= now &&
              !modes.some(
                (o) =>
                  o !== m &&
                  o.validFrom &&
                  new Date(o.validFrom) <= now &&
                  new Date(o.validFrom) > from,
              )
            return (
              <li key={m.id ?? i} className="pc-order__item">
                <span>
                  <strong>{ENUM_LABELS.TAX_MODES[m.mode as TaxMode]?.de ?? m.mode}</strong> ·{' '}
                  {adminText('settingsTaxValidFromShort', {
                    date: from ? formatBerlin(from, 'dd.MM.yyyy') : '–',
                  })}
                  {current ? (
                    <>
                      {' '}
                      <StatusBadge tone="success">{adminText('settingsTaxCurrent')}</StatusBadge>
                    </>
                  ) : null}
                  {m.reason ? <span className="pc-order__muted"> · {m.reason}</span> : null}
                </span>
              </li>
            )
          })}
        </ul>
        <TaxModeForm
          modes={TAX_MODES.map((m) => ({ value: m, label: ENUM_LABELS.TAX_MODES[m].de }))}
          today={berlinDateKey(now)}
        />
        <h3>{adminText('settingsRetentionTitle')}</h3>
        <SettingsSectionForm
          section="retention"
          initial={initialOf(settings, 'retention')}
          confirm={{
            title: adminText('settingsRetentionConfirmTitle'),
            consequence: adminText('settingsRetentionConfirm'),
          }}
        />
      </section>

      <section id="zahlung" className="pc-order__section" aria-labelledby="settings-payment">
        <h2 id="settings-payment">{adminText('settingsAreaPayment')}</h2>
        <dl className="pc-order__facts" data-testid="settings-payment-info">
          <dt>{adminText('settingsPaymentsProvider')}</dt>
          <dd data-testid="settings-payments-mode">{paymentsModeLabel()}</dd>
          <dt>{adminText('settingsPrepayment')}</dt>
          <dd>
            {payment.prepaymentEnabled === false
              ? adminText('settingsPrepaymentOff')
              : adminText('settingsPrepaymentOn')}
          </dd>
          <dt>{adminText('settingsPrepaymentDeadlines')}</dt>
          <dd>
            {adminText('settingsPrepaymentDeadlinesText', {
              hours: payment.prepaymentReminderHours ?? 72,
              days: payment.prepaymentDays ?? 5,
            })}
          </dd>
        </dl>
        <SettingsSectionForm section="payment" initial={initialOf(settings, 'payment')} />
      </section>

      <section
        id="benachrichtigungen"
        className="pc-order__section"
        aria-labelledby="settings-notifications"
      >
        <h2 id="settings-notifications">{adminText('settingsAreaNotifications')}</h2>
        <SettingsSectionForm
          section="notifications"
          initial={initialOf(settings, 'notifications')}
        />
      </section>

      <section id="rechtstexte" className="pc-order__section" aria-labelledby="settings-legal">
        <h2 id="settings-legal">{adminText('settingsAreaLegal')}</h2>
        <ul className="pc-order__items" data-testid="settings-legal">
          {LEGAL_TEXT_TYPES.map((t) => (
            <li key={t} className="pc-order__item">
              {ENUM_LABELS.LEGAL_TEXT_TYPES[t].de} ·{' '}
              <span className="pc-order__muted">{adminText('settingsLegalLater')}</span>
            </li>
          ))}
        </ul>
        <p className="pc-order__muted">{adminText('settingsLegalReviewLater')}</p>
      </section>

      <section id="konto" className="pc-order__section" aria-labelledby="settings-account">
        <h2 id="settings-account">{adminText('settingsAreaAccount')}</h2>
        <h3>{adminText('settingsPasswordTitle')}</h3>
        <PasswordForm />
        <p className="pc-admin-row">
          <a
            href={`${adminRoute}/logout`}
            className="pc-admin-btn pc-admin-btn--secondary"
            data-testid="settings-logout"
          >
            {adminText('settingsLogout')}
          </a>
        </p>
      </section>

      <Notice tone="info">{adminText('settingsMoreLater')}</Notice>
    </div>
  )
}
