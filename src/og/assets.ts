import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { OG_FONT_METRICS } from './fontMetrics.generated'

// Dateien der OG-Bilder (P3.14, DESIGN §12.6), einmal je Prozess vom eigenen Dateisystem gelesen – nie aus dem Netz:
// TTF-Schriften aus `src/og/fonts/` (gehen nie an den Browser), Wortmarke (`public/art/wordmark.svg`), Planet-Marke
// (`src/art/planet.svg`), Coco-Platzhalter `rennen` aus der Sprite-Quelle (`src/art/coco/coco-sprite.svg`) und das
// statische Rückfallbild `public/og/default.png`.

export const OG_FONT_DIR = path.join('src', 'og', 'fonts')
export const OG_FALLBACK_PNG = path.join('public', 'og', 'default.png')

const root = () => process.cwd()

export interface OgFont {
  name: string
  data: ArrayBuffer
  weight: 400 | 500 | 600
  style: 'normal' | 'italic'
}

let fontsPromise: Promise<OgFont[]> | undefined

async function readArrayBuffer(file: string): Promise<ArrayBuffer> {
  const buf = await readFile(file)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

/** Spectral 500 Italic und Bricolage Grotesque 600 als TTF für `ImageResponse({ fonts })`. */
export function loadOgFonts(): Promise<OgFont[]> {
  fontsPromise ??= Promise.all([
    readArrayBuffer(path.join(root(), OG_FONT_DIR, OG_FONT_METRICS.spectral500i.file)),
    readArrayBuffer(path.join(root(), OG_FONT_DIR, OG_FONT_METRICS.bricolage600.file)),
  ]).then(([spectral, bricolage]) => [
    { name: 'Spectral', data: spectral, weight: 500, style: 'italic' },
    { name: 'Bricolage Grotesque', data: bricolage, weight: 600, style: 'normal' },
  ])
  fontsPromise.catch(() => (fontsPromise = undefined))
  return fontsPromise
}

export const svgDataUrl = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`

/**
 * Ein Coco-Symbol als eigenständiges SVG: CSS-Variablen werden durch ihre Rückfallfarben ersetzt (der Renderer kennt
 * keine `var()`), der Block für erzwungene Farben entfällt.
 */
export function cocoSymbolSvg(sprite: string, id: string): string | null {
  const symbol = new RegExp(`<symbol id="${id}" viewBox="([^"]+)"[^>]*>([\\s\\S]*?)</symbol>`).exec(
    sprite,
  )
  if (!symbol) return null
  const style = (/<style>([\s\S]*?)<\/style>/.exec(sprite)?.[1] ?? '')
    .replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '')
    .replace(/var\(--[\w-]+,\s*([^)]+)\)/g, '$1')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${symbol[1]}"><style>${style}</style>${symbol[2]}</svg>`
}

export interface OgArt {
  /** Wortmarke „planet claire“ (viewBox-Seitenverhältnis `wordmarkRatio` = Breite/Höhe). */
  wordmark: string
  wordmarkRatio: number
  /** Planet-Marke (quadratisch). */
  planet: string
  /** Coco `rennen` (viewBox 160 × 120), `null`, falls die Sprite-Quelle fehlt. */
  coco: string | null
}

let artPromise: Promise<OgArt> | undefined

export function loadOgArt(): Promise<OgArt> {
  artPromise ??= (async () => {
    const [wordmark, planet, sprite] = await Promise.all([
      readFile(path.join(root(), 'public', 'art', 'wordmark.svg'), 'utf8'),
      readFile(path.join(root(), 'src', 'art', 'planet.svg'), 'utf8'),
      readFile(path.join(root(), 'src', 'art', 'coco', 'coco-sprite.svg'), 'utf8').catch(() => ''),
    ])
    const [, , w = 4, h = 1] = (/viewBox="([^"]+)"/.exec(wordmark)?.[1] ?? '0 0 4 1')
      .split(/\s+/)
      .map(Number)
    const coco = cocoSymbolSvg(sprite, 'coco-rennen-a')
    return {
      wordmark: svgDataUrl(wordmark),
      wordmarkRatio: w / h,
      planet: svgDataUrl(planet),
      coco: coco ? svgDataUrl(coco) : null,
    }
  })()
  artPromise.catch(() => (artPromise = undefined))
  return artPromise
}

/** Statisches Rückfallbild (1200 × 630), falls das Erzeugen scheitert. */
export function readFallbackPng(): Promise<Buffer> {
  return readFile(path.join(root(), OG_FALLBACK_PNG))
}
