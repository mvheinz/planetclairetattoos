import type { CollectionSlug, GlobalSlug, Where } from 'payload'

import { PUBLIC_PRODUCT_WHERE } from '@/collections/Products'
import { GALLERY_PUBLIC_WHERE } from '@/lib/tattoo/gallery'

// T-15 / DM-P1-03: Zugriffsmatrix aller Collections und Globals für anonyme REST-Aufrufe (DATENMODELL §1.4 und die
// „Access“-Abschnitte je Collection in §6/§7). Der Test `access-matrix.int.spec.ts` prüft jeden Eintrag gegen den
// laufenden REST-Handler und scheitert, wenn eine Collection bzw. ein Global aus `payload.config` hier fehlt.
// `legal-snippets` und `complaints` ergänzt P6 (DATENMODELL §10.1) – dann hier eintragen.

export interface PublicContext {
  /** Serverzeit der Anfrage (für zeitabhängige Filter wie `tattoo-offers.endsAt`). */
  now: Date
  /** `SEED_PREVIEW_MODE` wirksam (DATENMODELL §1.4 Regel 4). */
  preview: boolean
}

export type AnonRead =
  /** GET liefert 403. */
  | { kind: 'deny' }
  /** GET liefert 200, gefiltert (`null` = alle Dokumente). */
  | { kind: 'public'; where: (ctx: PublicContext) => Where | null }

export interface CollectionAccessEntry {
  /** Anonym `GET /api/<slug>` (Liste und Einzelabruf). */
  get: AnonRead
  /** Anonym `POST /api/<slug>`: immer 403; `users` nur, solange noch kein Konto existiert (Ersteinrichtung). */
  post: 'deny' | 'firstAccountOnly'
  /** Anonym `PATCH /api/<slug>/<id>`. */
  patch: 'deny'
  /** Anonym `DELETE /api/<slug>/<id>`. */
  delete: 'deny'
  /** Felder, die öffentlich nie ausgegeben werden (`adminField` bzw. Feld-`read: false`), als Datenpfade. */
  hiddenFields: readonly string[]
}

export interface GlobalAccessEntry {
  /** Anonym `GET /api/globals/<slug>`. */
  get: 'deny' | 'public'
  /** Anonym `POST /api/globals/<slug>` (Aktualisieren). */
  post: 'deny'
}

const NOT_SEED: Where = { seed: { equals: false } }

/** `publicRead(where)`: Where-Filter plus Seed-Filter, solange die Vorschau nicht wirkt (§1.4 Regel 4). */
const publicRead =
  (where?: Where) =>
  ({ preview }: PublicContext): Where | null => {
    const clauses = [...(where ? [where] : []), ...(preview ? [] : [NOT_SEED])]
    if (clauses.length === 0) return null
    return clauses.length === 1 ? clauses[0]! : { and: clauses }
  }

const deny: CollectionAccessEntry = {
  get: { kind: 'deny' },
  post: 'deny',
  patch: 'deny',
  delete: 'deny',
  hiddenFields: [],
}

const pub = (
  where: (ctx: PublicContext) => Where | null,
  hiddenFields: readonly string[] = [],
): CollectionAccessEntry => ({
  get: { kind: 'public', where },
  post: 'deny',
  patch: 'deny',
  delete: 'deny',
  hiddenFields,
})

export const COLLECTION_ACCESS: Record<CollectionSlug, CollectionAccessEntry> = {
  // §6.1: create nur ohne Konto; read/update eigenes Konto; delete none
  users: { ...deny, post: 'firstAccountOnly' },
  // §6.2: nicht gesperrte Bilder (+ Seed-Filter); P8 ergänzt showsPerson/ownerApproved
  media: pub(publicRead({ restricted: { not_equals: true } })),
  // §6.3: öffentlich (+ Seed-Filter)
  documents: pub(publicRead()),
  // §6.4: alles isAdmin (R-136)
  'private-uploads': deny,
  // §6.5: öffentlich ohne Seed-Filter (Grund-Seed)
  categories: pub(() => null),
  // §6.13: aktive Erklärungen; Laborangaben intern
  'conformity-declarations': pub(publicRead({ status: { equals: 'active' } }), [
    'labName',
    'labReport',
    'notes',
  ]),
  // §6.6: frei/reserviert bzw. verkauft im Archiv; interne Felder per adminField
  products: pub(publicRead(PUBLIC_PRODUCT_WHERE), [
    'blankBrandVisible',
    'nickelEvidence',
    'customs',
    'offlineSaleNote',
    'reservationRef',
    'currentOrder',
    'storageLocation',
    'internalNote',
    'adminAttention',
    // Übersetzungsstand (EN-Status, P1.19)
    'i18n',
  ]),
  // §6.7, §6.25: Kassen/Reservierungen nur Services
  checkouts: deny,
  reservations: deny,
  // §6.8–§6.11: Bestellungen, Belege, Zähler, Widerrufe
  orders: deny,
  invoices: deny,
  'invoice-counters': deny,
  withdrawals: deny,
  // §6.12: aktive und abgelöste Fassungen (+ Seed-Filter)
  'legal-texts': pub(publicRead({ status: { in: ['active', 'superseded'] } })),
  // §6.14: veröffentlichte Motive
  flash: pub(publicRead({ published: { equals: true } })),
  // §6.15: veröffentlicht und noch nicht beendet
  'tattoo-offers': pub(({ now, preview }) => ({
    and: [
      { published: { equals: true } },
      { endsAt: { greater_than: now.toISOString() } },
      ...(preview ? [] : [NOT_SEED]),
    ],
  })),
  // §6.16: veröffentlicht und (kein Kundenfoto oder Einwilligung); Vorschau zeigt veröffentlichte Seed-Einträge
  'tattoo-gallery': pub(
    ({ preview }): Where =>
      preview
        ? {
            or: [
              GALLERY_PUBLIC_WHERE,
              { and: [{ published: { equals: true } }, { seed: { equals: true } }] },
            ],
          }
        : { and: [GALLERY_PUBLIC_WHERE, NOT_SEED] },
    [
      'consentScope',
      'consentDate',
      'consentNote',
      'consentEvidence',
      'consentWithdrawnAt',
      'creditHandleAllowed',
    ],
  ),
  // §6.17: Anfragen nur über das Formular (Local API)
  inquiries: deny,
  // §6.18: veröffentlichte Fragen
  faqs: pub(publicRead({ published: { equals: true } })),
  // §6.19: veröffentlichte Fassung
  pages: pub(publicRead({ _status: { equals: 'published' } })),
  // §6.20, §6.26: intern
  'revenue-entries': deny,
  'privacy-requests': deny,
  // §6.21–§6.24, §6.27: Protokolle
  'audit-log': deny,
  'email-log': deny,
  'consent-log': deny,
  'webhook-events': deny,
  'deletion-log': deny,
} as Record<CollectionSlug, CollectionAccessEntry>

export const GLOBAL_ACCESS: Record<GlobalSlug, GlobalAccessEntry> = {
  // §7.1: nur über getPublicSettings() mit Feld-Whitelist
  settings: { get: 'deny', post: 'deny' },
  // §7.2: öffentlich lesbar
  'site-texts': { get: 'public', post: 'deny' },
} as Record<GlobalSlug, GlobalAccessEntry>
