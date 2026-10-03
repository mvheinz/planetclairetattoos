import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

import { ART_ROOT } from '../../../scripts/art/lib/run'

// Ablage eines Laufs (KUNST-QA §8): `pnpm art:record` setzt `ART_RUN_DIR` (`artifacts/art-qa/<lauf-id>`); ein direkter
// `playwright test`-Aufruf schreibt nach `artifacts/art-qa/_adhoc`.
export const RUN_DIR = path.resolve(process.env.ART_RUN_DIR || path.join(ART_ROOT, '_adhoc'))

export function writeRunFile(rel: string, data: Buffer | string): string {
  const abs = path.join(RUN_DIR, rel)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, data)
  return abs
}

/** PNG (verlustfrei aufgenommen) → WebP q 90 (Einzelframes, KUNST-QA §4.4). */
export async function writeWebp(rel: string, png: Buffer, quality = 90): Promise<string> {
  // smartSubsample: feine dunkle Linien behalten ihre Farbe (sonst färbt 4:2:0 die Tusche mit dem Papierton, LQ-01)
  const webp = await sharp(png).webp({ quality, smartSubsample: true }).toBuffer()
  return writeRunFile(rel, webp)
}

/**
 * Größter zusammenhängender Anteil der Bildhöhe aus völlig einfarbigen Zeilen (max − min ≤ 2 in Graustufen). Das
 * Papier hat ein Raster, echte Seiten haben also kaum einfarbige Zeilen; ein großer Block bedeutet meist, dass Chromium
 * (Mobil-Emulation, angehaltene Uhr) die Kacheln nach einem Scroll-Sprung noch nicht gerastert hat.
 */
export async function flatBandFraction(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png)
    .greyscale()
    .resize({ width: 256, kernel: 'nearest' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  let run = 0
  let best = 0
  for (let y = 0; y < info.height; y++) {
    let mn = 255
    let mx = 0
    for (let x = 0; x < info.width; x++) {
      const v = data[y * info.width + x]!
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
    run = mx - mn <= 2 ? run + 1 : 0
    if (run > best) best = run
  }
  return best / info.height
}

export const writeJson = (rel: string, data: unknown) =>
  writeRunFile(rel, `${JSON.stringify(data, null, 2)}\n`)
