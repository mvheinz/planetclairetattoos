// Drift-Prüfung (DATENMODELL §10 Nr. 4): Nach `payload migrate` darf `migrate:create ci-drift-check`
// keine Schemaänderung erzeugen. Erzeugte Dateien werden ausgewertet und wieder gelöscht. Aufruf: pnpm check:migrations
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'src/migrations')

/** Enthält die up-Funktion einer generierten Migration SQL-Anweisungen? */
export function migrationHasChanges(source: string): boolean {
  const up = /export async function up\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''
  return /sql`[\s\S]*?\S[\s\S]*?`/.test(up) && !/sql`\s*`/.test(up.trim())
}

function main(): void {
  const before = new Set(readdirSync(dir))
  const indexBefore = readFileSync(path.join(dir, 'index.ts'), 'utf8')
  const res = spawnSync('pnpm', ['-s', 'payload', 'migrate:create', 'ci-drift-check'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PAYLOAD_DB_PUSH: 'false' },
    encoding: 'utf8',
  })
  const created = readdirSync(dir).filter((f) => !before.has(f))
  let drift = false
  for (const f of created) {
    if (f.endsWith('.ts') && migrationHasChanges(readFileSync(path.join(dir, f), 'utf8')))
      drift = true
    rmSync(path.join(dir, f))
  }
  writeFileSync(path.join(dir, 'index.ts'), indexBefore)
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout)
    console.error('check:migrations: migrate:create ist gescheitert.')
    process.exit(1)
  }
  if (drift) {
    console.error(
      'check:migrations: Das Schema weicht von den Migrationen ab – `pnpm payload migrate:create <phase>_<thema>` ausführen und committen.',
    )
    process.exit(1)
  }
  console.log('check:migrations ok – keine Drift')
}

if (import.meta.url === `file://${process.argv[1]}`) main()
