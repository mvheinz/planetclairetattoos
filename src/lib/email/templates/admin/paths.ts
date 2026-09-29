import 'server-only'

// Direktlinks der Verwaltungs-Mails (KONZEPT §6.4): Pfade unterhalb von `ADMIN_ROUTE`, an einer Stelle gesammelt.
// Bis die Ansichten-Registry `src/admin/views/registry.ts` (P5.1) steht, zeigen die Links auf die Standard-Ansichten
// („Alle Daten“) – sie funktionieren damit heute schon. P5.1 stellt hier auf die eigenen Ansichten um
// (`/bestellungen/:id`, `/widerrufe/:id`, `/anfragen/:id`, `/texte`, `/export`, `/einstellungen`).

export const ADMIN_MAIL_PATHS = {
  order: (id: number) => `/collections/orders/${id}`,
  withdrawal: (id: number) => `/collections/withdrawals/${id}`,
  withdrawals: () => '/collections/withdrawals',
  inquiry: (id: number) => `/collections/inquiries/${id}`,
  legalTexts: () => '/collections/legal-texts',
  exports: () => '/collections/private-uploads',
  privacyRequest: (id: number) => `/collections/privacy-requests/${id}`,
  orders: () => '/collections/orders',
  privateUploads: () => '/collections/private-uploads',
  settings: () => '/globals/settings',
} as const
