// Browser-Verkleinerung vor dem Upload (DESIGN §12.2 Schritt 1, DATENMODELL §6.2): reines Modul, auch im Client nutzbar.

/** Lange Kante nach der Verkleinerung. */
export const DOWNSCALE_MAX_EDGE = 2560
/** JPEG-Qualität der verkleinerten Datei. */
export const DOWNSCALE_JPEG_QUALITY = 0.85
/** Ab dieser Dateigröße wird immer neu kodiert (Vercel-Limit 4,5 MB je Anfrage). */
export const DOWNSCALE_MAX_BYTES = 4 * 1024 * 1024

/** Zielmaß bei langer Kante ≤ `max`, nie vergrößern. */
export function downscaleDimensions(
  width: number,
  height: number,
  max = DOWNSCALE_MAX_EDGE,
): { width: number; height: number; scaled: boolean } {
  const edge = Math.max(width, height)
  if (edge <= max) return { width, height, scaled: false }
  const f = max / edge
  return { width: Math.round(width * f), height: Math.round(height * f), scaled: true }
}

/** Muss die Datei vor dem Upload verkleinert bzw. neu kodiert werden? */
export function needsDownscale(file: { size: number }, width: number, height: number): boolean {
  return Math.max(width, height) > DOWNSCALE_MAX_EDGE || file.size > DOWNSCALE_MAX_BYTES
}

/** Neuer Dateiname mit `.jpg`. */
export function downscaledName(name: string): string {
  return `${name.replace(/\.[^.]*$/, '') || 'bild'}.jpg`
}
