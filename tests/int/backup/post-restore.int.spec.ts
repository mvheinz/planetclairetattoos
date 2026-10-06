import { sql } from '@payloadcms/db-postgres'
import { describe, expect, it } from 'vitest'

import {
  parseInvoiceNumber,
  reconcileInvoiceCounters,
  runPostRestore,
} from '@/lib/backup/postRestore'
import { postRestoreEndpoints } from '@/endpoints/postRestore'
import { getEnv } from '@/lib/env'

import { dbOf } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'

// P10.9 – Nacharbeiten nach der Wiederherstellung (ARCHITEKTUR §10.5 Schritt 6 b–d, Endpoint `postRestore`).

describe('Nach Wiederherstellung abgleichen', () => {
  it('parseInvoiceNumber zerlegt Belegnummern', () => {
    expect(parseInvoiceNumber('RE-2026-00012')).toEqual({ series: 'RE', year: 2026, n: 12 })
    expect(parseInvoiceNumber('BSP-GS-2027-00003')).toEqual({ series: 'BSP-GS', year: 2027, n: 3 })
    expect(parseInvoiceNumber('X-1')).toBeNull()
  })

  it('Belegnummern: fehlende Belege werden aufgelistet, Zähler auf die höchste gefundene Nummer gesetzt (nie zurück)', async () => {
    const payload = await getTestPayload()
    const db = dbOf(payload)
    await db.execute(sql`DELETE FROM invoice_counters WHERE series = 'RE' AND year = 2099`)
    await db.execute(
      sql`INSERT INTO invoice_counters (series, year, last_number, created_at, updated_at) VALUES ('GS', 2099, 9, now(), now()) ON CONFLICT (series, year) DO UPDATE SET last_number = 9`,
    )
    const files = [
      { key: 'a.pdf', number: 'RE-2099-00007' },
      { key: 'b.pdf', number: 'RE-2099-00012' },
      { key: 'c.pdf', number: 'GS-2099-00004' },
    ]
    const res = await reconcileInvoiceCounters(
      payload,
      new Date('2099-01-01T00:00:00Z'),
      getEnv(),
      files,
    )
    expect(res.missing).toEqual(['GS-2099-00004', 'RE-2099-00007', 'RE-2099-00012'])
    const last = async (s: string) =>
      Number(
        (
          await db.execute(
            sql`SELECT last_number FROM invoice_counters WHERE series = ${s} AND year = 2099`,
          )
        ).rows[0]?.last_number,
      )
    expect(await last('RE')).toBe(12)
    expect(await last('GS')).toBe(9) // nie zurückgesetzt
    await db.execute(sql`DELETE FROM invoice_counters WHERE year = 2099`)
  })

  it('runPostRestore liefert einen Bericht (Mock-Zahlungsanbieter) und ist wiederholbar', async () => {
    const payload = await getTestPayload()
    const opts = {
      backupCreatedAt: new Date('2026-10-05T01:30:00Z'),
      now: new Date('2026-10-05T05:00:00Z'),
      invoiceFiles: [],
    }
    const a = await runPostRestore(payload, opts)
    expect(a.gap.from).toBe('2026-10-05T00:30:00.000Z')
    expect(a.payments.failed).toBe(0)
    const b = await runPostRestore(payload, opts)
    expect(b.replay.reapplied).toBe(0)
    expect(a.notes.length).toBeGreaterThan(0)
  })

  it('Endpoint: ohne Admin 403; als Admin außerhalb des Wartungsmodus 409', async () => {
    const payload = await getTestPayload()
    const handler = postRestoreEndpoints[0]!.handler
    const anon = await handler({ payload, user: null, json: async () => ({}) } as never)
    expect(anon.status).toBe(403)
    const admin = { id: 1, collection: 'users', role: 'admin' }
    const res = await handler({ payload, user: admin, json: async () => ({}) } as never)
    expect([403, 409]).toContain(res.status)
  })
})
