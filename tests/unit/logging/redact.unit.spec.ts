import { describe, expect, it } from 'vitest'

import { createLogger } from '@/lib/monitoring/logger'
import { createToken, sealToken } from '@/lib/security/tokens'
import { redact } from '@/lib/security/redact'

// P4.13 / T-20 (ARCHITEKTUR §8.11, R-137): der Logger schwärzt Empfänger, Tokens, Adressen, IBAN, Telefon und Namen.

function capture() {
  const lines: string[] = []
  const logger = createLogger({
    level: 'debug',
    sink: (l) => lines.push(l),
    now: () => new Date('2026-10-15T08:00:00Z'),
  })
  return { lines, logger }
}

describe('Logger-Schwärzung (T-20)', () => {
  it('T-20 E-Mail, IBAN, Token, Telefon und Name werden geschwärzt – als Feld und im Freitext', () => {
    const { lines, logger } = capture()
    const token = createToken()
    const sealed = sealToken(token)
    logger.error('mail.send_failed', {
      emailLogId: 17,
      to: 'erika.beispiel@web.de',
      customerName: 'Erika Beispiel',
      name: 'Erika Beispiel',
      statusToken: token,
      statusTokenSealed: sealed,
      statusUrl: `https://planetclairetattoos.com/de/bestellung/${token}`,
      shippingAddress: { name: 'Erika Beispiel', addressLine1: 'Musterstraße 1', city: 'Berlin' },
      buyer: { name: 'Erika Beispiel', email: 'erika@web.de' },
      iban: 'DE89370400440532013000',
      phone: '+49 171 2345678',
      error: `SMTP 550 für erika.beispiel@web.de; Link …/bestellung/${token}; IBAN DE89 3704 0044 0532 0130 00; Tel. 0171 2345678; Siegel ${sealed}`,
    })
    const out = lines[0]!
    for (const secret of [
      'erika.beispiel@web.de',
      'erika@web.de',
      'Erika Beispiel',
      token,
      sealed,
      'Musterstraße',
      'DE89370400440532013000',
      'DE89 3704',
      '2345678',
    ]) {
      expect(out, secret).not.toContain(secret)
    }
    const parsed = JSON.parse(out) as Record<string, unknown>
    expect(parsed).toMatchObject({
      emailLogId: 17,
      to: '[redacted]',
      customerName: '[redacted]',
      statusToken: '[redacted]',
      statusTokenSealed: '[redacted]',
      shippingAddress: '[redacted]',
      buyer: '[redacted]',
    })
  })

  it('IDs, Nummern und Prüfsummen bleiben lesbar', () => {
    expect(
      redact({
        orderId: 7,
        orderNumber: 'PC-2026-00017',
        invoice: 'RE-2026-00001',
        template: 'admin_alert',
      }),
    ).toEqual({
      orderId: 7,
      orderNumber: 'PC-2026-00017',
      invoice: 'RE-2026-00001',
      template: 'admin_alert',
    })
  })
})
