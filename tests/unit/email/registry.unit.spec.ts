import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'

import { adminRecipient } from '@/lib/email/outbox'
import { getTemplate, isTemplateImplemented, TEMPLATE_META } from '@/lib/email/registry'
import { getEnv } from '@/lib/env'
import type { EmailTemplate } from '@/lib/enums'

// P4.15 – Registry (DATENMODELL §4 „Mail-Vorlagen: Schlüssel ↔ KONZEPT-ID“, KONZEPT §6.2/§6.4).

/** Schlüssel aus P4.14/P4.15 mit ihrer KONZEPT-ID. */
const EXPECTED: [EmailTemplate, string][] = [
  ['order_confirmation', 'M01'],
  ['prepayment_instructions', 'M02'],
  ['prepayment_reminder', 'M03'],
  ['prepayment_cancelled', 'M04'],
  ['prepayment_received', 'M05'],
  ['oversold_apology', 'M10'],
  ['admin_order_placed', 'A01/A02'],
  ['admin_prepayment_cancelled', 'A03'],
  ['admin_oversold', 'A06'],
  ['admin_dispute_opened', 'A07'],
  ['admin_refund_failed', 'A08'],
  ['admin_alert', 'A12'],
]

function fakeReq(adminNotificationEmail: string | null, withSettings = true): PayloadRequest {
  return {
    payload: {
      config: { globals: withSettings ? [{ slug: 'settings' }] : [] },
      findGlobal: async () => ({ adminNotificationEmail }),
    },
  } as unknown as PayloadRequest
}

describe('Registry: Schlüssel ↔ KONZEPT-ID', () => {
  it('jeder Schlüssel aus P4.14/P4.15 ist umgesetzt und genau einer KONZEPT-ID zugeordnet', () => {
    const ids = Object.values(TEMPLATE_META).map((m) => m.konzeptId)
    for (const [key, id] of EXPECTED) {
      expect(TEMPLATE_META[key].konzeptId, key).toBe(id)
      expect(
        ids.filter((x) => x === id),
        id,
      ).toHaveLength(1)
      expect(isTemplateImplemented(key), key).toBe(true)
      expect(getTemplate(key).version, key).toMatch(/^[am]\d{2}-v\d+$/)
    }
  })

  it('Empfängerart: M… an Kund:innen, A… an die Verwaltung', () => {
    for (const [key, id] of EXPECTED) {
      expect(TEMPLATE_META[key].recipient, key).toBe(id.startsWith('A') ? 'admin' : 'customer')
    }
  })
})

describe('Admin-Empfänger (KONZEPT §6.4)', () => {
  it('settings.adminNotificationEmail hat Vorrang', async () => {
    expect(await adminRecipient(fakeReq('werkstatt@planetclaire.local'))).toBe(
      'werkstatt@planetclaire.local',
    )
  })

  it('Rückfall ADMIN_NOTIFY_EMAIL, wenn die Einstellung leer ist oder fehlt', async () => {
    expect(await adminRecipient(fakeReq(null))).toBe(getEnv().ADMIN_NOTIFY_EMAIL)
    expect(await adminRecipient(fakeReq('', false))).toBe(getEnv().ADMIN_NOTIFY_EMAIL)
  })
})
