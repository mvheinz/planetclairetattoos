import 'server-only'

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import { PDF_FONT } from './fonts'
import {
  DECO_ONLY_TEXT,
  InsertText,
  s as slip,
  type InsertBlock,
  type MakerInfo,
} from './PackingSlip'

// Etikett und Beileger je Stück (PLAN P5.12, R-203, KONZEPT §7.6): druckbares Etikett (zum Ausschneiden, z. B. für
// Hangtag, Schmuckkarte oder den Keramikboden) mit Objektnummer, Name, Postanschrift, E-Mail, Warnhinweisen, bei
// Deko-Keramik „Nur Deko – nicht für Lebensmittel“ und QR-Code zur kanonischen Produktseite; darunter der Beileger
// (DE und EN). Nur lokale Schriften, keine Preise.

export interface ProductLabelData {
  maker: MakerInfo
  insert: InsertBlock
  /** Kanonische Produktseite (DE). */
  productUrl: string
  /** QR-Code als PNG-Data-URL. */
  qr: string
}

const INK = '#1d1a17'

const s = StyleSheet.create({
  label: {
    width: 260,
    borderWidth: 0.8,
    borderColor: INK,
    borderStyle: 'dashed',
    padding: 10,
    flexDirection: 'row',
    marginBottom: 24,
  },
  labelText: { flexGrow: 1, flexShrink: 1, paddingRight: 8, fontSize: 8.5 },
  nr: { fontFamily: PDF_FONT.mono, fontSize: 11, marginBottom: 2 },
  name: { fontWeight: 700 },
  deco: { fontWeight: 700, marginTop: 4 },
  warn: { marginTop: 4 },
  qr: { width: 64, height: 64 },
  url: { fontSize: 7, marginTop: 2 },
})

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z')

export function ProductLabel({ data }: { data: ProductLabelData }) {
  const { maker, insert } = data
  const warning = insert.safety.de
  return (
    <Document
      title={`Etikett ${insert.nr}`}
      author={maker.name}
      creator="planetclairetattoos.com"
      producer="planetclairetattoos.com"
      language="de-DE"
      creationDate={FIXED_DATE}
      modificationDate={FIXED_DATE}
    >
      <Page size="A4" style={slip.page}>
        <Text style={slip.label}>Etikett (ausschneiden)</Text>
        <View style={s.label} wrap={false}>
          <View style={s.labelText}>
            <Text style={s.nr}>{insert.nr}</Text>
            <Text style={s.name}>{maker.name}</Text>
            {maker.address.map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
            <Text>{maker.email}</Text>
            {insert.decoOnly ? <Text style={s.deco}>{DECO_ONLY_TEXT.de}</Text> : null}
            {warning ? <Text style={s.warn}>{warning}</Text> : null}
          </View>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf-Bild, kein HTML */}
            <Image style={s.qr} src={data.qr} />
          </View>
        </View>
        <Text style={s.url}>{data.productUrl}</Text>

        <View style={{ marginTop: 16 }}>
          <Text style={slip.label}>Beileger (ausschneiden und beilegen)</Text>
          <View style={slip.insert} wrap={false}>
            <InsertText insert={insert} maker={maker} locale="de" />
          </View>
          <View style={slip.insert} wrap={false}>
            <InsertText insert={insert} maker={maker} locale="en" />
          </View>
        </View>
      </Page>
    </Document>
  )
}
