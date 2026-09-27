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

/** Ein Import-Schritt = eine Transaktion (SEED-SPEC §1.7). */
export async function seedStep<T>(
  payload: Payload,
  fn: (req: PayloadRequest) => Promise<T>,
): Promise<T> {
  const req = await createLocalReq({ context: seedContext() }, payload)
  return inTransaction(req, () => fn(req))
}
