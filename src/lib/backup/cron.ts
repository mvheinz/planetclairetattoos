import 'server-only'

import { CopyObjectCommand } from '@aws-sdk/client-s3'
import { createLocalReq, getPayload, type Payload } from 'payload'

import { isCronAuthorized } from '@/lib/jobs/auth'
import { withTaskLock } from '@/lib/jobs/lock'
import { getEnv, type Env } from '@/lib/env'
import { logger } from '@/lib/monitoring/logger'
import { BACKUP_STATUS_KEY } from '@/lib/monitoring/freshness'
import { readJson, writeJson } from '@/lib/storage/systemFiles'
import { berlinMonthKey } from '@/lib/time'

import { monthlyKey } from './format'
import { runMirror, type MirrorResult } from './mirror'
import { runBackup, type BackupResult } from './run'
import { getBackupS3 } from './s3'
import {
  localSource,
  s3Source,
  s3Mirror,
  type MirrorArea,
  type MirrorStore,
  type SourceStore,
} from './stores'

// `GET /api/cron/backup` (ARCHITEKTUR §10.3): nur bei APP_ENV=production **und** BACKUP_ENABLED=true (sonst 404 ohne
// DB-Verbindung), Bearer CRON_SECRET (sonst 401), Advisory-Lock `backup`, danach Dump, Monatsstand (CopyObject) und
// Datei-Spiegel im verbleibenden Zeitbudget. `backup-status.json` über `systemFiles`; Fehler → A12 (gedrosselt) und Sentry.

export const BACKUP_LOCK = 'backup'
/** `maxDuration` der Route (Sekunden). */
export const BACKUP_MAX_DURATION_S = 300
/** Reserve am Ende des Zeitbudgets für Status und Antwort. */
const SAFETY_MS = 30_000

export interface BackupStatus {
  lastSuccessAt?: string
  key?: string
  sizeBytes?: number
  sha256?: string
  tables?: number
  rows?: number
  durationMs?: number
  lastMonthlyKey?: string | null
  mirror?: Omit<MirrorResult, 'bytes'> & { bytes: number }
  lastFailureAt?: string
  errorCode?: string
}

export interface BackupCronDeps {
  env?: Env
  now?: Date
  loadPayload?: () => Promise<Payload>
  /** Ersatz für den Dump (Tests). */
  dump?: (now: Date) => Promise<BackupResult>
  /** Ersatz für die Monatskopie (Tests). */
  copyMonthly?: (fromKey: string, toKey: string) => Promise<void>
  /** Ersatz für den Spiegel (Tests). */
  mirror?: (args: {
    now: Date
    budgetMs: number
    areas: MirrorArea[]
    skipKeys: Set<string>
  }) => Promise<MirrorResult>
  /** Messuhr in ms (Tests). */
  clock?: () => number
}

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Aktiv nur in Produktion mit gesetztem Schalter (§10.3). */
export const backupActive = (env: Pick<Env, 'APP_ENV' | 'BACKUP_ENABLED'>): boolean =>
  env.APP_ENV === 'production' && env.BACKUP_ENABLED === true

/** Fehlercode ohne Personendaten (nur Name der Fehlerklasse bzw. Postgres-/AWS-Code). */
export function errorCodeOf(e: unknown): string {
  const err = e as { code?: unknown; name?: unknown }
  const code =
    typeof err?.code === 'string' ? err.code : typeof err?.name === 'string' ? err.name : 'Error'
  return code.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 60) || 'Error'
}

async function defaultLoadPayload(): Promise<Payload> {
  const { default: config } = await import('@payload-config')
  return getPayload({ config })
}

/** Quell-Schlüssel mit `status = pending` (§10.4): werden nicht gespiegelt. */
async function pendingKeys(payload: Payload): Promise<Set<string>> {
  const res = await payload.find({
    collection: 'private-uploads',
    where: { status: { equals: 'pending' } },
    depth: 0,
    limit: 1000,
    pagination: false,
    overrideAccess: true,
  })
  const keys = new Set<string>()
  for (const d of res.docs as { prefix?: string | null; filename?: string | null }[]) {
    if (!d.filename) continue
    keys.add(`${d.prefix || 'private'}/${d.filename}`)
    keys.add(`private/${d.filename}`)
  }
  return keys
}

async function alertFailure(payload: Payload, code: string, now: Date): Promise<void> {
  try {
    const { notifyAdmin } = await import('@/lib/email/notifyAdmin')
    const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
    await notifyAdmin(
      req,
      'admin_alert',
      {
        kind: 'backup_failed',
        summary: 'Das nächtliche Backup ist fehlgeschlagen',
        automatic: 'Das Backup wird in der nächsten Nacht automatisch erneut versucht.',
        todo: 'Wenn diese Meldung wiederkommt, bitte im Betriebshandbuch unter „Backups“ nachsehen (Alarm M-04).',
        adminPath: '/globals/settings',
      },
      { now },
    )
  } catch (e) {
    logger.error('backup.alert_failed', { reason: (e as Error).message })
  }
}

export async function handleBackupCron(
  request: Request,
  deps: BackupCronDeps = {},
): Promise<Response> {
  const env = deps.env ?? getEnv()
  // Ohne Freigabe: 404, bevor irgendetwas die Datenbank berührt.
  if (!backupActive(env)) return json({ error: 'not_found' }, 404)
  if (!isCronAuthorized(request.headers, env)) return json({ error: 'unauthorized' }, 401)

  const now = deps.now ?? new Date()
  const clock = deps.clock ?? Date.now
  const started = clock()
  const payload = await (deps.loadPayload ?? defaultLoadPayload)()

  try {
    const locked = await withTaskLock(payload, BACKUP_LOCK, async () => {
      const backupS3 = deps.dump && deps.copyMonthly ? null : getBackupS3(env)
      const dumpResult = deps.dump
        ? await deps.dump(now)
        : await runBackup({
            connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL,
            recipient: env.BACKUP_AGE_RECIPIENT as string,
            appVersion: (env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7),
            now,
            target: { kind: 's3', ...backupS3! },
          })
      const status = (await readJson<BackupStatus>(BACKUP_STATUS_KEY)) ?? {}

      // Monatsstand: erster erfolgreicher Dump eines Berliner Kalendermonats (§10.3 Nr. 6).
      const monthKey = monthlyKey(berlinMonthKey(now))
      let lastMonthlyKey = status.lastMonthlyKey ?? null
      if (lastMonthlyKey !== monthKey) {
        if (deps.copyMonthly) await deps.copyMonthly(dumpResult.key, monthKey)
        else {
          const { client, bucket } = backupS3!
          await client.send(
            new CopyObjectCommand({
              Bucket: bucket,
              Key: monthKey,
              CopySource: `${bucket}/${dumpResult.key.split('/').map(encodeURIComponent).join('/')}`,
            }),
          )
        }
        lastMonthlyKey = monthKey
      }

      // Datei-Spiegel im verbleibenden Zeitbudget; Medien nur sonntags (Berlin).
      const areas: MirrorArea[] = ['private']
      if (new Date(now.getTime() + 2 * 3600_000).getUTCDay() === 0) areas.push('media')
      const budgetMs = BACKUP_MAX_DURATION_S * 1000 - SAFETY_MS - (clock() - started)
      const skipKeys = await pendingKeys(payload)
      let mirror: MirrorResult | undefined
      if (budgetMs > 0) {
        mirror = deps.mirror
          ? await deps.mirror({ now, budgetMs, areas, skipKeys })
          : await runMirror({
              source:
                env.STORAGE_DRIVER === 's3' ? s3Source(env) : (localSource(env) as SourceStore),
              mirror: s3Mirror(backupS3!.client, backupS3!.bucket) as MirrorStore,
              recipient: env.BACKUP_AGE_RECIPIENT as string,
              areas,
              now,
              budgetMs,
              skipKeys,
              clock,
            })
      }

      const next: BackupStatus = {
        lastSuccessAt: now.toISOString(),
        key: dumpResult.key,
        sizeBytes: dumpResult.sizeBytes,
        sha256: dumpResult.sha256,
        tables: dumpResult.tables,
        rows: dumpResult.rows,
        durationMs: dumpResult.durationMs,
        lastMonthlyKey,
        ...(mirror ? { mirror } : {}),
      }
      await writeJson(BACKUP_STATUS_KEY, next)
      return next
    })
    if (locked.status === 'locked') return json({ status: 'locked' }, 200)
    return json({ status: 'ok', key: locked.result.key, sizeBytes: locked.result.sizeBytes }, 200)
  } catch (e) {
    const code = errorCodeOf(e)
    logger.error('backup.failed', { code })
    try {
      const prev = (await readJson<BackupStatus>(BACKUP_STATUS_KEY)) ?? {}
      await writeJson(BACKUP_STATUS_KEY, {
        ...prev,
        lastFailureAt: now.toISOString(),
        errorCode: code,
      })
    } catch {
      // Status ist nur Anzeige; der Alarm unten ist wichtiger.
    }
    await alertFailure(payload, code, now)
    // Sentry (P10.10) meldet über `onRequestError`/Logger; hier kein eigener Import.
    return json({ status: 'failed', errorCode: code }, 500)
  }
}
