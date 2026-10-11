import { createHash } from 'node:crypto'

import { z } from 'zod'

import { storable, type CellValue, type StoredCell } from './cells'

// Gemerkter Stand einer ausgegebenen Liste (U-89 a): je Zeile (Nr. bzw. Text-Kennung) die Zellwerte beim Ausgeben.
// Die Listen-Nr. steht in der Datei (Blatt „Anleitung“, Kommentar an der ersten Überschrift, Dateieigenschaften) und
// führt beim Zurückspielen zu diesem Stand. Vor dem Start liegt er im Repo (`content/pflege/stand/<Listen-Nr.>.json`),
// nach dem Start in der Datenbank (P19).

export type ListKind = 'bestand' | 'texte'

const PREFIX: Record<ListKind, string> = { bestand: 'B', texte: 'T' }
const KIND: Record<string, ListKind> = { B: 'bestand', T: 'texte' }

/** Listen-Nr., z. B. `B-2026-10-11-3fa9c1` (Art, Tag in Berlin, Prüfsumme des Inhalts). */
export const LIST_ID_PATTERN = /\b([BT])-(\d{4}-\d{2}-\d{2})-([0-9a-f]{6})\b/

export function parseListId(text: string): { id: string; kind: ListKind; day: string } | null {
  const m = LIST_ID_PATTERN.exec(text)
  return m ? { id: m[0], kind: KIND[m[1]!]!, day: m[2]! } : null
}

export type SnapshotRows = Record<string, Record<string, StoredCell>>

/** Je Zeile und Spalte die Werte aus dieser Liste, die schon übernommen wurden (U-89 c). */
export type ConsumedCells = Record<string, Record<string, StoredCell[]>>

export interface ListSnapshot {
  version: 1
  id: string
  kind: ListKind
  /** Zeitpunkt des Ausgebens (ISO, UTC). */
  createdAt: string
  /** Stand beim Ausgeben – bleibt unverändert. */
  rows: SnapshotRows
  /** Nach jedem Zurückspielen: schon übernommene Werte (dieselbe Liste noch einmal ändert nichts mehr). */
  consumed?: ConsumedCells
}

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()])
export const snapshotSchema = z.strictObject({
  version: z.literal(1),
  id: z.string().regex(/^[BT]-\d{4}-\d{2}-\d{2}-[0-9a-f]{6}$/),
  kind: z.enum(['bestand', 'texte']),
  createdAt: z.string().datetime(),
  rows: z.record(z.string(), z.record(z.string(), cell)),
  consumed: z.record(z.string(), z.record(z.string(), z.array(cell))).optional(),
})

/** Kalendertag in Berlin (`JJJJ-MM-TT`). */
export const berlinDay = (d: Date): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d)

/** Stand aus den Zeilen der Liste bilden; gleiche Zeilen am selben Tag ergeben dieselbe Listen-Nr. */
export function makeSnapshot(
  kind: ListKind,
  now: Date,
  rows: ReadonlyMap<string, Record<string, CellValue>> | Record<string, Record<string, CellValue>>,
): ListSnapshot {
  const entries: [string, Record<string, CellValue>][] =
    rows instanceof Map ? [...rows.entries()] : Object.entries(rows)
  const stored: SnapshotRows = {}
  for (const [key, row] of entries) {
    stored[key] = Object.fromEntries(
      Object.entries(row).map(([k, v]): [string, StoredCell] => [k, storable(v)]),
    )
  }
  const hash = createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 6)
  return {
    version: 1,
    id: `${PREFIX[kind]}-${berlinDay(now)}-${hash}`,
    kind,
    createdAt: now.toISOString(),
    rows: stored,
  }
}
