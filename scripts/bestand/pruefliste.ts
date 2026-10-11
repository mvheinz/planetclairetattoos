// `pnpm bestand:pruefliste` (U-76, PLAN P16.3): schreibt `dist/planet-claire-pruefliste.html` – alle Stücke aus
// `content/bestand` mit kleinen eingebetteten Fotos und den Prüfpunkten für Jutta (Darstellung: pruefliste-render.ts).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import { bestandPhotoPath, loadBestand, photosOf } from '../../src/lib/bestand/schema'

import { renderPruefliste } from './pruefliste-render'

export const PRUEFLISTE_FILE = path.join('dist', 'planet-claire-pruefliste.html')

async function main(): Promise<void> {
  const root = process.cwd()
  const products = await loadBestand(root)
  const thumbs = new Map<string, string>()
  for (const p of products) {
    for (const { file } of photosOf(p)) {
      const data = await sharp(await readFile(bestandPhotoPath(root, file)))
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 68, mozjpeg: true })
        .toBuffer()
      thumbs.set(file, `data:image/jpeg;base64,${data.toString('base64')}`)
    }
  }
  const date = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' }).format(new Date())
  const html = renderPruefliste({ products, thumbs, date })
  const out = path.join(root, PRUEFLISTE_FILE)
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, html)
  console.log(
    `${PRUEFLISTE_FILE} geschrieben (${(Buffer.byteLength(html) / 1_000_000).toFixed(1)} MB, ${products.length} Stücke)`,
  )
}

await main()
