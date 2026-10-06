import type { Endpoint } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE } from '@/endpoints/adminResponse'
import { readJsonBody } from '@/endpoints/products/actions'
import { runPostRestore } from '@/lib/backup/postRestore'
import { getEnv } from '@/lib/env'
import { createLogger } from '@/lib/monitoring/logger'
import { systemClock } from '@/lib/time'

// „Nach Wiederherstellung abgleichen“ (ARCHITEKTUR §10.5 Schritt 6 a–d, PLAN P10.9): `POST /api/admin/post-restore`
// `{ backupCreatedAt: <ISO>, confirm: 'ABGLEICHEN' }`. Nur mit Admin-Sitzung (403) und nur im Wartungsmodus (409), damit
// sich nicht versehentlich im laufenden Betrieb Daten ändern. Idempotent: ein zweiter Lauf findet nichts mehr.

export const POST_RESTORE_CONFIRM_WORD = 'ABGLEICHEN'

const log = createLogger()
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: ADMIN_NO_STORE })

export const postRestoreEndpoints: Endpoint[] = [
  {
    path: '/admin/post-restore',
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) return json({ error: 'Nicht erlaubt.' }, 403)
      if (!getEnv().MAINTENANCE_MODE) {
        return json({ error: 'Nur im Wartungsmodus möglich (MAINTENANCE_MODE=true).' }, 409)
      }
      const body = await readJsonBody(req)
      if (body.confirm !== POST_RESTORE_CONFIRM_WORD) {
        return json(
          { error: `Bitte zur Bestätigung „${POST_RESTORE_CONFIRM_WORD}“ eintippen.` },
          400,
        )
      }
      const created = new Date(String(body.backupCreatedAt ?? ''))
      if (Number.isNaN(created.getTime())) {
        return json({ error: 'Bitte den Zeitpunkt des Backups angeben (Datum und Uhrzeit).' }, 400)
      }
      try {
        const report = await runPostRestore(req.payload, {
          backupCreatedAt: created,
          now: systemClock.now(),
        })
        return json({ ok: true, report })
      } catch (e) {
        log.error('postRestore.failed', { reason: (e as Error).name })
        return json({ error: 'Der Abgleich ist fehlgeschlagen. Bitte noch einmal versuchen.' }, 500)
      }
    },
  },
]
