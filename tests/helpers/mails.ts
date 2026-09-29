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
  phone: '+49 30 1234567',
}
/** Telefonnummer der Fixture-Verwaltung – nur in der Anbieterkennung von M01/M02, nie im Mail-Fuß (R-021). */
export const MAIL_FIXTURE_PHONE = '+49 30 1234567'
/** Seed-IBAN (P4.14 „Ohne Jutta“) und Bankdaten der Vorkasse-Fixtures. */
export const MAIL_FIXTURE_BANK = {
  accountHolder: 'Jutta Beispiel',
  iban: 'DE36000000000000000000',
  bic: 'TESTDEFFXXX',
  bankName: 'Beispielbank Berlin',
}

/** Bestellmail-Daten (M01/M02/M05) wie aus `buildOrderMailData`: zwei Stücke, eines mit vereinbarter Abweichung. */
export const ORDER_MAIL_FIXTURE = {
  orderId: 17,
  orderNumber: 'PC-2026-00017',
  placedAt: '2026-10-14T09:28:00.000Z',
  customerName: 'Erika Beispiel',
  items: [
    {
      itemNumber: 17,
      title: 'Tasse „Coco schläft“',
      characteristics: 'Keramik · 300 ml · handbemalt',
      priceCents: 4500,
      deviationText: 'kleiner Glasurfehler am Henkel',
    },
    {
      itemNumber: 23,
      title: 'Cap „Planet“',
      characteristics: 'Baumwolle · Einheitsgröße',
      priceCents: 3900,
    },
  ],
  fulfillmentMethod: 'shipping',
  shippingCents: 690,
  totalCents: 9090,
  taxMode: 'kleinunternehmer',
  paymentMethod: 'card',
  paymentMethodType: 'apple_pay',
  paidAt: '2026-10-14T09:29:00.000Z',
  shippingAddress: {
    name: 'Erika Beispiel',
    addressLine1: 'Musterstraße 1',
    postalCode: '10115',
    city: 'Berlin',
    country: 'DE',
  },
  billingAddress: {
    name: 'Max Rechnung',
    addressLine1: 'Rechnungsweg 2',
    postalCode: '10117',
    city: 'Berlin',
    country: 'DE',
  },
  deliveryTime: '2–5 Werktage',
  legal: {
    agb: { version: 3, date: '2026-09-01T00:00:00.000Z' },
    withdrawal: { version: 2, date: '2026-08-15T00:00:00.000Z' },
  },
  attachmentFiles: ['RE-2026-00042.pdf', 'AGB_v3.pdf', 'Widerrufsbelehrung-und-Formular_v2.pdf'],
  invoiceNumber: 'RE-2026-00042',
  carrierEmailConsent: true,
  unavailable: [],
}

export const PREPAYMENT_MAIL_FIXTURE = {
  ...ORDER_MAIL_FIXTURE,
  paymentMethod: 'prepayment',
  paymentMethodType: null,
  paidAt: null,
  invoiceNumber: null,
  attachmentFiles: ['AGB_v3.pdf', 'Widerrufsbelehrung-und-Formular_v2.pdf'],
  bank: MAIL_FIXTURE_BANK,
  dueAt: '2026-10-19T21:59:59.000Z',
}

export const PREPAYMENT_RECEIVED_FIXTURE = {
  ...PREPAYMENT_MAIL_FIXTURE,
  paidAt: '2026-10-16T08:00:00.000Z',
  invoiceNumber: 'RE-2026-00043',
  attachmentFiles: ['RE-2026-00043.pdf'],
}

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
export const REMINDER_FIXTURE = {
  orderId: 17,
  orderNumber: 'PC-2026-00017',
  customerName: 'Erika Beispiel',
  amountCents: 9090,
  bank: MAIL_FIXTURE_BANK,
  dueAt: '2026-10-19T21:59:59.000Z',
}
export const CANCELLED_FIXTURE = {
  orderId: 17,
  orderNumber: 'PC-2026-00017',
  customerName: 'Erika Beispiel',
  reason: 'payment_timeout',
}
export const OVERSOLD_FIXTURE = {
  orderId: 17,
  orderNumber: 'PC-2026-00017',
  customerName: 'Erika Beispiel',
  items: [{ itemNumber: 17, title: 'Tasse „Coco schläft“' }],
  refundedCents: 5190,
}
export const ADMIN_ORDER_FIXTURE = {
  orderId: 17,
  orderNumber: 'PC-2026-00017',
  transition: 'O1',
  totalCents: 5390,
  fulfillmentMethod: 'shipping',
  items: [{ itemNumber: 17, title: 'Tasse „Coco schläft“', category: 'keramik' }],
  customerName: 'Erika Beispiel',
  city: 'Berlin',
  paymentMethod: 'card',
  paymentMethodType: 'card',
}

export const MAIL_FIXTURE_DATA: Partial<Record<EmailTemplate, Record<string, unknown>>> = {
  order_confirmation: ORDER_MAIL_FIXTURE,
  prepayment_instructions: PREPAYMENT_MAIL_FIXTURE,
  prepayment_received: PREPAYMENT_RECEIVED_FIXTURE,
  prepayment_reminder: REMINDER_FIXTURE,
  prepayment_cancelled: CANCELLED_FIXTURE,
  oversold_apology: OVERSOLD_FIXTURE,
  admin_order_placed: ADMIN_ORDER_FIXTURE,
  admin_prepayment_cancelled: {
    orderId: 17,
    orderNumber: 'PC-2026-00017',
    items: [{ itemNumber: 17, title: 'Tasse „Coco schläft“' }],
  },
  admin_oversold: {
    items: [{ itemNumber: 17, title: 'Tasse „Coco schläft“' }],
    orders: [{ orderId: 18, orderNumber: 'PC-2026-00018' }],
    refundedCents: 5190,
    refundStatus: 'succeeded',
  },
  admin_dispute_opened: {
    orderId: 17,
    orderNumber: 'PC-2026-00017',
    amountCents: 5390,
    reason: 'product_not_received',
    dueBy: '2026-11-02T22:59:59.000Z',
  },
  admin_refund_failed: {
    orderId: 17,
    orderNumber: 'PC-2026-00017',
    amountCents: 4500,
    error: 'expired_or_canceled_card',
  },
  admin_revenue_guard: {
    year: 2026,
    stage: 'U1',
    totalCents: 2_000_000,
    previousYearTotalCents: 0,
    thresholds: {
      u1Cents: 2_000_000,
      previousYearLimitCents: 2_500_000,
      u3Cents: 8_000_000,
      u3aCents: 9_000_000,
      u4Cents: 9_500_000,
      currentYearLimitCents: 10_000_000,
    },
  },
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
