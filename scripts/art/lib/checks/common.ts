// Gemeinsame Typen und Helfer der automatischen Kunst-Prüfung (`pnpm art:check`, KUNST-QA §3.3, §5; PLAN P9.5/P9.6).
// Jede Prüfung liefert PASS/FAIL mit Messwert und Schwelle; fehlende Rohdaten sind FAIL („keine Daten“) – ein
// Kriterium gilt nie stillschweigend als bestanden. Rein.

export type Status = 'PASS' | 'FAIL'

export interface CheckResult {
  id: string
  status: Status
  /** Messwert (lesbar, mit Einheit). */
  value: string
  /** Schwelle, gegen die geprüft wurde. */
  threshold: string
  /** Einzelbefunde (höchstens 12, Rest gezählt). */
  details?: string[]
}

export const MAX_DETAILS = 12

export function result(
  id: string,
  pass: boolean,
  value: string | number | null,
  threshold: string,
  details: readonly string[] = [],
): CheckResult {
  const d =
    details.length > MAX_DETAILS
      ? [...details.slice(0, MAX_DETAILS), `… und ${details.length - MAX_DETAILS} weitere`]
      : [...details]
  return {
    id,
    status: pass ? 'PASS' : 'FAIL',
    value: value === null ? 'keine Daten' : typeof value === 'number' ? fmt(value) : value,
    threshold,
    ...(d.length ? { details: d } : {}),
  }
}

/** Fehlende Rohdaten → FAIL mit Hinweis, woher sie kommen. */
export const noData = (id: string, threshold: string, hint: string): CheckResult =>
  result(id, false, null, threshold, [hint])

export function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return String(n)
  return String(Math.round(n * 10 ** digits) / 10 ** digits)
}

export const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d

export function mean(v: readonly number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
}

export function std(v: readonly number[]): number {
  if (v.length < 2) return 0
  const m = mean(v)
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length)
}

export function medianOf(v: readonly number[]): number {
  if (!v.length) return NaN
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

export function quantileOf(v: readonly number[], q: number): number {
  if (!v.length) return NaN
  const s = [...v].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]!
}

/** Mehrere Teilprüfungen zu einem Kriterium: PASS nur, wenn alle bestehen. */
export function combine(id: string, threshold: string, parts: readonly CheckResult[]): CheckResult {
  const failed = parts.filter((p) => p.status === 'FAIL')
  return result(
    id,
    failed.length === 0 && parts.length > 0,
    parts.length ? parts.map((p) => `${p.id}: ${p.value}`).join('; ') : null,
    threshold,
    failed.flatMap((p) => p.details ?? [`${p.id}: ${p.value}`]),
  )
}
