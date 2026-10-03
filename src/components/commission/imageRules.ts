// Regeln für Bilder des Auftragsarbeiten-Formulars im Browser (PLAN P7.13, KONZEPT §10.2, ARCHITEKTUR §8.8): Auswahl ≤ 15 MB je
// Datei, Verkleinerung auf ≤ 2560 px Kante und ≤ 4 MB (JPEG, Qualität schrittweise 0,85 → 0,6; reicht das nicht, wird
// die Kante weiter verkleinert), dann Upload einzeln an `POST /api/uploads/commission` mit Fortschritt. Nur eigene Origin
// (CSP `connect-src 'self'`), kein Speicher im Browser außer flüchtigen `blob:`-URLs für die Vorschau.
// Klein und statisch im Formular; Verkleinern und Hochladen (`./imageUpload`) lädt das Formular erst bei der ersten
// Bildauswahl nach (hält R10 im Budget firstLoadJs, tests/perf/budgets.json).

export const IMAGE_MAX_COUNT = 5
export const IMAGE_MAX_SELECT_BYTES = 15 * 1024 * 1024
export const IMAGE_MAX_EDGE = 2560
export const IMAGE_MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const IMAGE_QUALITIES = [0.85, 0.8, 0.75, 0.7, 0.65, 0.6] as const
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type ImageCheck = 'ok' | 'type' | 'size'

export function checkSelectedImage(file: Pick<File, 'type' | 'size'>): ImageCheck {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'type'
  if (file.size > IMAGE_MAX_SELECT_BYTES) return 'size'
  return 'ok'
}

/** Kantenlängen nach dem Verkleinern (Seitenverhältnis bleibt, nie größer als das Original). */
export function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
