import 'server-only'

import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { Locale } from '@/lib/enums'
import type { LexicalContent } from '@/lib/legal/render'

import { PDF_FONT } from './fonts'

// Rechtstext-PDF (DATENMODELL §6.12, P4.12): eine oder mehrere Fassungen mit bereits ersetzten Tokens (Renderer
// `src/lib/legal/render.ts`) – die Werte sind im PDF eingefroren. Fassungen mit `origin ≠ lawyer` tragen oben das Band
// „PLATZHALTER – nicht rechtsverbindlich“ (R-002). Das Bündel „Widerrufsbelehrung und Formular“ besteht aus zwei
// Abschnitten. Erzeugungsdatum = fester Zeitpunkt (Aktivierung) → gleiche Eingaben, gleiche Datei.

export interface LegalPdfSection {
  title: string
  versionLabel: string
  content: LexicalContent
  placeholder: boolean
}

export interface LegalTextDocumentProps {
  title: string
  locale: Locale
  sections: readonly LegalPdfSection[]
  /** Fester Zeitpunkt für Erzeugungs-/Änderungsdatum des PDFs. */
  fixedDate: Date
  author: string
}

const MESSAGES = { de, en } as const

export function placeholderBannerText(locale: Locale): string {
  return MESSAGES[locale].legal.placeholderBanner
}

const INK = '#1d1a17'
const MUTED = '#5b5550'

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT.text,
    fontSize: 10,
    color: INK,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    lineHeight: 1.4,
  },
  banner: {
    borderWidth: 1.5,
    borderColor: '#c0392b',
    color: '#c0392b',
    padding: 6,
    marginBottom: 16,
    fontWeight: 700,
    textAlign: 'center',
  },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  version: { color: MUTED, marginBottom: 16 },
  h2: { fontSize: 13, fontWeight: 700, marginTop: 12, marginBottom: 4 },
  h3: { fontSize: 11.5, fontWeight: 700, marginTop: 10, marginBottom: 3 },
  h4: { fontSize: 10.5, fontWeight: 700, marginTop: 8, marginBottom: 2 },
  p: { marginBottom: 6 },
  quote: { marginBottom: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: MUTED },
  li: { flexDirection: 'row', marginBottom: 3 },
  bullet: { width: 16 },
  liBody: { flex: 1 },
  bold: { fontWeight: 700 },
  link: { color: INK, textDecoration: 'underline' },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'center',
  },
  section: { marginBottom: 12 },
})

type Node = {
  type?: string
  text?: string
  format?: number | string
  tag?: string
  listType?: string
  url?: string
  fields?: { url?: string }
  children?: Node[]
}

const IS_BOLD = 1

function inline(nodes: readonly Node[] | undefined, key: string): ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    const k = `${key}.${i}`
    if (n.type === 'text') {
      const bold = typeof n.format === 'number' && (n.format & IS_BOLD) !== 0
      return bold ? (
        <Text key={k} style={s.bold}>
          {n.text}
        </Text>
      ) : (
        n.text
      )
    }
    if (n.type === 'linebreak') return '\n'
    if (n.type === 'link' || n.type === 'autolink') {
      const url = n.fields?.url ?? n.url
      const children = inline(n.children, k)
      return url ? (
        <Link key={k} src={url} style={s.link}>
          {children}
        </Link>
      ) : (
        <Text key={k}>{children}</Text>
      )
    }
    return <Text key={k}>{inline(n.children, k)}</Text>
  })
}

function blocks(nodes: readonly Node[] | undefined, key: string): ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    const k = `${key}.${i}`
    switch (n.type) {
      case 'heading': {
        const style = n.tag === 'h2' || n.tag === 'h1' ? s.h2 : n.tag === 'h3' ? s.h3 : s.h4
        return (
          <Text key={k} style={style} minPresenceAhead={24}>
            {inline(n.children, k)}
          </Text>
        )
      }
      case 'list':
        return (
          <View key={k} style={s.p}>
            {(n.children ?? []).map((li, j) => (
              <View key={`${k}.${j}`} style={s.li} wrap={false}>
                <Text style={s.bullet}>{n.listType === 'number' ? `${j + 1}.` : '•'}</Text>
                <Text style={s.liBody}>{inline(li.children, `${k}.${j}`)}</Text>
              </View>
            ))}
          </View>
        )
      case 'quote':
        return (
          <Text key={k} style={s.quote}>
            {inline(n.children, k)}
          </Text>
        )
      default:
        return (
          <Text key={k} style={s.p}>
            {inline(n.children, k)}
          </Text>
        )
    }
  })
}

export function LegalTextDocument(props: LegalTextDocumentProps) {
  const banner = placeholderBannerText(props.locale)
  return (
    <Document
      title={props.title}
      author={props.author}
      creator="planetclairetattoos.com"
      producer="planetclairetattoos.com"
      language={props.locale === 'de' ? 'de-DE' : 'en-GB'}
      creationDate={props.fixedDate}
      modificationDate={props.fixedDate}
    >
      <Page size="A4" style={s.page}>
        {props.sections.map((section, i) => (
          <View key={i} style={s.section} break={i > 0}>
            {section.placeholder ? <Text style={s.banner}>{banner}</Text> : null}
            <Text style={s.title}>{section.title}</Text>
            <Text style={s.version}>{section.versionLabel}</Text>
            {blocks(section.content.root.children as Node[], `s${i}`)}
          </View>
        ))}
        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${props.title} · ${pageNumber}/${totalPages}`}
        />
      </Page>
    </Document>
  )
}
