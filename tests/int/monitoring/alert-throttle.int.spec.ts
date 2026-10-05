import { sql } from '@payloadcms/db-postgres'
import { createLocalReq } from 'payload'
import { describe, expect, it } from 'vitest'

import { sendAdminAlert } from '@/lib/email/alerts'

import { dbOf } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'

// P10.10 – AK-A-11-04 (ARCHITEKTUR §11.4, M-03): fünf fehlschlagende Wiederholungen derselben Webhook-Verarbeitung
// innerhalb einer Stunde erzeugen genau eine A12-Mail (Drosselung je Fehlerart und Stunde).

describe('A12-Drosselung', () => {
  it('AK-A-11-04 fünf Meldungen derselben Fehlerart in einer Stunde → genau eine Mail; danach wieder eine', async () => {
    const payload = await getTestPayload()
    const db = dbOf(payload)
    await db.execute(
      sql`DELETE FROM email_log WHERE idempotency_key LIKE 'admin_alert:payment_webhook_p10@%'`,
    )
    const req = await createLocalReq({ context: { system: true } }, payload)
    const base = new Date('2034-05-01T10:00:00.000Z')
    const results: string[] = []
    for (let i = 0; i < 5; i++) {
      const r = await sendAdminAlert(req, {
        kind: 'payment_webhook_p10',
        summary: 'Zahlungs-Ereignis konnte nicht verarbeitet werden',
        affected: `Ereignis evt_test, ${i + 2}. Versuch`,
        automatic: 'Stripe stellt das Ereignis erneut zu.',
        todo: 'Bleibt der Fehler, bitte die technische Betreuung informieren.',
        adminPath: '/collections/webhook-events',
        now: new Date(base.getTime() + i * 10 * 60_000),
      })
      results.push(r.status)
    }
    expect(results.filter((s) => s !== 'throttled')).toHaveLength(1)
    const count = async () =>
      Number(
        (
          await db.execute(
            sql`SELECT count(*)::int AS n FROM email_log WHERE idempotency_key LIKE 'admin_alert:payment_webhook_p10@%'`,
          )
        ).rows[0]!.n,
      )
    expect(await count()).toBe(1)
    const later = await sendAdminAlert(req, {
      kind: 'payment_webhook_p10',
      summary: 'x',
      affected: 'y',
      automatic: 'z',
      todo: 'w',
      adminPath: '/collections/webhook-events',
      now: new Date(base.getTime() + 61 * 60_000),
    })
    expect(later.status).not.toBe('throttled')
    expect(await count()).toBe(2)
    await db.execute(
      sql`DELETE FROM email_log WHERE idempotency_key LIKE 'admin_alert:payment_webhook_p10@%'`,
    )
  })
})
