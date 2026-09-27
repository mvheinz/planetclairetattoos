import type { PayloadRequest, RequestContext } from 'payload'

import { systemClock } from '@/lib/time'

// Kontext-Flags für Hooks (DATENMODELL §1.5). Typisiert über die Payload-Erweiterung `RequestContext`.
export interface AppContext {
  /** Aufruf aus Server-Code (Webhook, Job, Service); erlaubt Systemübergänge. */
  system?: boolean
  /** Statuswechsel über den zugehörigen Service; ohne dieses Flag lehnt `beforeChange` jede `status`-Änderung ab. */
  transition?: string
  /** Seed-Import/-Entfernung: keine Mails, Jobs, Revalidierung, kein Audit (SEED-SPEC §1.6). */
  seed?: boolean
  /** Nur für Audit-/Log-Collections selbst (Endlosschleifen vermeiden). */
  skipAudit?: boolean
  /** Schreibvorgang durch den Übersetzen-Knopf (`enStatus = machine`). */
  translation?: boolean
  /** Injizierte Zeit für Jobs (ISO 8601), z. B. aus `pnpm jobs:run <task> --now=<ISO>` (A-08). */
  now?: string
}

declare module 'payload' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface RequestContext extends AppContext {}
}

/** Liest die Flags aus einem Request (fehlender Kontext = keine Flags). */
export function getAppContext(req: Pick<PayloadRequest, 'context'> | undefined): AppContext {
  return (req?.context ?? {}) as AppContext
}

/**
 * Optionen für einen Systemaufruf über die Local API im selben Request/derselben Transaktion:
 * `payload.update({ collection, id, data, ...withSystem(req, 'P3') })`.
 */
export function withSystem(
  req: PayloadRequest,
  transition?: string,
): { context: RequestContext; overrideAccess: true; req: PayloadRequest } {
  const context: RequestContext = { ...req.context, system: true }
  if (transition !== undefined) context.transition = transition
  return { context, overrideAccess: true, req }
}

/** Aktuelle Zeit eines Requests: injiziert über `req.context.now` (Tests, Jobs), sonst Systemuhr (A-08). */
export function requestNow(req: Pick<PayloadRequest, 'context'> | undefined): Date {
  const iso = getAppContext(req).now
  if (iso) {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) return d
  }
  return systemClock.now()
}
