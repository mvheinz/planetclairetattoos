import 'server-only'

import { Document, Page, Text, View } from '@react-pdf/renderer'
import type { PayloadRequest } from 'payload'
import React from 'react'

import { loadSettings } from '@/lib/commerce/packOrder'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { ProductCategory } from '@/lib/enums'

import { makerFromSettings } from './packingDocs'
import { s, type MakerInfo } from './PackingSlip'
import { renderPdf } from './render'

// Vorlage „Technische Unterlagen je Kategorie“ (PLAN P5.13, RECHT R-203, `GET /api/admin/compliance/template.pdf`):
// Gliederung zum Ausfüllen (Risikoanalyse, Materialien, Nachweise, Kennzeichnung, Rückverfolgbarkeit) mit Stichworten
// je Kategorie. Ausdrücklich keine Rechtsberatung – die Inhalte stimmt Jutta bei Bedarf mit der Kanzlei (K-16) ab.

export const COMPLIANCE_TEMPLATE_DISCLAIMER =
  'Gliederungshilfe zum Ausfüllen – keine Rechtsberatung. Was im Einzelfall nötig ist, klärst du bei Bedarf mit der Kanzlei.'

/** Stichworte je Kategorie (nur Denkanstöße, keine abschließende Liste). */
export const CATEGORY_HINTS: Readonly<Record<ProductCategory, readonly string[]>> = {
  keramik: [
    'Lebensmittelkontakt: Deko oder lebensmittelecht? Bei Lebensmittelkontakt Glasur, Laborbericht (Blei/Cadmium) und Konformitätserklärung.',
    'Deko-Stücke am Boden dauerhaft mit „Nur Deko – nicht für Lebensmittel“ kennzeichnen.',
    'Bruch und scharfe Kanten, Spülmaschine/Mikrowelle, Temperaturwechsel.',
  ],
  textil: [
    'Faserzusammensetzung laut Etikett bzw. nach bestem Wissen (Textilkennzeichnung).',
    'Farben und Fixierung: Sicherheitsdatenblätter und Lieferantenerklärungen der Textilfarben.',
    'Second-Hand: Zustand, fehlende Etiketten, Kordeln oder Kleinteile bei Kinderkleidung.',
  ],
  cap: [
    'Faserzusammensetzung und Farben wie bei Textil.',
    'Verschlüsse, Metallteile (Nickel), Kleinteile.',
  ],
  zeichnung: [
    'Papier, Farben, Rahmen; Rahmen mit Glas: Bruchgefahr und Aufhängung.',
    'Verpackung gegen Knicken und Glasbruch.',
  ],
  schmuck: [
    'Metallteile: Material, Nickelfreiheit (Lieferantennachweis), Blei/Cadmium.',
    'Verschluckbare Kleinteile: Warnhinweis „Nicht für Kinder unter 3 Jahren“.',
    'Glasur und Bemalung bei Porzellan-Anhängern.',
  ],
  sonstiges: [
    'Materialien, bestimmungsgemäße Verwendung und vorhersehbare Fehlanwendung beschreiben.',
    'Prüfen, ob besondere Vorschriften für die Produktart gelten.',
  ],
}

export const TEMPLATE_SECTIONS: readonly { title: string; points: readonly string[] }[] = [
  {
    title: '1. Produktgruppe',
    points: [
      'Welche Stücke gehören dazu (Art, typische Größen, Objektnummern)?',
      'Bestimmungsgemäße Verwendung und Zielgruppe (auch Kinder?).',
    ],
  },
  {
    title: '2. Materialien und Lieferanten',
    points: [
      'Rohlinge, Farben, Glasuren, Metallteile mit Lieferant und Bezugsdatum.',
      'Lieferantenerklärungen und Sicherheitsdatenblätter (Ablage „Lieferantenerklärung“).',
    ],
  },
  {
    title: '3. Risikoanalyse',
    points: [
      'Mögliche Gefahren (mechanisch, chemisch, Brand, Kleinteile …).',
      'Vorhersehbare Fehlanwendung.',
      'Maßnahmen (Material, Herstellung, Warnhinweise) und verbleibendes Risiko.',
    ],
  },
  {
    title: '4. Prüfungen und Nachweise',
    points: [
      'Prüfberichte, Nickel-Nachweise, Konformitätserklärungen (mit Datum und Version).',
      'Eigene Kontrollen (z. B. Schütteltest, Sichtprüfung).',
    ],
  },
  {
    title: '5. Kennzeichnung und Beileger',
    points: [
      'Objektnummer, Name, Postanschrift und E-Mail am Stück oder am Beileger (Etikett-PDF je Stück).',
      'Warn-, Sicherheits- und Pflegehinweise in Deutsch (und Englisch).',
    ],
  },
  {
    title: '6. Rückverfolgbarkeit und Vorfälle',
    points: [
      'Verkaufte Stücke sind über die Bestellungen nachvollziehbar (Objektnummer).',
      'Bei schweren Unfällen: Meldung über das Safety Business Gateway der EU.',
    ],
  },
  {
    title: '7. Änderungen',
    points: ['Datum, Version, was sich geändert hat (neue Glasur, neuer Lieferant …).'],
  },
]

export interface ComplianceTemplateData {
  category: ProductCategory
  maker: MakerInfo
}

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z')

export function ComplianceTemplate({ data }: { data: ComplianceTemplateData }) {
  const label = ENUM_LABELS.PRODUCT_CATEGORIES[data.category].de
  return (
    <Document
      title={`Technische Unterlagen – ${label}`}
      author={data.maker.name}
      creator="planetclairetattoos.com"
      producer="planetclairetattoos.com"
      language="de-DE"
      creationDate={FIXED_DATE}
      modificationDate={FIXED_DATE}
    >
      <Page size="A4" style={s.page}>
        <View style={s.section}>
          <Text style={s.title}>Technische Unterlagen – {label}</Text>
          <Text style={s.muted}>{COMPLIANCE_TEMPLATE_DISCLAIMER}</Text>
        </View>
        <View style={s.section}>
          <Text style={s.label}>Herstellerin</Text>
          <Text>{data.maker.name}</Text>
          {data.maker.address.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
          <Text>{data.maker.email}</Text>
          <Text style={{ marginTop: 6 }}>Stand / Version: ______________________</Text>
        </View>
        <View style={s.section}>
          <Text style={s.label}>Stichworte für {label}</Text>
          {CATEGORY_HINTS[data.category].map((hint, i) => (
            <Text key={i}>• {hint}</Text>
          ))}
        </View>
        {TEMPLATE_SECTIONS.map((section) => (
          <View key={section.title} style={s.section} wrap={false}>
            <Text style={s.insertTitle}>{section.title}</Text>
            {section.points.map((p, i) => (
              <Text key={i} style={s.muted}>
                – {p}
              </Text>
            ))}
            <View style={{ ...s.card, height: 70, marginTop: 4 }} />
          </View>
        ))}
      </Page>
    </Document>
  )
}

export async function renderComplianceTemplate(
  req: PayloadRequest,
  category: ProductCategory,
): Promise<Buffer> {
  const settings = await loadSettings(req)
  const pdf = await renderPdf(
    React.createElement(ComplianceTemplate, {
      data: { category, maker: makerFromSettings(settings) },
    }) as never,
  )
  return pdf.data
}
