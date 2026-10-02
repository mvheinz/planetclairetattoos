// `pnpm art:admin-icons` (PLAN P5.29, DESIGN §12.6): App-Icons der Verwaltung (PWA) aus der Planet-Marke
// `src/art/planet.svg` – Matte-Grün `#2F6B4C` als Grund, Planet in `--paper`. Ergebnis in `src/admin/pwa/`
// (`icon-192.png`, `icon-512.png` maskierbar, `apple-touch-icon.png` 180 px); ausgeliefert nur unter `ADMIN_ROUTE`
// (Route `src/app/(payload)/admin/pwa/[file]/route.ts`), nie aus `public/`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import sharp from 'sharp'

import { INK, PAPER, planetGroup } from './build-brand'

const ROOT = path.resolve(import.meta.dirname, '../..')
const p = (...parts: string[]) => path.join(ROOT, ...parts)

/** Matte-Grün der Verwaltung (DESIGN §12.6). */
export const ADMIN_ICON_GREEN = '#2F6B4C'
export const ADMIN_ICON_DIR = 'src/admin/pwa'
/** Dateien und Kantenlänge. Maskierbar: der Planet bleibt in der sicheren Zone (Kreis mit 80 % Durchmesser). */
export const ADMIN_ICONS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
] as const

/** Planet in Papierfarbe auf Grün: Striche `--paper`, Planetenkörper grün (verdeckt den hinteren Ring). */
export function adminIconSvg(planetSvg: string, size: number): string {
  const recolored = planetSvg
    .replaceAll(`fill="${PAPER}"`, `fill="${ADMIN_ICON_GREEN}"`)
    .replaceAll(`stroke="${INK}"`, `stroke="${PAPER}"`)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="${ADMIN_ICON_GREEN}"/>` +
    planetGroup(recolored, size / 2, size / 2, size * 0.66, 3) +
    '</svg>'
  )
}

async function main(): Promise<void> {
  const planet = readFileSync(p('src/art/planet.svg'), 'utf8')
  mkdirSync(p(ADMIN_ICON_DIR), { recursive: true })
  for (const { file, size } of ADMIN_ICONS) {
    const png = await sharp(Buffer.from(adminIconSvg(planet, size)))
      .png({ compressionLevel: 9 })
      .toBuffer()
    writeFileSync(p(ADMIN_ICON_DIR, file), png)
    console.log(`art:admin-icons: ${ADMIN_ICON_DIR}/${file} ${png.length} B`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
