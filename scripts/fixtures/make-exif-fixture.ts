// Test-Fixtures für die Bildpipeline (DATENMODELL §6.2, ARCHITEKTUR §7.2, T-05). Aufruf:
//   pnpm exec tsx scripts/fixtures/make-exif-fixture.ts
// Erzeugt synthetische Bilder (keine Fotos von Personen):
// - gps-orientation-6.jpg: 2000×3000 gespeichert, EXIF-Orientation 6 (angezeigt 3000×2000), GPS, XMP und IPTC.
//   Rote Markierung oben links in den gespeicherten Pixeln → nach richtiger Drehung oben rechts.
// - landscape-small.jpg: 640×427 ohne Metadaten (kleiner als card/detail/zoom/og → nichts wird hochskaliert).
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const FIXTURE_DIR = path.join(root, 'tests/fixtures/images')

const XMP = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>Fixture Creator</rdf:li></rdf:Seq></dc:creator></rdf:Description>
</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`

/** IPTC-IIM (Record 2) in einem Photoshop-APP13-Segment direkt nach SOI einfügen – sharp schreibt kein IPTC. */
export function insertIptc(jpeg: Buffer, caption: string): Buffer {
  const text = Buffer.from(caption, 'utf8')
  const dataset = Buffer.concat([
    Buffer.from([0x1c, 0x02, 0x78, text.length >> 8, text.length & 0xff]),
    text,
  ])
  const padded = dataset.length % 2 ? Buffer.concat([dataset, Buffer.from([0])]) : dataset
  const size = Buffer.alloc(4)
  size.writeUInt32BE(dataset.length)
  const resource = Buffer.concat([
    Buffer.from('8BIM', 'latin1'),
    Buffer.from([0x04, 0x04, 0x00, 0x00]), // Ressource 0x0404 (IPTC), leerer Pascal-Name (gerade Länge)
    size,
    padded,
  ])
  const payload = Buffer.concat([Buffer.from('Photoshop 3.0\0', 'latin1'), resource])
  const len = payload.length + 2
  const segment = Buffer.concat([Buffer.from([0xff, 0xed, len >> 8, len & 0xff]), payload])
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('kein JPEG')
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)])
}

async function orientedFixture(): Promise<Buffer> {
  const width = 2000
  const height = 3000
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#e8e2d0"/>
    <rect x="0" y="0" width="400" height="400" fill="#ff0000"/>
    <circle cx="1000" cy="1500" r="500" fill="#2a4d8f"/>
  </svg>`
  const jpeg = await sharp(Buffer.from(svg))
    .jpeg({ quality: 80 })
    .withExif({
      IFD0: { Make: 'FixtureCam', Model: 'Orientation Six', Copyright: 'Test fixture' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '52/1 31/1 12/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '13/1 24/1 18/1',
      },
    })
    .withMetadata({ orientation: 6 })
    .withXmp(XMP)
    .toBuffer()
  return insertIptc(jpeg, 'Fixture caption with IPTC')
}

async function landscapeSmall(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="427">
    <rect width="100%" height="100%" fill="#f3efe4"/><rect x="40" y="40" width="200" height="120" fill="#c0392b"/>
  </svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer()
}

export async function makeFixtures(dir = FIXTURE_DIR): Promise<{ gps: string; small: string }> {
  mkdirSync(dir, { recursive: true })
  const gps = path.join(dir, 'gps-orientation-6.jpg')
  const small = path.join(dir, 'landscape-small.jpg')
  writeFileSync(gps, await orientedFixture())
  writeFileSync(small, await landscapeSmall())
  return { gps, small }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  makeFixtures().then(
    (r) =>
      console.log(
        `Fixtures geschrieben: ${path.relative(root, r.gps)}, ${path.relative(root, r.small)}`,
      ),
    (e: unknown) => {
      console.error(e)
      process.exit(1)
    },
  )
}
