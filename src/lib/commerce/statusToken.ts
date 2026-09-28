import 'server-only'

import type { PayloadRequest } from 'payload'

import { writeAudit } from '@/lib/audit'
import { logger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { createToken, hashToken, matchesHash, sealToken, unsealToken } from '@/lib/security/tokens'

// Status-Link der Bestellung (DATENMODELL §6.8.2, ARCHITEKTUR §8.6, R-067, DM-36): zufälliger Token, gespeichert als
// Hash (Suche) und Siegel (damit jede spätere Kund:innen-Mail denselben Link enthält). Lässt sich das Siegel nicht
// öffnen (z. B. nach Tausch von PAYLOAD_SECRET), wird wie bei „Statuslink neu senden“ ein neuer Token erzeugt –
// außer bei Seed-Bestellungen, die nie automatisch rotiert werden. Der Klartext steht nie in DB oder Log.

export interface IssuedStatusToken {
  /** Klartext nur für Mail-Daten und Danke-Seite im Speicher – nie speichern, nie loggen. */
  token: string
  fields: {
    statusTokenHash: string
    statusTokenSealed: string
    statusTokenIssuedAt: string
  }
}

/** Neuer Status-Token mit den zu speichernden Feldern (Hash, Siegel, Ausstellungszeit). */
export function issueStatusToken(now: Date): IssuedStatusToken {
  const token = createToken()
  return {
    token,
    fields: {
      statusTokenHash: hashToken(token),
      statusTokenSealed: sealToken(token),
      statusTokenIssuedAt: now.toISOString(),
    },
  }
}

export type StatusTokenRotationReason = 'resend' | 'seal_unreadable'

const REASON_TEXT: Record<StatusTokenRotationReason, string> = {
  resend: 'Statuslink neu gesendet',
  seal_unreadable: 'Siegel nicht lesbar, neuer Status-Link erzeugt',
}

/**
 * Ersetzt Hash und Siegel durch einen neuen Zufallstoken (`context.transition = 'rotateToken'`, Audit
 * `order_status_link_rotated`) und gibt den Klartext zurück. Der alte Link wird ungültig.
 */
export async function rotateStatusToken(
  req: PayloadRequest,
  orderId: number,
  { now, reason }: { now: Date; reason: StatusTokenRotationReason },
): Promise<string> {
  return inTransaction(req, async () => {
    const issued = issueStatusToken(now)
    const order = await preservingReq(req, () =>
      req.payload.update({
        collection: 'orders',
        id: orderId,
        data: issued.fields as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: {
          ...req.context,
          system: true,
          transition: 'rotateToken',
          now: now.toISOString(),
        },
      }),
    )
    await writeAudit(req, {
      action: 'order_status_link_rotated',
      entityCollection: 'orders',
      entityId: orderId,
      summary: `Bestellung ${order.orderNumber}: ${REASON_TEXT[reason]}`,
    })
    return issued.token
  })
}

/**
 * Status-Token für die gerade entstehende Kund:innen-Mail: entsiegelt `statusTokenSealed` und prüft ihn gegen
 * `statusTokenHash`. Scheitert das, wird rotiert (neuer Hash + Siegel, Audit) – bei `seed = true` nie (`null`).
 * Ohne Hash (nach Stufe B oder Anonymisierung) gibt es keinen Link mehr (`null`).
 */
export async function statusTokenForMail(
  req: PayloadRequest,
  orderId: number,
  { now }: { now: Date },
): Promise<string | null> {
  const order = await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
      req,
      select: { seed: true, statusTokenHash: true, statusTokenSealed: true },
    }),
  )
  const hash = order.statusTokenHash
  if (!hash) return null
  if (order.statusTokenSealed) {
    try {
      const token = unsealToken(order.statusTokenSealed)
      if (matchesHash(token, hash)) return token
    } catch {
      // unten: rotieren bzw. bei Seed-Bestellungen nichts tun
    }
  }
  if (order.seed) {
    logger.warn('status_token_unreadable', { orderId, seed: true, rotated: false })
    return null
  }
  logger.warn('status_token_unreadable', { orderId, rotated: true })
  return rotateStatusToken(req, orderId, { now, reason: 'seal_unreadable' })
}
