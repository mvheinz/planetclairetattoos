// Bilder der Vorschau-Datei (KONZEPT §12.5 Nr. 4, ARCHITEKTUR §14.5): `sharp` wendet die Orientierung an, verkleinert
// auf längste Kante ≤ 1200 px (nie vergrößern) und kodiert WebP Qualität 70; Deduplizierung nach SHA-256 der Ausgabe.
// SVG bleibt SVG (Data-URI). Alle Bilder stehen einmal in `#pv-assets`, Templates verweisen per `data-pv-src="<hash>"`.
import { createHash } from 'node:crypto'

import sharp from 'sharp'

export interface ImageSettings {
  maxEdge: 1200 | 1000
  quality: 70 | 60
}

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = { maxEdge: 1200, quality: 70 }
/** Stufen bei Überschreitung des Ziels (ARCHITEKTUR §14.8): erst Qualität 60, dann zusätzlich 1000 px. */
export const IMAGE_SETTING_STEPS: readonly ImageSettings[] = [
  DEFAULT_IMAGE_SETTINGS,
  { maxEdge: 1200, quality: 60 },
  { maxEdge: 1000, quality: 60 },
]

export interface EncodedImage {
  /** Kurzer Inhalts-Hash (erste 16 Hex-Zeichen von SHA-256 der Ausgabe). */
  hash: string
  dataUri: string
  width: number
  height: number
  bytes: number
}

const sha = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex')

export function isSvg(contentType: string, path: string): boolean {
  return contentType.includes('image/svg') || /\.svg(\?|$)/i.test(path)
}

/** SVG-Größe aus `width`/`height` bzw. `viewBox` (für stabiles Layout). */
export function svgSize(svg: string): { width: number; height: number } {
  const tag = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? ''
  const num = (name: string) => {
    const m = new RegExp(`\\b${name}="([\\d.]+)(px)?"`).exec(tag)
    return m ? Math.round(Number(m[1])) : 0
  }
  let width = num('width')
  let height = num('height')
  if (!width || !height) {
    const vb = /viewBox="([^"]+)"/
      .exec(tag)?.[1]
      ?.split(/[\s,]+/)
      .map(Number)
    if (vb && vb.length === 4) {
      width = Math.round(vb[2]!)
      height = Math.round(vb[3]!)
    }
  }
  return { width, height }
}

export async function encodeImage(
  body: Buffer,
  contentType: string,
  path: string,
  settings: ImageSettings,
): Promise<EncodedImage> {
  if (isSvg(contentType, path)) {
    const text = body.toString('utf8')
    const dataUri = `data:image/svg+xml;base64,${body.toString('base64')}`
    return { hash: sha(body).slice(0, 16), dataUri, ...svgSize(text), bytes: dataUri.length }
  }
  const { data, info } = await sharp(body, { failOn: 'none' })
    .rotate()
    .resize({
      width: settings.maxEdge,
      height: settings.maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: settings.quality })
    .toBuffer({ resolveWithObject: true })
  const dataUri = `data:image/webp;base64,${data.toString('base64')}`
  return {
    hash: sha(data).slice(0, 16),
    dataUri,
    width: info.width,
    height: info.height,
    bytes: dataUri.length,
  }
}

/** Kodiert alle Bilder (höchstens 4 parallel) und liefert `Pfad → Bild` sowie die deduplizierte Asset-Tabelle. */
export async function encodeImages(
  inputs: { path: string; contentType: string; body: Buffer }[],
  settings: ImageSettings,
  concurrency = 4,
): Promise<{ byPath: Map<string, EncodedImage>; assets: Map<string, string> }> {
  const byPath = new Map<string, EncodedImage>()
  let i = 0
  const worker = async () => {
    while (i < inputs.length) {
      const input = inputs[i++]!
      byPath.set(input.path, await encodeImage(input.body, input.contentType, input.path, settings))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, worker))
  const assets = new Map<string, string>()
  for (const img of [...byPath.values()].sort((a, b) => a.hash.localeCompare(b.hash)))
    assets.set(img.hash, img.dataUri)
  return { byPath, assets }
}
