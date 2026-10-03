import type { Endpoint } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE } from '@/endpoints/adminResponse'
import { readJsonBody } from '@/endpoints/products/actions'
import { revalidateAll } from '@/lib/cache/revalidate'
import { ENUM_LABELS } from '@/lib/enumLabels'
import { createLogger } from '@/lib/monitoring/logger'
import { SeedGuardError } from '@/lib/seed/guard'
import { removeSeedData, seedSummary } from '@/lib/seed/remove'
import { SEED_REMOVE_LOCK_TEXT, seedRemovalLockedTypes } from '@/lib/seed/removeLock'
import { systemClock } from '@/lib/time'

// Beispieldaten in der Verwaltung (PLAN P8.19, KONZEPT §11.3, DATENMODELL §13.5, ARCHITEKTUR §2.5):
// `GET /api/admin/seed/summary` → `{ counts, total, locked: [Typen] }` (Anzahl `seed = true` je Collection);
// `POST /api/admin/seed/remove` `{ keepTexts = true, confirm: 'ENTFERNEN' }` → dieselbe Logik wie `pnpm seed:remove`,
// danach Revalidierung aller öffentlichen Seiten. Nur mit Admin-Sitzung (sonst 403); falsches Bestätigungswort → 400 ohne
// Wirkung; Sperre mit Platzhalter-Rechtstexten → 409 mit `lockedTypes`. Zweimal ausführbar (dann nichts zu tun).

export const SEED_REMOVE_CONFIRM_WORD = 'ENTFERNEN'

const log = createLogger()
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: ADMIN_NO_STORE })
const forbidden = () => json({ error: 'Nicht erlaubt.' }, 403)

const typeLabels = (types: readonly string[]) =>
  types.map(
    (t) => ENUM_LABELS.LEGAL_TEXT_TYPES[t as keyof typeof ENUM_LABELS.LEGAL_TEXT_TYPES]?.de ?? t,
  )

export const seedAdminEndpoints: Endpoint[] = [
  {
    path: '/admin/seed/summary',
    method: 'get',
    handler: async (req) => {
      if (!isAdminRequest(req)) return forbidden()
      const counts = await seedSummary(req.payload)
      const locked = await seedRemovalLockedTypes(req.payload, systemClock.now())
      return json({
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        locked,
        lockedLabels: typeLabels(locked),
      })
    },
  },
  {
    path: '/admin/seed/remove',
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) return forbidden()
      const body = await readJsonBody(req)
      if (body.confirm !== SEED_REMOVE_CONFIRM_WORD) {
        return json(
          { error: `Bitte zur Bestätigung „${SEED_REMOVE_CONFIRM_WORD}“ eintippen.` },
          400,
        )
      }
      const locked = await seedRemovalLockedTypes(req.payload, systemClock.now())
      if (locked.length > 0) {
        return json(
          {
            error: `${SEED_REMOVE_LOCK_TEXT} (${typeLabels(locked).join(', ')})`,
            code: 'legal_placeholder',
            lockedTypes: locked,
          },
          409,
        )
      }
      const keepTexts = body.keepTexts !== false
      try {
        const report = await removeSeedData(req.payload, { keepTexts, clock: systemClock })
        revalidateAll()
        const counts = Object.fromEntries(
          [...report.counts].map(([c, row]) => [c, { deleted: row.deleted, adopted: row.adopted }]),
        )
        log.info('seed.removed_by_admin', { keepTexts })
        return json({ doc: null, unchanged: report.counts.size === 0, keepTexts, counts })
      } catch (err) {
        if (err instanceof SeedGuardError) return json({ error: err.message }, 409)
        log.error('seed.remove_failed', { reason: (err as Error)?.message })
        return json({ error: 'Beispieldaten konnten nicht entfernt werden.' }, 500)
      }
    },
  },
]
