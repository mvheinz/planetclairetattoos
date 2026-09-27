import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig, getPayload, type Config, type Payload, type SanitizedConfig } from 'payload'
import pg from 'pg'

// Eigene Payload-Instanz für Kontrakttests und Spikes: eigene Konfiguration in einem eigenen Postgres-Schema der
// Test-DB (Schema per Push, nicht per Migration), damit die migrierte Test-DB unberührt bleibt. Nach dem Test `close()`.

export interface IsolatedPayload {
  payload: Payload
  config: SanitizedConfig
  cacheKey: string
  close(): Promise<void>
}

async function dropSchema(url: string, schemaName: string): Promise<void> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
  } finally {
    await client.end()
  }
}

export async function createIsolatedPayload(
  key: string,
  config: Omit<Config, 'db'> & { secret: string },
): Promise<IsolatedPayload> {
  const url = process.env.DATABASE_URL as string
  const schemaName = `harness_${key.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`
  await dropSchema(url, schemaName)
  const built = await buildConfig({
    telemetry: false,
    graphQL: { disable: true },
    ...config,
    db: postgresAdapter({ pool: { connectionString: url, max: 3 }, schemaName, push: true }),
  })
  const cacheKey = `harness-${key}`
  // Jede Instanz hat ein eigenes Schema: Payloads Push-Cache (gleiche Tabellen) darf den Push nicht auslassen.
  const previousForce = process.env.PAYLOAD_FORCE_DRIZZLE_PUSH
  process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'
  let payload: Payload
  try {
    payload = await getPayload({ config: built, key: cacheKey })
  } finally {
    if (previousForce === undefined) delete process.env.PAYLOAD_FORCE_DRIZZLE_PUSH
    else process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = previousForce
  }
  return {
    payload,
    config: built,
    cacheKey,
    async close() {
      await payload.destroy()
      await dropSchema(url, schemaName)
    },
  }
}
