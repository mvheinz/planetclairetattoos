import 'server-only'

import { create, toBuffer, toString, type QRCodeSegment } from 'qrcode'

import { buildEpcPayload, type EpcInput } from './epc'

// EPC-QR-Code („GiroCode“) als Bild (KONZEPT §4.8, KA-22): PNG (Mail M02 als eingebettetes Bild) und SVG (Danke-Seite,
// Bestellstatus). Serverseitig mit `qrcode` 1.x, ohne Netz. EPC069-12: Fehlerkorrektur M, QR-Version ≤ 13; die
// Nutzdaten gehen unverändert als UTF-8-Bytes in ein Byte-Segment.

/** Fehlerkorrektur laut EPC069-12. */
export const EPC_QR_ERROR_CORRECTION = 'M'
/** Größte erlaubte QR-Version laut EPC069-12. */
export const EPC_QR_MAX_VERSION = 13
/** Ruhezone in Modulen (ISO/IEC 18004: mindestens 4). */
export const EPC_QR_MARGIN = 4
/** Standardbreite des PNG in Pixeln. */
export const EPC_QR_PNG_WIDTH = 360

const COLOR = { dark: '#000000ff', light: '#ffffffff' }

function segments(payload: string): QRCodeSegment[] {
  if (payload === '') throw new Error('EPC-QR: leere Nutzdaten')
  return [{ mode: 'byte', data: Buffer.from(payload, 'utf8') }]
}

/** QR-Version der Nutzdaten (wirft, wenn sie über Version 13 hinausgehen). */
export function epcQrVersion(payload: string): number {
  const { version } = create(segments(payload), {
    errorCorrectionLevel: EPC_QR_ERROR_CORRECTION,
  })
  if (version > EPC_QR_MAX_VERSION) {
    throw new Error(`EPC-QR: Version ${version} > ${EPC_QR_MAX_VERSION}`)
  }
  return version
}

/** EPC-QR als PNG-Buffer (schwarz auf weiß). */
export async function epcQrPng(payload: string, options: { width?: number } = {}): Promise<Buffer> {
  epcQrVersion(payload)
  return toBuffer(segments(payload), {
    type: 'png',
    errorCorrectionLevel: EPC_QR_ERROR_CORRECTION,
    margin: EPC_QR_MARGIN,
    width: options.width ?? EPC_QR_PNG_WIDTH,
    color: COLOR,
  })
}

/** EPC-QR als SVG-Zeichenkette (skalierbar; `width` setzt Breite und Höhe in Pixeln). */
export async function epcQrSvg(payload: string, options: { width?: number } = {}): Promise<string> {
  epcQrVersion(payload)
  return toString(segments(payload), {
    type: 'svg',
    errorCorrectionLevel: EPC_QR_ERROR_CORRECTION,
    margin: EPC_QR_MARGIN,
    ...(options.width ? { width: options.width } : {}),
    color: COLOR,
  })
}

/** Nutzdaten, PNG und SVG in einem Schritt (Danke-Seite, Bestellstatus, Mail M02). */
export async function renderEpcQr(
  input: EpcInput,
): Promise<{ payload: string; png: Buffer; svg: string }> {
  const payload = buildEpcPayload(input)
  const [png, svg] = await Promise.all([epcQrPng(payload), epcQrSvg(payload)])
  return { payload, png, svg }
}
