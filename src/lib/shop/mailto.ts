import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { Locale } from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { buildMailto } from '@/lib/tattoo/mailto'

// „Frag nach diesem Stück“ (U-57 a): `mailto:` an die Kontaktadresse aus den Einstellungen mit Betreff
// „Frage zu Nr. 017 – {Titel}“ (EN „Question about No. 017 – {title}“) und kurzer Vorlage ohne Personendaten
// (RFC 6068 wie die Tattoo-Knöpfe). Kein Anfrage-Formular, keine Speicherung. Texte aus den Nachrichten
// (`shop.mail.*`). Rein, ohne Datenbank.

const MAIL = { de: de.shop.mail, en: en.shop.mail } as const

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (raw, name: string) => vars[name] ?? raw)

export interface ProductMailTopic {
  itemNumber: number
  title: string | null | undefined
  /** Absolute URL der Produktseite (für Jutta beim Antworten); optional. */
  url?: string | null
}

/** Betreff „Frage zu Nr. 017 – Tasse mit Kater“; ohne Titel nur die Nummer. */
export function productMailSubject(topic: ProductMailTopic, locale: Locale): string {
  const number = formatItemNumber(topic.itemNumber, locale)
  const title = topic.title?.trim()
  return title ? fill(MAIL[locale].subject, { number, title }) : number
}

/** Vorlage: Gruß, Frage-Zeile mit Nummer und Titel, Platz für die Frage, Link, Abschied. */
export function productMailBody(topic: ProductMailTopic, locale: Locale): string {
  const m = MAIL[locale]
  const number = formatItemNumber(topic.itemNumber, locale)
  const title = topic.title?.trim() || number
  const lines = [m.greeting, '', fill(m.intro, { number, title }), '', '', '']
  if (topic.url) lines.push(fill(m.link, { url: topic.url }), '')
  lines.push(m.closing)
  return lines.join('\n')
}

/** Fertiger Mail-Link; ohne Adresse `null` (Link entfällt). */
export function productMailto(
  to: string | null | undefined,
  topic: ProductMailTopic,
  locale: Locale,
): string | null {
  if (!to) return null
  return buildMailto({
    to,
    subject: productMailSubject(topic, locale),
    body: productMailBody(topic, locale),
  })
}
