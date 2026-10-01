import 'server-only'

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import { PDF_FONT } from './fonts'

// Packzettel (PLAN P5.12, KONZEPT §7.6): A4, **ohne Preise** – Bestellnummer, Datum, Empfänger:in, Positionen mit Foto,
// `Nr.`, Titel und Lagerort, Verpackungs-Checkliste, je Stück ein Beileger-Block zum Abtrennen (Herstellerin mit Name,
// Anschrift und E-Mail aus `settings.business`, `Nr.`, Warn-/Sicherheits- und Pflegehinweise – GPSR, R-203; bei
// EN-Bestellungen zusätzlich EN) und Platz für eine handschriftliche Karte. Texte des Zettels sind Deutsch (für Jutta),
// die Beileger in der Sprache der Bestellung plus Deutsch.

export interface MakerInfo {
  name: string
  /** Postanschrift als Zeilen. */
  address: string[]
  email: string
}

export interface LocalizedText {
  de: string | null
  en: string | null
}

export interface InsertBlock {
  nr: string
  nrEn: string
  title: LocalizedText
  safety: LocalizedText
  care: LocalizedText
  /** Deko-Keramik: „Nur Deko – nicht für Lebensmittel“. */
  decoOnly: boolean
}

export interface PackingSlipItem {
  nr: string
  title: string
  storageLocation: string | null
  /** JPEG als Data-URL (oder `null`). */
  photo: string | null
}

export interface PackingSlipData {
  orderNumber: string
  /** Bestelldatum (Berlin, TT.MM.JJJJ). */
  placedAt: string
  locale: 'de' | 'en'
  recipient: string[]
  shippingClassLabel: string | null
  items: PackingSlipItem[]
  checklist: string[]
  maker: MakerInfo
  inserts: InsertBlock[]
}

/** Deko-Hinweis (R-203, KONZEPT §7.6). */
export const DECO_ONLY_TEXT = {
  de: 'Nur Deko – nicht für Lebensmittel',
  en: 'Decoration only – not for food use',
} as const

export const INSERT_LABELS = {
  de: {
    maker: 'Herstellerin',
    safety: 'Warn- und Sicherheitshinweise',
    care: 'Pflegehinweise',
  },
  en: {
    maker: 'Manufacturer',
    safety: 'Warnings and safety information',
    care: 'Care instructions',
  },
} as const

const INK = '#1d1a17'
const MUTED = '#5b5550'
const LINE = '#cfc7bd'

export const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT.text,
    fontSize: 9.5,
    color: INK,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 44,
    lineHeight: 1.35,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  mono: { fontFamily: PDF_FONT.mono, fontSize: 9 },
  label: { fontSize: 8, color: MUTED, textTransform: 'uppercase', marginBottom: 3 },
  muted: { color: MUTED },
  section: { marginBottom: 16 },
  recipient: { fontSize: 11 },
  item: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 6,
  },
  photo: { width: 48, height: 60, objectFit: 'cover', marginRight: 10 },
  nophoto: { width: 48, height: 60, marginRight: 10, backgroundColor: '#efe9e1' },
  itemBody: { flexGrow: 1, flexShrink: 1 },
  itemTitle: { fontWeight: 700 },
  check: { flexDirection: 'row', marginBottom: 3 },
  box: { width: 9, height: 9, borderWidth: 0.8, borderColor: INK, marginRight: 6, marginTop: 1.5 },
  insert: {
    borderWidth: 0.8,
    borderColor: INK,
    borderStyle: 'dashed',
    padding: 10,
    marginBottom: 10,
  },
  insertTitle: { fontWeight: 700, marginBottom: 4 },
  insertHeading: { fontWeight: 700, marginTop: 4 },
  deco: { fontWeight: 700, marginTop: 4 },
  card: {
    borderWidth: 0.8,
    borderColor: LINE,
    height: 150,
    padding: 10,
  },
})

function Lines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </>
  )
}

/** Beileger-Text eines Stücks in einer Sprache. */
export function InsertText({
  insert,
  maker,
  locale,
}: {
  insert: InsertBlock
  maker: MakerInfo
  locale: 'de' | 'en'
}) {
  const l = INSERT_LABELS[locale]
  const title = insert.title[locale] ?? insert.title.de
  const safety = insert.safety[locale] ?? (locale === 'de' ? null : insert.safety.de)
  const care = insert.care[locale] ?? (locale === 'de' ? null : insert.care.de)
  return (
    <View wrap={false}>
      <Text style={s.insertTitle}>
        {locale === 'de' ? insert.nr : insert.nrEn}
        {title ? ` · ${title}` : ''}
      </Text>
      <Text style={s.insertHeading}>{l.maker}</Text>
      <Text>{maker.name}</Text>
      <Lines lines={maker.address} />
      <Text>{maker.email}</Text>
      {safety ? (
        <>
          <Text style={s.insertHeading}>{l.safety}</Text>
          <Text>{safety}</Text>
        </>
      ) : null}
      {insert.decoOnly ? <Text style={s.deco}>{DECO_ONLY_TEXT[locale]}</Text> : null}
      {care ? (
        <>
          <Text style={s.insertHeading}>{l.care}</Text>
          <Text>{care}</Text>
        </>
      ) : null}
    </View>
  )
}

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z')

export function PackingSlip({ data }: { data: PackingSlipData }) {
  return (
    <Document
      title={`Packzettel ${data.orderNumber}`}
      author={data.maker.name}
      creator="planetclairetattoos.com"
      producer="planetclairetattoos.com"
      language="de-DE"
      creationDate={FIXED_DATE}
      modificationDate={FIXED_DATE}
    >
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Packzettel</Text>
            <Text style={s.mono}>{data.orderNumber}</Text>
            <Text style={s.muted}>Bestellt am {data.placedAt}</Text>
            {data.shippingClassLabel ? (
              <Text style={s.muted}>Versandklasse: {data.shippingClassLabel}</Text>
            ) : null}
          </View>
          <View style={{ width: '45%' }}>
            <Text style={s.label}>Empfänger:in</Text>
            <View style={s.recipient}>
              <Lines lines={data.recipient} />
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Positionen</Text>
          {data.items.map((item, i) => (
            <View key={i} style={s.item} wrap={false}>
              {item.photo ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf-Bild, kein HTML
                <Image style={s.photo} src={item.photo} />
              ) : (
                <View style={s.nophoto} />
              )}
              <View style={s.itemBody}>
                <Text style={s.itemTitle}>
                  {item.nr} · {item.title}
                </Text>
                <Text style={s.muted}>Lagerort: {item.storageLocation || '–'}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.label}>Verpackungs-Checkliste</Text>
          {data.checklist.map((text, i) => (
            <View key={i} style={s.check}>
              <View style={s.box} />
              <Text>{text}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.label}>Beileger je Stück (abtrennen und beilegen)</Text>
          {data.inserts.map((insert, i) => (
            <View key={i} style={s.insert} wrap={false}>
              {data.locale === 'en' ? (
                <>
                  <InsertText insert={insert} maker={data.maker} locale="en" />
                  <View style={{ marginTop: 8 }} />
                </>
              ) : null}
              <InsertText insert={insert} maker={data.maker} locale="de" />
            </View>
          ))}
        </View>

        <View wrap={false}>
          <Text style={s.label}>Platz für eine handschriftliche Karte</Text>
          <View style={s.card} />
        </View>
      </Page>
    </Document>
  )
}
