// Versionsgleichheit und exaktes Pinning (ARCHITEKTUR §1.1, §1.3; AK-A-1-01/-02).
// Aufruf: pnpm check:versions. Ab P1.3 zusätzlich Teilprüfung `versions` von pnpm check:static.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface PackageJsonLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export interface VersionReport {
  errors: string[]
  warnings: string[]
}

/** Stichtag für den angekündigten Sicherheits-Patch next 16.3.7 (ARCHITEKTUR §1.1). */
export const NEXT_PATCH_DEADLINE = new Date('2026-09-30T00:00:00+02:00')
export const NEXT_REQUIRED_PATCH = '16.3.7'

function parseVersion(v: string): number[] {
  return v
    .replace(/^[^\d]*/, '')
    .split('-')[0]!
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0)
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export function checkVersions(pkg: PackageJsonLike, now: Date): VersionReport {
  const errors: string[] = []
  const warnings: string[] = []
  const deps = pkg.dependencies ?? {}
  const all = { ...deps, ...(pkg.devDependencies ?? {}) }

  const payload = all.payload
  for (const [name, version] of Object.entries(all)) {
    if (name.startsWith('@payloadcms/') && version !== payload) {
      errors.push(
        `${name}@${version} weicht von payload@${payload} ab (alle @payloadcms/* = payload).`,
      )
    }
  }
  if (all['eslint-config-next'] && all.next && all['eslint-config-next'] !== all.next) {
    errors.push(`eslint-config-next@${all['eslint-config-next']} weicht von next@${all.next} ab.`)
  }
  if (all.react && all['react-dom'] && all.react !== all['react-dom']) {
    errors.push(`react@${all.react} weicht von react-dom@${all['react-dom']} ab.`)
  }
  for (const [name, version] of Object.entries(deps)) {
    if (/^[\^~]/.test(version)) {
      errors.push(
        `${name}@${version}: Laufzeit-Abhängigkeiten werden exakt gepinnt (kein ^ oder ~).`,
      )
    }
  }
  if (
    all.next &&
    now.getTime() >= NEXT_PATCH_DEADLINE.getTime() &&
    compareVersions(all.next, NEXT_REQUIRED_PATCH) < 0
  ) {
    warnings.push(
      `next@${all.next} < ${NEXT_REQUIRED_PATCH}: Sicherheits-Patch einspielen, sobald veröffentlicht (ARCHITEKTUR §1.1, PLAN P1.1b).`,
    )
  }
  return { errors, warnings }
}

export function runCheckVersions(root: string, now: Date): VersionReport {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as PackageJsonLike
  return checkVersions(pkg, now)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const report = runCheckVersions(root, new Date())
  for (const w of report.warnings) console.warn(`Warnung: ${w}`)
  for (const e of report.errors) console.error(`Fehler: ${e}`)
  if (report.errors.length > 0) process.exit(1)
  console.log('check:versions ok')
}
