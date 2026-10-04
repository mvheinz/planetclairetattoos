import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { INVOICE_WATERMARK } from '@/lib/pdf/InvoiceDocument'
import { SEED_EXPECTED_DETAIL, expectedCount } from '@/lib/seed/expected'

import { getTestPayload } from '../helpers/payload'
import { pdfText, readPrivateUpload } from '../helpers/invoices'
import {
  SEED_N,
  SEED_TIMEOUT,
  bySeedKey,
  findAll,
  runCanonicalSeed,
  type SeedDoc,
} from './canonical'
import { seedIso } from '@/lib/seed/time'

// P8.4a: Belege des Beispielbestands (SEED-SPEC §9) – AK-SEED-08 (Nummern und Zählerstände BSP-RE/BSP-GS, RE/GS
// unverändert), Verknüpfungen `orders.invoice`/`refunds[].creditNote`, PDF mit Wasserzeichen, `sha256`, `issued`.

const SPEC = path.join(process.cwd(), 'content/seed/SEED-SPEC.md')
let payload: Payload
let invoices: SeedDoc[]
let realCountersBefore: string

async function counters(series: string[]) {
  return (await findAll(payload, 'invoice-counters', { series: { in: series } }))
    .map((c) => `${String(c.series)}/${String(c.year)}=${String(c.lastNumber)}`)
    .sort()
}

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
  realCountersBefore = JSON.stringify(await counters(['RE', 'GS']))
  await runCanonicalSeed(payload)
  invoices = await findAll(payload, 'invoices', { seed: { equals: true } })
}, SEED_TIMEOUT)

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
}, SEED_TIMEOUT)

/** Tabelle §9: Nummer, Typ, Bestellung, issueAt, Betrag, reason, relatedInvoice. */
async function table(): Promise<string[][]> {
  const md = await readFile(SPEC, 'utf8')
  const sec = md.slice(md.indexOf('## 9. Belege'), md.indexOf('## 10. Widerrufe'))
  return sec
    .split('\n')
    .filter((l) => /^\| BSP-/.test(l))
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim().replace(/`/g, '')),
    )
}

describe('Belege des Beispielbestands (SEED-SPEC §9)', () => {
  it('AK-SEED-08: Belegnummern exakt wie §9; Zähler BSP-RE = 12, BSP-GS = 3; RE/GS unverändert', async () => {
    const rows = await table()
    expect(invoices).toHaveLength(expectedCount('invoices'))
    expect(rows).toHaveLength(expectedCount('invoices'))
    for (const [number, type, orderKey, issueAt, amount, reason, related] of rows) {
      const inv = invoices.find((i) => i.number === number)
      expect(inv, number).toBeDefined()
      const order = await bySeedKey(payload, 'orders', orderKey!)
      expect([inv!.type, inv!.order, inv!.totalGrossCents], number).toEqual([
        type,
        order.id,
        Number(amount),
      ])
      expect(inv!.issueDate, number).toBe(seedIso(issueAt!, SEED_N))
      expect(inv!.series).toBe(type === 'invoice' ? 'BSP-RE' : 'BSP-GS')
      expect([inv!.taxMode, inv!.isKleinunternehmer, inv!.totalTaxCents]).toEqual([
        'kleinunternehmer',
        true,
        0,
      ])
      if (type === 'credit_note') {
        expect(inv!.reason).toBe(reason)
        expect(inv!.relatedInvoice).toBe(invoices.find((i) => i.number === related)!.id)
      } else {
        expect(inv!.seedKey).toBe(`invoices:${orderKey}:invoice`)
      }
    }
    expect(await counters(['BSP-RE', 'BSP-GS'])).toEqual(
      Object.entries(SEED_EXPECTED_DETAIL.invoiceCounters)
        .map(([s, n]) => `${s}/2026=${n}`)
        .sort(),
    )
    expect(JSON.stringify(await counters(['RE', 'GS']))).toBe(realCountersBefore)
  })

  it('orders.invoice und refunds[].creditNote zeigen auf die Belege; O08 mit Gutschrift Grund breakage', async () => {
    for (const inv of invoices.filter((i) => i.type === 'invoice')) {
      const order = await payload.findByID({
        collection: 'orders',
        id: inv.order as number,
        depth: 0,
        overrideAccess: true,
      })
      expect(order.invoice, String(inv.number)).toBe(inv.id)
    }
    for (const credit of invoices.filter((i) => i.type === 'credit_note')) {
      const order = await payload.findByID({
        collection: 'orders',
        id: credit.order as number,
        depth: 0,
        overrideAccess: true,
      })
      const linked = (order.refunds ?? []).filter((r) => r.creditNote === credit.id)
      expect(linked, String(credit.number)).toHaveLength(1)
      expect(linked[0]!.reason).toBe(credit.reason)
      expect(linked[0]!.amountCents).toBe(credit.totalGrossCents)
    }
    const o08 = await bySeedKey(payload, 'orders', 'O08')
    const gs = invoices.find((i) => i.number === 'BSP-GS-2026-00003')!
    expect([gs.order, gs.reason]).toEqual([o08.id, 'breakage'])
    // Bestellungen ohne Zahlung haben keinen Beleg
    for (const key of ['O07', 'O13']) {
      expect((await bySeedKey(payload, 'orders', key)).invoice ?? null, key).toBeNull()
    }
  })

  it('jedes Beleg-PDF: Wasserzeichen (Textextraktion), sha256, status = issued, private-uploads invoice-pdf:<Nummer>', async () => {
    for (const inv of invoices) {
      expect(inv.status, String(inv.number)).toBe('issued')
      expect(inv.sha256).toMatch(/^[0-9a-f]{64}$/)
      const upload = await bySeedKey(
        payload,
        'private-uploads',
        `invoice-pdf:${String(inv.number)}`,
      )
      expect(upload.id).toBe(inv.pdf)
      expect([upload.seed, upload.purpose, upload.relatedInvoice]).toEqual([
        true,
        inv.type === 'invoice' ? 'invoice_pdf' : 'credit_note_pdf',
        inv.id,
      ])
      const text = await pdfText(await readPrivateUpload(payload, upload.id))
      expect(text, String(inv.number)).toContain(INVOICE_WATERMARK)
      expect(text).toContain(String(inv.number))
    }
    expect(
      await findAll(payload, 'private-uploads', {
        and: [{ seed: { equals: true } }, { purpose: { in: ['invoice_pdf', 'credit_note_pdf'] } }],
      }),
    ).toHaveLength(SEED_EXPECTED_DETAIL['private-uploads'].invoicePdfs)
  })
})
