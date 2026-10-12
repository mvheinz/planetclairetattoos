import { sameText, str, UNREADABLE, type CellValue, type SheetRow } from '@/lib/pflege/cells'
import { decide, emptyReport, NO_BASE, type PflegeReport } from '@/lib/pflege/merge'
import type { ConsumedCells, SnapshotRows } from '@/lib/pflege/snapshot'
import type { TableColumn } from '@/lib/pflege/workbook'
import { newForbiddenHits, type ForbiddenTarget } from '@/lib/legal/forbiddenContent'

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

/** Welche Zusatzmuster der Rechtsliste gelten (wie im Test über `src/i18n/messages` bzw. `content/`). */
const forbiddenTarget = (id: string): ForbiddenTarget =>
  id.startsWith('m:') ? 'messages' : id.startsWith('st:') ? 'code' : 'content'

const short = (s: string, n = 70) => {
  const one = s.replace(/\s+/g, ' ')
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}

/** Zeilen der Texte-Liste anwenden: Änderungen (je Sprache) und Bericht. */
export function applyTextRows(
  entries: readonly TextEntry[],
  rows: readonly SheetRow[],
  opts: {
    base: SnapshotRows | null
    consumed?: ConsumedCells
    /** „N Texte stehen nicht in der Liste“ melden (aus, wenn mehrere Teil-Listen einzeln abgeglichen werden). */
    countMissing?: boolean
  },
): { updates: TextUpdate[]; report: PflegeReport } {
  const report = emptyReport()
  const updates: TextUpdate[] = []
  const byId = new Map(entries.map((e) => [e.id, e]))
  const seen = new Set<string>()
  let dropped = 0
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
      // V-36: Zeilen, die beim Ausgeben in der Liste standen (oder ohne gemerkten Stand), gibt es nicht mehr – der Text
      // erscheint nicht mehr auf der Seite. Kein Fehler: geändert → „Entfällt“, sonst nur gezählt.
      const old = opts.base ? opts.base[id] : undefined
      if (opts.base && !old) {
        report.problems.push(`Kennung „${id}“ gibt es nicht – Zeile nicht übernommen.`)
        continue
      }
      if (seen.has(id)) continue
      seen.add(id)
      const changed = old
        ? (['de', 'en'] as const).some((l) => l in row && !sameText(row[l], old[l] ?? null))
        : false
      const where = str(old?.wo ?? null) || str(row.wo) || id
      if (changed)
        report.dropped.push(
          `${where}: entfällt – dieser Text erscheint nicht mehr auf der Seite, deine Änderung wird nicht gebraucht.`,
        )
      else dropped++
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
    if (opts.base && !base) {
      report.problems.push(
        `${e.where}: stand nicht in dieser Liste, als sie ausgegeben wurde – nicht übernommen, bitte klären.`,
      )
      continue
    }
    for (const [key, why] of Object.entries(row[UNREADABLE] ?? {}))
      if (key !== 'id' && key !== 'wo')
        report.problems.push(
          `${e.where} (${key === 'en' ? 'Englisch' : key === 'de' ? 'Deutsch' : 'Notiz'}): ${why}; nicht übernommen.`,
        )
    const applied = { de: false, en: false }
    for (const lang of ['de', 'en'] as const) {
      if (!(lang in row)) continue
      const label = lang === 'de' ? 'Deutsch' : 'Englisch'
      const d = decide(
        row[lang],
        base ? (base[lang] ?? null) : NO_BASE,
        e[lang],
        sameText,
        opts.consumed?.[id]?.[lang] ?? [],
      )
      if (d === 'keep') continue
      const value = str(row[lang])
      if (d === 'conflict') {
        report.conflicts.push(
          `${e.where} (${label}): in deiner Liste „${short(value)}“, inzwischen „${short(e[lang])}“. Was gilt?`,
        )
        continue
      }
      const bad = (why: string) =>
        report.problems.push(`${e.where} (${label}): „${short(value)}“ – ${why}; nicht übernommen.`)
      if (e.locked) bad(e.locked)
      else if (!value && e[lang]) bad('darf nicht leer sein')
      else if (e.maxLength && value.length > e.maxLength)
        bad(`höchstens ${e.maxLength} Zeichen (jetzt ${value.length})`)
      else {
        // Platzhalter nur in festen Texten (ICU); Seiten, Fragen usw. zeigen { } wörtlich
        const ph = e.id.startsWith('m:') ? checkPlaceholders(e[lang], value) : null
        const forbidden = newForbiddenHits(e[lang], value, forbiddenTarget(e.id))
        const valid = e.validate ? e.validate(value) : true
        if (ph) bad(ph)
        else if (valid !== true) bad(valid)
        else if (forbidden.length)
          bad(`enthält eine verbotene Formulierung (${forbidden.join(', ')}, siehe Rechtsliste)`)
        else {
          updates.push({ id, lang, value })
          applied[lang] = true
          report.changes.push(`${e.where} (${label}): „${short(e[lang])}“ → „${short(value)}“`)
        }
      }
    }
    // Englisch nachziehen, wenn das Deutsche geschrieben wurde, das Englische aber nicht (U-00)
    if (applied.de && !applied.en) report.englishTodo.push(`${e.where} – Kennung ${id}`)
    const note = str(row.notiz)
    const seenNotes = [base?.notiz ?? null, ...(opts.consumed?.[id]?.notiz ?? [])]
    if (note && !(base && seenNotes.some((n) => sameText(n, note))))
      report.ownerNotes.push(`${e.where}: ${note}`)
  }
  if (dropped > 0)
    report.notes.push(
      `${dropped} Zeilen entfallen – diese Texte stehen nicht mehr auf der Seite. Nichts zu tun.`,
    )
  let missing = 0
  if (opts.countMissing !== false)
    for (const e of entries) if (!seen.has(e.id) && (!opts.base || opts.base[e.id])) missing++
  if (missing > 0)
    report.notes.push(`${missing} Texte stehen nicht in der Liste – sie bleiben, wie sie sind.`)
  return { updates, report }
}
