// Bildschirmfotos für die Kanzlei-Mappe, Anlage E (PLAN P6.22, KANZLEI-BRIEFING §18): startet Playwright mit
// `scripts/legal/briefing-screenshots.config.ts` (Server wie bei `pnpm test:e2e`, Test-DB, Mock-Treiber, 390 px, DE) und
// verkleinert jede Datei auf höchstens 300 KB (Palette-PNG). Aufruf: pnpm exec tsx scripts/legal/briefing-screenshots.ts
// Voraussetzung: Test-DB mit Grund-Seed (`pnpm db:reset --test`), Widerrufsfunktion R26 (PLAN P6.8).
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const BRIEFING_SHOTS = ['E-01', 'E-02', 'E-03', 'E-04', 'E-05', 'E-06'] as const
export const BRIEFING_SHOT_MAX_BYTES = 300 * 1024
export const briefingShotPath = (name: string) =>
  path.join(ROOT, 'docs/recht/anlagen', `${name}.png`)

/** Verkleinert ein PNG schrittweise (Palette, dann Breite), bis es ≤ 300 KB ist. */
async function shrink(file: string): Promise<number> {
  let size = statSync(file).size
  const original = readFileSync(file)
  for (const [colours, width] of [
    [256, 390],
    [128, 390],
    [64, 390],
    [64, 360],
  ] as const) {
    if (size <= BRIEFING_SHOT_MAX_BYTES) break
    const out = await sharp(original)
      .resize({ width, withoutEnlargement: true })
      .png({ palette: true, colours, compressionLevel: 9, effort: 10 })
      .toBuffer()
    writeFileSync(file, out)
    size = out.length
  }
  return size
}

async function main(): Promise<void> {
  const res = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'test', '--config', 'scripts/legal/briefing-screenshots.config.ts'],
    { cwd: ROOT, stdio: 'inherit', env: process.env },
  )
  if (res.status !== 0) process.exit(res.status ?? 1)
  let failed = false
  for (const name of BRIEFING_SHOTS) {
    const file = briefingShotPath(name)
    if (!existsSync(file)) {
      console.error(`${name}: Datei fehlt`)
      failed = true
      continue
    }
    const size = await shrink(file)
    console.log(`${name}: ${Math.round(size / 1024)} KB`)
    if (size > BRIEFING_SHOT_MAX_BYTES) failed = true
  }
  if (failed) process.exit(1)
}

void main()
