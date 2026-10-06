import { handleBackupCron } from '@/lib/backup/cron'

// Nächtliches Datenbank-Backup (ARCHITEKTUR §10.3): nur APP_ENV=production und BACKUP_ENABLED=true, sonst 404 ohne
// Datenbank; Bearer CRON_SECRET. Vercel Cron `30 1 * * *`.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export function GET(request: Request): Promise<Response> {
  return handleBackupCron(request)
}
