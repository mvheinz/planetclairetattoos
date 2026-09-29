import { createElement } from 'react'
import { z } from 'zod'

import type { Locale } from '@/lib/enums'
import {
  CustomerFooter,
  customerFooterText,
  EmailLayout,
  mailLinks,
  renderMailHtml,
  type MailBusiness,
  type MailLinks,
} from '@/lib/email/layout'
import { getTemplate, type RenderedMail, type TemplateDef } from '@/lib/email/registry'
import type { EmailTemplate } from '@/lib/enums'

import { FORBIDDEN_CONTENT_PATTERNS } from './forbiddenPatterns'

// Snapshot-Hilfe für Mails (P4.13, KONZEPT §6.1 „Tests“): Vorlagen mit festen Fixture-Daten rendern (feste Zeit, feste
// Links, feste Anbieterkennung) und auf Verbotsmuster prüfen (V-01, V-02, V-09, R-080).

export const MAIL_FIXTURE_NOW = new Date('2026-10-14T09:30:00.000Z')
export const MAIL_FIXTURE_SITE = 'https://planetclairetattoos.com'
export const MAIL_FIXTURE_ADMIN_ROUTE = '/werkstatt'
export const MAIL_FIXTURE_BUSINESS: MailBusiness = {
  legalName: 'Jutta Beispiel',
  tradeName: 'Planet Claire',
  street: 'Werkstattweg 7',
  postalCode: '10999',
  city: 'Berlin',
  email: 'jutta@planetclairetattoos.com',
}
/** Telefonnummer der Fixture-Verwaltung – darf in keinem Mail-Fuß stehen (R-021). */
export const MAIL_FIXTURE_PHONE = '+49 30 1234567'

export function fixtureLinks(locale: Locale, withStatusLink = false): MailLinks {
  return mailLinks({
    siteUrl: MAIL_FIXTURE_SITE,
    adminRoute: MAIL_FIXTURE_ADMIN_ROUTE,
    locale,
    withStatusLink,
  })
}

/** Rendert eine umgesetzte Vorlage mit Fixture-Daten. */
export function renderFixture(
  template: EmailTemplate,
  data: Record<string, unknown>,
  locale: Locale,
  options: { withStatusLink?: boolean } = {},
): Promise<RenderedMail> {
  const def = getTemplate(template)
  return def.render({
    locale,
    data: def.schema.parse(data),
    links: fixtureLinks(locale, options.withStatusLink ?? false),
    business: MAIL_FIXTURE_BUSINESS,
    now: MAIL_FIXTURE_NOW,
  })
}

/** Fixture-Daten je umgesetzter Vorlage (für Snapshots und den Werbe-/OS-Scan über alle Vorlagen). */
export const MAIL_FIXTURE_DATA: Partial<Record<EmailTemplate, Record<string, unknown>>> = {
  admin_alert: {
    kind: 'payment_webhook',
    summary: 'Zahlung konnte nicht zugeordnet werden',
    affected: 'Bestellung PC-2026-00017',
    automatic: 'Die Zahlung wurde gespeichert, die Bestellung ist markiert.',
    todo: 'Bitte in der Verwaltung prüfen.',
    adminPath: '/collections/orders/17',
  },
}

/**
 * Test-Kund:innen-Vorlage (Bestellmail) für Layout-, Fuß- und Status-Link-Tests, bis die echten Vorlagen (P4.14 ff.)
 * da sind. Wird per `__setTemplateForTests` für einen Schlüssel eingesetzt.
 */
export const fixtureCustomerTemplate: TemplateDef<{ orderNumber: string }> = {
  version: 'test-1',
  schema: z.object({ orderNumber: z.string() }),
  subject: (d, locale) =>
    locale === 'de' ? `Test zu deiner Bestellung ${d.orderNumber}` : `Test for ${d.orderNumber}`,
  async render({ locale, data, links, business }) {
    const subject =
      locale === 'de'
        ? `Test zu deiner Bestellung ${data.orderNumber}`
        : `Test for ${data.orderNumber}`
    const footer = { locale, business, links, orderMail: true }
    const status = links.orderStatus
    const html = await renderMailHtml(
      createElement(
        EmailLayout,
        { locale, title: subject, footer: createElement(CustomerFooter, footer) },
        createElement('p', null, data.orderNumber),
        status ? createElement('p', null, createElement('a', { href: status }, 'Status')) : null,
      ),
    )
    const text = [subject, '', status ? `Status: ${status}` : '', customerFooterText(footer)].join(
      '\n',
    )
    return { subject, html, text, images: [] }
  },
}

// --- Scans ---------------------------------------------------------------------------------------------------------

/** V-09 (RECHT §5): Werbung und Tracking in Transaktionsmails. */
export const V09_PATTERNS: readonly RegExp[] = [
  /instagram\.com/i,
  /Folge\s+(mir|uns)/i,
  /Newsletter/i,
  /Gutschein/i,
  /Rabatt/i,
  /neue\s+Stücke/i,
  /Das\s+könnte\s+dir/i,
  /utm_/i,
  /[?&](fbclid|gclid|mc_eid|mc_cid)=/i,
]

/** Verstöße einer gerenderten Mail (leer = in Ordnung). */
export function scanMail(
  mail: { html: string; text: string },
  siteUrl = MAIL_FIXTURE_SITE,
): string[] {
  const out: string[] = []
  const all = `${mail.html}\n${mail.text}`
  for (const f of FORBIDDEN_CONTENT_PATTERNS.filter((x) => ['V-01', 'V-02'].includes(x.id))) {
    if (f.re.test(all)) out.push(f.id)
  }
  for (const re of V09_PATTERNS) if (re.test(all)) out.push(`V-09 ${re}`)
  // Bilder nur per CID (keine externen Bilder, keine Tracking-Pixel)
  for (const m of mail.html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/gi)) {
    if (!m[1]!.startsWith('cid:')) out.push(`img ${m[1]}`)
  }
  // Links nur auf die eigene Domain bzw. mailto:
  const own = new URL(siteUrl).host
  for (const m of mail.html.matchAll(/\bhref="([^"]*)"/gi)) {
    const href = m[1]!
    if (href.startsWith('mailto:')) continue
    try {
      if (new URL(href).host !== own) out.push(`link ${href}`)
    } catch {
      out.push(`link ${href}`)
    }
  }
  // Stylesheets oder Schriften von außen
  if (/<link\b|@import|url\(/i.test(mail.html)) out.push('externe Ressource')
  return out
}
