import 'server-only'

import type { LegalSnippetKey, LegalTextOrigin, Locale } from '@/lib/enums'

// Grund-Seed der Rechtsbausteine (DATENMODELL §6.28, RECHT ANFORDERUNGEN §6): je Schlüssel die Fassung v1 mit
// `validFrom = 2026-01-01`. Schlüssel mit Arbeitsfassung tragen den Wortlaut aus ANFORDERUNGEN §6 (DE wörtlich, EN
// sinngemäß übersetzt, `origin = 'draft'`); Schlüssel ohne Arbeitsfassung („– (Kanzlei)“) den Platzhaltertext mit
// `origin = 'placeholder'`. Arbeitsfassungen sind keine geprüften Rechtstexte; der Kanzlei-Wortlaut kommt in P11 als
// neue Fassung. Laufzeitquelle ist die Collection `legal-snippets` (src/lib/legal/snippets.ts); diese Texte dienen nur
// dem Seed und – solange die Collection noch nicht geladen ist (Unit-Tests, Start) – als Rückfall mit der Version
// `draft-1` aus P3–P5.

/** Text für Schlüssel ohne Arbeitsfassung (DATENMODELL §6.28, R-002). */
export const SNIPPET_PLACEHOLDER_TEXT: Readonly<Record<Locale, string>> = Object.freeze({
  de: 'PLATZHALTER – Text folgt von der Kanzlei.',
  en: 'PLACEHOLDER – text to follow from the law firm.',
})

/** Fassung und Gültigkeitsbeginn der Seed-Bausteine (DATENMODELL §6.28). */
export const LEGAL_SNIPPET_SEED_VERSION = 1
export const LEGAL_SNIPPET_SEED_VALID_FROM = '2026-01-01T00:00:00+01:00'

export interface LegalSnippetSeedText {
  de: string
  en: string
  origin: Extract<LegalTextOrigin, 'draft' | 'placeholder'>
}

const draft = (de: string, en: string) => ({ de, en, origin: 'draft' as const })
const placeholder = () => ({ ...SNIPPET_PLACEHOLDER_TEXT, origin: 'placeholder' as const })

/**
 * Platzhalter `commission.offer` (R-161, PLAN P7.14) mit der Gliederung, die der Kanzleitext (K-24, P11) füllen muss –
 * Jutta kopiert ihn im Anfrage-Detail als Gerüst für ihr Angebot per Mail. Bleibt `origin = 'placeholder'`.
 */
export const COMMISSION_OFFER_PLACEHOLDER: Readonly<Record<Locale, string>> = Object.freeze({
  de: [
    SNIPPET_PLACEHOLDER_TEXT.de,
    'Gliederung des Angebots per Mail:',
    '1. Wesentliche Eigenschaften (Gegenstand, Motiv, Material, Größe, Farben).',
    '2. Gesamtpreis inkl. Versandkosten (mit Hinweis nach § 19 UStG, solange Kleinunternehmerin).',
    '3. Lieferzeit.',
    '4. Zahlungsweg (Überweisung außerhalb des Shops).',
    '5. Herstellerangaben und Warnhinweise (GPSR).',
    '6. Widerrufsinformation: Ausschluss nur, wenn das Stück nach individuellen Vorgaben angefertigt wird (§ 312g Abs. 2 Nr. 1 BGB); sonst Widerrufsbelehrung und Muster-Widerrufsformular beifügen.',
  ].join('\n'),
  en: [
    SNIPPET_PLACEHOLDER_TEXT.en,
    'Structure of the offer by email:',
    '1. Main characteristics (object, motif, material, size, colours).',
    '2. Total price including shipping (with the note under Section 19 UStG while the small-business scheme applies).',
    '3. Delivery time.',
    '4. Payment method (bank transfer outside the shop).',
    '5. Manufacturer details and safety warnings (GPSR).',
    '6. Withdrawal information: excluded only if the piece is made to individual specifications (Section 312g (2) no. 1 BGB); otherwise attach the withdrawal policy and the model withdrawal form.',
  ].join('\n'),
})

const TEXTS: Record<LegalSnippetKey, LegalSnippetSeedText> = {
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
  'commission.offer': { ...COMMISSION_OFFER_PLACEHOLDER, origin: 'placeholder' },
  'translation.disclaimer': draft(
    'This English version is provided for convenience only. Only the German version is legally binding.',
    'This English version is provided for convenience only. Only the German version is legally binding.',
  ),
  'privacyRequest.accessResponse': placeholder(),
  'privacyRequest.erasureResponse': placeholder(),
}

/** Seed-Texte aller Schlüssel aus `LEGAL_SNIPPET_KEYS` (unveränderlich). */
export const LEGAL_SNIPPET_SEED: Readonly<Record<LegalSnippetKey, Readonly<LegalSnippetSeedText>>> =
  Object.freeze(
    Object.fromEntries(Object.entries(TEXTS).map(([k, v]) => [k, Object.freeze(v)])) as Record<
      LegalSnippetKey,
      LegalSnippetSeedText
    >,
  )
