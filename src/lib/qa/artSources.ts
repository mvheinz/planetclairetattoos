import 'server-only'

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

// Quellen der Stationszeichnungen für `/qa/art` (KUNST-QA §3.2, SC-13, AR-01): Ausschnitt der Instagram-Vorlage genau
// wie `pnpm art:vectorize` (`content/art/sources.json`, Crop in Prozent nach EXIF-Drehung), als WebP-Daten-URI in der
// Breite der Zeichnung. Nur QA-Modus; liest Dateien aus dem Repo (Server läuft im Repo-Ordner).

interface Crop {
  x: number
  y: number
  w: number
  h: number
}
interface SourcesJson {
  vectorize: { id: string; file: string; crop: Crop }[]
  derived: { id: string; from: string; kind: string; reference?: string; crop?: Crop }[]
}

export interface QaStationSource {
  id: string
  kind: 'photo' | 'derived'
  /** Daten-URI des Ausschnitts (nur `photo`) bzw. der Referenz. */
  image: string | null
  /** Beschreibung der Herkunft (Datei bzw. `from`). */
  from: string
}

const IG_DIR = path.join('content', 'seed', 'instagram')

async function cropDataUri(file: string, crop: Crop | null, width: number): Promise<string | null> {
  try {
    const rotated = await sharp(await readFile(path.join(process.cwd(), IG_DIR, file)))
      .rotate()
      .toBuffer()
    const meta = await sharp(rotated).metadata()
    let img = sharp(rotated)
    if (crop && meta.width && meta.height) {
      const left = Math.round((crop.x / 100) * meta.width)
      const top = Math.round((crop.y / 100) * meta.height)
      img = img.extract({
        left,
        top,
        width: Math.min(meta.width - left, Math.round((crop.w / 100) * meta.width)),
        height: Math.min(meta.height - top, Math.round((crop.h / 100) * meta.height)),
      })
    }
    const out = await img.resize({ width }).webp({ quality: 85 }).toBuffer()
    return `data:image/webp;base64,${out.toString('base64')}`
  } catch {
    return null
  }
}

export async function loadStationSources(width = 640): Promise<QaStationSource[]> {
  const json = JSON.parse(
    await readFile(path.join(process.cwd(), 'content', 'art', 'sources.json'), 'utf8'),
  ) as SourcesJson
  const photos = await Promise.all(
    json.vectorize.map(async (v) => ({
      id: v.id,
      kind: 'photo' as const,
      image: await cropDataUri(v.file, v.crop, width),
      from: v.file,
    })),
  )
  const derived = await Promise.all(
    json.derived.map(async (d) => ({
      id: d.id,
      kind: 'derived' as const,
      // `traced` (P9.12): Ausschnitt der Vorlage wie beim Nachzeichnen; sonst das ganze Referenzbild
      image: d.reference ? await cropDataUri(d.reference, d.crop ?? null, width) : null,
      from: d.reference ? `${d.from} (Referenz ${d.reference})` : d.from,
    })),
  )
  return [...photos, ...derived]
}

/** Weltraum-Motive (`src/art/space/*.svg`, `pnpm art:space`, DESIGN §12.5) für `/qa/art`. */
export async function loadSpaceSvgs(): Promise<{ id: string; svg: string }[]> {
  const dir = path.join(process.cwd(), 'src', 'art', 'space')
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith('.svg'))
  return Promise.all(
    files.sort().map(async (f) => ({
      id: f.replace(/\.svg$/, ''),
      svg: await readFile(path.join(dir, f), 'utf8'),
    })),
  )
}

/** Alle Platzhalter-SVGs (`src/art/placeholders/*.svg`) als Text. */
export async function loadPlaceholderSvgs(): Promise<{ id: string; svg: string }[]> {
  const dir = path.join(process.cwd(), 'src', 'art', 'placeholders')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.svg')).sort()
  return Promise.all(
    files.map(async (f) => ({
      id: f.replace(/\.svg$/, ''),
      svg: await readFile(path.join(dir, f), 'utf8'),
    })),
  )
}
