import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  checkFixture,
  FIXTURE_DIR,
  FIXTURE_NAMES,
  fixtureFile,
  generateFixture,
  isFixtureName,
  serializeFixture,
  type FixtureName,
} from './lib/stripe-fixtures'

// pnpm stripe:fixture <name> [--write]   prüft eine Stripe-Fixture; fehlt sie, wird sie aus der Vorlage erzeugt
// pnpm stripe:fixture --all [--write]    dasselbe für alle Fixtures (zehn Ereignisse + Balance Transactions)
// --write erzeugt die Datei neu aus der Vorlage (überschreibt). Aufgezeichnete Ereignisse (Stripe-CLI, Testmodus)
// müssen vor dem Einchecken bereinigt werden: IDs mit „fixture“, nur example.com, Kassen-Referenz = Platzhalter.

const args = process.argv.slice(2)
const write = args.includes('--write')
const all = args.includes('--all')
const names = args.filter((a) => !a.startsWith('--'))

function usage(): never {
  console.error(
    `Aufruf: pnpm stripe:fixture <name>|--all [--write]\nNamen: ${FIXTURE_NAMES.join(', ')}`,
  )
  process.exit(2)
}

if (!all && names.length === 0) usage()
const unknown = names.filter((n) => !isFixtureName(n))
if (unknown.length > 0) {
  console.error(`Unbekannte Fixture: ${unknown.join(', ')}`)
  usage()
}
const selected: FixtureName[] = all ? FIXTURE_NAMES : (names as FixtureName[])

let failed = 0
mkdirSync(path.resolve(FIXTURE_DIR), { recursive: true })
for (const name of selected) {
  const file = path.resolve(fixtureFile(name))
  if (write || !existsSync(file)) {
    writeFileSync(file, serializeFixture(generateFixture(name)))
    console.log(`erzeugt  ${fixtureFile(name)}`)
  }
  let json: unknown
  try {
    json = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(`FEHLER   ${fixtureFile(name)}: kein gültiges JSON (${(e as Error).message})`)
    failed++
    continue
  }
  const errors = checkFixture(name, json)
  if (errors.length > 0) {
    failed++
    console.error(`FEHLER   ${fixtureFile(name)}:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  } else {
    console.log(`ok       ${fixtureFile(name)}`)
  }
}
process.exit(failed > 0 ? 1 : 0)
