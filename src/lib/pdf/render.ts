import 'server-only'

import { createHash } from 'node:crypto'

import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

import { registerPdfFonts } from './fonts'

// Gemeinsamer Einstieg aller PDFs (Belege, Rechtstexte): Schriften registrieren, rendern, SHA-256.
// Erzeugungs- und Änderungsdatum setzt das Dokument selbst (fester Zeitpunkt) – gleiche Eingaben ergeben dieselbe Datei.

export interface RenderedPdf {
  data: Buffer
  sha256: string
}

export async function renderPdf(doc: ReactElement<DocumentProps>): Promise<RenderedPdf> {
  registerPdfFonts()
  const data = Buffer.from(await renderToBuffer(doc))
  return { data, sha256: createHash('sha256').update(data).digest('hex') }
}
