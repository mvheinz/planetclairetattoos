// Logik des Vorschau-Release (ARCHITEKTUR §6.6, PLAN P10.21): reine Funktionen ohne Abhängigkeiten, damit der Job `gate`
// ohne `pnpm install` läuft (nur Node) und `tests/unit/release/config.unit.spec.ts` sie prüfen kann.
import { createHash } from 'node:crypto'

export const CONFIG_PATH = '.github/vorschau-release.json'
export const ASSET_NAME = 'planet-claire-vorschau.html'
export const SIZE_NOTE_LIMIT_BYTES = 20_000_000
export const SIZE_NOTE =
  'Die Datei ist zu groß für eine Mail – per Link oder USB-Stick auf einen anderen eigenen Rechner bringen.'
export const PRIVATE_NOTE = 'Nur privat ansehen, nicht weitergeben, nicht veröffentlichen'
export const MARKER_PREFIX = '<!-- vorschau-config: '

/** Die ersten 12 Zeichen des SHA-256 der Konfigurationsdatei (Vermerk im Release-Text). */
export function configHash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12)
}

/** Prüft die Form von `vorschau-release.json`; liefert die Fehlertexte (leer = gültig). */
export function configProblems(config) {
  const problems = []
  if (!config || typeof config !== 'object') return ['Konfiguration ist kein Objekt']
  const keys = Object.keys(config).sort().join(',')
  if (keys !== 'notesDe,tag,title')
    problems.push(`Schlüssel müssen tag, title, notesDe sein (sind: ${keys})`)
  if (config.tag !== 'vorschau-p10') problems.push('tag muss vorschau-p10 sein')
  if (config.title !== 'Planet Claire – Vorschau (Stand P10)')
    problems.push('title muss „Planet Claire – Vorschau (Stand P10)“ sein')
  const notes = String(config.notesDe ?? '')
  if (!notes.includes(PRIVATE_NOTE))
    problems.push('notesDe nennt den Hinweis „Nur privat ansehen …“ nicht')
  if (!/^Stand: \d{2}\.\d{2}\.\d{4}$/m.test(notes))
    problems.push('notesDe braucht eine Zeile „Stand: TT.MM.JJJJ“')
  if (!notes.includes(ASSET_NAME)) problems.push(`notesDe nennt ${ASSET_NAME} nicht`)
  if (notes.includes(SIZE_NOTE)) problems.push('der Größen-Satz wird erst vom Workflow angehängt')
  if (notes.includes(MARKER_PREFIX))
    problems.push('der Vermerk vorschau-config wird vom Workflow angehängt')
  return problems
}

/** Die Zeile „Stand: TT.MM.JJJJ“ eines Release-Texts (oder `null`). */
export function standLine(text) {
  return /^Stand: (\d{2}\.\d{2}\.\d{4})$/m.exec(text ?? '')?.[1] ?? null
}

/** `OFFEN_P1_P10=<n>` aus der Ausgabe von `scripts/cloud-setup.sh --plan-status` (`null` = nicht lesbar). */
export function openTasks(planStatusOutput) {
  const m = /^OFFEN_P1_P10=(\d+)\s*$/m.exec(planStatusOutput ?? '')
  return m ? Number(m[1]) : null
}

/**
 * Entscheidung des Jobs `gate`: veröffentlichen nur, wenn der Plan leer ist und das Release fehlt oder veraltet ist.
 * `release` ist die Ausgabe von `gh release view <tag> --json assets,body` oder `null`, wenn es das Release nicht gibt.
 */
export function decide({ planStatusOutput, release, configText }) {
  const open = openTasks(planStatusOutput)
  if (open !== 0) {
    return {
      publish: false,
      reason: 'Plan noch nicht leer – nichts zu tun',
      detail: open === null ? 'OFFEN_P1_P10 nicht lesbar' : `OFFEN_P1_P10=${open}`,
    }
  }
  const config = JSON.parse(configText)
  const hash = configHash(configText)
  if (!release) return { publish: true, reason: 'Release fehlt', detail: config.tag }
  const hasAsset = (release.assets ?? []).some((a) => a.name === ASSET_NAME)
  if (!hasAsset) return { publish: true, reason: 'Release hat das Asset nicht', detail: ASSET_NAME }
  const body = release.body ?? ''
  if (!body.includes(`${MARKER_PREFIX}${hash} -->`))
    return { publish: true, reason: 'Release veraltet (Konfiguration geändert)', detail: hash }
  if (standLine(body) !== standLine(config.notesDe))
    return {
      publish: true,
      reason: 'Release veraltet (Zeile „Stand“)',
      detail: String(standLine(config.notesDe)),
    }
  return { publish: false, reason: 'Release aktuell – nichts zu tun', detail: hash }
}

/** Release-Text: `notesDe`, bei Dateien über 20 MB der Größen-Satz, die Größe in MB und der unsichtbare Vermerk. */
export function buildNotes(config, sizeBytes, hash) {
  const mb = (sizeBytes / 1_000_000).toFixed(1).replace('.', ',')
  const parts = [String(config.notesDe).trim()]
  if (sizeBytes > SIZE_NOTE_LIMIT_BYTES) parts.push(SIZE_NOTE)
  parts.push(`Dateigröße: ${mb} MB.`)
  parts.push(`${MARKER_PREFIX}${hash} -->`)
  return parts.join('\n\n') + '\n'
}
