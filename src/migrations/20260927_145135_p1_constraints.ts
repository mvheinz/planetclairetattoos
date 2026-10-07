import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// DATENMODELL §9 – eigene Postgres-Objekte (P1.26): Sequenzen, CHECK-Constraints, partielle UNIQUE-Indizes und der
// GoBD-Trigger für Belege. Tabellen-/Spaltennamen geprüft gegen die generierten P1-Migrationen. Läuft auf PG 16 und 17.

/** Tabellen mit `seedField()` (Spalte `seed_key`), je ein partieller UNIQUE-Index (§9.3). */
export const SEED_KEY_TABLES = [
  'media',
  'documents',
  'private_uploads',
  'products',
  'checkouts',
  'reservations',
  'orders',
  'invoices',
  'withdrawals',
  'conformity_declarations',
  'flash',
  // 'tattoo_offers' entfiel mit P12.7 (Tabelle gelöscht in `p12_remove_offers`)
  'tattoo_gallery',
  'inquiries',
  'privacy_requests',
  'faqs',
  'pages',
  'revenue_entries',
  'audit_log',
  'email_log',
  'consent_log',
  'legal_texts',
] as const

/** Cent-Spalten: ganzzahlig und ≥ 0 (Constraint `<tabelle>_<spalte>_ck`, §9.2). */
export const CENT_COLUMNS: readonly (readonly [string, string])[] = [
  ['checkouts', 'subtotal_cents'],
  ['checkouts', 'shipping_cents'],
  ['checkouts', 'total_cents'],
  ['checkouts_items', 'price_cents'],
  ['orders', 'subtotal_cents'],
  ['orders', 'shipping_cents'],
  ['orders', 'total_cents'],
  ['orders', 'stripe_amount_received_cents'],
  ['orders', 'stripe_fee_cents'],
  ['orders', 'prepayment_received_amount_cents'],
  ['orders_items', 'price_cents'],
  ['orders_items', 'refunded_cents'],
  ['orders_refunds', 'amount_cents'],
  ['invoices', 'total_gross_cents'],
  ['invoices', 'total_net_cents'],
  ['invoices', 'total_tax_cents'],
  ['flash', 'price_cents'],
  ['revenue_entries', 'amount_cents'],
  ['settings', 'costs_budget_cents'],
  ['settings', 'costs_warning_threshold_cents'],
  ['settings', 'revenue_guard_current_year_limit_cents'],
  ['settings', 'revenue_guard_previous_year_limit_cents'],
  ['settings', 'revenue_guard_stage_thresholds_cents_u1'],
  ['settings', 'revenue_guard_stage_thresholds_cents_u3'],
  ['settings', 'revenue_guard_stage_thresholds_cents_u3a'],
  ['settings', 'revenue_guard_stage_thresholds_cents_u4'],
  ['settings', 'shipping_insurance_hint_threshold_cents'],
  ['settings', 'tattoo_custom_price_from_cents'],
  ['settings', 'tattoo_custom_price_to_cents'],
  ['settings', 'tattoo_min_price_cents'],
  ['settings_costs_monthly_entries', 'amount_cents'],
  ['settings_revenue_guard_manual_year_totals', 'amount_cents'],
  ['settings_shipping_rates', 'price_cents'],
]

/** Benannte CHECK-Constraints aus §9.2 (ohne die Cent-Constraints). */
export const CHECKS: readonly (readonly [table: string, name: string, expr: string])[] = [
  [
    'products',
    'products_item_number_int',
    'item_number >= 1 AND item_number <= 99999 AND item_number = trunc(item_number)',
  ],
  ['products', 'products_price_positive', 'price_cents >= 100 AND price_cents = trunc(price_cents)'],
  [
    'products',
    'products_reserved_consistent',
    "(status = 'reserved') = (reserved_until IS NOT NULL AND reservation_ref IS NOT NULL)",
  ],
  ['products', 'products_sold_consistent', "(status = 'sold') = (sold_channel IS NOT NULL)"],
  ['products', 'products_no_commission', 'is_custom_commission IS NOT TRUE'],
  [
    'orders',
    'orders_totals_consistent',
    'total_cents = subtotal_cents + shipping_cents AND total_cents > 0 AND shipping_cents >= 0',
  ],
  ['orders', 'orders_cancel_reason', "status <> 'cancelled' OR cancel_reason IS NOT NULL"],
  [
    'checkouts',
    'checkouts_totals_consistent',
    'total_cents = subtotal_cents + shipping_cents AND total_cents > 0 AND shipping_cents >= 0',
  ],
  [
    'invoice_counters',
    'invoice_counters_non_negative',
    'last_number >= 0 AND last_number = trunc(last_number)',
  ],
  ['invoices', 'invoices_amount_positive', 'total_gross_cents > 0'],
  [
    'invoices',
    'invoices_credit_note_has_parent',
    "type <> 'credit_note' OR related_invoice_id IS NOT NULL",
  ],
  ['flash', 'flash_repeatable_available', "repeatable IS NOT TRUE OR status = 'available'"],
  ['revenue_entries', 'revenue_entries_non_negative', 'amount_cents >= 0'],
]

export const SEQUENCES = [
  'order_number_seq',
  'withdrawal_number_seq',
  'inquiry_number_seq',
  'privacy_request_number_seq',
] as const

export const PARTIAL_UNIQUE_INDEXES = [
  'reservations_one_active_per_product',
  'legal_texts_one_active_per_type',
  'invoices_one_invoice_per_order',
  ...SEED_KEY_TABLES.map((t) => `${t}_seed_key_unique`),
] as const

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`

const GUARD_FUNCTION = `
CREATE OR REPLACE FUNCTION pc_guard_invoices() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_now timestamptz := nullif(current_setting('pc.now', true), '')::timestamptz;
  v_core_changed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.seed THEN RETURN OLD; END IF;  -- nur Beispielbelege (Seed-Entfernung, DATENMODELL §13.5)
    RAISE EXCEPTION 'GoBD: Beleg % darf nicht gelöscht werden (nach Fristende wird anonymisiert, L-06)', OLD.number
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.anonymized_at IS NOT NULL THEN
    RAISE EXCEPTION 'Beleg % ist anonymisiert und unveränderbar', OLD.number USING ERRCODE = 'check_violation';
  END IF;
  v_core_changed :=
       NEW.number IS DISTINCT FROM OLD.number OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.series IS DISTINCT FROM OLD.series OR NEW.year IS DISTINCT FROM OLD.year
    OR NEW.sequence_number IS DISTINCT FROM OLD.sequence_number OR NEW.order_id IS DISTINCT FROM OLD.order_id
    OR NEW.related_invoice_id IS DISTINCT FROM OLD.related_invoice_id OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
    OR NEW.delivery_date IS DISTINCT FROM OLD.delivery_date OR NEW.tax_mode IS DISTINCT FROM OLD.tax_mode
    OR NEW.is_kleinunternehmer IS DISTINCT FROM OLD.is_kleinunternehmer OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.total_gross_cents IS DISTINCT FROM OLD.total_gross_cents OR NEW.total_net_cents IS DISTINCT FROM OLD.total_net_cents
    OR NEW.total_tax_cents IS DISTINCT FROM OLD.total_tax_cents
    OR NEW.retain_until IS DISTINCT FROM OLD.retain_until OR NEW.seed IS DISTINCT FROM OLD.seed
    OR NEW.created_at IS DISTINCT FROM OLD.created_at;
  IF v_core_changed THEN
    RAISE EXCEPTION 'GoBD: Beleg % ist unveränderbar', OLD.number USING ERRCODE = 'check_violation';
  END IF;
  -- Anonymisierung nach Fristende (retentionInvoices, L-06): nur data (Käuferfelder), pdf_id (→ NULL), anonymized_at
  IF NEW.anonymized_at IS NOT NULL THEN
    IF v_now IS NULL OR v_now < OLD.retain_until OR OLD.status <> 'issued' THEN
      RAISE EXCEPTION 'GoBD: Beleg % ist bis % aufzubewahren', OLD.number, OLD.retain_until
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.sha256 IS DISTINCT FROM OLD.sha256
       OR NEW.rendered_at IS DISTINCT FROM OLD.rendered_at OR NEW.pdf_id IS NOT NULL THEN
      RAISE EXCEPTION 'GoBD: unzulässige Änderung bei der Anonymisierung von %', OLD.number
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.data IS DISTINCT FROM OLD.data THEN
    RAISE EXCEPTION 'GoBD: Beleg % ist unveränderbar', OLD.number USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'issued' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.pdf_id IS DISTINCT FROM OLD.pdf_id
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.rendered_at IS DISTINCT FROM OLD.rendered_at) THEN
    RAISE EXCEPTION 'GoBD: PDF von % ist festgeschrieben', OLD.number USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // §9.1 Sequenzen (Nummern mit erlaubten Lücken, §8.7)
  for (const s of SEQUENCES) {
    await db.execute(
      sql.raw(`CREATE SEQUENCE IF NOT EXISTS ${q(s)} AS bigint START 1 MINVALUE 1 NO CYCLE;`),
    )
  }
  // §9.2 CHECK-Constraints
  for (const [table, name, expr] of CHECKS) {
    await db.execute(sql.raw(`ALTER TABLE ${q(table)} ADD CONSTRAINT ${q(name)} CHECK (${expr});`))
  }
  for (const [table, column] of CENT_COLUMNS) {
    const c = q(column)
    await db.execute(
      sql.raw(
        `ALTER TABLE ${q(table)} ADD CONSTRAINT ${q(`${table}_${column}_ck`)} CHECK (${c} >= 0 AND ${c} = trunc(${c}));`,
      ),
    )
  }
  // §9.3 Partielle UNIQUE-Indizes
  await db.execute(sql`
    CREATE UNIQUE INDEX reservations_one_active_per_product ON reservations (product_id) WHERE status = 'active';
    CREATE UNIQUE INDEX legal_texts_one_active_per_type ON legal_texts (type) WHERE status = 'active';
    CREATE UNIQUE INDEX invoices_one_invoice_per_order ON invoices (order_id) WHERE type = 'invoice';
  `)
  for (const t of SEED_KEY_TABLES) {
    await db.execute(
      sql.raw(
        `CREATE UNIQUE INDEX ${q(`${t}_seed_key_unique`)} ON ${q(t)} (seed_key) WHERE seed_key IS NOT NULL;`,
      ),
    )
  }
  // §9.4 GoBD-Trigger
  await db.execute(sql.raw(GUARD_FUNCTION))
  await db.execute(sql`
    CREATE TRIGGER invoices_guard BEFORE UPDATE OR DELETE ON invoices
      FOR EACH ROW EXECUTE FUNCTION pc_guard_invoices();
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS invoices_guard ON invoices;
    DROP FUNCTION IF EXISTS pc_guard_invoices();
  `)
  for (const name of PARTIAL_UNIQUE_INDEXES) {
    await db.execute(sql.raw(`DROP INDEX IF EXISTS ${q(name)};`))
  }
  for (const [table, column] of CENT_COLUMNS) {
    await db.execute(
      sql.raw(`ALTER TABLE ${q(table)} DROP CONSTRAINT IF EXISTS ${q(`${table}_${column}_ck`)};`),
    )
  }
  for (const [table, name] of CHECKS) {
    await db.execute(sql.raw(`ALTER TABLE ${q(table)} DROP CONSTRAINT IF EXISTS ${q(name)};`))
  }
  for (const s of SEQUENCES) {
    await db.execute(sql.raw(`DROP SEQUENCE IF EXISTS ${q(s)};`))
  }
}
