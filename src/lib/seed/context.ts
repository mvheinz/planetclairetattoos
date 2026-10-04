import 'server-only'

import { createLocalReq, type Payload, type PayloadRequest, type RequestContext } from 'payload'

import { inTransaction } from '@/lib/payload/transaction'

// Seed-Kontext (SEED-SPEC §1.6, DATENMODELL §1.5): alle Schreibvorgänge über die Local API mit `overrideAccess: true`
// und `{ seed: true, skipAudit: true }` – keine Mails, Jobs, Revalidierung, kein Audit, keine Stripe-/DeepL-Aufrufe.

/** Neuer Kontext je Aufruf (Payload verändert übergebene Kontexte). */
export function seedContext(): RequestContext {
  return { seed: true, skipAudit: true }
}

/** Gemeinsame Optionen eines Seed-Schreibvorgangs in der Transaktion von `req`. */
export function seedOp(req: PayloadRequest): {
  req: PayloadRequest
  overrideAccess: true
  context: RequestContext
  depth: 0
} {
  return { req, overrideAccess: true, context: seedContext(), depth: 0 }
}

/**
 * Ein Import-Schritt = eine Transaktion (SEED-SPEC §1.7). Mit `now` sehen die Hooks `N` als aktuelle Zeit
 * (`requestNow`, z. B. „Eingang nicht in der Zukunft“ bei Reklamationen), unabhängig von der Uhr des Rechners.
 */
export async function seedStep<T>(
  payload: Payload,
  fn: (req: PayloadRequest) => Promise<T>,
  now?: Date,
): Promise<T> {
  const context = now ? { ...seedContext(), now: now.toISOString() } : seedContext()
  const req = await createLocalReq({ context }, payload)
  return inTransaction(req, () => fn(req))
}
