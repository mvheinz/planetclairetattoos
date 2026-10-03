// `pnpm art:space` (PLAN P9.12, DESIGN §12.5): Weltraum-Motive aus `content/art/space.ts` → `src/art/space/{id}.svg`
// (Tusche über `currentColor`, Wash über CSS-Variable mit Rückfall, je ≤ 1,5 KB). Deterministisch: gleiche Quelle →
// byte-gleiche Dateien.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { optimize } from 'svgo'

import { SPACE, type SpaceMotif } from '../../content/art/space'
import { ART, handBlob, handStroke } from './lib/handline'

/** SVGO wie `art:vectorize` (floatPrecision 1). */
function compact(svg: string): string {
  return optimize(svg, {
    multipass: true,
    floatPrecision: 1,
    plugins: [{ name: 'preset-default' }, 'mergePaths'],
  }).data
}

export const SPACE_DIR = path.join('src', 'art', 'space')
export const SPACE_MAX_BYTES = 1500

const LINE = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"'

/** Seed je Motiv aus der ID (FNV-1a). */
function seedOf(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return (h >>> 0) % 100000
}

export function spaceSvg(id: string, m: SpaceMotif): string {
  const seed = seedOf(id)
  // kleine Motive: Wackel und Zittern auf die viewBox-Größe skaliert
  const [, , vw] = m.viewBox.split(' ').map(Number) as [number, number, number, number]
  const k = Math.min(1, vw / 160)
  const opts = { wobble: 0.9 * k, tremor: 0.35 * k, wave: 30 }
  const strokes = m.ink.strokes.flatMap((s, i) => handStroke(s, seed + i * 7919, opts)).join('')
  const dots = (m.ink.dots ?? []).map((d, i) => handBlob(d, seed + 13 + i * 31, 0.3)).join('')
  const wash = m.wash
    ? `<path style="fill:var(--wash-${m.wash.color},${ART.wash[m.wash.color]})" d="${handBlob(m.wash.d, seed + 5, 0.4)}"/>`
    : ''
  return compact(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.viewBox}" aria-hidden="true">`,
      wash,
      `<path ${LINE} stroke-width="${m.strokeWidth}" d="${strokes}"/>`,
      dots ? `<path fill="currentColor" d="${dots}"/>` : '',
      '</svg>',
    ].join(''),
  )
}

function main(): void {
  mkdirSync(SPACE_DIR, { recursive: true })
  let over = 0
  for (const [id, m] of Object.entries(SPACE)) {
    const svg = spaceSvg(id, m)
    writeFileSync(path.join(SPACE_DIR, `${id}.svg`), svg)
    const bytes = Buffer.byteLength(svg)
    if (bytes > SPACE_MAX_BYTES) over++
    process.stdout.write(
      `${id.padEnd(14)} ${String(bytes).padStart(5)} B${bytes > SPACE_MAX_BYTES ? '  ÜBER BUDGET' : ''}\n`,
    )
  }
  if (over) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
