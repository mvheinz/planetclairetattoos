// Eigene Admin-Texte (Admin nur Deutsch, DATENMODELL §1.2). Schlüssel werden im Admin als `custom:<key>` genutzt.
export const ADMIN_CUSTOM_DE = {
  euroInputInvalid:
    'Bitte einen Betrag in Euro mit höchstens zwei Nachkommastellen eingeben (z. B. 38,50).',
  euroInputHint: 'Betrag in Euro, z. B. 38,50',
  moneyNotInteger: 'Der Betrag muss ein ganzzahliger Cent-Wert ≥ 0 sein.',
  seedKeyInvalid:
    'Seed-Schlüssel muss das Format <collection>:<schlüssel> haben (a–z, Ziffern und : # . _ -, höchstens 80 Zeichen).',
  sortOrderInvalid: 'Reihenfolge muss eine ganze Zahl von 0 bis 9999 sein.',
  legalHoldReasonRequired: 'Begründung für die Sperre nötig (10–300 Zeichen).',
  lengthBetween: 'Bitte {{min}}–{{max}} Zeichen eingeben.',
  lengthMax: 'Höchstens {{max}} Zeichen.',
  postalCodeDe: 'Deutsche Postleitzahl: genau 5 Ziffern.',
  required: 'Pflichtfeld.',
  categoryRequired: 'Bitte eine Kategorie wählen.',
  integerMin1: 'Ganzzahl ≥ 1.',
  integerMin0: 'Ganzzahl ≥ 0.',
  entityIdInvalid:
    'Nur die interne ID (Ziffern, Buchstaben, - oder _), keine Namen oder E-Mail-Adressen.',
  privacyRequestRefInvalid: 'Format DS-JJJJ-NNNN.',
  taskSlugInvalid: 'Task-Slug in camelCase (z. B. retentionOrders).',
  immutableField: 'Protokolleinträge sind unveränderlich.',
  ruleIdInvalid: 'Regel muss L-xx (z. B. „L-13 a“, „L-05 Stufe C“), DSGVO oder ADMIN sein.',
} as const

export type AdminCustomKey = keyof typeof ADMIN_CUSTOM_DE

/** Text mit {{platzhaltern}} füllen (für serverseitige Validierungsmeldungen). */
export function adminText(key: AdminCustomKey, vars: Record<string, string | number> = {}): string {
  return ADMIN_CUSTOM_DE[key].replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''))
}
