// Job `gate` von release.yml (ARCHITEKTUR §6.6): entscheidet in Sekunden, ob veröffentlicht wird. Läuft nur mit Node.
// Eingabe: PLAN_STATUS_FILE (Ausgabe von `cloud-setup.sh --plan-status`), RELEASE_JSON_FILE (`gh release view … --json
// assets,body`, leer oder `null` = Release fehlt), Konfiguration `.github/vorschau-release.json`.
// Ausgabe: `publish=true|false`, `tag`, Job-Summary.
import { appendFileSync, existsSync, readFileSync } from 'node:fs'

import { CONFIG_PATH, decide } from './lib.mjs'

const configText = readFileSync(CONFIG_PATH, 'utf8')
const read = (p) => (p && existsSync(p) ? readFileSync(p, 'utf8') : '')
const rawRelease = read(process.env.RELEASE_JSON_FILE).trim()
let release = null
try {
  release = rawRelease && rawRelease !== 'null' ? JSON.parse(rawRelease) : null
} catch {
  release = null
}
const result = decide({
  planStatusOutput: read(process.env.PLAN_STATUS_FILE),
  release,
  configText,
})
const line = `${result.reason} (${result.detail})`
console.log(`publish=${result.publish}: ${line}`)
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `publish=${result.publish}\ntag=${JSON.parse(configText).tag}\n`,
  )
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Vorschau-Release\n\n${line}\n`)
}
