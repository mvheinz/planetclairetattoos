import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import 'dotenv/config'
import pg from 'pg'
import sharp from 'sharp'

import { imageLook, median, type ImageLook } from './lib/lab'
import { ART_ROOT, framePath } from './lib/run'

// SC-16 (KUNST-QA §4.3, §5.9; PLAN P9.2): Titelbilder des Beispielbestands – Ergebnis der Bild-Pipeline (Größe `card`,
// wie sie die Seite zeigt) gegen das Original. Skript ohne Browser: je Stück ein Vorher/Nachher-Paar als Frame
// `frames/SC-16/script/none/<nnn>-nr<nummer>.webp` und Kennzahlen `metrics/images.json` (Median-L*, Papier-a*/b*,
// Clipping, Dateigrößen `thumb`/`card`; Streuung des Median-L* über alle Titelbilder, IM-01/IM-02/IM-05). Fehlt eine
// Ableitung auf der Platte, rechnet das Skript sie mit den Parametern aus `MEDIA_IMAGE_SIZES` nach (vermerkt).

const RUN_DIR = path.resolve(process.env.ART_RUN_DIR || path.join(ART_ROOT, '_adhoc'))
const MEDIA_DIR = path.resolve(process.env.STORAGE_LOCAL_DIR || '.data', 'media')
const PAIR_W = 400
const PAIR_H = 500

interface Row {
  item_number: number
  filename: string
  thumb: string | null
  card: string | null
}

async function look(buf: Buffer): Promise<ImageLook> {
  const { data, info } = await sharp(buf)
    .rotate()
    .resize({ width: 320, height: 320, fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return imageLook(data, info.width, info.height, info.channels)
}

const fileOr = (name: string | null) => {
  if (!name) return null
  const p = path.join(MEDIA_DIR, name)
  return existsSync(p) ? p : null
}

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const { rows } = await client.query<Row>(`
    select p.item_number, m.filename, m.sizes_thumb_filename as thumb, m.sizes_card_filename as card
    from products p
    join products_rels r on r.parent_id = p.id and r.path = 'images'
    join media m on m.id = r.media_id
    where r."order" = (select min(r2."order") from products_rels r2 where r2.parent_id = p.id and r2.path = 'images')
    order by p.item_number`)
  await client.end()

  const items: Record<string, unknown>[] = []
  let n = 0
  for (const row of rows) {
    const orig = fileOr(row.filename)
    if (!orig) {
      items.push({ itemNumber: row.item_number, error: `Original fehlt: ${row.filename}` })
      continue
    }
    const original = readFileSync(orig)
    const cardFile = fileOr(row.card)
    const card = cardFile
      ? readFileSync(cardFile)
      : await sharp(original)
          .rotate()
          .resize({ width: 800, height: 1000, fit: 'cover', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer()
    const thumbFile = fileOr(row.thumb)
    const [before, after] = await Promise.all([look(original), look(card)])
    const tile = (b: Buffer) =>
      sharp(b)
        .rotate()
        .resize({ width: PAIR_W, height: PAIR_H, fit: 'contain', background: '#f4efe6' })
        .png()
        .toBuffer()
    const pair = await sharp({
      create: { width: PAIR_W * 2 + 8, height: PAIR_H, channels: 3, background: '#f4efe6' },
    })
      .composite([
        { input: await tile(original), left: 0, top: 0 },
        { input: await tile(card), left: PAIR_W + 8, top: 0 },
      ])
      .webp({ quality: 90 })
      .toBuffer()
    n++
    const rel = framePath('SC-16', 'script', 'none', n, `nr${row.item_number}`)
    mkdirSync(path.dirname(path.join(RUN_DIR, rel)), { recursive: true })
    writeFileSync(path.join(RUN_DIR, rel), pair)
    items.push({
      itemNumber: row.item_number,
      frame: rel,
      original: row.filename,
      cardSource: cardFile ? 'datei' : 'nachgerechnet',
      before,
      after,
      bytes: {
        thumb: thumbFile ? statSync(thumbFile).size : null,
        card: cardFile ? statSync(cardFile).size : card.length,
      },
    })
  }
  const afters = items
    .map((i) => (i.after as ImageLook | undefined)?.medianL)
    .filter((v): v is number => typeof v === 'number')
  const mean = afters.reduce((a, b) => a + b, 0) / Math.max(1, afters.length)
  const sd = Math.sqrt(afters.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, afters.length))
  const summary = {
    count: items.length,
    medianLStdDev: Math.round(sd * 100) / 100,
    medianCardBytes: median(items.map((i) => (i.bytes as { card: number } | undefined)?.card ?? 0)),
    medianThumbBytes: median(
      items
        .map((i) => (i.bytes as { thumb: number | null } | undefined)?.thumb)
        .filter((v): v is number => !!v),
    ),
  }
  const out = path.join(RUN_DIR, 'metrics', 'images.json')
  mkdirSync(path.dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify({ scenario: 'SC-16', summary, items }, null, 2)}\n`)
  console.log(`SC-16: ${items.length} Titelbilder, σ(Median-L*) ${summary.medianLStdDev} → ${out}`)
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
