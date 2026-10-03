import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// P6.18 – Berichtigung nach Rechnung (R-152, R-121): Gutschrift + neue Rechnung derselben Bestellung. Die neue
// Rechnung verweist über `replaces_invoice_id` auf die stornierte. Je Bestellung gibt es weiterhin genau eine
// ursprüngliche Rechnung (partieller UNIQUE-Index nur noch über Rechnungen ohne Ersetzungsbezug) und jede Rechnung wird
// höchstens einmal ersetzt. Der GoBD-Trigger (§9.4) schützt auch den neuen Verweis (außer bei Beispielbelegen).

const GUARD_FUNCTION_V2 = `
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
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (NEW.replaces_invoice_id IS DISTINCT FROM OLD.replaces_invoice_id AND NOT OLD.seed);
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

const GUARD_FUNCTION_V1 = `
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
  await db.execute(sql`
    DROP INDEX IF EXISTS invoices_one_invoice_per_order;
    CREATE UNIQUE INDEX invoices_one_invoice_per_order ON invoices (order_id)
      WHERE type = 'invoice' AND replaces_invoice_id IS NULL;
    CREATE UNIQUE INDEX invoices_replaced_once ON invoices (replaces_invoice_id)
      WHERE replaces_invoice_id IS NOT NULL;
  `)
  await db.execute(sql.raw(GUARD_FUNCTION_V2))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(GUARD_FUNCTION_V1))
  await db.execute(sql`
    DROP INDEX IF EXISTS invoices_replaced_once;
    DROP INDEX IF EXISTS invoices_one_invoice_per_order;
    CREATE UNIQUE INDEX invoices_one_invoice_per_order ON invoices (order_id) WHERE type = 'invoice';
  `)
}
