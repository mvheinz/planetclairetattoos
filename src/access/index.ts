import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

import { seedPreviewModeActive } from '@/lib/env'

// Zugriffsschutz „deny by default“ (DATENMODELL §1.4). Jede Collection setzt create/read/update/delete explizit.

/** Es gibt genau ein Konto (E-03): jede Anmeldung an `users` ist Admin. */
export function isAdminRequest(req: Pick<PayloadRequest, 'user'> | undefined): boolean {
  return req?.user?.collection === 'users'
}

export const isAdmin: Access = ({ req }) => isAdminRequest(req)

/**
 * Nur Admin und nur Dokumente, die `where` erfüllen (KONZEPT §7.16): Payload blendet damit in „Alle Daten“ z. B. den
 * Lösch-Knopf für veröffentlichte Stücke aus. Die `beforeDelete`-Wächter bleiben die eigentliche Sperre.
 */
export function adminWhere(where: Where): Access {
  return ({ req }) => (isAdminRequest(req) ? where : false)
}

/** Nur Server-Code über die Local API mit `overrideAccess: true`. */
export const none: Access = () => false

/** Seed-Filter für öffentliche Abfragen, solange SEED_PREVIEW_MODE nicht wirkt (§1.4 Regel 4). */
export const NOT_SEED: Where = { seed: { equals: false } }

/**
 * Öffentlich lesbar: Admin → `true`; sonst die Where-Query, ergänzt um `{ seed: { equals: false } }`, wenn der
 * Vorschau-Modus nicht wirkt (Wert ≠ 'true' oder APP_ENV=production).
 */
export function publicRead(where?: Where): Access {
  return ({ req }) => {
    if (isAdminRequest(req)) return true
    const clauses: Where[] = []
    if (where) clauses.push(where)
    if (!seedPreviewModeActive()) clauses.push(NOT_SEED)
    if (clauses.length === 0) return true
    if (clauses.length === 1) return clauses[0]!
    return { and: clauses }
  }
}

const adminFieldAccess: FieldAccess = ({ req }) => isAdminRequest(req)

/** Feldzugriff für interne Felder in öffentlich lesbaren Collections. */
export const adminField: { create: FieldAccess; read: FieldAccess; update: FieldAccess } = {
  create: adminFieldAccess,
  read: adminFieldAccess,
  update: adminFieldAccess,
}
