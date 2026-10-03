import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { isTemplateImplemented, TEMPLATE_META } from '@/lib/email/registry'
import type { EmailTemplate } from '@/lib/enums'
import { buildLegalTokenValues, renderLegalString } from '@/lib/legal/render'

import {
  MAIL_FIXTURE_DATA,
  MAIL_FIXTURE_PHONE,
  MAIL_FIXTURE_SITE,
  renderFixture,
} from '../../helpers/mails'

// P6.5 (R-021): Die Telefonnummer steht nur im Impressum, in der Widerrufsbelehrung (Token `{{phone}}`) und in der
// Anbieterkennung der Bestellbestätigungen M01/M02 – in keiner anderen Kund:innen-Mail.

type Base = { legalTexts: { type: string; sections: { paragraphs: string[] }[] }[] }
const base = JSON.parse(readFileSync(path.resolve('content/seed/data/base.json'), 'utf8')) as Base

const PHONE_MAILS: readonly EmailTemplate[] = ['order_confirmation', 'prepayment_instructions']

describe('R-021 Telefonnummer', () => {
  it('R-021 Token {{phone}} nur in Impressum und Widerrufsbelehrung der Platzhalter-Gliederung', () => {
    const withPhone = base.legalTexts
      .filter((t) => t.sections.some((s) => s.paragraphs.some((p) => p.includes('{{phone}}'))))
      .map((t) => t.type)
      .sort()
    expect(withPhone).toEqual(['impressum', 'widerrufsbelehrung'])
  })

  it('R-021 {{phone}} wird aus settings.business.phone ersetzt', () => {
    const values = buildLegalTokenValues({
      settings: {
        business: {
          legalName: 'Jutta Beispiel',
          street: 'Werkstattweg 7',
          postalCode: '10999',
          city: 'Berlin',
          email: 'jutta@planetclairetattoos.com',
          phone: MAIL_FIXTURE_PHONE,
        },
      } as never,
      siteUrl: MAIL_FIXTURE_SITE,
      locale: 'de',
    })
    expect(renderLegalString('Telefon: {{phone}}', values)).toBe(`Telefon: ${MAIL_FIXTURE_PHONE}`)
  })

  it('R-021 M01 und M02 enthalten die Nummer in der Anbieterkennung (DE/EN)', async () => {
    for (const template of PHONE_MAILS) {
      for (const locale of ['de', 'en'] as const) {
        const mail = await renderFixture(template, MAIL_FIXTURE_DATA[template]!, locale)
        expect(mail.text, `${template} ${locale}`).toContain(MAIL_FIXTURE_PHONE)
        expect(mail.html, `${template} ${locale}`).toContain(MAIL_FIXTURE_PHONE)
      }
    }
  })

  it('R-021 keine andere Kund:innen-Mail enthält die Nummer (Snapshots aller umgesetzten Vorlagen)', async () => {
    const others = (Object.keys(TEMPLATE_META) as EmailTemplate[]).filter(
      (t) =>
        TEMPLATE_META[t].recipient === 'customer' &&
        !PHONE_MAILS.includes(t) &&
        isTemplateImplemented(t),
    )
    expect(others.length).toBeGreaterThanOrEqual(6)
    for (const template of others) {
      const data = MAIL_FIXTURE_DATA[template]
      expect(data, `Fixture für ${template}`).toBeDefined()
      for (const locale of ['de', 'en'] as const) {
        const mail = await renderFixture(template, data!, locale)
        expect(`${mail.text}\n${mail.html}`, `${template} ${locale}`).not.toContain(
          MAIL_FIXTURE_PHONE,
        )
      }
    }
  })
})
