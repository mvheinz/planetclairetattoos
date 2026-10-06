// Texte der Tattoo-Verwaltung `/tattoo` (PLAN P7.6–P7.9, KONZEPT §7.12). Verwaltung nur Deutsch (DATENMODELL §1.2);
// eine Quelle für Server- und Client-Komponenten. `{{name}}` wird ersetzt.

export const TATTOO_TABS = ['flash', 'galerie', 'texte'] as const
export type TattooTab = (typeof TATTOO_TABS)[number]

export const TATTOO_TEXT = {
  tabsLabel: 'Bereiche',
  tab_flash: 'Flash',
  tab_galerie: 'Galerie',
  tab_texte: 'Texte',
  allDataHint: 'Alle Felder findest du auch in der Standard-Verwaltung.',
  notFound: 'Nicht gefunden – vielleicht schon gelöscht.',
  backToList: '← Zurück zur Liste',
  noPhoto: 'kein Bild',
  save: 'Speichern',
  saved: 'Gespeichert.',
  savedOnline: 'Gespeichert – die Texte sind online.',
  title: 'Titel',
  german: 'Deutsch',
  english: 'Englisch',
  online: 'online',
  offline: 'offline',
  onlineLabel: 'Online (auf der Website zeigen)',
  takeOffline: 'Offline nehmen',
  putOnline: 'Online stellen',
  checkFields: 'Bitte prüfen:',
  altRequired:
    'Bitte für Foto {{n}} eine Bildbeschreibung auf Deutsch eingeben (oder „Vorschlag“ nutzen).',
  moveUp: 'Hoch',
  moveDown: 'Runter',

  // Flash (P7.6)
  flashNew: 'Neuer Flash',
  flashEditHeading: 'Flash bearbeiten',
  flashPublic: 'Flash-Seite ansehen',
  flashHint:
    'Antippen des Status wechselt zwischen „verfügbar“ und „vergeben“ (mit Rückfrage). Wiederholbare Motive pausierst du mit „Offline nehmen“.',
  flashEmpty: 'Noch keine Flash-Motive.',
  flashSize: 'ca. {{size}} cm',
  flashRepeatable: 'wiederholbar',
  statusAvailable: 'verfügbar',
  statusClaimed: 'vergeben',
  flashChipHint: '– Status von {{nr}} ändern',
  flashClaimTitle: '{{nr}} als vergeben markieren?',
  flashClaimText: 'Auf der Flash-Seite erscheint der Stempel „vergeben“.',
  flashClaimConfirm: 'Ja, vergeben',
  flashReleaseTitle: '{{nr}} wieder verfügbar machen?',
  flashReleaseText: 'Der Stempel „vergeben“ verschwindet von der Flash-Seite.',
  flashReleaseConfirm: 'Ja, verfügbar',
  flashNumber: 'Nummer',
  flashNumberHint: 'Vorschlag: nächste freie Nummer (Anzeige „F-012“).',
  flashNumberInvalid: 'Nummer: ganze Zahl von 1 bis 9999.',
  flashTitleInvalid: 'Titel (Deutsch): 2–60 Zeichen.',
  flashSizeCm: 'Größe (cm)',
  flashSizeHint: 'Ungefähre Größe, z. B. 9,5.',
  flashSizeInvalid: 'Größe: größer als 0 und höchstens 60 cm, eine Nachkommastelle.',
  flashSizeNote: 'Hinweis zur Größe',
  flashSizeNoteHint: 'z. B. „Größe anpassbar“.',
  flashPrice: 'Festpreis (Euro)',
  flashPriceHint: 'Gesamtpreis, mindestens 10,00 €.',
  flashPriceInvalid: 'Festpreis: Betrag wie 120 oder 120,00 – mindestens 10,00 €.',
  flashRepeatableLabel: 'wiederholbar (kann mehrmals gestochen werden)',
  flashRepeatableHint: 'Wiederholbare Motive werden nie „vergeben“.',
  flashImageMissing: 'Bitte eine Zeichnung hinzufügen.',

  // Galerie (P7.8)
  galleryNew: 'Neues Galerie-Foto',
  galleryEditHeading: 'Galerie-Foto bearbeiten',
  galleryHint:
    'Fotos mit Kund:innen erscheinen nur mit dokumentierter Einwilligung. Eine Instagram-Freigabe deckt die Website nicht automatisch ab.',
  galleryEmpty: 'Noch keine Galerie-Fotos.',
  galleryUntitled: 'Galerie-Foto {{id}}',
  galleryNoCustomer: 'ohne Kund:in',
  galleryConsentYes: 'Einwilligung vom {{date}}',
  galleryConsentNo: 'keine Einwilligung',
  galleryConsentWithdrawn: 'Einwilligung widerrufen am {{date}}',
  galleryKind: 'Art',
  galleryMonths: 'Verheilt seit (Monate)',
  galleryMonthsHint: 'z. B. 42 → „3,5 Jahre verheilt“.',
  galleryMonthsInvalid: 'Bei „verheilt“: Monate seit dem Stechen (1–600).',
  galleryHealedLabel: 'Eigene Angabe „verheilt“ (optional)',
  galleryCaption: 'Bildunterschrift',
  galleryPlacement: 'Körperstelle (optional)',
  galleryPlacementHint: 'z. B. „Unterarm“.',
  galleryShowsCustomer: 'Zeigt eine Kundin / einen Kunden',
  galleryShowsCustomerHint: 'Aus nur bei eigenen Zeichnungen oder Platzhaltern.',
  galleryConsent: 'Einwilligung',
  galleryInstagramHint: 'Eine Instagram-Freigabe deckt die Website nicht automatisch ab.',
  galleryConsentGiven: 'Einwilligung zur Veröffentlichung auf der Website liegt vor',
  galleryConsentScope: 'Umfang',
  galleryConsentDate: 'Datum der Einwilligung',
  galleryConsentNote: 'Wie/wo erteilt',
  galleryConsentNoteHint: 'z. B. „per Mail am 02.10.2026“ (5–300 Zeichen).',
  galleryEvidence: 'Nachweis (Screenshot oder Formular, privat)',
  galleryEvidenceHint:
    'Empfohlen. Nur für dich sichtbar; wird 3 Jahre nach einem Widerruf gelöscht.',
  galleryEvidenceSaved: 'Gespeicherter Nachweis: {{name}}',
  galleryEvidenceFailed: 'Der Nachweis konnte nicht hochgeladen werden.',
  galleryCreditAllowed: 'Kund:in erlaubt die Nennung ihres Instagram-Namens',
  galleryCreditHandle: 'Instagram-Name',
  galleryFeatured: 'Hervorheben',
  galleryPublishLocked: 'Ohne Einwilligung der Kundin/des Kunden nicht veröffentlichen.',
  galleryImageMissing: 'Bitte ein Foto hinzufügen.',
  galleryWithdrawnNotice:
    'Die Einwilligung wurde am {{date}} widerrufen. Das Foto ist offline, die Bilddateien werden gelöscht.',
  withdrawButton: 'Einwilligung widerrufen',
  withdrawTitle: 'Einwilligung widerrufen?',
  withdrawConsequence:
    'Das Foto ist sofort offline und die Bilder sind nicht mehr abrufbar. Die Bilddateien werden innerhalb von 24 Stunden gelöscht; der Nachweis bleibt 3 Jahre.',
  withdrawConfirm: 'Widerrufen',
  withdrawEmail: 'Bestätigung an (E-Mail, optional)',
  withdrawEmailHint:
    'Wird nicht gespeichert. Kam der Widerruf per Brief oder mündlich, lass das Feld leer und antworte dort.',
  withdrawLocale: 'Sprache der Bestätigung',
  withdrawDone: 'Einwilligung widerrufen – das Foto ist offline.',
  withdrawDoneMail: 'Einwilligung widerrufen – das Foto ist offline, die Bestätigung geht raus.',

  // Texte (P7.9)
  textsPrices: 'Preise',
  pageTitle: 'Titel der Seite',
  pageMetaTitle: 'Titel für Suchmaschinen (höchstens 60 Zeichen)',
  pageMetaDescription: 'Beschreibung für Suchmaschinen (höchstens 160 Zeichen)',
  textsMarkupHint:
    'Leerzeile = neuer Absatz, Zeile mit „- “ = Liste, **fett**, [Linktext](Adresse).',
  textsNoBlocks: 'Noch keine Texte – füge unten einen Abschnitt hinzu.',
  textsPageMissing: 'Die Seite gibt es noch nicht; sie entsteht beim ersten Speichern.',
  textsBlockElsewhere: 'Dieser Abschnitt bleibt unverändert (bearbeitbar in „Alle Daten“).',
  textsLossy:
    'Dieser Text hat Formatierungen, die hier vereinfacht werden (z. B. kursiv). Beim Speichern gehen sie verloren.',
  addBlock: '„{{label}}“ hinzufügen',
  addRow: '{{label}} hinzufügen',
  removeRow: '{{label}} entfernen',
  warningsSaved: 'Gespeichert, aber bitte prüfen:',
  faqTattoo: 'FAQ Tattoo',
  faqAftercare: 'FAQ Aftercare',
  faqEmpty: 'Noch keine Fragen.',
  faqNew: 'Neue Frage',
  faqAdd: 'Frage hinzufügen',
  faqQuestion: 'Frage',
  faqAnswer: 'Antwort',
} as const

export type TattooTextKey = keyof typeof TATTOO_TEXT

export function tattooText(key: TattooTextKey, vars: Record<string, string | number> = {}): string {
  return TATTOO_TEXT[key].replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''))
}
