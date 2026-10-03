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
  const webp = await sharp(png).webp({ quality }).toBuffer()
  return writeRunFile(rel, webp)
}

export const writeJson = (rel: string, data: unknown) =>
  writeRunFile(rel, `${JSON.stringify(data, null, 2)}\n`)
