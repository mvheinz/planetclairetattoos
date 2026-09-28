// Verwaltungs-Ansichten für die Bildschirmfotos der Vorschau-Datei (ARCHITEKTUR §14.7, KONZEPT §12.5 Nr. 9): je Ansicht
// aus KONZEPT §7.3–§7.15 Schlüssel, Pfad relativ zu `ADMIN_ROUTE`, Bildunterschrift DE/EN und die Phase, ab der sie
// existiert. In P2 gibt es nur Anmeldung, Liste und Formular der Standard-Verwaltung (P1); die eigenen Handy-Ansichten
// baut P5 (P5.1 ergänzt die Pfade der Ansichten-Registry), „Tattoo“ P7. Noch nicht gebaute Ansichten erscheinen als
// „kommt in P<n>“.

export interface AdminView {
  key: string
  /** Pfad relativ zu `ADMIN_ROUTE` (`''` = Startseite der Verwaltung). */
  path: string
  caption: { de: string; en: string }
  /** Phase, ab der die Ansicht existiert. */
  phase: number
  /** Nur ohne Anmeldung aufnehmen (Anmeldeseite). */
  anonymous?: boolean
  /** Quelle in KONZEPT. */
  ref: string
}

export const ADMIN_VIEWS: readonly AdminView[] = [
  {
    key: 'login',
    path: '/login',
    caption: { de: 'Anmeldung', en: 'Sign-in' },
    phase: 1,
    anonymous: true,
    ref: 'KONZEPT §7.1',
  },
  {
    key: 'products-list',
    path: '/collections/products',
    caption: { de: 'Alle Daten: Stücke (Liste)', en: 'All data: pieces (list)' },
    phase: 1,
    ref: 'KONZEPT §7.16',
  },
  {
    key: 'products-form',
    path: '/collections/products/create',
    caption: { de: 'Alle Daten: neues Stück (Formular)', en: 'All data: new piece (form)' },
    phase: 1,
    ref: 'KONZEPT §7.16',
  },
  { key: 'heute', path: '', caption: { de: 'Heute', en: 'Today' }, phase: 5, ref: 'KONZEPT §7.3' },
  {
    key: 'neues-stueck',
    path: '/neues-stueck',
    caption: { de: 'Neues Stück', en: 'New piece' },
    phase: 5,
    ref: 'KONZEPT §7.4',
  },
  {
    key: 'stuecke',
    path: '/stuecke',
    caption: { de: 'Meine Stücke', en: 'My pieces' },
    phase: 5,
    ref: 'KONZEPT §7.5',
  },
  {
    key: 'packen',
    path: '/packen',
    caption: { de: 'Zu packen', en: 'To pack' },
    phase: 5,
    ref: 'KONZEPT §7.6',
  },
  {
    key: 'vorkasse',
    path: '/vorkasse',
    caption: { de: 'Vorkasse offen', en: 'Awaiting bank transfer' },
    phase: 5,
    ref: 'KONZEPT §7.7',
  },
  {
    key: 'versendet',
    path: '/versendet',
    caption: { de: 'Versendet', en: 'Shipped' },
    phase: 5,
    ref: 'KONZEPT §7.8',
  },
  {
    key: 'abholung',
    path: '/abholung',
    caption: { de: 'Abholung', en: 'Pick-up' },
    phase: 5,
    ref: 'KONZEPT §7.9',
  },
  {
    key: 'widerrufe',
    path: '/widerrufe',
    caption: { de: 'Widerrufe', en: 'Withdrawals' },
    phase: 5,
    ref: 'KONZEPT §7.10',
  },
  {
    key: 'anfragen',
    path: '/anfragen',
    caption: { de: 'Anfragen (Auftragsarbeiten)', en: 'Requests (commissions)' },
    phase: 5,
    ref: 'KONZEPT §7.11',
  },
  {
    key: 'tattoo',
    path: '/tattoo',
    caption: { de: 'Tattoo', en: 'Tattoo' },
    phase: 7,
    ref: 'KONZEPT §7.12',
  },
  {
    key: 'texte',
    path: '/texte',
    caption: { de: 'Texte', en: 'Texts' },
    phase: 5,
    ref: 'KONZEPT §7.13',
  },
  {
    key: 'einstellungen',
    path: '/einstellungen',
    caption: { de: 'Einstellungen', en: 'Settings' },
    phase: 5,
    ref: 'KONZEPT §7.14',
  },
  {
    key: 'export',
    path: '/export',
    caption: { de: 'Export und Datenschutz-Werkzeuge', en: 'Export and privacy tools' },
    phase: 5,
    ref: 'KONZEPT §7.15',
  },
]
