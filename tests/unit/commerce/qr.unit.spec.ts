import jsQR from 'jsqr'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { buildEpcPayload } from '@/lib/commerce/epc'
import {
  EPC_QR_MAX_VERSION,
  epcQrPng,
  epcQrSvg,
  epcQrVersion,
  renderEpcQr,
} from '@/lib/commerce/qr'

// KONZEPT §4.8, KA-22 (P4.2): Der EPC-QR ist maschinell lesbar – PNG und SVG (mit sharp gerastert) ergeben dekodiert
// byte-gleich die Nutzdaten aus buildEpcPayload.

const input = {
  bic: 'COBADEFFXXX',
  name: 'Jütta Bäcker',
  iban: 'DE89370400440532013000',
  amountCents: 5390,
  reference: 'PC-2026-00017',
}

async function decode(image: Buffer): Promise<{ data: string; bytes: Buffer }> {
  const { data, info } = await sharp(image)
    .flatten({ background: '#ffffff' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  const code = jsQR(pixels, info.width, info.height)
  if (!code) throw new Error('QR nicht lesbar')
  return { data: code.data, bytes: Buffer.from(code.binaryData) }
}

describe('EPC-QR (qr.ts)', () => {
  const payload = buildEpcPayload(input)
  const expected = Buffer.from(payload, 'utf8')

  it('PNG wird mit jsqr dekodiert und ergibt byte-gleich die Payload', async () => {
    const png = await epcQrPng(payload)
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
    const decoded = await decode(png)
    expect(decoded.bytes.equals(expected)).toBe(true)
    expect(decoded.data).toBe(payload)
  })

  it('SVG (mit sharp gerastert) wird mit jsqr dekodiert und ergibt byte-gleich die Payload', async () => {
    const svg = await epcQrSvg(payload, { width: 400 })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/)
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    const decoded = await decode(png)
    expect(decoded.bytes.equals(expected)).toBe(true)
    expect(decoded.data).toBe(payload)
  })

  it('renderEpcQr liefert Payload, PNG und SVG aus denselben Daten', async () => {
    const r = await renderEpcQr(input)
    expect(r.payload).toBe(payload)
    expect((await decode(r.png)).bytes.equals(expected)).toBe(true)
    expect((await decode(await sharp(Buffer.from(r.svg)).png().toBuffer())).data).toBe(payload)
  })

  it('EPC069-12: QR-Version ≤ 13 bei Fehlerkorrektur M, auch bei maximal langen Feldern', () => {
    expect(epcQrVersion(payload)).toBeLessThanOrEqual(EPC_QR_MAX_VERSION)
    const long = buildEpcPayload({ ...input, name: 'N'.repeat(70), reference: 'R'.repeat(140) })
    expect(epcQrVersion(long)).toBeLessThanOrEqual(EPC_QR_MAX_VERSION)
    expect(() => epcQrVersion('x'.repeat(400))).toThrow(/Version/)
  })
})
