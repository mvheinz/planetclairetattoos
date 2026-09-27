import {
  BoldFeature,
  HeadingFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

// Eingeschränkte Rich-Text-Editoren (DATENMODELL §6.12, §6.18): nur die erlaubten Elemente, externe Links ohne
// interne Dokument-Verweise (KANZLEI-BRIEFING §1.2).

const links = () => LinkFeature({ enabledCollections: [], disableAutoLinks: 'creationOnly' })

/** Rechtstexte: Absätze, Überschriften H2–H4, Listen, fett, Links. */
export function legalRichTextEditor() {
  return lexicalEditor({
    features: () => [
      ParagraphFeature(),
      HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
      UnorderedListFeature(),
      OrderedListFeature(),
      BoldFeature(),
      links(),
    ],
  })
}

/** Einfache Texte (FAQ-Antworten): Absätze, fett, Listen, Links. */
export function basicRichTextEditor() {
  return lexicalEditor({
    features: () => [
      ParagraphFeature(),
      UnorderedListFeature(),
      OrderedListFeature(),
      BoldFeature(),
      links(),
    ],
  })
}
