import { readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { cropPixels } from '@/lib/seed/example'
import { loadSeedData } from '@/lib/seed/loader'
import { CANONICAL_SEED_NOW } from '@/lib/seed/time'

// P8.2: Ausschnitte in Prozent → Pixel (SEED-SPEC §2.4, §4.1) für jede Zeile der Tabelle §4.1, gegen die tatsächlichen
// 640-px-Quellen in content/seed/instagram/; dazu stimmen media.json und die Tabelle überein.

const SPEC = path.join(process.cwd(), 'content/seed/SEED-SPEC.md')
const IG_DIR = path.join(process.cwd(), 'content/seed/instagram')

interface CropRow {
  key: string
  file: string
  pct: number[] | null
  px: number[] | null
  focal: number[] | null
}

async function cropTable(): Promise<CropRow[]> {
  const md = await readFile(SPEC, 'utf8')
  const sec = md.slice(md.indexOf('### 4.1'), md.indexOf('### 4.2'))
  return sec
    .split('\n')
    .filter((l) => /^\| `ig:/.test(l) && l.split('|').length > 7)
    .map((line) => {
      const [key, file, crop, px] = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())
      const nums = (s: string) => [...s.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
      const focal = /focal (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)/.exec(crop!)
      return {
        key: key!.replace(/`/g, ''),
        file: file!,
        pct: crop!.startsWith('ganz') ? null : nums(crop!.split(';')[0]!).slice(0, 4),
        px: /×/.test(px!) ? null : nums(px!),
        focal: focal ? [Number(focal[1]), Number(focal[2])] : null,
      }
    })
}

describe('Ausschnitte (SEED-SPEC §4.1)', () => {
  it('jede Zeile: Prozent → Pixel der tatsächlichen Quelle = Kontrollspalte', async () => {
    const rows = await cropTable()
    expect(rows).toHaveLength(17)
    for (const row of rows) {
      const meta = await sharp(path.join(IG_DIR, row.file)).metadata()
      if (!row.pct) {
        expect(row.px, row.key).toBeNull()
        continue
      }
      const [x, y, w, h] = row.pct
      const r = cropPixels({ x: x!, y: y!, w: w!, h: h! }, meta.width!, meta.height!)
      expect([r.left, r.top, r.width, r.height], row.key).toEqual(row.px)
    }
  })

  it('media.json übernimmt Prozentwerte, Fokuspunkte und Reihenfolge der Tabelle', async () => {
    const rows = await cropTable()
    const data = await loadSeedData({ now: new Date(CANONICAL_SEED_NOW) })
    expect(data.media.instagram.map((m) => m.key)).toEqual(rows.map((r) => r.key))
    for (const row of rows) {
      const entry = data.media.instagram.find((m) => m.key === row.key)!
      expect(entry.file, row.key).toBe(row.file)
      expect(entry.crop ? [entry.crop.x, entry.crop.y, entry.crop.w, entry.crop.h] : null).toEqual(
        row.pct,
      )
      expect(entry.focal ? [entry.focal.x, entry.focal.y] : null, row.key).toEqual(row.focal)
    }
  })

  it('Ränder: Ausschnitte werden auf das Bild begrenzt (§2.4)', () => {
    expect(cropPixels({ x: 90, y: 90, w: 50, h: 50 }, 100, 100)).toEqual({
      left: 90,
      top: 90,
      width: 10,
      height: 10,
    })
  })
})
