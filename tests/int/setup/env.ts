// Int-Tests laufen immer gegen DATABASE_URL_TEST (ARCHITEKTUR §7.2) – nie gegen die Entwicklungs-DB.
import 'dotenv/config'

const testUrl = process.env.DATABASE_URL_TEST
if (!testUrl)
  throw new Error('DATABASE_URL_TEST fehlt – Int-Tests brauchen eine eigene Test-Datenbank.')
if (!new URL(testUrl).pathname.endsWith('_test'))
  throw new Error('DATABASE_URL_TEST muss auf _test enden.')
process.env.DATABASE_URL = testUrl
process.env.DATABASE_URL_UNPOOLED = testUrl
process.env.PAYLOAD_DB_PUSH = 'false'
process.env.TZ = 'UTC'
