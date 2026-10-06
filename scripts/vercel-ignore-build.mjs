// „Ignored Build Step“ für Vercel (ARCHITEKTUR §12, PLAN P10.13): kein Build, wenn sich nur `docs/**`, `tests/**` oder
// `content/art/**` geändert haben. Exit-Code 0 = Build überspringen, 1 = bauen (Vercel-Konvention). Im Zweifel (kein
// Vergleichsstand, Git-Fehler) wird gebaut. Läuft vor `pnpm install`, deshalb reines Node ohne Abhängigkeiten.
import { execFileSync } from 'node:child_process'

export const IGNORED_PATTERNS = [/^docs\//, /^tests\//, /^content\/art\//]

/** `true`, wenn alle geänderten Dateien zu den ignorierten Pfaden gehören (und es Änderungen gibt). */
export function shouldSkipBuild(files) {
  const changed = files.map((f) => f.trim()).filter(Boolean)
  return changed.length > 0 && changed.every((f) => IGNORED_PATTERNS.some((re) => re.test(f)))
}

function main() {
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA
  if (!previous) {
    console.log('vercel-ignore-build: kein Vergleichsstand – es wird gebaut.')
    process.exit(1)
  }
  let files
  try {
    files = execFileSync('git', ['diff', '--name-only', previous, 'HEAD'], {
      encoding: 'utf8',
    }).split('\n')
  } catch {
    console.log('vercel-ignore-build: git diff nicht möglich – es wird gebaut.')
    process.exit(1)
  }
  if (shouldSkipBuild(files)) {
    console.log('vercel-ignore-build: nur docs/tests/content-art geändert – Build übersprungen.')
    process.exit(0)
  }
  console.log('vercel-ignore-build: es wird gebaut.')
  process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
