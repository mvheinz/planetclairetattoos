import type { ShippingClass } from '@/lib/enums'
import { formatTagPrice } from '@/lib/shop/priceTag'

import { formatItemNumber } from './itemNumber'

// Text für Instagram nach dem Online-Stellen (V-39, U-93): Name, Nummer, Preis „42 € zzgl. Versand“ (Endpreis, R-030 –
// ohne Steuerzusatz, solange die Kleinunternehmerregelung gilt, V-02), ein kurzer Satz und der Kurzlink aufs Stück. Zweisprachig
// (U-00): erst Deutsch, dann Englisch. Keine Zitate von Schriftzügen am Stück (U-77) – Anführungszeichen aus dem Titel
// fallen weg –, kein Aufruf zu Direktnachrichten (U-15/U-42: gekauft wird im Shop), keine Hashtag-Listen. Rein, auch im
// Browser nutzbar (der Knopf „Für Instagram“ kopiert den Text, bevor das Teilen-Menü aufgeht).

export interface InstagramPostInput {
  title: { de: string; en?: string | null }
  itemNumber: number
  priceCents: number
  shippingClass?: ShippingClass | '' | null
  /** Kurzlink aufs Stück, z. B. `https://planetclairetattoos.com/nr/17`. */
  shortUrl: string
}

/** Anführungszeichen (auch typografische) und doppelte Leerzeichen aus einem Titel entfernen (U-77). */
export function plainTitle(title: string): string {
  return title
    .replace(/["“”„‟«»‹›‚‘’']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Fertiger Text (DE, Leerzeile, EN, Leerzeile, Kurzlink). */
export function instagramPostText(input: InstagramPostInput): string {
  const de = plainTitle(input.title.de)
  const en = plainTitle(input.title.en?.trim() || input.title.de)
  const pickupOnly = input.shippingClass === 'nur_abholung'
  const priceDe = `${formatTagPrice(input.priceCents, 'de')} ${pickupOnly ? '· nur Abholung in Berlin' : 'zzgl. Versand'}`
  const priceEn = `${formatTagPrice(input.priceCents, 'en')} ${pickupOnly ? '· pickup in Berlin only' : 'plus shipping'}`
  return [
    de,
    `${formatItemNumber(input.itemNumber, 'de')} · ${priceDe}`,
    'Ein Unikat – gibt es genau einmal. Jetzt im Shop.',
    '',
    en,
    `${formatItemNumber(input.itemNumber, 'en')} · ${priceEn}`,
    'One of a kind – there is only one. In the shop now.',
    '',
    input.shortUrl,
  ]
    .join('\n')
    .replace(/[  ]/g, ' ')
}

/** Dateiname des geteilten Fotos bzw. Story-Bilds (`planet-claire-nr-017.jpg`). */
export const instagramFileName = (itemNumber: number, kind: 'photo' | 'story', ext: string) =>
  `planet-claire-nr-${String(itemNumber).padStart(3, '0')}${kind === 'story' ? '-story' : ''}.${ext}`
