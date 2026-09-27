import 'server-only'

// Minimale einseitige PDF-Datei für Beispieldokumente (SEED-SPEC §4.4, z. B. `nickel-demo`): A4, Helvetica, Text in
// WinAnsi-Kodierung, Zeilen umbrochen. Kein echtes Dokument und kein Beleg – nur ein erkennbarer Platzhalter.

const WIN_ANSI: Record<string, number> = {
  '–': 0x96,
  '—': 0x97,
  '„': 0x84,
  '“': 0x93,
  '”': 0x94,
  '‘': 0x91,
  '’': 0x92,
  '€': 0x80,
  '…': 0x85,
}

function encode(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = WIN_ANSI[ch] ?? ch.charCodeAt(0)
    const c = code > 0xff ? 0x3f : code
    if (c === 0x28 || c === 0x29 || c === 0x5c) out += `\\${String.fromCharCode(c)}`
    else if (c < 0x20 || c > 0x7e) out += `\\${c.toString(8).padStart(3, '0')}`
    else out += String.fromCharCode(c)
  }
  return out
}

function wrap(text: string, max = 78): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (line && `${line} ${word}`.length > max) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}

/** Einseitiges PDF mit dem Text (Überschrift fett, weitere Zeilen normal). */
export function simplePdf(title: string, body: string): Buffer {
  const lines = [
    `BT /F2 16 Tf 56 780 Td (${encode(title)}) Tj ET`,
    ...wrap(body).map((l, i) => `BT /F1 11 Tf 56 ${740 - i * 16} Td (${encode(l)}) Tj ET`),
  ].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(lines, 'latin1')} >>\nstream\n${lines}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
