import 'server-only'

import sharp from 'sharp'

// Vom Seed erzeugte Beispielbilder der privaten Dateien (SEED-SPEC §4.4): einfache Linienzeichnungen ohne Personen,
// deterministisch, mit sichtbarem Schriftzug „BEISPIEL-…“ (außer der Auftrags-Skizze, die keinen Text zeigt).
// Keine echten Fotos, keine Metadaten (sharp schreibt ohne EXIF).

export const SEED_DRAWING_MOTIFS = [
  'packing-open',
  'packing-closed',
  'commission-plate-bunnies',
  'complaint-bowl-crack',
  'complaint-shirt-faded',
] as const
export type SeedDrawingMotif = (typeof SEED_DRAWING_MOTIFS)[number]

const INK = '#1d1b19'
const PAPER = '#f6f1e7'
const STROKE = `fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"`

/** Motiv als SVG-Pfade im Koordinatensystem 1200×900 (Bild wird auf das Zielformat skaliert). */
function motifPaths(motif: SeedDrawingMotif): string {
  switch (motif) {
    case 'packing-open':
      // offener Karton mit Klappen, darin zerknülltes Papierpolster
      return [
        `<path ${STROKE} d="M330 420 L870 420 L870 760 L330 760 Z"/>`,
        `<path ${STROKE} d="M330 420 L250 300 M870 420 L950 300 M330 420 L420 330 L780 330 L870 420"/>`,
        `<path ${STROKE} d="M380 430 q40 -60 90 -10 q30 -70 90 -5 q50 -60 100 0 q40 -55 95 5 q35 -40 75 15"/>`,
        `<path ${STROKE} d="M420 470 q30 25 60 0 q30 25 60 0 M640 480 q30 20 60 0"/>`,
      ].join('')
    case 'packing-closed':
      // zugeklebter Karton mit Klebeband über der Naht
      return [
        `<path ${STROKE} d="M300 380 L900 380 L900 760 L300 760 Z"/>`,
        `<path ${STROKE} d="M300 380 L420 300 L1020 300 L900 380 M900 760 L1020 680 L1020 300"/>`,
        `<path ${STROKE} d="M560 300 L470 380 L470 760 M640 300 L550 380 L550 760"/>`,
      ].join('')
    case 'commission-plate-bunnies':
      // Teller (Ellipse) mit zwei Hasen, die sich an den Pfoten halten
      return [
        `<ellipse ${STROKE} cx="600" cy="470" rx="420" ry="300"/>`,
        `<ellipse ${STROKE} cx="600" cy="470" rx="330" ry="225"/>`,
        `<path ${STROKE} d="M470 560 q-40 -90 0 -160 q40 70 0 160 M470 400 l-25 -110 M490 400 l20 -115"/>`,
        `<path ${STROKE} d="M730 560 q-40 -90 0 -160 q40 70 0 160 M710 400 l-20 -115 M730 400 l25 -110"/>`,
        `<path ${STROKE} d="M495 500 q105 40 210 0"/>`,
        `<circle cx="460" cy="440" r="7" fill="${INK}"/><circle cx="740" cy="440" r="7" fill="${INK}"/>`,
      ].join('')
    case 'complaint-bowl-crack':
      // Schale mit Sprung am Rand in einem eingedrückten Karton
      return [
        `<path ${STROKE} d="M250 430 L950 430 L930 780 L270 780 Z M250 430 L330 360 L520 400"/>`,
        `<path ${STROKE} d="M420 520 q180 200 360 0 M420 520 q180 -60 360 0"/>`,
        `<path ${STROKE} d="M700 505 l-20 40 l25 25 l-15 45"/>`,
      ].join('')
    case 'complaint-shirt-faded':
      // T-Shirt mit verblasster Stelle an der Schulter (gestrichelt)
      return [
        `<path ${STROKE} d="M420 220 L320 290 L250 420 L340 460 L390 380 L390 780 L810 780 L810 380 L860 460 L950 420 L880 290 L780 220 q-180 90 -360 0"/>`,
        `<ellipse cx="760" cy="300" rx="70" ry="45" fill="none" stroke="${INK}" stroke-width="4" stroke-dasharray="10 12"/>`,
      ].join('')
  }
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** SVG 1200×900 (Seitenverhältnis wie die Zielgrößen) mit Motiv und optionalem Schriftzug. */
export function seedDrawingSvg(motif: SeedDrawingMotif, label?: string): string {
  const text = label
    ? `<text x="600" y="120" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="56" font-weight="bold" fill="${INK}">${escapeXml(label)}</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900"><rect width="1200" height="900" fill="${PAPER}"/>${motifPaths(motif)}${text}</svg>`
}

export interface SeedDrawingFile {
  format: 'jpeg' | 'png'
  width: number
  height: number
  motif: SeedDrawingMotif
  label?: string
}

/** Gerastertes Beispielbild (JPEG bzw. PNG) in der gewünschten Größe. */
export async function seedDrawing(file: SeedDrawingFile): Promise<Buffer> {
  const img = sharp(Buffer.from(seedDrawingSvg(file.motif, file.label))).resize(
    file.width,
    file.height,
    { fit: 'contain', background: PAPER },
  )
  return file.format === 'png'
    ? img.png().toBuffer()
    : img.flatten({ background: PAPER }).jpeg({ quality: 85 }).toBuffer()
}
