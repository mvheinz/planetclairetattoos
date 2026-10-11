import { str, sameText, type CellValue } from '@/lib/pflege/cells'
import { decide, emptyReport, NO_BASE, type PflegeReport } from '@/lib/pflege/merge'
import type { SnapshotRows } from '@/lib/pflege/snapshot'
import type { TableColumn } from '@/lib/pflege/workbook'
import { newForbiddenHits } from '@/lib/legal/forbiddenContent'

import type { TextEntry } from './model'
import { checkPlaceholders } from './placeholders'

// Texte-Liste (U-87, U-89, PLAN P18.2): Spalten und Rückweg. Übernommen wird nur, was Jutta gegenüber dem gemerkten
// Stand geändert hat (Dreiwege-Abgleich); geprüft werden Pflichttext, Länge, Platzhalter und Verbotsliste (RECHT §5).

export interface TextColumn extends TableColumn {
  width: number
  readOnly?: boolean
  wrap?: boolean
  hint?: string
}

export const TEXT_COLUMNS: readonly TextColumn[] = [
  { key: 'wo', header: 'Wo auf der Seite', width: 34, readOnly: true, wrap: true },
  {
    key: 'de',
    header: 'Deutsch',
    width: 60,
    wrap: true,
    hint: 'Text korrigieren. {name}, <link>…</link> und Ähnliches bitte genau so stehen lassen.',
  },
  {
    key: 'en',
    header: 'Englisch',
    width: 60,
    wrap: true,
    hint: 'Musst du nicht anfassen – änderst du nur das Deutsche, passe ich das Englische an.',
  },
  { key: 'notiz', header: 'Deine Notiz', width: 28, wrap: true },
  { key: 'id', header: 'Kennung (nicht ändern)', width: 26, readOnly: true },
]

export function textRow(e: TextEntry): Record<string, CellValue> {
  return { wo: e.where, de: e.de, en: e.en, notiz: '', id: e.id }
}

export interface TextUpdate {
  id: string
  lang: 'de' | 'en'
  value: string
}

const short = (s: string, n = 70) => {
  const one = s.replace(/\s+/g, ' ')
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}

/** Zeilen der Texte-Liste anwenden: Änderungen (je Sprache) und Bericht. */
export function applyTextRows(
  entries: readonly TextEntry[],
  rows: readonly Record<string, CellValue>[],
  opts: { base: SnapshotRows | null },
): { updates: TextUpdate[]; report: PflegeReport } {
  const report = emptyReport()
  const updates: TextUpdate[] = []
  const byId = new Map(entries.map((e) => [e.id, e]))
  const seen = new Set<string>()
  for (const row of rows) {
    const id = str(row.id)
    if (!id) {
      const text = str(row.de) || str(row.en)
      if (text)
        report.newEntries.push(`Neuer Text „${short(text)}“ – bitte sagen, wo er hingehört.`)
      else if (str(row.notiz)) report.ownerNotes.push(str(row.notiz))
      continue
    }
    const e = byId.get(id)
    if (!e) {
      report.problems.push(`Kennung „${id}“ gibt es nicht (mehr) – Zeile nicht übernommen.`)
      continue
    }
    if (seen.has(id)) {
      report.problems.push(
        `${e.where}: steht doppelt in der Liste – nur die erste Zeile übernommen.`,
      )
      continue
    }
    seen.add(id)
    const base = opts.base ? opts.base[id] : undefined
    const decisions = { de: 'keep', en: 'keep' } as Record<'de' | 'en', string>
    for (const lang of ['de', 'en'] as const) {
      if (!(lang in row)) continue
      const label = lang === 'de' ? 'Deutsch' : 'Englisch'
      const d = decide(row[lang], base ? (base[lang] ?? null) : NO_BASE, e[lang], sameText)
      decisions[lang] = d
      if (d === 'keep') continue
      const value = str(row[lang])
      if (d === 'conflict') {
        report.conflicts.push(
          `${e.where} (${label}): in deiner Liste „${short(value)}“, inzwischen „${short(e[lang])}“. Was gilt?`,
        )
        continue
      }
      const bad = (why: string) => {
        decisions[lang] = 'bad'
        report.problems.push(`${e.where} (${label}): „${short(value)}“ – ${why}; nicht übernommen.`)
      }
      if (e.locked) bad(e.locked)
      else if (!value && e[lang]) bad('darf nicht leer sein')
      else if (e.maxLength && value.length > e.maxLength)
        bad(`höchstens ${e.maxLength} Zeichen (jetzt ${value.length})`)
      else {
        const ph = checkPlaceholders(e[lang], value)
        const forbidden = newForbiddenHits(e[lang], value)
        if (ph) bad(ph)
        else if (forbidden.length)
          bad(`enthält eine verbotene Formulierung (${forbidden.join(', ')}, siehe Rechtsliste)`)
        else {
          updates.push({ id, lang, value })
          report.changes.push(`${e.where} (${label}): „${short(e[lang])}“ → „${short(value)}“`)
        }
      }
    }
    if (decisions.de === 'apply' && decisions.en === 'keep')
      report.englishTodo.push(`${e.where} – Kennung ${id}`)
    const note = str(row.notiz)
    if (note && !(base && sameText(base.notiz ?? null, note)))
      report.ownerNotes.push(`${e.where}: ${note}`)
  }
  let missing = 0
  for (const e of entries) if (!seen.has(e.id) && (!opts.base || opts.base[e.id])) missing++
  if (missing > 0)
    report.notes.push(`${missing} Texte stehen nicht in der Liste – sie bleiben, wie sie sind.`)
  return { updates, report }
}
