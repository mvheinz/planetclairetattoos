import { describe, expect, it } from 'vitest'

import { createLogger } from '@/lib/monitoring/logger'
import { redact, redactText } from '@/lib/security/redact'

describe('Logger ohne Personendaten (ARCHITEKTUR §8.11, R-137)', () => {
  const capture = () => {
    const lines: string[] = []
    const logger = createLogger({
      level: 'debug',
      sink: (l) => lines.push(l),
      now: () => new Date('2026-10-15T08:00:00Z'),
    })
    return { lines, logger }
  }

  it('schreibt JSON-Zeilen mit level, time, event', () => {
    const { lines, logger } = capture()
    logger.info('order_created', { orderId: 42, orderNumber: 'PC-2026-0001' })
    expect(JSON.parse(lines[0]!)).toEqual({
      level: 'info',
      time: '2026-10-15T08:00:00.000Z',
      event: 'order_created',
      orderId: 42,
      orderNumber: 'PC-2026-0001',
    })
  })

  it('R-137 keine E-Mail, IBAN, 43-Zeichen-Token oder Telefonnummer im Klartext', () => {
    const { lines, logger } = capture()
    const token = 'A'.repeat(20) + '-_' + 'b'.repeat(21)
    logger.error('failed', {
      message: `Mail an erika@example.com, IBAN DE89370400440532013000, Token ${token}, Tel. +49 30 1234567`,
      email: 'max@example.com',
      nested: {
        street: 'Musterstraße 1',
        iban: 'DE89 3704 0044 0532 0130 00',
        note: 'ruf an: 030 1234567',
      },
    })
    const out = lines[0]!
    expect(out).not.toContain('erika@example.com')
    expect(out).not.toContain('max@example.com')
    expect(out).not.toContain('DE89370400440532013000')
    expect(out).not.toContain(token)
    expect(out).not.toContain('Musterstraße')
    expect(out).not.toContain('1234567')
    expect(out).toContain('[redacted]')
  })

  it('Stufenfilter: debug wird bei info unterdrückt', () => {
    const lines: string[] = []
    const logger = createLogger({ level: 'info', sink: (l) => lines.push(l) })
    logger.debug('x')
    logger.warn('y')
    expect(lines).toHaveLength(1)
  })

  it('redact lässt IDs und Nummern stehen', () => {
    expect(redact({ orderId: 7, count: 3 })).toEqual({ orderId: 7, count: 3 })
    expect(redactText('Bestellung PC-2026-0001')).toBe('Bestellung PC-2026-0001')
  })
})
