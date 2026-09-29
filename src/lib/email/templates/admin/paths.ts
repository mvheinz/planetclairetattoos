import 'server-only'

import { adminViewPath } from '@/admin/views/registry'

// Direktlinks der Verwaltungs-Mails (KONZEPT §6.4): Pfade unterhalb von `ADMIN_ROUTE`, an einer Stelle gesammelt. Wo
// es eine eigene Ansicht gibt, kommt der Pfad aus der Ansichten-Registry (PLAN P5.1); solange eine Ansicht noch
// Platzhalter ist, führt sie mit einem Link in „Alle Daten“ weiter. Ohne eigene Ansicht (Datenschutz-Anfragen bis
// P6.16, Bestell-Liste, Dateiablage) zeigen die Links auf die Standard-Ansichten („Alle Daten“).

export const ADMIN_MAIL_PATHS = {
  order: (id: number) => adminViewPath('bestellung', id),
  withdrawal: (id: number) => adminViewPath('widerruf', id),
  withdrawals: () => adminViewPath('widerrufe'),
  inquiry: (id: number) => adminViewPath('anfrage', id),
  legalTexts: () => adminViewPath('texte'),
  exports: () => adminViewPath('export'),
  privacyRequest: (id: number) => `/collections/privacy-requests/${id}`,
  orders: () => '/collections/orders',
  privateUploads: () => '/collections/private-uploads',
  settings: () => adminViewPath('einstellungen'),
} as const
