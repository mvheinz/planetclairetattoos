// Schriften der Vorschau-Datei (KONZEPT §12.5 Nr. 2, E-79): die drei selbst gehosteten Familien als
// `data:font/woff2;base64,…` direkt im `@font-face` – keine Datei, kein Request.

export function isFont(contentType: string, path: string): boolean {
  return contentType.startsWith('font/') || /\.(woff2?|ttf|otf)(\?|$)/i.test(path)
}

const FONT_MIME: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

export function fontDataUri(body: Buffer, contentType: string, path: string): string {
  const ext = /\.(woff2?|ttf|otf)(\?|$)/i.exec(path)?.[1]?.toLowerCase()
  const mime = (ext && FONT_MIME[ext]) || contentType.split(';')[0]!.trim() || 'font/woff2'
  return `data:${mime};base64,${body.toString('base64')}`
}
