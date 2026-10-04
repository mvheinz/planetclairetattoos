// Int-Tests laufen immer gegen DATABASE_URL_TEST (ARCHITEKTUR §7.2) – nie gegen die Entwicklungs-DB.
import 'dotenv/config'

import { baseStorageDir, workerDatabaseUrl, workerStorageDir } from './workers'

const baseUrl = process.env.DATABASE_URL_TEST
if (!baseUrl)
  throw new Error('DATABASE_URL_TEST fehlt – Int-Tests brauchen eine eigene Test-Datenbank.')
if (!new URL(baseUrl).pathname.endsWith('_test'))
  throw new Error('DATABASE_URL_TEST muss auf _test enden.')
// Paralleler Lauf (`PC_INT_WORKERS` > 1): eigene Datenbank und eigener Speicherordner (Upload-Dateien, Mail-Ausgang) je Worker (tests/int/setup/workers.ts).
const workerId = Number(process.env.VITEST_POOL_ID ?? '1') || 1
const testUrl = workerDatabaseUrl(baseUrl, workerId)
process.env.DATABASE_URL_TEST = testUrl
if (workerId > 1) {
  const storage = workerStorageDir(baseStorageDir(), workerId)
  process.env.STORAGE_LOCAL_DIR = storage
  process.env.EMAIL_FILE_DIR = `${storage}/mail-outbox`
}
process.env.DATABASE_URL = testUrl
process.env.DATABASE_URL_UNPOOLED = testUrl
process.env.PAYLOAD_DB_PUSH = 'false'
process.env.TZ = 'UTC'
