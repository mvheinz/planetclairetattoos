import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { Locale } from '@/lib/enums'
import { formatBerlin } from '@/lib/time'

import { formatFlashNumber } from './flash'

// Mail-Knöpfe des Tattoo-Bereichs (KONZEPT §9.4, E-51, R-170): `mailto:` nach RFC 6068 mit Betreff und Text-Vorlage
// je Anlass (Flash, Angebot, allgemein, eigene Idee) in DE/EN. Die Vorlage enthält nie vorbefüllte Personendaten und
// immer den Satz „(Bitte keine Gesundheitsinfos – die klären wir persönlich.)“. Texte aus den Nachrichten
// (`tattoo.mail.*`), damit Jutta sie mit den übrigen Texten übersetzt bekommt. Rein, ohne Datenbank.

const MAIL = { de: de.tattoo.mail, en: en.tattoo.mail } as const

/** Zeilenumbruch in `mailto:`-Texten (RFC 6068 §5: CRLF, kodiert `%0D%0A`). */
const CRLF = '\r\n'

/** `{name}`-Platzhalter ersetzen (einfacher als ICU, die Vorlagen haben keine Mehrzahl). */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (raw, name: string) => vars[name] ?? raw)
}

/**
 * `mailto:`-Link nach RFC 6068: Adresse bleibt lesbar (nur Sonderzeichen kodiert), Betreff und Text mit
 * `encodeURIComponent` (Umlaute UTF-8, `&` → `%26`, `?` → `%3F`, Leerzeichen `%20`); Zeilenumbrüche als `%0D%0A`.
 */
export function buildMailto({
  to,
  subject,
  body,
}: {
  to: string
  subject?: string | null
  body?: string | null
}): string {
  const address = encodeURIComponent(to.trim()).replace(/%40/g, '@')
  const params: string[] = []
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
  if (body) {
    const normalized = body.replace(/\r\n|\r|\n/g, CRLF)
    params.push(`body=${encodeURIComponent(normalized)}`)
  }
  return `mailto:${address}${params.length ? `?${params.join('&')}` : ''}`
}

/** Anlass einer Tattoo-Mail (KONZEPT §9.4). */
export type TattooMailTopic =
  | { kind: 'flash'; number: number; title: string }
  | { kind: 'offer'; title: string; startsAt: Date | string }
  | { kind: 'general' }
  | { kind: 'custom' }

/** Datum im Angebots-Betreff: DE „12.10.2026“, EN „12 Oct 2026“ (Europe/Berlin). */
export function offerDateText(startsAt: Date | string, locale: Locale): string {
  const d = typeof startsAt === 'string' ? new Date(startsAt) : startsAt
  return locale === 'en' ? formatBerlin(d, 'd MMM yyyy', 'en') : formatBerlin(d, 'dd.MM.yyyy')
}

/** Betreff je Anlass, z. B. `Flash-Anfrage F-012 – Kelch mit Schlange` (AK-9-02). */
export function tattooMailSubject(topic: TattooMailTopic, locale: Locale): string {
  const m = MAIL[locale]
  switch (topic.kind) {
    case 'flash':
      return fill(m.subjectFlash, {
        number: formatFlashNumber(topic.number),
        title: topic.title.trim(),
      })
    case 'offer':
      return fill(m.subjectOffer, {
        title: topic.title.trim(),
        date: offerDateText(topic.startsAt, locale),
      })
    case 'custom':
      return m.subjectCustom
    default:
      return m.subjectGeneral
  }
}

/** Text-Vorlage je Anlass (ohne Personendaten, mit Gesundheits-Hinweis). Zeilen mit `\n` getrennt. */
export function tattooMailBody(topic: TattooMailTopic, locale: Locale): string {
  const m = MAIL[locale]
  let intro: string
  switch (topic.kind) {
    case 'flash':
      intro = fill(m.introFlash, {
        number: formatFlashNumber(topic.number),
        title: topic.title.trim(),
      })
      break
    case 'offer':
      intro = fill(m.introOffer, {
        title: topic.title.trim(),
        date: offerDateText(topic.startsAt, locale),
      })
      break
    case 'custom':
      intro = m.introCustom
      break
    default:
      intro = m.introGeneral
  }
  const fields = [
    ...(topic.kind === 'custom' || topic.kind === 'general' ? [m.fieldIdea] : []),
    m.fieldPlacement,
    m.fieldSize,
    m.fieldTime,
  ]
  return [m.greeting, '', intro, '', ...fields, '', m.health, '', m.closing].join('\n')
}

/** Fertiger Mail-Link eines Anlasses; ohne Adresse `null` (Knopf entfällt, die DM bleibt). */
export function tattooMailto(
  to: string | null | undefined,
  topic: TattooMailTopic,
  locale: Locale,
): string | null {
  if (!to) return null
  return buildMailto({
    to,
    subject: tattooMailSubject(topic, locale),
    body: tattooMailBody(topic, locale),
  })
}

/** Kopierbarer DM-Baustein „F-012 – Kelch mit Schlange“ (KONZEPT §9.4). */
export function flashDmSnippet(number: number, title: string): string {
  return `${formatFlashNumber(number)} – ${title.trim()}`
}
