import Link from 'next/link'
import React from 'react'

import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  COUNTRY_CODES,
  LEGAL_TEXT_TYPES,
  PRODUCT_CATEGORIES,
  TAX_MODES,
  type TaxMode,
} from '@/lib/enums'
import { getEnv } from '@/lib/env'
import { processorAgreementServices } from '@/lib/legal/services'
import { getPaymentsAdapter } from '@/lib/payments'
import { previewRetention, type RetentionPreviewRow } from '@/lib/retention/jobs'
import { ADOPTABLE_COLLECTIONS } from '@/lib/seed/adopt'
import { seedSummary } from '@/lib/seed/remove'
import { seedRemovalLockedTypes } from '@/lib/seed/removeLock'
import { startklarStatus } from '@/lib/settings/readiness'
import { translationAvailability } from '@/lib/translation'
import { berlinDateKey, formatBerlin } from '@/lib/time'
import type { Setting } from '@/payload-types'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminView } from '../registry'
import {
  AnalyticsForm,
  CostsForm,
  LegalForm,
  ProcessorAgreementsForm,
  ShopForm,
  TaxConfirmForm,
  TemplatesForm,
  YearTotalsForm,
} from './AreaForms'
import { ProcessorAgreementUpload } from './ProcessorAgreementUpload'
import { type AdoptGroup, SeedArea } from './SeedArea'
import { areaText, initialAreaValues, initialProcessorAgreements, type Obj } from './settingsAreas'
import { getPath, SETTINGS_SECTIONS, type SettingsSectionKey } from './settingsForm'
import { PasswordForm, SettingsSectionForm, TaxModeForm } from './SettingsForms'

// Ansicht „Einstellungen“ `/einstellungen` (PLAN P5.21, KONZEPT §7.14): Bereiche als Handy-Formulare über dem Global
// `settings` – Stammdaten & Impressum, Steuer (Modus-Verlauf mit „gilt ab“, Aufbewahrung 8/10 Jahre), Zahlung
// (Bankdaten; Zahlungsanbieter und Vorkasse-Fristen nur Anzeige), Benachrichtigungen, Rechtstexte (Übersicht, P6),
// Konto (Passwort ändern, Abmelden). Teil 2 und 3 (P5.22/P5.22a): Shop, Kosten, Vorlagen, Steuer-Bestätigung mit
// Jahressummen vor dem Shop, Datenschutz & Dienste (Statistik), Rechtstexte (Intervall, Marken-Schalter), Beispieldaten
// (Anzahl je Collection, Entfernen und Übernehmen – P8.19, `SeedArea`). Versand, Umsatz-Wächter, System und Produktsicherheit haben eigene
// Unterseiten.

const AREAS = [
  ['stammdaten', 'settingsAreaBusiness'],
  ['steuer', 'settingsAreaTax'],
  ['zahlung', 'settingsAreaPayment'],
  ['shop', 'settingsAreaShop'],
  ['kosten', 'settingsAreaCosts'],
  ['vorlagen', 'settingsAreaTemplates'],
  ['datenschutz', 'settingsAreaPrivacy'],
  ['rechtstexte', 'settingsAreaLegal'],
  ['benachrichtigungen', 'settingsAreaNotifications'],
  ['beispieldaten', 'settingsAreaSeed'],
  ['konto', 'settingsAreaAccount'],
] as const

const SUBVIEWS = [
  ['versand', 'settings-shipping'],
  ['umsatz-waechter', 'settings-revenue'],
  ['system', 'settings-system'],
  ['produktsicherheit', 'settings-product-safety'],
] as const

function collectionLabel(req: AdminViewBodyProps['req'], slug: string): string {
  const collections = req.payload.collections as Record<
    string,
    { config: { labels?: unknown } } | undefined
  >
  const labels = collections[slug]?.config.labels as { plural?: unknown } | undefined
  const plural = labels?.plural
  if (typeof plural === 'string') return plural
  if (plural && typeof plural === 'object' && 'de' in plural) return String(plural.de)
  return slug
}

const ADOPT_TITLE: Record<AdoptGroup['collection'], (d: Record<string, unknown>) => unknown> = {
  products: (d) =>
    d.itemNumber ? `${String(d.itemNumber)} · ${String(d.adminTitle ?? '')}` : d.adminTitle,
  flash: (d) =>
    d.number ? `F-${String(d.number).padStart(3, '0')} · ${String(d.title ?? '')}` : d.title,
  'tattoo-gallery': (d) => d.caption,
  media: (d) => d.filename,
}

/** Beispiele, die sich einzeln übernehmen lassen (DATENMODELL §13.4). */
async function loadAdoptGroups(req: AdminViewBodyProps['req']): Promise<AdoptGroup[]> {
  const groups: AdoptGroup[] = []
  for (const collection of ADOPTABLE_COLLECTIONS) {
    const res = await req.payload.find({
      collection,
      where: { seed: { equals: true } },
      limit: 300,
      depth: 0,
      locale: 'de',
      sort: collection === 'products' ? 'itemNumber' : collection === 'flash' ? 'number' : 'id',
      overrideAccess: true,
      req,
    })
    groups.push({
      collection,
      label: collectionLabel(req, collection),
      items: (res.docs as unknown as Array<Record<string, unknown> & { id: number }>).map((d) => {
        const t = ADOPT_TITLE[collection](d)
        return { id: d.id, title: typeof t === 'string' && t.trim() ? t : `#${d.id}` }
      }),
    })
  }
  return groups
}

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

/** Tage der Löschvorschau (LOESCHKONZEPT §4 Regel 5). */
export const DELETION_PREVIEW_DAYS = 30

const ACTION_KEY = {
  deleted: 'deletionPreviewDeleted',
  anonymized: 'deletionPreviewAnonymized',
  files_deleted: 'deletionPreviewFiles',
  restricted: 'deletionPreviewRestricted',
} as const

/** Löschvorschau (Einstellungen → Datenschutz, PLAN P6.15): Trockenlauf aller Löschjobs, je Regel die Anzahl. */
function DeletionPreview({
  rows,
  now,
  label,
}: {
  rows: RetentionPreviewRow[]
  now: Date
  label: (slug: string) => string
}) {
  const due = rows.filter((r) => r.count > 0)
  return (
    <div data-testid="deletion-preview">
      <h3 id="deletion-preview">{adminText('deletionPreviewTitle')}</h3>
      <p className="pc-order__muted">
        {adminText('deletionPreviewIntro', {
          days: DELETION_PREVIEW_DAYS,
          date: formatBerlin(now, 'dd.MM.yyyy, HH:mm'),
        })}
      </p>
      {due.length === 0 ? (
        <p data-testid="deletion-preview-none">
          {adminText('deletionPreviewNone', { days: DELETION_PREVIEW_DAYS })}
        </p>
      ) : (
        <table className="pc-revenue__table" aria-labelledby="deletion-preview">
          <thead>
            <tr>
              <th scope="col">{adminText('deletionPreviewRule')}</th>
              <th scope="col">{adminText('deletionPreviewArea')}</th>
              <th scope="col">{adminText('deletionPreviewAction')}</th>
              <th scope="col">{adminText('deletionPreviewCount')}</th>
            </tr>
          </thead>
          <tbody>
            {due.map((r) => (
              <tr key={`${r.task}-${r.ruleId}-${r.collection}`} data-rule={r.ruleId}>
                <td>{r.ruleId}</td>
                <td>{label(r.collection)}</td>
                <td>
                  {adminText(
                    ACTION_KEY[r.action as keyof typeof ACTION_KEY] ?? 'deletionPreviewDeleted',
                  )}
                </td>
                <td>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export async function SettingsView({ adminRoute, req }: AdminViewBodyProps) {
  const load = (locale: 'de' | 'en') =>
    req.payload.findGlobal({
      slug: 'settings',
      depth: 0,
      locale,
      fallbackLocale: false,
      overrideAccess: true,
      req,
    })
  const settings = (await load('de')) as Setting
  const settingsEn = (await load('en')) as Setting
  const area = initialAreaValues(settings as unknown as Obj, settingsEn as unknown as Obj)
  const now = new Date()
  const deletionPreview = await previewRetention(req.payload, now, DELETION_PREVIEW_DAYS)
  const modes = [...(settings.tax?.modes ?? [])]
  const payment = settings.payment ?? {}
  const countries = enumOptions(COUNTRY_CODES, ENUM_LABELS.COUNTRY_CODES)
  const production = getEnv().APP_ENV === 'production'
  const startklar = startklarStatus()
  const translation = translationAvailability()
  const seedCounts = Object.entries(await seedSummary(req.payload))
  const seedLocked = await seedRemovalLockedTypes(req.payload, now)
  const adoptGroups = seedCounts.length > 0 ? await loadAdoptGroups(req) : []
  const categories = PRODUCT_CATEGORIES.map((c) => ({
    value: c,
    label: ENUM_LABELS.PRODUCT_CATEGORIES[c].de,
  }))
  const avv = initialProcessorAgreements(
    processorAgreementServices().map((x) => ({ id: x.id, name: x.name })),
    settings.processorAgreements,
  )
  const avvFiles = (
    await req.payload.find({
      collection: 'private-uploads',
      where: { purpose: { equals: 'processor_agreement' } },
      select: { filename: true, createdAt: true },
      sort: '-createdAt',
      limit: 200,
      depth: 0,
      overrideAccess: true,
      req,
    })
  ).docs.map((d) => ({
    value: String(d.id),
    label: `${d.filename ?? `#${d.id}`} (${formatBerlin(new Date(d.createdAt), 'dd.MM.yyyy')})`,
  }))
  const confirmedAt = settings.tax?.confirmedAt
    ? formatBerlin(new Date(settings.tax.confirmedAt), 'dd.MM.yyyy')
    : null

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
          {SUBVIEWS.map(([key, testId]) => (
            <li key={key}>
              <Link
                href={`${adminRoute}${adminView(key).path}`}
                prefetch={false}
                className="pc-admin-link"
                data-testid={testId}
              >
                {adminView(key).title}
              </Link>
            </li>
          ))}
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
        <h3>{areaText('taxConfirmTitle')}</h3>
        <TaxConfirmForm confirmedAt={confirmedAt} />
        <h3>{areaText('yearTotals')}</h3>
        <YearTotalsForm initial={area.yearTotals} idPrefix="settings-tax" />
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

      <section id="shop" className="pc-order__section" aria-labelledby="settings-shop">
        <h2 id="settings-shop">{adminText('settingsAreaShop')}</h2>
        <ShopForm
          initial={area.shop}
          blocked={production && !startklar.ready ? startklar.openItems : null}
          translateDisabled={translation.enabled ? null : (translation.reason ?? null)}
        />
      </section>

      <section id="kosten" className="pc-order__section" aria-labelledby="settings-costs">
        <h2 id="settings-costs">{adminText('settingsAreaCosts')}</h2>
        <CostsForm initial={area.costs} />
      </section>

      <section id="vorlagen" className="pc-order__section" aria-labelledby="settings-templates">
        <h2 id="settings-templates">{adminText('settingsAreaTemplates')}</h2>
        <TemplatesForm initial={area.templates} categories={categories} />
      </section>

      <section id="datenschutz" className="pc-order__section" aria-labelledby="settings-privacy">
        <h2 id="settings-privacy">{adminText('settingsAreaPrivacy')}</h2>
        <h3>{adminText('settingsAnalyticsTitle')}</h3>
        <AnalyticsForm initial={area.analytics} />
        <h3 id="auftragsverarbeitung">{areaText('avvTitle')}</h3>
        <ProcessorAgreementsForm initial={avv} files={avvFiles} />
        <ProcessorAgreementUpload />
        <DeletionPreview
          rows={deletionPreview}
          now={now}
          label={(slug) => collectionLabel(req, slug)}
        />
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
              <Link
                href={`${adminRoute}${adminView('texte').path}#texts-legal`}
                prefetch={false}
                className="pc-admin-link"
              >
                {adminText('settingsLegalEdit')}
              </Link>
            </li>
          ))}
        </ul>
        <LegalForm initial={area.legal} />
      </section>

      <section id="beispieldaten" className="pc-order__section" aria-labelledby="settings-seed">
        <h2 id="settings-seed">{adminText('settingsAreaSeed')}</h2>
        <SeedArea
          counts={seedCounts.map(([slug, count]) => ({
            slug,
            label: collectionLabel(req, slug),
            count,
          }))}
          lockedTypes={seedLocked.map((t) => ENUM_LABELS.LEGAL_TEXT_TYPES[t].de)}
          adoptGroups={adoptGroups}
        />
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
    </div>
  )
}
