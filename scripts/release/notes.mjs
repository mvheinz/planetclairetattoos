// Schritt im Job `publish` von release.yml: schreibt den Release-Text (`notesDe`, ggf. Größen-Satz, Vermerk) nach
// `dist/release-notes.md` und gibt Größe und SHA-256 der Vorschau-Datei aus (`size=`, `sha256=` für GITHUB_OUTPUT).
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs'

import { ASSET_NAME, buildNotes, CONFIG_PATH, configHash } from './lib.mjs'

const configText = readFileSync(CONFIG_PATH, 'utf8')
const config = JSON.parse(configText)
const file = `dist/${ASSET_NAME}`
const size = statSync(file).size
const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex')
writeFileSync('dist/release-notes.md', buildNotes(config, size, configHash(configText)))
const out = `size=${size}\nsha256=${sha256}\ntag=${config.tag}\ntitle=${config.title}\n`
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out)
console.log(out)
