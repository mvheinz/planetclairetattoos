import 'server-only'

import type { Locale } from '@/lib/enums'

// Harmonisierte Mitteilung zur gesetzlichen Gewährleistung (R-049, RL (EU) 2024/825, DVO (EU) 2025/1960): Grafik je
// Sprache lokal unter `public/legal/` (kein Hotlinking) und Textlink auf die EU-Infoseite. Die amtliche Grafik war in
// der Sandbox nicht ladbar – bis zum Abgleich (Kanzleifrage K-19, P11) gilt eine Platzhalter-Grafik; das Go-live-Gate
// R-210 prüft `placeholder`.

export interface WarrantyNoticeAsset {
  /** Pfad der Grafik vom eigenen Origin. */
  src: string
  width: number
  height: number
  /** `true`, solange die amtliche Grafik fehlt (Gate R-210). */
  placeholder: boolean
}

export const WARRANTY_NOTICE_GRAPHIC: Readonly<Record<Locale, WarrantyNoticeAsset>> = Object.freeze(
  {
    de: { src: '/legal/warranty-notice-de.svg', width: 320, height: 120, placeholder: true },
    en: { src: '/legal/warranty-notice-en.svg', width: 320, height: 120, placeholder: true },
  },
)

/** EU-Infoseite zur gesetzlichen Gewährleistung („Ihr Europa“) – Link, kein Request; Abgleich mit K-19. */
export const WARRANTY_INFO_URL: Readonly<Record<Locale, string>> = Object.freeze({
  de: 'https://europa.eu/youreurope/citizens/consumers/shopping/guarantees-returns/index_de.htm',
  en: 'https://europa.eu/youreurope/citizens/consumers/shopping/guarantees-returns/index_en.htm',
})
