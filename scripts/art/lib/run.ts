import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Lauf-ID, Ablage und Dateinamen der Kunst-Abnahme (KUNST-QA §4.1, §4.4, §8; PLAN P9.2). Rein bis auf die
// Git-/Dateisystem-Helfer am Ende.

/** Build-Verzeichnis des QA-Builds (`pnpm art:build`). */
export const ART_DIST_DIR = '.next-art'
/** Ablage aller Läufe (nie committen, `.gitignore`). */
export const ART_ROOT = path.join('artifacts', 'art-qa')
/** Port des QA-Servers (`next start`), getrennt von `pnpm dev` (3000) und E2E. */
export const ART_PORT = 3200

export const ART_PROFILES = ['art-iphone15', 'art-pixel7', 'art-desktop'] as const
export type ArtProfile = (typeof ART_PROFILES)[number]
export const ART_VARIANTS = ['motion', 'reduced'] as const
export type ArtVariant = (typeof ART_VARIANTS)[number]

const pad = (n: number, w: number) => String(Math.max(0, Math.trunc(n))).padStart(w, '0')

/** `YYYYMMDD` in UTC. */
export function runDate(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1, 2)}${pad(date.getUTCDate(), 2)}`
}

/** Lauf-ID `<YYYYMMDD>-iter<NN>-<sha7>` (KUNST-QA §4.1). */
export function makeRunId(date: Date, iteration: number, sha: string): string {
  if (!Number.isInteger(iteration) || iteration < 1 || iteration > 99)
    throw new Error(`Iteration muss 1–99 sein (war ${iteration}).`)
  const sha7 = sha.trim().slice(0, 7).toLowerCase()
  if (!/^[0-9a-f]{7}$/.test(sha7)) throw new Error(`Ungültiger Commit-Hash: ${sha}`)
  return `${runDate(date)}-iter${pad(iteration, 2)}-${sha7}`
}

const RUN_ID_RE = /^(\d{8})-iter(\d{2})-([0-9a-f]{7})$/

export function parseRunId(id: string): { date: string; iteration: number; sha7: string } | null {
  const m = RUN_ID_RE.exec(id)
  return m ? { date: m[1]!, iteration: Number(m[2]), sha7: m[3]! } : null
}

/** Nächste Iteration: höchste vorhandene Nummer + 1 (über alle Tage, KUNST-QA §6.6 zählt fortlaufend). */
export function nextIteration(existing: readonly string[]): number {
  const nums = existing.map((e) => parseRunId(e)?.iteration ?? 0)
  return Math.max(0, ...nums) + 1
}

/** Bild-Label: nur `[a-z0-9-]`, z. B. `y1840`, `t0300`, `station3-arrive`. */
export function slugLabel(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'frame'
}

/** `t` in ms als Label `t0300`. */
export const tLabel = (ms: number) => `t${pad(Math.round(ms), 4)}`
/** Scroll-Position als Label `y1840`. */
export const yLabel = (y: number) => `y${pad(Math.round(y), 4)}`

/** Szenario-ID `SC-00` … `SC-18`. */
export function assertScenario(sc: string): string {
  if (!/^SC-\d{2}$/.test(sc)) throw new Error(`Ungültige Szenario-ID: ${sc}`)
  return sc
}

/** `frames/<SC>/<profil>/<variante>/<nnn>-<label>.webp` (KUNST-QA §4.4). */
export function framePath(
  sc: string,
  profile: string,
  variant: string,
  n: number,
  label: string,
): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) throw new Error(`Frame-Nummer 0–999 (war ${n}).`)
  return path.posix.join(
    'frames',
    assertScenario(sc),
    profile,
    variant,
    `${pad(n, 3)}-${slugLabel(label)}.webp`,
  )
}

/** `videos/<SC>/<profil>/<variante>/<name>.webm`. */
export function videoPath(sc: string, profile: string, variant: string, name: string): string {
  return path.posix.join('videos', assertScenario(sc), profile, variant, `${slugLabel(name)}.webm`)
}

/** `--scope SC-01,SC-04` → `['SC-01','SC-04']`; leer = alle. */
export function parseScope(arg: string | undefined): string[] {
  if (!arg) return []
  return [
    ...new Set(
      arg
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  ].map(assertScenario)
}

/** Spec-Datei eines Szenarios. */
export const specFile = (sc: string) => `tests/art/${assertScenario(sc).toLowerCase()}.art.spec.ts`

// ---------- Umgebung (Git, Dateisystem) ----------

export function gitHead(cwd = process.cwd()): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
}

/** `git status --porcelain` leer? (Lauf nur auf sauberem Commit, KUNST-QA §4.1). */
export function gitClean(cwd = process.cwd()): boolean {
  return execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim() === ''
}

export function existingRuns(root = ART_ROOT): string[] {
  return existsSync(root) ? readdirSync(root).filter((d) => RUN_ID_RE.test(d)) : []
}
