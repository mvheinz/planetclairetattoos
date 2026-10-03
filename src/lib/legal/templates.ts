import 'server-only'

import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale } from '@/lib/enums'
import { formatMoney } from '@/lib/money'
import { addBerlinDays, formatBerlin } from '@/lib/time'

// Vorlagen zum Öffnen im Mailprogramm (PLAN P5.27, KONZEPT §7.13, R-084): Antworten, die Jutta selbst aus ihrem
// Mailprogramm schickt – ohne Rechtspflicht, nicht über die Outbox, nicht protokolliert. Alle Texte sind
// **Arbeitsfassungen** in Juttas Ton (E-62); sie passt sie selbst an. „Reparatur/Ersatz“ und „§ 37 VSBG“ sind seit
// P6.11 die protokollierten Mails M12 `complaint_repair_choice` und M13 `dispute_vsbg` (Reklamationsakte).
// Keine Werbung (V-09), kein OS-Hinweis (V-01), keine Rügefrist gegenüber Kund:innen (V-11) – die 7-Tage-Frist bei
// Transportschäden ist nur Juttas eigene Erinnerung für die Reklamation beim Versanddienst.

/** Kennzeichnung aller Vorlagen in der Verwaltung. */
export const ADMIN_TEMPLATE_STATUS = 'Arbeitsfassung'

/** Tage nach dem Versanddatum, bis zu denen Jutta einen Transportschaden beim Versanddienst meldet. */
export const CARRIER_CLAIM_DAYS = 7

export const ADMIN_TEMPLATE_KEYS = ['breakage_photos', 'prepayment_refund_iban'] as const
export type AdminTemplateKey = (typeof ADMIN_TEMPLATE_KEYS)[number]

type L10n = Readonly<Record<Locale, string>>

interface AdminTemplateDef {
  key: AdminTemplateKey
  /** Titel in der Verwaltung (Deutsch). */
  title: string
  /** Wofür (Verwaltung, Deutsch). */
  purpose: string
  /** Welche Bestellung passt (Verwaltung). */
  fits: string
  subject: L10n
  body: L10n
  /** Nur für Jutta (nicht in der Mail), Deutsch. */
  ownerNote?: string
}

const DEFS: readonly AdminTemplateDef[] = [
  {
    key: 'breakage_photos',
    title: 'Reklamation Bruch: Fotos anfordern',
    purpose: 'Ein Stück ist kaputt angekommen – Fotos für die Schadensmeldung erbitten.',
    fits: 'versendete Bestellung',
    subject: {
      de: 'Deine Bestellung {{orderNumber}} – kaputt angekommen',
      en: 'Your order {{orderNumber}} – arrived damaged',
    },
    body: {
      de: [
        '{{greeting}}',
        '',
        'es tut mir wirklich leid, dass deine Bestellung {{orderNumber}} beschädigt bei dir angekommen ist.',
        '',
        'Magst du mir ein paar Fotos schicken? Am besten vom beschädigten Stück, von der Verpackung (innen und außen) und vom Versandetikett. Damit kann ich den Schaden beim Versanddienst melden. Heb die Verpackung bitte auf, bis alles geklärt ist.',
        '',
        'Deine gesetzlichen Rechte bleiben davon unberührt. Sobald ich die Fotos habe, melde ich mich und wir finden eine Lösung.',
        '',
        '{{signature}}',
      ].join('\n'),
      en: [
        '{{greeting}}',
        '',
        'I am really sorry that your order {{orderNumber}} arrived damaged.',
        '',
        'Could you send me a few photos? Ideally of the damaged piece, the packaging (inside and outside) and the shipping label. This lets me report the damage to the carrier. Please keep the packaging until everything is sorted out.',
        '',
        'Your statutory rights remain unaffected. As soon as I have the photos, I will get back to you and we will find a solution.',
        '',
        '{{signature}}',
      ].join('\n'),
    },
    ownerNote:
      'Für dich: bis {{claimDeadline}} bei {{carrier}} reklamieren (Versanddatum {{shippedDate}} + 7 Tage).',
  },
  {
    key: 'prepayment_refund_iban',
    title: 'Bitte um Bankverbindung (Vorkasse-Erstattung)',
    purpose: 'Geld einer stornierten Vorkasse-Bestellung zurücküberweisen.',
    fits: 'stornierte Vorkasse-Bestellung',
    subject: {
      de: 'Deine Bestellung {{orderNumber}} – Rückzahlung',
      en: 'Your order {{orderNumber}} – refund',
    },
    body: {
      de: [
        '{{greeting}}',
        '',
        'deine Bestellung {{orderNumber}} ist storniert. Deine Überweisung über {{amount}} möchte ich dir zurückzahlen.',
        '',
        'Schick mir dafür bitte als Antwort auf diese Mail deine Bankverbindung (Kontoinhaber:in und IBAN). Ich überweise dir den Betrag dann so schnell wie möglich.',
        '',
        '{{signature}}',
      ].join('\n'),
      en: [
        '{{greeting}}',
        '',
        'your order {{orderNumber}} has been cancelled. I would like to pay back your transfer of {{amount}}.',
        '',
        'Please reply to this email with your bank details (account holder and IBAN). I will then transfer the amount back to you as soon as possible.',
        '',
        '{{signature}}',
      ].join('\n'),
    },
    ownerNote:
      'Für dich: die Bankverbindung nur für die Überweisung nutzen und nicht in der Verwaltung speichern.',
  },
]

export const ADMIN_TEMPLATES: Readonly<Record<AdminTemplateKey, AdminTemplateDef>> = Object.freeze(
  Object.fromEntries(DEFS.map((d) => [d.key, d])) as Record<AdminTemplateKey, AdminTemplateDef>,
)

/** Daten einer Bestellung für die Vorlagen (rein, ohne Payload). */
export interface AdminTemplateOrder {
  orderNumber: string
  locale: Locale
  customer: { name?: string | null; email: string }
  totalCents: number
  prepayment?: { receivedAmountCents?: number | null } | null
  shipment?: { carrier?: string | null } | null
  timestamps?: { shippedAt?: string | null } | null
}

export interface AdminTemplateContext {
  order: AdminTemplateOrder
  /** Signatur aus `site-texts.emails.signature` in der Sprache der Bestellung. */
  signature: string
}

export class AdminTemplateError extends Error {
  constructor(
    readonly key: AdminTemplateKey,
    readonly token: string,
  ) {
    super(`Vorlage „${key}“: Platzhalter {{${token}}} lässt sich nicht füllen.`)
    this.name = 'AdminTemplateError'
  }
}

const TOKEN_RE = /\{\{([^{}]*)\}\}/g

function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

/** Platzhalter-Werte einer Bestellung (fehlende Werte bleiben weg und führen beim Füllen zum Fehler). */
export function templateVars(ctx: AdminTemplateContext): Record<string, string> {
  const { order } = ctx
  const locale = order.locale
  const name = firstName(order.customer.name)
  const vars: Record<string, string> = {
    greeting: locale === 'en' ? (name ? `Hi ${name},` : 'Hi,') : name ? `Hallo ${name},` : 'Hallo,',
    orderNumber: order.orderNumber,
    signature: ctx.signature.trim(),
    amount: formatMoney(order.prepayment?.receivedAmountCents ?? order.totalCents, locale),
  }
  const carrier = order.shipment?.carrier
  vars.carrier =
    carrier && carrier !== 'other' && carrier in ENUM_LABELS.CARRIERS
      ? ENUM_LABELS.CARRIERS[carrier as keyof typeof ENUM_LABELS.CARRIERS].de
      : 'dem Versanddienst'
  const shipped = order.timestamps?.shippedAt
  if (shipped) {
    const at = new Date(shipped)
    vars.shippedDate = formatBerlin(at, 'dd.MM.yyyy')
    vars.claimDeadline = formatBerlin(addBerlinDays(at, CARRIER_CLAIM_DAYS), 'dd.MM.yyyy')
  }
  if (!vars.signature) delete vars.signature
  return vars
}

function fill(key: AdminTemplateKey, text: string, vars: Record<string, string>): string {
  return text.replace(TOKEN_RE, (_, raw: string) => {
    const token = raw.trim()
    const value = vars[token]
    if (value === undefined) throw new AdminTemplateError(key, token)
    return value
  })
}

export interface RenderedAdminTemplate {
  key: AdminTemplateKey
  title: string
  status: typeof ADMIN_TEMPLATE_STATUS
  locale: Locale
  to: string
  subject: string
  body: string
  /** `mailto:`-Link (Empfänger, Betreff, Text). */
  mailto: string
  ownerNote: string | null
}

/** `mailto:` mit Betreff und Text (RFC 6068: Zeilenumbrüche als `%0D%0A`). */
export function mailtoLink(to: string, subject: string, body: string): string {
  const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'))
  return `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${enc(subject)}&body=${enc(body)}`
}

/** Vorlage mit den Daten einer Bestellung füllen (Sprache der Bestellung). Wirft bei offenen Platzhaltern. */
export function renderAdminTemplate(
  key: AdminTemplateKey,
  ctx: AdminTemplateContext,
): RenderedAdminTemplate {
  const def = ADMIN_TEMPLATES[key]
  const vars = templateVars(ctx)
  const locale = ctx.order.locale
  const subject = fill(key, def.subject[locale], vars)
  const body = fill(key, def.body[locale], vars)
  return {
    key,
    title: def.title,
    status: ADMIN_TEMPLATE_STATUS,
    locale,
    to: ctx.order.customer.email,
    subject,
    body,
    mailto: mailtoLink(ctx.order.customer.email, subject, body),
    ownerNote: def.ownerNote ? fill(key, def.ownerNote, vars) : null,
  }
}

/** Passt die Vorlage zur Bestellung? (Versanddatum für „Bruch“, Vorkasse-Storno für „Bankverbindung“.) */
export function templateFitsOrder(
  key: AdminTemplateKey,
  order: AdminTemplateOrder & { status?: string; paymentMethod?: string },
): boolean {
  if (key === 'breakage_photos') return Boolean(order.timestamps?.shippedAt)
  if (key === 'prepayment_refund_iban') {
    return order.paymentMethod === 'prepayment' && order.status === 'cancelled'
  }
  return true
}
