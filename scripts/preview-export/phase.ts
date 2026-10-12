// Phasen-Kennung der Vorschau-Datei (ARCHITEKTUR §14.9, KONZEPT §12.8): `PREVIEW_PHASE`, falls gesetzt (CI setzt es
// aus `[ci:full pN]` bzw. dem PR-Titel) → sonst die höchste vollständig abgehakte Phase aus `PLAN.md` (die höchste Nummer
// vor dem ersten Abschnitt mit offener Checkbox; `p0`, solange P1 offen ist; `p10`, wenn P1–P10 abgehakt sind; die
// Nachbesserungen P12 ff. stehen vor P11 – sind sie erledigt, nennt die Datei z. B. `p17`, U-78) → sonst `px`.
// Nie aus dem Branch-Namen (Cloud-Branches heißen `claude/…`).

const PHASE_ID = /^p(\d{1,2}|x)$/i

/** `P3`/`p3`/` p3 ` → `p3`; ungültig oder leer → `null`. */
export function normalizePhase(value: string | undefined | null): string | null {
  const v = (value ?? '').trim()
  return PHASE_ID.test(v) ? v.toLowerCase() : null
}

/** Höchste vollständig abgehakte Phase aus dem Text von `PLAN.md`; `null`, wenn nicht ermittelbar. */
export function phaseFromPlan(plan: string): string | null {
  const sections: { n: number; open: boolean }[] = []
  let current: { n: number; open: boolean } | null = null
  for (const line of plan.split('\n')) {
    const heading = /^## P(\d{1,2})\b/.exec(line)
    if (heading) {
      current = { n: Number(heading[1]), open: false }
      sections.push(current)
      continue
    }
    if (/^## /.test(line)) {
      current = null
      continue
    }
    if (current && /^\s*- \[ \]/.test(line)) current.open = true
  }
  if (sections.length === 0) return null
  const open = sections.findIndex((s) => s.open)
  if (open === -1) return `p${Math.max(...sections.map((s) => s.n))}`
  const done = sections.slice(0, open)
  return `p${done.length ? Math.max(...done.map((s) => s.n)) : Math.max(0, sections[open]!.n - 1)}`
}

export interface PhaseSource {
  env?: string | undefined
  plan?: string | null
}

export function resolvePhase({ env, plan }: PhaseSource): string {
  return normalizePhase(env) ?? (plan ? phaseFromPlan(plan) : null) ?? 'px'
}

/** Anzeige im Banner und in der Datei: `p3` → `P3`, `px` → `PX`. */
export const displayPhase = (phase: string) => phase.toUpperCase()
