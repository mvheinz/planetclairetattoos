import 'server-only'

import { createHash } from 'node:crypto'

import {
  LEGAL_SNIPPET_KEYS,
  type LegalSnippetKey,
  type LegalTextOrigin,
  type Locale,
} from '@/lib/enums'

import { LEGAL_TOKENS } from './render'

// Rechtliche Textbausteine (RECHT ANFORDERUNGEN §6, DATENMODELL §6.28, R-012). Bis P6 liegen die Arbeitsfassungen
// hier als Konstanten (DE wörtlich aus ANFORDERUNGEN §6, EN sinngemäß übersetzt; `origin: 'draft'`, Version `draft-1`).
// Schlüssel ohne Arbeitsfassung („– (Kanzlei)“) tragen wie im späteren Grund-Seed den Platzhaltertext mit
// `origin: 'placeholder'` (DATENMODELL §6.28) – das Go-live-Gate R-210 verlangt für alle Schlüssel aus
// `LEGAL_SNIPPET_REQUIRES_LAWYER` die Kanzlei-Fassung. Ab P6 liest `getSnippet` die aktive Fassung aus der Collection
// `legal-snippets` (vorab geladen, damit die Funktion synchron bleibt); die Aufrufer ändern sich nicht.
// Arbeitsfassungen sind keine geprüften Rechtstexte.

export const LEGAL_SNIPPET_DRAFT_VERSION = 'draft-1'

/** Text für Schlüssel ohne Arbeitsfassung (DATENMODELL §6.28, R-002). */
export const SNIPPET_PLACEHOLDER_TEXT: Readonly<Record<Locale, string>> = Object.freeze({
  de: 'PLATZHALTER – Text folgt von der Kanzlei.',
  en: 'PLACEHOLDER – text to follow from the law firm.',
})

/**
 * Kontext-Tokens, die ein Baustein neben den Tokens aus R-012 (`LEGAL_TOKENS`) verwenden darf – nur die in seiner
 * Arbeitsfassung genannten (ANFORDERUNGEN §6); der Aufrufer liefert sie.
 */
export const SNIPPET_CONTEXT_TOKENS = [
  'itemTitle',
  'objectNumber',
  'deviationText',
  'metalMaterial',
  'condition',
  'amount',
  'dueDate',
  'accountHolder',
  'iban',
  'orderNumber',
] as const

/** Spalte „Kanzlei: ja“ aus ANFORDERUNGEN §6 (Go-live verlangt `origin = lawyer`, DATENMODELL §13.7). */
export const LEGAL_SNIPPET_REQUIRES_LAWYER: readonly LegalSnippetKey[] = LEGAL_SNIPPET_KEYS.filter(
  (k) => !['product.noSpecialWarnings', 'product.glassFrame', 'email.pickup.ready'].includes(k),
)

export interface LegalSnippetDraft {
  de: string
  en: string
  origin: Extract<LegalTextOrigin, 'draft' | 'placeholder'>
  version: typeof LEGAL_SNIPPET_DRAFT_VERSION
  /** SHA-256 (hex) des DE-Texts. */
  sha256: string
}

const draft = (de: string, en: string) => ({ de, en, origin: 'draft' as const })
const placeholder = () => ({ ...SNIPPET_PLACEHOLDER_TEXT, origin: 'placeholder' as const })

const TEXTS: Record<LegalSnippetKey, Pick<LegalSnippetDraft, 'de' | 'en' | 'origin'>> = {
  'price.kleinunternehmerNote': draft(
    'Endpreis · gemäß § 19 UStG wird keine Umsatzsteuer berechnet',
    'Final price · no VAT is charged under Section 19 of the German VAT Act (UStG)',
  ),
  'price.shippingNote': draft('zzgl. Versandkosten', 'plus shipping costs'),
  'price.tattooNote': draft(
    'Gesamtpreis · gemäß § 19 UStG wird keine Umsatzsteuer berechnet',
    'Total price · no VAT is charged under Section 19 of the German VAT Act (UStG)',
  ),
  'delivery.timeShipping': draft(
    'Lieferzeit: {{deliveryTime}} (bei Vorkasse ab Zahlungseingang)',
    'Delivery time: {{deliveryTime}} (for payment in advance, from receipt of payment)',
  ),
  'delivery.timePickup': draft(
    'Abholbereit innerhalb von {{deliveryTime}} nach Zahlungseingang, Termin nach Absprache per E-Mail',
    'Ready for collection within {{deliveryTime}} after receipt of payment, appointment by arrangement via email',
  ),
  'cart.paymentAndDeliveryInfo': draft(
    'Wir liefern nur innerhalb Deutschlands. Abholung in Berlin nach Absprache. Zahlarten: Kredit-/Debitkarte, Apple Pay, Google Pay, PayPal, Vorkasse per Überweisung.',
    'We only deliver within Germany. Collection in Berlin by arrangement. Payment methods: credit/debit card, Apple Pay, Google Pay, PayPal, payment in advance by bank transfer.',
  ),
  'checkout.legalNotice': draft(
    'Es gelten unsere AGB. Informationen zu deinem Widerrufsrecht findest du in der Widerrufsbelehrung, Hinweise zum Datenschutz in der Datenschutzerklärung.',
    'Our terms and conditions apply. Information about your right of withdrawal can be found in the withdrawal policy, information on data protection in the privacy policy.',
  ),
  'checkout.dhlEmailConsent': draft(
    'Ich bin einverstanden, dass meine E-Mail-Adresse an DHL (DHL Paket GmbH bzw. Deutsche Post AG) übermittelt wird, damit DHL mich über die Zustellung informieren kann. Ich kann diese Einwilligung jederzeit per E-Mail an jutta@planetclairetattoos.com widerrufen.',
    'I agree that my email address will be passed on to DHL (DHL Paket GmbH or Deutsche Post AG) so that DHL can inform me about the delivery. I can withdraw this consent at any time by email to jutta@planetclairetattoos.com.',
  ),
  'checkout.deviationAgreement': draft(
    'Mir ist bekannt, dass {{itemTitle}} (Nr. {{objectNumber}}) folgende Abweichung aufweist: {{deviationText}}. Ich vereinbare diese Beschaffenheit ausdrücklich und gesondert.',
    'I am aware that {{itemTitle}} (No. {{objectNumber}}) has the following deviation: {{deviationText}}. I expressly and separately agree to this condition.',
  ),
  'checkout.vorkasseInfo': draft(
    'Bei Vorkasse reservieren wir dein Stück {{vorkasseDays}} Tage. Geht die Zahlung bis dahin nicht ein, wird die Bestellung automatisch storniert.',
    'For payment in advance, we reserve your piece for {{vorkasseDays}} days. If payment has not been received by then, the order is cancelled automatically.',
  ),
  'product.ceramicsDecorative': draft(
    'Dekorationsobjekt – nicht für Lebensmittel geeignet.',
    'Decorative object – not suitable for food.',
  ),
  'product.ceramicsFoodSafe': draft(
    'Für den Kontakt mit Lebensmitteln geeignet – Konformitätserklärung ansehen.',
    'Suitable for contact with food – view the declaration of conformity.',
  ),
  'product.jewelrySmallParts': draft(
    'Achtung: Kein Spielzeug. Nicht für Kinder unter 3 Jahren geeignet – enthält verschluckbare Kleinteile.',
    'Warning: Not a toy. Not suitable for children under 3 years – contains small parts that can be swallowed.',
  ),
  'product.jewelryNickel': draft(
    'Metallteile: {{metalMaterial}}, nickelfrei (Lieferantennachweis liegt vor).',
    'Metal parts: {{metalMaterial}}, nickel-free (supplier evidence available).',
  ),
  'product.textileSecondHand': draft(
    'Second-Hand/Vintage: gebrauchtes Stück, von Hand bemalt. Zustand: {{condition}}.',
    'Second-hand/vintage: used piece, hand-painted. Condition: {{condition}}.',
  ),
  'product.textileLabelMissing': draft(
    'Das Originaletikett fehlt – Materialangabe nach bestem Wissen.',
    'The original label is missing – material stated to the best of our knowledge.',
  ),
  'product.noSpecialWarnings': draft('Keine besonderen Warnhinweise.', 'No special warnings.'),
  'product.glassFrame': draft(
    'Rahmen mit Glas – zerbrechlich, vorsichtig auspacken.',
    'Frame with glass – fragile, unpack carefully.',
  ),
  'email.orderConfirmation.contractSentence': placeholder(),
  'email.vorkasse.paymentInstructions': draft(
    'Bitte überweise {{amount}} bis {{dueDate}} an {{accountHolder}}, IBAN {{iban}}, Verwendungszweck: {{orderNumber}}.',
    'Please transfer {{amount}} by {{dueDate}} to {{accountHolder}}, IBAN {{iban}}, reference: {{orderNumber}}.',
  ),
  'email.vorkasse.reminder': draft(
    'Wir haben deine Zahlung für {{orderNumber}} noch nicht erhalten. Bitte überweise bis {{dueDate}}.',
    'We have not yet received your payment for {{orderNumber}}. Please transfer by {{dueDate}}.',
  ),
  'email.vorkasse.cancellation': placeholder(),
  'email.shipping.damageNotice': draft(
    'Falls dein Paket beschädigt ankommt: Bitte melde dich möglichst schnell mit Fotos bei jutta@planetclairetattoos.com. Deine gesetzlichen Rechte bleiben davon unberührt.',
    'If your parcel arrives damaged: please get in touch as soon as possible with photos at jutta@planetclairetattoos.com. Your statutory rights remain unaffected.',
  ),
  'email.pickup.ready': draft(
    'Dein Stück ist bereit zur Abholung. Ort und Terminvorschläge: …',
    'Your piece is ready for collection. Location and suggested appointments: …',
  ),
  'withdrawal.intro': draft(
    'Hier kannst du deinen Vertrag widerrufen. Nach dem Absenden bekommst du sofort eine Eingangsbestätigung per E-Mail.',
    'Here you can withdraw from your contract. After submitting, you will immediately receive a confirmation of receipt by email.',
  ),
  'withdrawal.receiptNotice': draft(
    'Diese E-Mail bestätigt den Eingang deiner Widerrufserklärung. Sie ist noch keine Prüfung, ob der Widerruf wirksam ist.',
    'This email confirms receipt of your notice of withdrawal. It does not yet confirm whether the withdrawal is valid.',
  ),
  'withdrawal.returnInfo': draft(
    'Bitte sende die Ware an: {{name}}, {{street}}, {{postalCode}} {{city}}. Die unmittelbaren Kosten der Rücksendung trägst du.',
    'Please send the goods to: {{name}}, {{street}}, {{postalCode}} {{city}}. You bear the direct costs of returning the goods.',
  ),
  'withdrawal.returnCostsNote': draft(
    'Die unmittelbaren Kosten der Rücksendung der Waren trägst du.',
    'You bear the direct costs of returning the goods.',
  ),
  'complaint.repairChoice': placeholder(),
  'dispute.vsbg37': draft(
    'Zuständig ist die Universalschlichtungsstelle des Bundes, Zentrum für Schlichtung e. V., Straßburger Straße 8, 77694 Kehl am Rhein, www.universalschlichtungsstelle.de. Ich bin nicht bereit und nicht verpflichtet, an einem Streitbeilegungsverfahren teilzunehmen.',
    'The competent body is the Universalschlichtungsstelle des Bundes, Zentrum für Schlichtung e. V., Straßburger Straße 8, 77694 Kehl am Rhein, www.universalschlichtungsstelle.de. I am neither willing nor obliged to participate in dispute resolution proceedings.',
  ),
  'inquiry.privacyNotice': draft(
    'Deine Angaben und Bilder nutze ich nur, um deine Anfrage zu beantworten. Sie werden 6 Monate nach Eingang automatisch gelöscht. Mehr in der Datenschutzerklärung.',
    'I only use your details and images to answer your request. They are deleted automatically 6 months after receipt. More in the privacy policy.',
  ),
  'inquiry.autoReply': placeholder(),
  'commission.offer': placeholder(),
  'translation.disclaimer': draft(
    'This English version is provided for convenience only. Only the German version is legally binding.',
    'This English version is provided for convenience only. Only the German version is legally binding.',
  ),
  'privacyRequest.accessResponse': placeholder(),
  'privacyRequest.erasureResponse': placeholder(),
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

/** Alle Bausteine der Arbeitsfassung (unveränderlich). */
export const LEGAL_SNIPPETS: Readonly<Record<LegalSnippetKey, Readonly<LegalSnippetDraft>>> =
  Object.freeze(
    Object.fromEntries(
      LEGAL_SNIPPET_KEYS.map((key) => {
        const t = TEXTS[key]
        const entry: LegalSnippetDraft = {
          ...t,
          version: LEGAL_SNIPPET_DRAFT_VERSION,
          sha256: sha256(t.de),
        }
        return [key, Object.freeze(entry)]
      }),
    ) as Record<LegalSnippetKey, LegalSnippetDraft>,
  )

export class SnippetRenderError extends Error {
  constructor(
    readonly key: string,
    readonly unknownTokens: readonly string[] = [],
    readonly missingTokens: readonly string[] = [],
  ) {
    const parts: string[] = []
    if (unknownTokens.length) parts.push(`unbekannte Platzhalter: ${unknownTokens.join(', ')}`)
    if (missingTokens.length) parts.push(`ohne Wert: ${missingTokens.join(', ')}`)
    super(`Baustein ${key} nicht darstellbar (${parts.join('; ') || 'unbekannter Schlüssel'}).`)
    this.name = 'SnippetRenderError'
  }
}

const TOKEN_RE = /\{\{([^{}]*)\}\}/g
const ALLOWED_TOKENS = new Set<string>([...LEGAL_TOKENS, ...SNIPPET_CONTEXT_TOKENS])

/** Tokens eines Texts (`{{deliveryTime}}` → `deliveryTime`). */
export function snippetTokens(text: string): string[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => m[1]!)
}

export type SnippetVars = Readonly<Record<string, string | number | null | undefined>>

export interface RenderedSnippet {
  key: LegalSnippetKey
  locale: Locale
  text: string
  version: string
  origin: LegalSnippetDraft['origin']
  /** SHA-256 des DE-Texts der Fassung (für Kasse, Bestellung, `consent-log`). */
  sha256: string
}

/**
 * Ersetzt die Platzhalter eines Bausteintexts. Unbekannte Platzhalter (weder R-012 noch Kontext-Token), Platzhalter
 * ohne Wert und unvollständige Klammern → `SnippetRenderError`.
 */
export function renderSnippetText(key: string, template: string, vars: SnippetVars = {}): string {
  const unknown: string[] = []
  const missing: string[] = []
  const text = template.replace(TOKEN_RE, (raw, name: string) => {
    if (!ALLOWED_TOKENS.has(name)) {
      unknown.push(raw)
      return raw
    }
    const value = vars[name]
    if (value === null || value === undefined || String(value).trim() === '') {
      missing.push(raw)
      return raw
    }
    return String(value)
  })
  if (unknown.length || missing.length || /\{\{|\}\}/.test(template.replace(TOKEN_RE, ''))) {
    throw new SnippetRenderError(key, [...new Set(unknown)], [...new Set(missing)])
  }
  return text
}

const isSnippetKey = (key: string): key is LegalSnippetKey =>
  (LEGAL_SNIPPET_KEYS as readonly string[]).includes(key)

/**
 * Baustein in `locale` mit ersetzten Platzhaltern. Unbekannter Schlüssel, unbekannter Platzhalter (weder R-012 noch
 * Kontext-Token) oder Platzhalter ohne Wert → `SnippetRenderError` (Muster R-012; nie rohe Tokens anzeigen).
 */
export function getSnippet(
  key: LegalSnippetKey,
  locale: Locale,
  vars: SnippetVars = {},
): RenderedSnippet {
  if (!isSnippetKey(key)) throw new SnippetRenderError(String(key))
  const entry = LEGAL_SNIPPETS[key]
  const text = renderSnippetText(key, entry[locale], vars)
  return {
    key,
    locale,
    text,
    version: entry.version,
    origin: entry.origin,
    sha256: entry.sha256,
  }
}
