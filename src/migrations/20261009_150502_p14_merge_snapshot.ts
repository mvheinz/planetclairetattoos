import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

// P14 (Zusammenführung): keine Schemaänderung. `p14_shop_stray_payments` entstand parallel zu `p14_admin_offline_sale`;
// sein Schnappschuss kannte deren Spalten nicht. Diese leere Migration trägt nur den vollständigen Schnappschuss
// (JSON daneben), damit `pnpm check:migrations` und das nächste `migrate:create` vom richtigen Stand ausgehen.
export async function up(_args: MigrateUpArgs): Promise<void> {}

export async function down(_args: MigrateDownArgs): Promise<void> {}
