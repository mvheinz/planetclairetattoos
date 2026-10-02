import { describe, expect, it } from 'vitest'

import { isTemplateImplemented, TEMPLATE_META } from '@/lib/email/registry'
import type { EmailTemplate } from '@/lib/enums'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'

import { MAIL_FIXTURE_DATA, MAIL_FIXTURE_SITE, renderFixture } from '../../helpers/mails'

// P6.6 (R-090): Alle bestellbezogenen Kund:innen-Mails M01–M09 enthalten im Fuß den Link „Vertrag widerrufen“ auf R26
// (absolute URL der Sprache der Mail).

const ORDER_MAILS: readonly EmailTemplate[] = (
  Object.entries(TEMPLATE_META) as [EmailTemplate, (typeof TEMPLATE_META)[EmailTemplate]][]
)
  .filter(([, m]) => /^M0[1-9]$/.test(m.konzeptId))
  .map(([k]) => k)

const R26 = {
  de: `${MAIL_FIXTURE_SITE}/de/vertrag-widerrufen`,
  en: `${MAIL_FIXTURE_SITE}/en/withdraw-from-contract`,
} as const

describe('R-090 Mails', () => {
  it('R-090 Mails: M01–M09 sind als Bestellmail mit Fuß „Vertrag widerrufen“ registriert', () => {
    expect(ORDER_MAILS).toHaveLength(9)
    for (const t of ORDER_MAILS) {
      expect(TEMPLATE_META[t].recipient, t).toBe('customer')
      // M08 (Eingangsbestätigung Widerruf) setzt den Link im Fuß ohne Status-Link (orderMail in der Vorlage).
      if (t !== 'withdrawal_receipt') expect(TEMPLATE_META[t].orderMail, t).toBe(true)
    }
  })

  for (const template of ORDER_MAILS) {
    it(`R-090 Mails: ${TEMPLATE_META[template].konzeptId} ${template} enthält den Link auf R26 (DE/EN)`, async () => {
      if (!isTemplateImplemented(template)) {
        // M09 (Erstattung) entsteht in P6.10 über denselben Fuß (`orderMail: true`, s. o.).
        expect(template).toBe('refund_confirmation')
        return
      }
      const data = MAIL_FIXTURE_DATA[template]
      expect(data, `Fixture für ${template}`).toBeDefined()
      for (const locale of ['de', 'en'] as const) {
        const mail = await renderFixture(template, data!, locale)
        expect(mail.html, `${template} ${locale} HTML`).toContain(`href="${R26[locale]}"`)
        expect(mail.html, `${template} ${locale} Beschriftung`).toContain(
          WITHDRAWAL_LINK_LABEL[locale],
        )
        expect(mail.text, `${template} ${locale} Text`).toContain(R26[locale])
      }
    })
  }
})
