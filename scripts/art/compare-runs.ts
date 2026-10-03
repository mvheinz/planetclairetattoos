import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

import { ART_ROOT } from './lib/run'

// `pnpm art:compare <laufA> <laufB> [--variant reduced]` (PLAN P9.2 Akzeptanz): Zwei Läufe desselben Commits müssen
// pixelgleiche Standbilder der Variante `reduced` liefern. Vergleicht die dekodierten Pixel aller gemeinsamen Frames.

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.webp') ? [p] : []
  })
}

async function main(): Promise<void> {
  const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--'))
  const vi = process.argv.indexOf('--variant')
  const variant = vi >= 0 ? process.argv[vi + 1]! : 'reduced'
  if (!a || !b) {
    console.error('Aufruf: pnpm art:compare <laufA> <laufB> [--variant reduced]')
    process.exit(2)
  }
  const ra = path.join(ART_ROOT, a, 'frames')
  const rb = path.join(ART_ROOT, b, 'frames')
  const rel = walk(ra)
    .map((p) => path.relative(ra, p))
    .filter((p) => p.split(path.sep)[2] === variant)
  let diff = 0
  let missing = 0
  for (const r of rel) {
    const pb = path.join(rb, r)
    if (!existsSync(pb)) {
      missing++
      continue
    }
    const [x, y] = await Promise.all([
      sharp(path.join(ra, r)).raw().toBuffer(),
      sharp(pb).raw().toBuffer(),
    ])
    if (!x.equals(y)) {
      diff++
      console.log(`verschieden: ${r}`)
    }
  }
  console.log(
    `art:compare ${variant}: ${rel.length} Frames, ${diff} verschieden, ${missing} fehlen in ${b}`,
  )
  process.exit(diff > 0 || missing > 0 || rel.length === 0 ? 1 : 0)
}

void main()
