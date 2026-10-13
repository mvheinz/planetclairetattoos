import { storable, type CellValue } from './cells'
import type { ListSnapshot } from './snapshot'

// Dreiwege-Abgleich je Zelle (U-89 a): `mine` = Juttas Liste, `base` = Stand beim Ausgeben (gemerkt unter der
// Listen-Nr.), `current` = Stand jetzt. Übernommen wird nur, was Jutta gegenüber dem Stand geändert hat; wurde dieselbe
// Zelle inzwischen anders geändert, entscheidet Jutta (Bericht „Bitte entscheiden“). `consumed` = Werte aus dieser Liste,
// die schon übernommen wurden (U-89 c): Sie zählen wie der Stand – dieselbe Liste (oder ihr unbearbeitetes Original)
// noch einmal ändert also nichts, auch wenn inzwischen korrigiert wurde. Ohne gemerkten Stand (`NO_BASE`) zählt jeder
// Unterschied zum jetzigen Stand – das darf nur mit ausdrücklicher Freigabe geschrieben werden.

export type Decision = 'keep' | 'apply' | 'conflict'

export const NO_BASE = Symbol('kein gemerkter Stand')

export function decide(
  mine: CellValue,
  base: CellValue | typeof NO_BASE,
  current: CellValue,
  same: (a: CellValue, b: CellValue) => boolean,
  consumed: readonly CellValue[] = [],
): Decision {
  if (same(mine, current)) return 'keep'
  if (base === NO_BASE) return 'apply'
  const known = [base, ...consumed]
  if (known.some((k) => same(mine, k))) return 'keep'
  return known.some((k) => same(current, k)) ? 'apply' : 'conflict'
}

/** Bericht nach dem Zurückspielen – gemeinsam für beide Listen. */
export interface PflegeReport {
  /** Übernommene Änderungen. */
  changes: string[]
  /** Dieselbe Zelle in der Liste und inzwischen anders geändert – nicht übernommen, Jutta entscheidet. */
  conflicts: string[]
  /** Ungültig oder nicht automatisch möglich – nicht übernommen. */
  problems: string[]
  /** Deutsch geändert, Englisch nicht: Englisch nachziehen (U-00). */
  englishTodo: string[]
  /** Neue Zeilen ohne Nummer/Kennung (neue Stücke oder Texte) – nicht übernommen, aber notiert. */
  newEntries: string[]
  /** Juttas Notizen zu Zeilen, die nirgends gespeichert werden (Texte-Liste) – Claude kümmert sich darum. */
  ownerNotes: string[]
  /** Hinweise (z. B. Liste ohne Listen-Nr.). */
  notes: string[]
  /**
   * Zeilen, die es nicht mehr gibt (V-36: Texte, die nicht mehr auf der Seite stehen) und die Jutta geändert hat –
   * kein Fehler, nur zur Info. Unveränderte entfallene Zeilen zählt ein Hinweis.
   */
  dropped: string[]
}

export const emptyReport = (): PflegeReport => ({
  changes: [],
  conflicts: [],
  problems: [],
  englishTodo: [],
  newEntries: [],
  ownerNotes: [],
  notes: [],
  dropped: [],
})

/** Abschnitte des Berichts in Juttas Worten (Markdown). */
export function reportMarkdown(title: string, meta: string, r: PflegeReport): string {
  const list = (items: readonly string[]) =>
    items.length ? items.map((i) => `- ${i}`).join('\n') : '- keine'
  const section = (head: string, items: readonly string[], always = true) =>
    always || items.length ? `## ${head} (${items.length})\n\n${list(items)}\n` : ''
  return [
    `# ${title}\n\n${meta}\n`,
    section('Hinweise', r.notes, false),
    section('Übernommen', r.changes),
    section('Bitte entscheiden', r.conflicts, false),
    section('Nicht übernommen', r.problems),
    section('Entfällt (steht nicht mehr auf der Seite)', r.dropped, false),
    section('Neu eingetragen (noch nicht übernommen)', r.newEntries, false),
    section('Deine Notizen', r.ownerNotes, false),
    section('Englisch zu ergänzen', r.englishTodo),
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Nach dem Übernehmen festhalten, welche Werte aus dieser Liste jetzt gelten (U-89 a, c): Jede Zelle, die Jutta gegenüber
 * dem Stand geändert hat und die jetzt so gilt, kommt in `snapshot.consumed`. Schickt sie dieselbe Liste später noch
 * einmal, zählt die Zelle nicht mehr als Änderung – auch wenn sie inzwischen anders korrigiert wurde. Der Stand beim
 * Ausgeben bleibt unverändert (auch das unbearbeitete Original der Liste ändert nichts). Rückfragen und Abgelehntes
 * bleiben offen. Verändert `snapshot`; gibt die Zahl der neu festgehaltenen Zellen zurück.
 */
export function recordConsumed(
  snapshot: ListSnapshot,
  rows: Iterable<readonly [string, Record<string, CellValue>]>,
  current: ReadonlyMap<string, Record<string, CellValue>>,
  same: (column: string) => (a: CellValue, b: CellValue) => boolean,
): number {
  let n = 0
  const consumed = (snapshot.consumed ??= {})
  for (const [id, row] of rows) {
    const b = snapshot.rows[id]
    const cur = current.get(id)
    if (!b || !cur) continue
    for (const [column, mine] of Object.entries(row)) {
      if (!(column in cur)) continue
      const eq = same(column)
      const done = consumed[id]?.[column] ?? []
      if (eq(mine, b[column] ?? null) || done.some((v) => eq(mine, v)) || !eq(mine, cur[column]))
        continue
      ;((consumed[id] ??= {})[column] ??= []).push(storable(cur[column]))
      n++
    }
  }
  return n
}
