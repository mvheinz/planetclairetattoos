import 'server-only'

import path from 'node:path'

import { Font } from '@react-pdf/renderer'

// Schriften der PDFs (ARCHITEKTUR §1.2, P4.11): lokale TTF-Dateien aus `src/lib/pdf/fonts/` (erzeugt von
// `pnpm fonts:copy`), nie aus dem Netz. Keine Silbentrennung (Namen, Nummern und Rechtstexte bleiben unverändert).

export const PDF_FONT_DIR = path.join('src', 'lib', 'pdf', 'fonts')
export const PDF_FONT = { text: 'Bricolage Grotesque', mono: 'IBM Plex Mono' } as const

let registered = false

export function registerPdfFonts(): void {
  if (registered) return
  const dir = path.join(process.cwd(), PDF_FONT_DIR)
  Font.register({
    family: PDF_FONT.text,
    fonts: [
      { src: path.join(dir, 'bricolage-grotesque-400.ttf'), fontWeight: 400 },
      { src: path.join(dir, 'bricolage-grotesque-700.ttf'), fontWeight: 700 },
    ],
  })
  Font.register({ family: PDF_FONT.mono, src: path.join(dir, 'ibm-plex-mono-400.ttf') })
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}
