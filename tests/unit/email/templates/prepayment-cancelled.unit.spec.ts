import { describe, expect, it } from 'vitest'

import { getTemplate } from '@/lib/email/registry'

import { CANCELLED_FIXTURE, renderFixture, scanMail } from '../../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './helpers'

// P4.15 – M04 `prepayment_cancelled` (KONZEPT §6.3 „M04“, R-071 Nr. 4, R-084): nur O4 durch Task oder Verwaltung.

const render = async (
  locale: 'de' | 'en' = 'de',
  data: Record<string, unknown> = CANCELLED_FIXTURE,
) => plain(await renderFixture('prepayment_cancelled', data, locale, { withStatusLink: true }))

describe('M04 prepayment_cancelled', () => {
  it('Betreff exakt nach KONZEPT §6.2', async () => {
    expect((await render('de')).subject).toBe('Deine Bestellung PC-2026-00017 wurde storniert')
    expect((await render('en')).subject).toBe('Your order PC-2026-00017 has been cancelled')
  })

  it('Grund „keine Zahlung eingegangen“ bzw. Text von Jutta; Satz zur Rücküberweisung', async () => {
    const m = await render()
    expect(m.text).toContain('Grund: keine Zahlung eingegangen')
    expect(m.text).toContain(
      'Falls du doch schon überwiesen hast, melde dich – dann überweise ich dir das Geld zurück.',
    )
    const byAdmin = await render('de', {
      ...CANCELLED_FIXTURE,
      reason: 'admin',
      reasonText: 'Das Stück ist leider beim Fotografieren zerbrochen.',
    })
    expect(byAdmin.text).toContain('Grund: Das Stück ist leider beim Fotografieren zerbrochen.')
  })

  it('nicht bei Widerruf: Grund `withdrawn` wird vom Schema abgelehnt', () => {
    const def = getTemplate('prepayment_cancelled')
    expect(def.schema.safeParse({ ...CANCELLED_FIXTURE, reason: 'withdrawn' }).success).toBe(false)
  })

  for (const locale of ['de', 'en'] as const) {
    it(`AK-6-01 Snapshot ${locale}, R-084 keine unersetzten Tokens, V-09`, async () => {
      const m = await render(locale)
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      await expect(m.text).toMatchFileSnapshot(snapshotPath('prepayment_cancelled', locale, 'txt'))
      await expect(m.html).toMatchFileSnapshot(snapshotPath('prepayment_cancelled', locale, 'html'))
    })
  }
})
