import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  SEED_EXPECTED_COUNTS,
  SEED_EXPECTED_DETAIL,
  SEED_EXPECTED_PRODUCTS_BY_CATEGORY,
  SEED_EXPECTED_PRODUCTS_BY_STATUS,
  SEED_EXPECTED_SOLD,
  type CountRange,
} from '@/lib/seed/expected'

// P8.1: SEED-SPEC §0.1 ist die einzige Quelle der Mengen – die Tabelle wird hier per Markdown-Parser gelesen und mit
// `SEED_EXPECTED_COUNTS` verglichen, damit Doku und Code nicht auseinanderlaufen.

const SPEC = path.join(process.cwd(), 'content/seed/SEED-SPEC.md')

interface Row {
  collections: string[]
  count: string
}

/** Zeilen der ersten Tabelle unter „### 0.1“. */
function parseSection01(markdown: string): Row[] {
  const start = markdown.indexOf('### 0.1')
  const end = markdown.indexOf('### 0.2', start)
  const lines = markdown.slice(start, end).split('\n')
  const table = lines.filter((l) => l.startsWith('|'))
  const [header, sep, ...body] = table
  expect(header).toMatch(/\|\s*Collection\s*\|\s*Anzahl\s*\|/)
  expect(sep).toMatch(/^\|[-|\s]+\|$/)
  return body.map((line) => {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
    const collections = [...cells[0]!.matchAll(/`([a-z-]+)`/g)].map((m) => m[1]!)
    return { collections, count: cells[1]! }
  })
}

/** „47 (17 … + 30 …)“ → 47 · „7 (+ 15 Beleg-PDFs)“ → 22 · „0–1“ → Spanne · „je 1“ → 1 · „2 Zeilen …“ → 2. */
function parseCount(cell: string): number | CountRange {
  const range = /^(\d+)\s*[–-]\s*(\d+)/.exec(cell)
  if (range) return { min: Number(range[1]), max: Number(range[2]) }
  const each = /^je\s+(\d+)/.exec(cell)
  if (each) return Number(each[1])
  const lead = /^(\d+)/.exec(cell)
  if (!lead) throw new Error(`Menge nicht lesbar: ${cell}`)
  const plus = /\(\+\s*(\d+)/.exec(cell)
  return Number(lead[1]) + (plus ? Number(plus[1]) : 0)
}

describe('SEED_EXPECTED_COUNTS (SEED-SPEC §0.1)', () => {
  it('enthält genau die Zeilen der Tabelle §0.1 mit denselben Mengen', async () => {
    const rows = parseSection01(await readFile(SPEC, 'utf8'))
    const fromSpec: Record<string, number | CountRange> = {}
    for (const row of rows) {
      // „`users` (Admin)“ → users; „`settings`, `site-texts` (Globals)“ → beide; „`webhook-events`, `documents`, …“
      const names = row.collections.filter((c) => c !== 'seed')
      expect(names.length, JSON.stringify(row)).toBeGreaterThan(0)
      for (const name of names) fromSpec[name] = parseCount(row.count)
    }
    expect(fromSpec).toEqual(SEED_EXPECTED_COUNTS)
    // Pflichtzeilen laut PLAN P8.1
    for (const c of [
      'media',
      'private-uploads',
      'orders',
      'checkouts',
      'reservations',
      'invoices',
      'complaints',
      'privacy-requests',
      'email-log',
      'consent-log',
      'audit-log',
    ]) {
      expect(SEED_EXPECTED_COUNTS).toHaveProperty(c)
    }
  })

  it('Aufteilungen in Klammern (§0.1) und Verteilungen (§0.3, §5.1) sind in sich stimmig', async () => {
    const spec = await readFile(SPEC, 'utf8')
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
    expect(sum(SEED_EXPECTED_DETAIL.media)).toBe(SEED_EXPECTED_COUNTS.media)
    expect(sum(SEED_EXPECTED_DETAIL['private-uploads'])).toBe(
      SEED_EXPECTED_COUNTS['private-uploads'],
    )
    expect(SEED_EXPECTED_DETAIL['private-uploads'].invoicePdfs).toBe(SEED_EXPECTED_COUNTS.invoices)
    expect(sum(SEED_EXPECTED_DETAIL.checkouts)).toBe(SEED_EXPECTED_COUNTS.checkouts)
    expect(sum(SEED_EXPECTED_DETAIL.invoices)).toBe(SEED_EXPECTED_COUNTS.invoices)
    expect(sum(SEED_EXPECTED_DETAIL.invoiceCounters)).toBe(SEED_EXPECTED_COUNTS.invoices)
    expect(sum(SEED_EXPECTED_PRODUCTS_BY_CATEGORY)).toBe(SEED_EXPECTED_COUNTS.products)
    expect(sum(SEED_EXPECTED_PRODUCTS_BY_STATUS)).toBe(SEED_EXPECTED_COUNTS.products)
    expect(sum(SEED_EXPECTED_SOLD.byChannel)).toBe(SEED_EXPECTED_PRODUCTS_BY_STATUS.sold)

    // Texte der Spezifikation (§0.1 Klammern, §0.3 Tabelle, §5.1 Summe) nennen dieselben Zahlen
    const m = SEED_EXPECTED_DETAIL.media
    expect(spec).toContain(
      `${SEED_EXPECTED_COUNTS.media} (${m.instagram} Instagram-Ausschnitte + ${m.owned} eigenes Foto von Jutta + ${m.placeholders} Platzhalter)`,
    )
    const c = SEED_EXPECTED_DETAIL.checkouts
    expect(spec).toContain(
      `${SEED_EXPECTED_COUNTS.checkouts} (${c.completed} abgeschlossen, ${c.expired} abgelaufen, ${c.open} offen)`,
    )
    const i = SEED_EXPECTED_DETAIL.invoices
    expect(spec).toContain(
      `${SEED_EXPECTED_COUNTS.invoices} (${i.invoice} Rechnungen, ${i.credit_note} Gutschriften)`,
    )
    expect(spec).toContain(
      `| Stücke je Kategorie | ${Object.entries(SEED_EXPECTED_PRODUCTS_BY_CATEGORY)
        .map(([k, n]) => `${k} ${n}`)
        .join(', ')} |`,
    )
    const s = SEED_EXPECTED_PRODUCTS_BY_STATUS
    expect(spec).toContain(
      `${s.available} \`available\`, ${s.reserved} \`reserved\`, ${s.sold} \`sold\`, ${s.archived} \`archived\`, ${s.draft} \`draft\``,
    )
    const sold = SEED_EXPECTED_SOLD
    expect(spec).toContain(
      `${s.sold} \`sold\` (${sold.visibleInArchive} im Archiv sichtbar; \`soldChannel\` ${sold.byChannel.online} × \`online\`, ${sold.byChannel.pickup} × \`pickup\`,\n${sold.byChannel.offline} × \`offline\`)`,
    )
    expect(spec).toContain(
      `Zählerstand danach: \`BSP-RE\`/2026 = ${SEED_EXPECTED_DETAIL.invoiceCounters['BSP-RE']},\n\`BSP-GS\`/2026 = ${SEED_EXPECTED_DETAIL.invoiceCounters['BSP-GS']}`,
    )
  })
})
