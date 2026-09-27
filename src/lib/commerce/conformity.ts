import 'server-only'

import type { PayloadRequest } from 'payload'

import { CONFORMITY_REVOKE_TRANSITION } from '@/collections/ConformityDeclarations'
import { enqueueEmail } from '@/lib/email/outbox'
import { getEnv } from '@/lib/env'
import { requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { formatItemNumber } from '@/lib/products/itemNumber'

import { transitionProduct } from './productTransitions'
import { TransitionError } from './transitionError'

// Widerruf einer Konformitätserklärung (DATENMODELL §6.6.6, §6.13, R-044) in einer Transaktion: Erklärung `revoked`;
// verknüpfte `available`-Stücke mit „lebensmittelecht“ ohne weitere gültige Erklärung gehen per Systemübergang P3
// (`unpublish`) offline und bekommen den Hinweis `conformity_revoked`; eine Mail `admin_alert` (A12) wird über die
// Outbox eingereiht. Audit schreiben die Hooks (`product_status_changed`), die Revalidierung läuft nach dem Speichern.

export interface RevokeResult {
  declarationId: number
  unpublished: number[]
  keptOnline: number[]
  emailLogId: number | null
}

const idOf = (v: unknown): number =>
  typeof v === 'object' && v !== null ? Number((v as { id: unknown }).id) : Number(v)

export async function revokeConformityDeclaration(
  req: PayloadRequest,
  declarationId: number,
): Promise<RevokeResult> {
  return inTransaction(req, async () => {
    const now = requestNow(req)
    const declaration = await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'conformity-declarations',
        id: declarationId,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )
    if (declaration.status === 'revoked')
      throw new TransitionError('Die Erklärung ist schon widerrufen.')
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'conformity-declarations',
        id: declarationId,
        data: { status: 'revoked' },
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, transition: CONFORMITY_REVOKE_TRANSITION },
      }),
    )

    const linked = await preservingReq(req, () =>
      req.payload.find({
        collection: 'products',
        where: {
          and: [
            { conformityDeclarations: { in: [declarationId] } },
            { foodContact: { equals: 'lebensmittelecht' } },
            { status: { equals: 'available' } },
          ],
        },
        pagination: false,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )
    const otherIds = [
      ...new Set(
        linked.docs
          .flatMap((p) => (p.conformityDeclarations ?? []).map(idOf))
          .filter((id) => id !== declarationId),
      ),
    ]
    const valid = otherIds.length
      ? await preservingReq(req, () =>
          req.payload.find({
            collection: 'conformity-declarations',
            where: {
              and: [
                { id: { in: otherIds } },
                { status: { equals: 'active' } },
                { validFrom: { less_than_equal: now.toISOString() } },
              ],
            },
            pagination: false,
            depth: 0,
            overrideAccess: true,
            req,
          }),
        )
      : { docs: [] }
    const validIds = new Set(valid.docs.map((d) => Number(d.id)))

    const unpublished: number[] = []
    const keptOnline: number[] = []
    const labels: string[] = []
    for (const product of linked.docs) {
      const others = (product.conformityDeclarations ?? [])
        .map(idOf)
        .filter((id) => id !== declarationId)
      if (others.some((id) => validIds.has(id))) {
        keptOnline.push(product.id)
        continue
      }
      await transitionProduct(req, product.id, 'unpublish', {
        actor: 'system',
        summary: `Konformitätserklärung „${declaration.name}“ widerrufen`,
        patch: {
          adminAttention: {
            flag: true,
            reason: 'conformity_revoked',
            note: `Erklärung „${declaration.name}“ widerrufen – Stück offline genommen. Bitte neue Erklärung verknüpfen oder auf „Deko“ umstellen.`.slice(
              0,
              500,
            ),
          },
        },
      })
      unpublished.push(product.id)
      labels.push(formatItemNumber(product.itemNumber, 'de'))
    }

    let emailLogId: number | null = null
    if (unpublished.length > 0) {
      const settings = req.payload.config.globals.some((g) => g.slug === 'settings')
        ? await preservingReq(req, () =>
            req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
          )
        : null
      const to = settings?.adminNotificationEmail || getEnv().ADMIN_NOTIFY_EMAIL
      const mail = await enqueueEmail(req, {
        template: 'admin_alert',
        to,
        locale: 'de',
        subject:
          `Konformitätserklärung widerrufen – ${unpublished.length} Stück(e) offline: ${labels.join(', ')}`.slice(
            0,
            200,
          ),
      })
      emailLogId = mail.emailLogId
    }
    return { declarationId, unpublished, keptOnline, emailLogId }
  })
}
