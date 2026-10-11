import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'

// Ist ein Bild noch irgendwo verknüpft (DATENMODELL §6.2, §6.16)? Anders als `findMediaReferences` (nur zählende
// Verweise für die Löschsperre, z. B. veröffentlichte Einträge) zählt hier jeder Fremdschlüssel auf `media` – auch
// Entwürfe, Versionen, Blöcke, Arrays und Globals. Ausgenommen sind die eigenen Sprachzeilen und die Bearbeitungs-
// sperren der Verwaltung. Gebraucht, bevor ein Bild mit einem Galerie-Eintrag gelöscht wird (L-19 b, L-20).

const IGNORED_TABLES = new Set(['media_locales', 'payload_locked_documents_rels'])

/** `true`, wenn noch eine Zeile (außer Sprachzeilen und Sperren) auf das Bild zeigt. */
export async function mediaInUse(req: PayloadRequest, mediaId: number): Promise<boolean> {
  const db = await dbFor(req)
  const keys = await db.execute(sql`
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND c.confrelid = to_regclass('media')
     ORDER BY 1, 2`)
  for (const key of keys.rows) {
    const table = String(key.tbl)
    if (IGNORED_TABLES.has(table.replace(/"/g, '').replace(/^public\./, ''))) continue
    const column = `"${String(key.col).replace(/"/g, '""')}"`
    // Tabellen- und Spaltenname stammen aus dem Systemkatalog (`regclass` ist bereits passend gequotet)
    const hit = await db.execute(
      sql`SELECT 1 FROM ${sql.raw(table)} WHERE ${sql.raw(column)} = ${mediaId} LIMIT 1`,
    )
    if (hit.rows.length > 0) return true
  }
  return false
}
