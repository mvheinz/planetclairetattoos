import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CENT_COLUMNS, down, up } from '@/migrations/20260927_145135_p1_constraints'
import * as p6 from '@/migrations/20261002_020601_p6_legal_snippets_complaints_constraints'

// P1.26 (T-14, DM-P1-02): Alle eigenen Postgres-Objekte aus DATENMODELL §9 existieren – geprüft über die Kataloge
// pg_sequences, pg_constraint, pg_indexes und pg_trigger; `down` entfernt alles (in einer zurückgerollten Transaktion).

const SEQUENCES = [
  'order_number_seq',
  'withdrawal_number_seq',
  'inquiry_number_seq',
  'privacy_request_number_seq',
]

const CHECKS: [table: string, name: string][] = [
  ['products', 'products_item_number_int'],
  ['products', 'products_price_positive'],
  ['products', 'products_reserved_consistent'],
  ['products', 'products_sold_consistent'],
  ['products', 'products_no_commission'],
  ['orders', 'orders_totals_consistent'],
  ['orders', 'orders_cancel_reason'],
  ['checkouts', 'checkouts_totals_consistent'],
  ['invoice_counters', 'invoice_counters_non_negative'],
  ['invoices', 'invoices_amount_positive'],
  ['invoices', 'invoices_credit_note_has_parent'],
  ['flash', 'flash_repeatable_available'],
  ['revenue_entries', 'revenue_entries_non_negative'],
  ['tattoo_offers', 'tattoo_offers_dates'],
]

const PARTIAL_INDEXES: [table: string, name: string, where: RegExp][] = [
  ['reservations', 'reservations_one_active_per_product', /WHERE \(status = 'active'/],
  ['legal_texts', 'legal_texts_one_active_per_type', /WHERE \(status = 'active'/],
  [
    'invoices',
    'invoices_one_invoice_per_order',
    /WHERE \(\(type = 'invoice'.*replaces_invoice_id IS NULL/,
  ],
  // P6.1 (DATENMODELL §9.3, §10.1)
  ['legal_snippets', 'legal_snippets_one_active_per_key', /\(key\) WHERE \(status = 'active'/],
]

/** Indizes späterer Migrationen (nicht Teil von `p1_constraints`). */
const LATER_INDEXES = ['legal_snippets_one_active_per_key', 'complaints_seed_key_unique']

let client: pg.Client

async function rows<T extends Record<string, unknown>>(text: string, values: unknown[] = []) {
  return (await client.query<T>(text, values)).rows
}

async function objectCounts() {
  const [seq] = await rows<{ n: string }>(
    `SELECT count(*) AS n FROM pg_sequences WHERE schemaname = 'public' AND sequencename = ANY($1)`,
    [SEQUENCES],
  )
  const [chk] = await rows<{ n: string }>(
    `SELECT count(*) AS n FROM pg_constraint WHERE contype = 'c' AND conname = ANY($1)`,
    [CHECKS.map((c) => c[1])],
  )
  const [idx] = await rows<{ n: string }>(
    `SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public'
       AND (indexname = ANY($1) OR indexname LIKE '%\\_seed\\_key\\_unique')
       AND indexname <> ALL($2)`,
    [PARTIAL_INDEXES.map((i) => i[1]), LATER_INDEXES],
  )
  const [trg] = await rows<{ n: string }>(
    `SELECT count(*) AS n FROM pg_trigger WHERE tgname = 'invoices_guard' AND NOT tgisinternal`,
  )
  return { seq: Number(seq!.n), chk: Number(chk!.n), idx: Number(idx!.n), trg: Number(trg!.n) }
}

beforeAll(async () => {
  client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST })
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

describe('Postgres-Objekte (DATENMODELL §9)', () => {
  it('T-14/DM-P1-02 §9.1 Sequenzen als bigint ab 1 ohne Zyklus', async () => {
    const found = await rows<{
      sequencename: string
      data_type: string
      start_value: string
      min_value: string
      cycle: boolean
    }>(
      `SELECT sequencename, data_type::text, start_value::text, min_value::text, cycle
         FROM pg_sequences WHERE schemaname = 'public' AND sequencename = ANY($1)`,
      [SEQUENCES],
    )
    expect(found.map((s) => s.sequencename).sort()).toEqual([...SEQUENCES].sort())
    for (const s of found) {
      expect(s).toMatchObject({
        data_type: 'bigint',
        start_value: '1',
        min_value: '1',
        cycle: false,
      })
    }
  })

  it('T-14/DM-P1-02 §9.2 CHECK-Constraints an den richtigen Tabellen', async () => {
    const found = await rows<{ conname: string; tbl: string; def: string }>(
      `SELECT c.conname, c.conrelid::regclass::text AS tbl, pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c WHERE c.contype = 'c' AND c.conname = ANY($1)`,
      [CHECKS.map((c) => c[1])],
    )
    const byName = new Map(found.map((f) => [f.conname, f]))
    for (const [table, name] of CHECKS) {
      expect(byName.get(name)?.tbl, name).toBe(table)
    }
    expect(byName.get('products_item_number_int')?.def).toMatch(/99999/)
  })

  it('T-14/DM-P1-02 jede Cent-Spalte ist ganzzahlig und ≥ 0 (CHECK), auch neue', async () => {
    // Alle *_cents-Spalten außer Versionstabellen (Präfix `_`) müssen einen CHECK tragen
    const cols = await rows<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name LIKE '%cents%' AND table_name NOT LIKE '\\_%'`,
    )
    const checked = await rows<{ tbl: string; col: string }>(
      `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'c' AND a.attname LIKE '%cents%'`,
    )
    const has = new Set(checked.map((c) => `${c.tbl}.${c.col}`))
    const missing = cols.map((c) => `${c.table_name}.${c.column_name}`).filter((k) => !has.has(k))
    expect(missing, 'Cent-Spalten ohne CHECK (Migration ergänzen, DATENMODELL §9.2)').toEqual([])
    expect(CENT_COLUMNS.length).toBeGreaterThan(20)
  })

  it('T-14/DM-P1-02 §9.3 partielle UNIQUE-Indizes, seed_key-Index für jede Tabelle mit seed_key', async () => {
    const idx = await rows<{ tablename: string; indexname: string; indexdef: string }>(
      `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
    )
    const byName = new Map(idx.map((i) => [i.indexname, i]))
    for (const [table, name, where] of PARTIAL_INDEXES) {
      const found = byName.get(name)
      expect(found?.tablename, name).toBe(table)
      expect(found?.indexdef).toMatch(/^CREATE UNIQUE INDEX/)
      expect(found?.indexdef).toMatch(where)
    }
    const seedTables = await rows<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'seed_key' AND table_name NOT LIKE '\\_%'`,
    )
    // P6.18 (Berichtigung, R-152): jede Rechnung wird höchstens einmal ersetzt
    expect(byName.get('invoices_replaced_once')?.indexdef).toMatch(
      /^CREATE UNIQUE INDEX .*\(replaces_invoice_id\) WHERE \(replaces_invoice_id IS NOT NULL\)$/,
    )
    expect(seedTables.length).toBeGreaterThanOrEqual(22)
    for (const { table_name: t } of seedTables) {
      const found = byName.get(`${t}_seed_key_unique`)
      expect(found?.tablename, `${t}_seed_key_unique`).toBe(t)
      expect(found?.indexdef).toMatch(/^CREATE UNIQUE INDEX .* WHERE \(seed_key IS NOT NULL\)$/)
    }
  })

  it('T-14/DM-P1-02 §9.4 Trigger invoices_guard (BEFORE UPDATE OR DELETE) mit pc_guard_invoices()', async () => {
    const [trg] = await rows<{ def: string; enabled: string }>(
      `SELECT pg_get_triggerdef(t.oid) AS def, t.tgenabled::text AS enabled
         FROM pg_trigger t WHERE t.tgname = 'invoices_guard' AND NOT t.tgisinternal`,
    )
    expect(trg?.def).toMatch(
      /BEFORE (UPDATE OR DELETE|DELETE OR UPDATE) ON public\.invoices FOR EACH ROW EXECUTE FUNCTION pc_guard_invoices\(\)/,
    )
    expect(trg?.enabled).toBe('O')
  })

  it('down entfernt alles, up legt es wieder an (in einer zurückgerollten Transaktion)', async () => {
    const before = await objectCounts()
    expect(before).toMatchObject({ seq: 4, chk: CHECKS.length, trg: 1 })
    const db = {
      execute: (q: { getSQL?: unknown }) => {
        // Drizzle-SQL in Text übersetzen: die Migration nutzt nur sql.raw bzw. Literale ohne Parameter
        const chunks = (q as unknown as { queryChunks: { value?: string[] }[] }).queryChunks
        const text = chunks.map((c) => (Array.isArray(c.value) ? c.value.join('') : '')).join('')
        return client.query(text)
      },
    }
    await client.query('BEGIN')
    try {
      await down({ db } as never)
      expect(await objectCounts()).toEqual({ seq: 0, chk: 0, idx: 0, trg: 0 })
      const [fn] = await rows<{ n: string }>(
        `SELECT count(*) AS n FROM pg_proc WHERE proname = 'pc_guard_invoices'`,
      )
      expect(Number(fn!.n)).toBe(0)
      await up({ db } as never)
      expect(await objectCounts()).toEqual(before)
    } finally {
      await client.query('ROLLBACK')
    }
    expect(await objectCounts()).toEqual(before)
  })

  it('T-14 p6_legal_snippets_complaints_constraints: down entfernt die P6-Indizes, up legt sie wieder an', async () => {
    const count = async () =>
      Number(
        (
          await rows<{ n: string }>(
            `SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)`,
            [LATER_INDEXES],
          )
        )[0]!.n,
      )
    expect(await count()).toBe(2)
    const db = {
      execute: (q: unknown) => {
        const chunks = (q as { queryChunks: { value?: string[] }[] }).queryChunks
        return client.query(
          chunks.map((c) => (Array.isArray(c.value) ? c.value.join('') : '')).join(''),
        )
      },
    }
    await client.query('BEGIN')
    try {
      await p6.down({ db } as never)
      expect(await count()).toBe(0)
      await p6.up({ db } as never)
      expect(await count()).toBe(2)
    } finally {
      await client.query('ROLLBACK')
    }
  })
})
