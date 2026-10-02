import React from 'react'

import {
  ADMIN_TEMPLATE_KEYS,
  ADMIN_TEMPLATE_STATUS,
  ADMIN_TEMPLATES,
  renderAdminTemplate,
  templateFitsOrder,
  type RenderedAdminTemplate,
} from '@/lib/legal/templates'
import { translationAvailability } from '@/lib/translation'
import type { Order } from '@/payload-types'

import { CopyButton } from '../../components/CopyButton'
import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { MailTextsForm } from '../settings/AreaForms'
import { initialMailTexts, type Obj } from '../settings/settingsAreas'
import { LegalTextsArea } from './LegalTextsArea'

// Ansicht „Texte“ `/texte` (PLAN P5.27, KONZEPT §7.13): Übersicht mit den Bereichen Seiten und FAQ (kommt in P8),
// Rechtstexte (P6.4, `LegalTextsArea`), Mail-Bausteine (Signatur, Abhol-Vorlage, Antwortzeit-Satz – DE/EN mit „Übersetzen“) und
// Vorlagen zum Öffnen im Mailprogramm (`mailto:`) bzw. zum Kopieren. Mit einer Bestellnummer (`?bestellung=…`) werden
// Name, Nummer, Betrag und Signatur eingesetzt; ohne zeigt die Ansicht die Vorlagen mit Platzhaltern.

type Locale = 'de' | 'en'

const ORDER_NUMBER_RE = /^[A-Z]{2,4}-\d{4}-\d{5}$/

function param(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim().toUpperCase() ?? ''
}

async function loadGlobal(
  req: AdminViewBodyProps['req'],
  slug: 'settings' | 'site-texts',
  locale: Locale,
) {
  return (await req.payload.findGlobal({
    slug,
    locale,
    fallbackLocale: false,
    depth: 0,
    overrideAccess: true,
    req,
  })) as unknown as Obj
}

function TemplateCard({
  keyName,
  rendered,
}: {
  keyName: (typeof ADMIN_TEMPLATE_KEYS)[number]
  rendered: RenderedAdminTemplate | null
}) {
  const def = ADMIN_TEMPLATES[keyName]
  const headingId = `tpl-${keyName}`
  const subject = rendered?.subject ?? def.subject.de
  const body = rendered?.body ?? def.body.de
  return (
    <li className="pc-order__card" data-testid="text-template" data-key={keyName}>
      <h3 id={headingId} className="pc-order__cardtitle">
        {def.title} <StatusBadge tone="warning">{ADMIN_TEMPLATE_STATUS}</StatusBadge>
      </h3>
      <p className="pc-order__meta">{def.purpose}</p>
      <p className="pc-order__muted">{adminText('textsTemplateFits', { fits: def.fits })}</p>
      {def.replacedBy ? <p className="pc-order__muted">{def.replacedBy}</p> : null}
      {rendered?.ownerNote ? (
        <Notice tone="warning" data-testid="text-template-owner-note">
          {rendered.ownerNote}
        </Notice>
      ) : null}
      <p className="pc-order__meta">
        <strong>{adminText('textsSubject')}</strong> {subject}
      </p>
      <pre className="pc-texts__body" data-testid="text-template-body" aria-labelledby={headingId}>
        {body}
      </pre>
      {rendered ? (
        <p className="pc-admin-row">
          <a
            href={rendered.mailto}
            className="pc-admin-btn pc-admin-btn--primary"
            data-testid="text-template-mailto"
          >
            {adminText('textsOpenMail')}
          </a>
          <CopyButton
            text={`${rendered.subject}\n\n${rendered.body}`}
            label={adminText('textsCopy')}
            data-testid="text-template-copy"
          />
        </p>
      ) : null}
    </li>
  )
}

export async function TextsView({ adminRoute, req, searchParams, match }: AdminViewBodyProps) {
  const [settingsDe, settingsEn, textsDe, textsEn] = await Promise.all([
    loadGlobal(req, 'settings', 'de'),
    loadGlobal(req, 'settings', 'en'),
    loadGlobal(req, 'site-texts', 'de'),
    loadGlobal(req, 'site-texts', 'en'),
  ])
  const mailTexts = initialMailTexts(
    { de: settingsDe, en: settingsEn },
    { de: textsDe, en: textsEn },
  )
  const translation = translationAvailability()

  const orderNumber = param(searchParams?.bestellung)
  let order: Order | null = null
  if (orderNumber && ORDER_NUMBER_RE.test(orderNumber)) {
    const res = await req.payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    order = (res.docs[0] as Order | undefined) ?? null
  }
  const business = (settingsDe.business ?? {}) as { tradeName?: string; legalName?: string }
  const signatureOf = (locale: Locale): string => {
    const own = (mailTexts.signature[locale] || mailTexts.signature.de).trim()
    if (own) return own
    const name = business.tradeName || business.legalName || ''
    return `${locale === 'en' ? 'Best wishes,' : 'Liebe Grüße'}\n${name}`.trim()
  }
  const rendered = (key: (typeof ADMIN_TEMPLATE_KEYS)[number]) => {
    if (!order || !templateFitsOrder(key, order)) return null
    return renderAdminTemplate(key, { order, signature: signatureOf(order.locale) })
  }
  const allData = (path: string) => `${adminRoute}${path}`

  return (
    <div className="pc-order pc-texts" data-testid="texts">
      <section className="pc-order__section" aria-labelledby="texts-pages">
        <h2 id="texts-pages">{adminText('textsPages')}</h2>
        <Notice
          tone="info"
          action={{ href: allData('/collections/pages'), label: adminText('shellOpenAllData') }}
          data-testid="texts-pages-later"
        >
          {adminText('textsPagesLater')}
        </Notice>
      </section>

      <section
        className="pc-order__section"
        aria-labelledby="texts-legal"
        data-testid="texts-legal"
      >
        <h2 id="texts-legal">{adminText('textsLegal')}</h2>
        <LegalTextsArea adminRoute={adminRoute} req={req} match={match} />
      </section>

      <section className="pc-order__section" aria-labelledby="texts-mail" data-testid="texts-mail">
        <h2 id="texts-mail">{adminText('textsMail')}</h2>
        <p className="pc-order__muted">{adminText('textsMailHint')}</p>
        <MailTextsForm
          initial={mailTexts}
          translateDisabled={translation.enabled ? null : (translation.reason ?? null)}
        />
      </section>

      <section
        className="pc-order__section"
        aria-labelledby="texts-templates"
        data-testid="texts-templates"
      >
        <h2 id="texts-templates">{adminText('textsTemplates')}</h2>
        <p className="pc-order__muted">{adminText('textsTemplatesHint')}</p>
        <form method="get" className="pc-settings__form" role="search">
          <div className="pc-field">
            <label htmlFor="texts-order" className="pc-field__label">
              {adminText('textsOrderLabel')}
            </label>
            <input
              id="texts-order"
              name="bestellung"
              type="text"
              defaultValue={orderNumber}
              placeholder="PC-2026-00017"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="texts-order-hint"
              data-testid="texts-order-input"
            />
            <p id="texts-order-hint" className="pc-order__muted">
              {adminText('textsOrderHint')}
            </p>
          </div>
          <p className="pc-admin-row">
            <button type="submit" className="pc-admin-btn pc-admin-btn--secondary">
              {adminText('textsOrderApply')}
            </button>
          </p>
        </form>
        {orderNumber && !order ? (
          <Notice tone="warning" data-testid="texts-order-missing">
            {adminText('textsOrderMissing', { number: orderNumber })}
          </Notice>
        ) : null}
        {order ? (
          <p role="status" className="pc-order__count" data-testid="texts-order-active">
            {adminText('textsOrderActive', {
              number: order.orderNumber,
              locale: order.locale === 'en' ? 'Englisch' : 'Deutsch',
            })}
          </p>
        ) : null}
        <ul className="pc-order__list">
          {ADMIN_TEMPLATE_KEYS.map((key) => (
            <TemplateCard key={key} keyName={key} rendered={rendered(key)} />
          ))}
        </ul>
      </section>
    </div>
  )
}
