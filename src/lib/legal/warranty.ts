import 'server-only'

import type { LegalTextOrigin, Locale } from '@/lib/enums'

// Harmonisierte Mitteilung zur gesetzlichen Gewährleistung (R-049, RL (EU) 2024/825, DVO (EU) 2025/1960): Grafik je
// Sprache lokal unter `public/legal/` (kein Hotlinking), Text der Mitteilung DE/EN (`shop.warranty.*`, U-45/P13.6) und
// Textlink auf die EU-Infoseite. Die amtliche Grafik und der Amtsblatt-Text waren in der Sandbox nicht ladbar – bis zum
// Abgleich (Kanzleifrage K-19, P11) gelten eine Platzhalter-Grafik mit den Kernaussagen und eine Platzhalter-Fassung des
// Textes; das Go-live-Gate R-210 prüft beides.

export interface WarrantyNoticeAsset {
  /**
   * Pfad der Grafik vom eigenen Origin (`public/…`). Die amtliche Grafik darf SVG oder PNG/WebP sein – beim Einsetzen
   * Datei ablegen, `src`, `width`, `height` (Seitenverhältnis der amtlichen Datei) anpassen und `placeholder: false`.
   * Der Alt-Text kommt aus `shop.warranty.alt` (DE/EN) und beschreibt den Inhalt der Grafik.
   */
  src: string
  width: number
  height: number
  /** `true`, solange die amtliche Grafik fehlt (Gate R-210). */
  placeholder: boolean
}

export const WARRANTY_NOTICE_GRAPHIC: Readonly<Record<Locale, WarrantyNoticeAsset>> = Object.freeze(
  {
    de: { src: '/legal/warranty-notice-de.svg', width: 320, height: 176, placeholder: true },
    en: { src: '/legal/warranty-notice-en.svg', width: 320, height: 176, placeholder: true },
  },
)

/** EU-Infoseite zur gesetzlichen Gewährleistung („Ihr Europa“) – Link, kein Request; Abgleich mit K-19. */
export const WARRANTY_INFO_URL: Readonly<Record<Locale, string>> = Object.freeze({
  de: 'https://europa.eu/youreurope/citizens/consumers/shopping/guarantees-returns/index_de.htm',
  en: 'https://europa.eu/youreurope/citizens/consumers/shopping/guarantees-returns/index_en.htm',
})

/**
 * Herkunft des Mitteilungs-Textes (R-002-Logik wie bei Rechtsbausteinen): `placeholder`, bis die Kanzlei den Wortlaut
 * mit Anhang I der DVO (EU) 2025/1960 abgeglichen hat (K-19); dann `lawyer`. Solange nicht `lawyer`, zeigt die
 * Mitteilung den Hinweis „Platzhalter-Fassung“ und das Gate R-210 bleibt rot.
 */
export const WARRANTY_NOTICE_TEXT_ORIGIN = 'placeholder' as LegalTextOrigin

/**
 * Wortlaut der Mitteilung in Bausteinen (U-59, P14.10): Reihenfolge der Absätze unter `shop.warranty.blocks.<key>` in
 * beiden Sprachdateien. Der erste Baustein mit `lead: true` wird hervorgehoben. Beim Einsetzen des amtlichen Wortlauts
 * (Anhang I DVO (EU) 2025/1960) werden nur diese Liste und die Texte `shop.warranty.blocks.*` DE/EN angepasst – je
 * amtlichem Absatz ein Baustein, wörtlich, ohne eigene Zusätze. Die Komponente `WarrantyNotice` rendert, was hier steht.
 */
export interface WarrantyNoticeBlock {
  key: string
  lead?: boolean
}

export const WARRANTY_NOTICE_BLOCKS: readonly WarrantyNoticeBlock[] = Object.freeze([
  { key: 'lead', lead: true },
  { key: 'rights' },
  { key: 'duration' },
  { key: 'secondHand' },
])

/** Was an der Mitteilung noch Platzhalter ist – für Startklar-Check (R-210 Nr. 11) und Hinweis auf der Seite. */
export type WarrantyNoticePlaceholderPart = 'graphic-de' | 'graphic-en' | 'text'

export const warrantyNoticePlaceholderParts = (): WarrantyNoticePlaceholderPart[] => {
  const parts: WarrantyNoticePlaceholderPart[] = []
  if (WARRANTY_NOTICE_GRAPHIC.de.placeholder) parts.push('graphic-de')
  if (WARRANTY_NOTICE_GRAPHIC.en.placeholder) parts.push('graphic-en')
  if (WARRANTY_NOTICE_TEXT_ORIGIN !== 'lawyer') parts.push('text')
  return parts
}

/** `true`, solange Grafik oder Text der Mitteilung Platzhalter sind (Hinweis auf der Seite, Gate R-210). */
export const warrantyNoticeIsPlaceholder = (): boolean =>
  warrantyNoticePlaceholderParts().length > 0
