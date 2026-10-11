import type { CellValue } from './cells'

// Dreiwege-Abgleich je Zelle (U-89 a): `mine` = Juttas Liste, `base` = Stand beim Ausgeben (gemerkt unter der
// Listen-Nr.), `current` = Stand jetzt. Übernommen wird nur, was Jutta gegenüber dem Stand geändert hat; wurde dieselbe
// Zelle inzwischen anders geändert, entscheidet Jutta (Bericht „Bitte entscheiden“). Ohne gemerkten Stand (`NO_BASE`)
// zählt jeder Unterschied zum jetzigen Stand – das darf nur mit ausdrücklicher Freigabe geschrieben werden.

export type Decision = 'keep' | 'apply' | 'conflict'

export const NO_BASE = Symbol('kein gemerkter Stand')

export function decide(
  mine: CellValue,
  base: CellValue | typeof NO_BASE,
  current: CellValue,
  same: (a: CellValue, b: CellValue) => boolean,
): Decision {
  if (same(mine, current)) return 'keep'
  if (base === NO_BASE) return 'apply'
  if (same(mine, base)) return 'keep'
  return same(current, base) ? 'apply' : 'conflict'
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
}

export const emptyReport = (): PflegeReport => ({
  changes: [],
  conflicts: [],
  problems: [],
  englishTodo: [],
  newEntries: [],
  ownerNotes: [],
  notes: [],
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
    section('Neu eingetragen (noch nicht übernommen)', r.newEntries, false),
    section('Deine Notizen', r.ownerNotes, false),
    section('Englisch zu ergänzen', r.englishTodo),
  ]
    .filter(Boolean)
    .join('\n')
}
