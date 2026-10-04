import 'server-only'

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Zuordnung Instagram-Kürzel → Originaldatei aus Juttas Datenexport (PLAN P8.10, SEED-SPEC §4.1). Geschrieben von
// `pnpm seed:import-instagram` (scripts/seed/import-instagram.ts), gelesen vom Medien-Schritt des Seeds: Für gemappte
// Kürzel nimmt er die volle Auflösung (gleiche Prozent-Ausschnitte, gleicher `seedKey`, `source = instagram_export`),
// sonst das 640-px-Bild. Fehlt die Datei auf der Platte oder stimmt der Hash nicht, bleibt es beim 640-px-Bild.

export const EXPORT_MAP_FILE = 'content/seed/instagram-export-map.json'

export interface ExportMapEntry {
  /** Pfad relativ zur Projektwurzel (gefunden über dHash). */
  path: string | null
  sha256: string | null
  width: number | null
  height: number | null
  /** Hamming-Abstand des dHash zum 640-px-Bild. */
  distance: number | null
  /** Manuelle Korrektur: Pfad relativ zur Projektwurzel; hat Vorrang vor `path`. */
  override: string | null
}

export interface ExportMap {
  entries: Record<string, ExportMapEntry>
}

export async function readExportMap(file: string): Promise<ExportMap> {
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as Partial<ExportMap>
    return { entries: raw.entries ?? {} }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { entries: {} }
    throw e
  }
}

/**
 * Originaldatei für ein Kürzel oder `null` (nicht gemappt, Datei fehlt – z. B. ZIP noch nicht entpackt –, Hash
 * weicht ab). Bei `override` wird der Hash nicht verlangt (manuelle Korrektur).
 */
export async function exportSource(
  root: string,
  map: ExportMap,
  shortcode: string,
): Promise<Buffer | null> {
  const entry = map.entries[shortcode]
  if (!entry) return null
  const rel = entry.override ?? entry.path
  if (!rel) return null
  try {
    const buf = await readFile(path.resolve(root, rel))
    if (!entry.override && entry.sha256) {
      const sha = createHash('sha256').update(buf).digest('hex')
      if (sha !== entry.sha256) return null
    }
    return buf
  } catch {
    return null
  }
}
