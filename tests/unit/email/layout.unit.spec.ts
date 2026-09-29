import { afterEach, describe, expect, it } from 'vitest'

import {
  adminFooterText,
  cocoVignette,
  COCO_CID,
  customerFooterText,
  STATUS_TOKEN_PLACEHOLDER,
} from '@/lib/email/layout'
import { EmailLayout, renderMailHtml } from '@/lib/email/layout'
import { __setTemplateForTests, implementedTemplates, TEMPLATE_META } from '@/lib/email/registry'
import { EMAIL_TEMPLATES } from '@/lib/enums'

import {
  fixtureCustomerTemplate,
  fixtureLinks,
  MAIL_FIXTURE_BUSINESS,
  MAIL_FIXTURE_DATA,
  MAIL_FIXTURE_PHONE,
  renderFixture,
  scanMail,
} from '../../helpers/mails'

// P4.13 – Mail-Layout, Fußbereiche und Verbotsmuster (KONZEPT §6.1, R-080, R-021, V-01, V-02, V-09).

afterEach(() => __setTemplateForTests('order_shipped'))

describe('Registry (DATENMODELL §4)', () => {
  it('jeder Schlüssel aus EMAIL_TEMPLATES hat genau eine KONZEPT-ID und eine Empfängerart', () => {
    expect(Object.keys(TEMPLATE_META).sort()).toEqual([...EMAIL_TEMPLATES].sort())
    const ids = Object.values(TEMPLATE_META).map((m) => m.konzeptId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(TEMPLATE_META.order_confirmation).toMatchObject({
      konzeptId: 'M01',
      recipient: 'customer',
      attachments: ['invoice', 'legal_texts'],
    })
    expect(TEMPLATE_META.prepayment_instructions.attachments).toEqual(['legal_texts'])
    expect(TEMPLATE_META.prepayment_received.attachments).toEqual(['invoice'])
    expect(TEMPLATE_META.admin_alert).toMatchObject({ konzeptId: 'A12', recipient: 'admin' })
    for (const [key, meta] of Object.entries(TEMPLATE_META)) {
      expect(meta.recipient === 'admin', key).toBe(key.startsWith('admin_'))
    }
  })
})

describe('Kund:innen-Fuß (R-080, R-021)', () => {
  it('R-080 enthält Name, Anschrift, E-Mail, Impressum und Datenschutz; bei Bestellmails Status und „Vertrag widerrufen“; nie die Telefonnummer', async () => {
    __setTemplateForTests('order_shipped', fixtureCustomerTemplate)
    for (const locale of ['de', 'en'] as const) {
      const mail = await renderFixture('order_shipped', { orderNumber: 'PC-2026-00017' }, locale, {
        withStatusLink: true,
      })
      for (const part of [mail.html, mail.text]) {
        expect(part).toContain('Jutta Beispiel')
        expect(part).toContain('Werkstattweg 7')
        expect(part).toContain('10999 Berlin')
        expect(part).toContain(MAIL_FIXTURE_BUSINESS.email)
        expect(part).toContain(`https://planetclairetattoos.com/${locale}/`)
        expect(part).toContain(STATUS_TOKEN_PLACEHOLDER)
        expect(part).not.toContain(MAIL_FIXTURE_PHONE)
      }
      const links = fixtureLinks(locale, true)
      for (const href of [links.imprint, links.privacy, links.withdraw, links.orderStatus!]) {
        expect(mail.html).toContain(`href="${href}"`)
      }
      expect(mail.html).toContain(locale === 'de' ? 'Vertrag widerrufen' : 'Withdraw from contract')
      expect(scanMail(mail)).toEqual([])
    }
  })

  it('ohne Bestellbezug: kein Status-Link und kein „Vertrag widerrufen“ im Fuß', () => {
    const text = customerFooterText({
      locale: 'de',
      business: MAIL_FIXTURE_BUSINESS,
      links: fixtureLinks('de'),
      orderMail: false,
    })
    expect(text).toContain('Impressum: https://planetclairetattoos.com/de/impressum')
    expect(text).toContain('Datenschutz: https://planetclairetattoos.com/de/datenschutz')
    expect(text).not.toContain('Vertrag widerrufen')
    expect(text).not.toContain('Bestellstatus')
  })
})

describe('Verwaltungs-Fuß', () => {
  it('Direktlink in die Verwaltung (ADMIN_ROUTE)', () => {
    expect(adminFooterText(fixtureLinks('de'), '/collections/orders/17')).toContain(
      'https://planetclairetattoos.com/werkstatt/collections/orders/17',
    )
  })
})

describe('Layout', () => {
  it('einspaltig ≤ 600 px, Inline-Stile, kein <style>/<link>, Bilder nur per CID', async () => {
    const coco = await cocoVignette()
    expect(coco).toMatchObject({ cid: COCO_CID, contentType: 'image/png' })
    const html = await renderMailHtml(
      EmailLayout({
        locale: 'de',
        title: 'Titel',
        vignetteCid: COCO_CID,
        children: 'Inhalt',
        footer: 'Fuß',
      }),
    )
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('max-width:600px')
    expect(html).toContain(`src="cid:${COCO_CID}"`)
    expect(html).not.toMatch(/<style|<link|<script/i)
    expect(scanMail({ html, text: '' })).toEqual([])
  })
})

describe('Alle umgesetzten Vorlagen (AK-6-03, R-080, V-01, V-02, V-09)', () => {
  it('R-080 keine externen Bild-URLs, keine Tracking-Parameter, kein OS-Link, keine Werbung', async () => {
    const templates = implementedTemplates()
    expect(templates).toContain('admin_alert')
    for (const t of templates) {
      const data = MAIL_FIXTURE_DATA[t]
      expect(data, `Fixture-Daten für ${t}`).toBeDefined()
      const locales =
        TEMPLATE_META[t].recipient === 'admin' ? (['de'] as const) : (['de', 'en'] as const)
      for (const locale of locales) {
        const mail = await renderFixture(t, data!, locale)
        expect(scanMail(mail), `${t} ${locale}`).toEqual([])
      }
    }
  })

  it('A12 admin_alert: Snapshot (HTML und Text)', async () => {
    const mail = await renderFixture('admin_alert', MAIL_FIXTURE_DATA.admin_alert!, 'de')
    expect(mail.subject).toBe('Technisches Problem: Zahlung konnte nicht zugeordnet werden')
    expect(mail.text).toMatchSnapshot('admin_alert.de.txt')
    expect(mail.html).toMatchSnapshot('admin_alert.de.html')
  })
})
