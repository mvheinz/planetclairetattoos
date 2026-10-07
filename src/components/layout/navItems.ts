// Navigationslisten (KONZEPT §3.0.2/§3.0.3, DESIGN KO-03/KO-04) als Routen-IDs der Registry.

/** Hauptliste des Menüs: Start · Shop · Archiv · Auftragsarbeiten · Tattoo · Über mich & Coco · Kontakt. */
export const MENU_MAIN = ['R01', 'R02', 'R05', 'R10', 'R11', 'R19', 'R20'] as const

/** Tattoo-Unterseiten (unter „Tattoo“ im Menü). */
export const TATTOO_PAGES = ['R12', 'R14', 'R15', 'R16', 'R17', 'R18'] as const

/** Pflichtlink-Block (R-011): Impressum, Datenschutz, AGB, Widerrufsbelehrung, Versand & Zahlung, Kontakt. */
export const LEGAL_LINKS = ['R21', 'R22', 'R23', 'R24', 'R25', 'R20'] as const

/** Konformitätserklärungen: Fußlink nur bei mindestens einer aktiven Erklärung (KONZEPT §3.0.3). */
export const CONFORMITY_ROUTE = 'R27'

/** Vertrag widerrufen (R-090). */
export const WITHDRAWAL_ROUTE = 'R26'
