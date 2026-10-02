import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// P4.4 – Zustand des Zahlungs-Mocks (`checkouts.mock_state`, DATENMODELL §6.25.1) schreibt nur der Mock-Treiber.
// Payload-Updates einer Kasse schreiben alle Spalten mit dem zuvor gelesenen Stand zurück; ohne diesen Trigger könnte
// ein gleichzeitiges Update (z. B. Kasse → `confirming`) einen neueren Mock-Zustand überschreiben. Der Mock setzt in
// seiner Transaktion `pc.mock_state_write = on` (src/lib/payments/mock/store.ts); alle anderen UPDATEs behalten den
// alten Wert der Spalte. INSERT und DELETE (Aufbewahrung) sind nicht betroffen.

const KEEP_FUNCTION = `
CREATE OR REPLACE FUNCTION pc_checkouts_keep_mock_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('pc.mock_state_write', true), '') <> 'on' THEN
    NEW.mock_state := OLD.mock_state;
  END IF;
  RETURN NEW;
END
$$;`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(KEEP_FUNCTION))
  await db.execute(
    sql.raw(`
    CREATE TRIGGER checkouts_keep_mock_state BEFORE UPDATE ON checkouts
      FOR EACH ROW EXECUTE FUNCTION pc_checkouts_keep_mock_state();`),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`DROP TRIGGER IF EXISTS checkouts_keep_mock_state ON checkouts;`))
  await db.execute(sql.raw(`DROP FUNCTION IF EXISTS pc_checkouts_keep_mock_state();`))
}
