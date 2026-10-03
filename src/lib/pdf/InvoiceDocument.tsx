import 'server-only'

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import { ENUM_LABELS } from '@/lib/enumLabels'
import type { InvoiceType } from '@/lib/enums'
import type { InvoiceDataV1 } from '@/lib/invoices/schema'
import { formatMoney } from '@/lib/money'
import { formatBerlin } from '@/lib/time'

import { PDF_FONT } from './fonts'

// Beleg-PDF (R-120, DATENMODELL §6.9): Rechnung bzw. Gutschrift aus den eingefrorenen Belegdaten `InvoiceDataV1`.
// Deutsch (verbindliche Fassung). Im Kleinunternehmer-Modus nur der §-19-Satz, keine Steuerbeträge (RECHT V-02);
// bei Regelbesteuerung Netto, Satz und Steuer je Satz (§ 14 Abs. 4 UStG). Beispielbelege (`seed = true`) tragen auf
// jeder Seite das Wasserzeichen „BEISPIELBELEG – kein echter Beleg“ (R-121, SEED-SPEC §9).

export const INVOICE_WATERMARK = 'BEISPIELBELEG – kein echter Beleg'
/** Anzeige, solange `settings.business.taxNumber` fehlt (Grund-Seed; echte Belege erst nach P11, §13.7). */
export const TAX_NUMBER_MISSING = '[Steuernummer fehlt – vor dem Start eintragen]'

export const INVOICE_TITLE: Readonly<Record<InvoiceType, string>> = {
  invoice: 'Rechnung',
  credit_note: 'Gutschrift',
}

export interface InvoiceDocumentProps {
  number: string
  type: InvoiceType
  /** Ausstellungsdatum (ISO). */
  issueDate: string
  seed: boolean
  data: InvoiceDataV1
}

const INK = '#1d1a17'
const MUTED = '#5b5550'
const LINE = '#cfc7bd'

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT.text,
    fontSize: 9.5,
    color: INK,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 52,
    lineHeight: 1.35,
  },
  watermark: {
    position: 'absolute',
    top: 380,
    left: -40,
    width: 680,
    textAlign: 'center',
    fontSize: 34,
    fontWeight: 700,
    color: '#c0392b',
    opacity: 0.18,
    transform: 'rotate(-35deg)',
  },
  banner: {
    borderWidth: 1,
    borderColor: '#c0392b',
    color: '#c0392b',
    padding: 6,
    marginBottom: 14,
    fontWeight: 700,
    textAlign: 'center',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  seller: { width: '55%' },
  sellerName: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  muted: { color: MUTED },
  meta: { width: '40%' },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mono: { fontFamily: PDF_FONT.mono, fontSize: 9 },
  buyer: { marginBottom: 24 },
  label: { fontSize: 8, color: MUTED, textTransform: 'uppercase', marginBottom: 3 },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 4,
    fontWeight: 700,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 5,
  },
  cPos: { width: '7%' },
  cDesc: { width: '55%', paddingRight: 8 },
  cQty: { width: '8%', textAlign: 'right' },
  cUnit: { width: '15%', textAlign: 'right' },
  cTotal: { width: '15%', textAlign: 'right' },
  totals: { marginTop: 10, marginLeft: '50%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingTop: 4,
    marginTop: 2,
    fontSize: 11,
    fontWeight: 700,
  },
  notes: { marginTop: 24 },
  note: { marginBottom: 4 },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 52,
    right: 52,
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'center',
  },
})

const money = (cents: number) => formatMoney(cents, 'de')
const day = (iso: string) => formatBerlin(new Date(iso), 'dd.MM.yyyy')

/** „2026-10“ → „Oktober 2026“ (Leistungszeitpunkt als Monat, R-120). */
export function formatDeliveryMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return formatBerlin(new Date(Date.UTC(y!, m! - 1, 15, 12)), 'MMMM yyyy')
}

function paymentNote(props: InvoiceDocumentProps): string {
  const method = ENUM_LABELS.PAYMENT_METHODS[props.data.paymentMethod].de
  if (props.type === 'credit_note') {
    return `Der Betrag wurde am ${day(props.data.paidAt)} erstattet (Zahlart der Bestellung: ${method}).`
  }
  return `Bezahlt am ${day(props.data.paidAt)} per ${method}.`
}

export function InvoiceDocument(props: InvoiceDocumentProps) {
  const { data, number, type, seed } = props
  const seller = data.seller
  const buyer = data.buyer
  const title = INVOICE_TITLE[type]
  const ids: [string, string][] = [['Steuernummer', seller.taxNumber || TAX_NUMBER_MISSING]]
  if (seller.vatId) ids.push(['USt-IdNr.', seller.vatId])
  if (seller.economicId) ids.push(['W-IdNr.', seller.economicId])
  const fixed = new Date(props.issueDate)
  return (
    <Document
      title={`${title} ${number}`}
      author={seller.legalName}
      creator="planetclairetattoos.com"
      producer="planetclairetattoos.com"
      language="de-DE"
      creationDate={fixed}
      modificationDate={fixed}
    >
      <Page size="A4" style={s.page}>
        {seed ? (
          <Text style={s.watermark} fixed>
            {INVOICE_WATERMARK}
          </Text>
        ) : null}
        {seed ? <Text style={s.banner}>{INVOICE_WATERMARK}</Text> : null}
        <View style={s.header}>
          <View style={s.seller}>
            <Text style={s.sellerName}>{seller.legalName}</Text>
            {seller.tradeName ? <Text>{seller.tradeName}</Text> : null}
            <Text>{seller.street}</Text>
            <Text>
              {seller.postalCode} {seller.city}
            </Text>
            <Text>{seller.email}</Text>
            {ids.map(([k, v]) => (
              <Text key={k} style={s.muted}>
                {k}: {v}
              </Text>
            ))}
          </View>
          <View style={s.meta}>
            <Text style={s.title}>{title}</Text>
            <View style={s.metaRow}>
              <Text>{type === 'invoice' ? 'Rechnungsnummer' : 'Gutschriftnummer'}</Text>
              <Text style={s.mono}>{number}</Text>
            </View>
            <View style={s.metaRow}>
              <Text>Datum</Text>
              <Text>{day(props.issueDate)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text>Bestellnummer</Text>
              <Text style={s.mono}>{data.orderNumber}</Text>
            </View>
            <View style={s.metaRow}>
              <Text>Leistungszeitpunkt</Text>
              <Text>{formatDeliveryMonth(data.deliveryMonth)}</Text>
            </View>
            {data.relatedInvoiceNumber ? (
              <View style={s.metaRow}>
                <Text>{type === 'invoice' ? 'ersetzt Rechnung' : 'zu Rechnung'}</Text>
                <Text style={s.mono}>{data.relatedInvoiceNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.buyer}>
          <Text style={s.label}>{type === 'invoice' ? 'Rechnung an' : 'Gutschrift an'}</Text>
          <Text>{buyer.name}</Text>
          <Text>{buyer.addressLine1}</Text>
          {buyer.addressLine2 ? <Text>{buyer.addressLine2}</Text> : null}
          <Text>
            {buyer.postalCode} {buyer.city}
            {buyer.country !== 'DE' ? ` · ${buyer.country}` : ''}
          </Text>
        </View>

        <View style={s.tableHead}>
          <Text style={s.cPos}>Pos.</Text>
          <Text style={s.cDesc}>Bezeichnung</Text>
          <Text style={s.cQty}>Menge</Text>
          <Text style={s.cUnit}>Einzelpreis</Text>
          <Text style={s.cTotal}>Gesamt</Text>
        </View>
        {data.lines.map((l) => (
          <View key={l.pos} style={s.row} wrap={false}>
            <Text style={s.cPos}>{l.pos}</Text>
            <Text style={s.cDesc}>{l.description}</Text>
            <Text style={s.cQty}>{l.quantity}</Text>
            <Text style={s.cUnit}>{money(l.unitPriceCents)}</Text>
            <Text style={s.cTotal}>{money(l.totalCents)}</Text>
          </View>
        ))}
        {data.shipping ? (
          <View style={s.row} wrap={false}>
            <Text style={s.cPos}>{data.lines.length + 1}</Text>
            <Text style={s.cDesc}>{data.shipping.description}</Text>
            <Text style={s.cQty}>1</Text>
            <Text style={s.cUnit}>{money(data.shipping.totalCents)}</Text>
            <Text style={s.cTotal}>{money(data.shipping.totalCents)}</Text>
          </View>
        ) : null}

        <View style={s.totals} wrap={false}>
          {data.taxLines.map((t) => (
            <View key={t.rate}>
              <View style={s.totalRow}>
                <Text>Nettobetrag {t.rate} %</Text>
                <Text>{money(t.netCents)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text>Umsatzsteuer {t.rate} %</Text>
                <Text>{money(t.taxCents)}</Text>
              </View>
            </View>
          ))}
          <View style={s.grand}>
            <Text>{type === 'invoice' ? 'Gesamtbetrag' : 'Gutschriftbetrag'}</Text>
            <Text>{money(data.totalGrossCents)}</Text>
          </View>
        </View>

        <View style={s.notes}>
          {data.legalNote ? <Text style={s.note}>{data.legalNote}</Text> : null}
          <Text style={s.note}>{paymentNote(props)}</Text>
        </View>

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${seller.legalName} · ${seller.street} · ${seller.postalCode} ${seller.city} · ${seller.email} · ${title} ${number} · Seite ${pageNumber}/${totalPages}`
          }
        />
      </Page>
    </Document>
  )
}
