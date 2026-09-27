import { postgresAdapter } from '@payloadcms/db-postgres'
import {
  buildConfig,
  getPayload,
  handleEndpoints,
  type Payload,
  type SanitizedConfig,
} from 'payload'
import pg from 'pg'

import { isAdmin } from '@/access'
import { parseEnv, type Env } from '@/lib/env'
import { storagePlugins, uploadStorage } from '@/lib/storage'

// Eigene Payload-Instanz für Speicher-Kontrakttests und Spike B-02 (ARCHITEKTUR §3.3): gleiche Speicher-Bausteine wie die
// App, aber mit eigener Umgebung (Treiber `local`/`s3`) und in einem eigenen Postgres-Schema, damit die Test-DB der
// Migrationen unberührt bleibt. `private-uploads` ist hier ein minimaler Stellvertreter (die echte Collection folgt in P1.14).

export interface StorageHarness {
  env: Env
  payload: Payload
  config: SanitizedConfig
  request(path: string, headers?: Record<string, string>): Promise<Response>
  adminHeaders(): Promise<Record<string, string>>
  close(): Promise<void>
}

const ADMIN = { email: 'speicher-test@example.com', password: 'speicher-test-2026' }

export async function createStorageHarness(
  key: string,
  overrides: Record<string, string>,
): Promise<StorageHarness> {
  const env = parseEnv({ ...process.env, ...overrides })
  const url = process.env.DATABASE_URL as string
  const schemaName = `harness_${key.replace(/[^a-z0-9_]/g, '_')}`
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
  await client.end()

  const config = await buildConfig({
    secret: env.PAYLOAD_SECRET,
    telemetry: false,
    graphQL: { disable: true },
    admin: { user: 'users' },
    collections: [
      { slug: 'users', auth: true, access: { read: isAdmin }, fields: [] },
      {
        slug: 'media',
        access: {
          read: ({ req }) => (req.user ? true : { restricted: { not_equals: true } }),
          create: isAdmin,
        },
        fields: [
          { name: 'alt', type: 'text' },
          { name: 'seed', type: 'checkbox', defaultValue: false },
          { name: 'restricted', type: 'checkbox', defaultValue: false },
        ],
        upload: { ...uploadStorage('media', env) },
      },
      {
        slug: 'documents',
        access: { read: () => true, create: isAdmin },
        fields: [{ name: 'title', type: 'text' }],
        upload: { ...uploadStorage('documents', env), mimeTypes: ['application/pdf'] },
      },
      {
        slug: 'private-uploads',
        access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
        fields: [{ name: 'note', type: 'text' }],
        upload: { ...uploadStorage('private', env) },
      },
    ],
    db: postgresAdapter({ pool: { connectionString: url, max: 3 }, schemaName, push: true }),
    plugins: storagePlugins(env),
  })
  // Jede Harness-Instanz hat ein eigenes Schema: Payloads Push-Cache (gleiche Tabellen) nicht greifen lassen.
  const previousForce = process.env.PAYLOAD_FORCE_DRIZZLE_PUSH
  process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'
  let payload: Payload
  try {
    payload = await getPayload({ config, key: `harness-${key}` })
  } finally {
    if (previousForce === undefined) delete process.env.PAYLOAD_FORCE_DRIZZLE_PUSH
    else process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = previousForce
  }
  await payload.create({ collection: 'users', data: ADMIN, overrideAccess: true })

  const request = (path: string, headers: Record<string, string> = {}) =>
    handleEndpoints({
      config,
      payloadInstanceCacheKey: `harness-${key}`,
      request: new Request(`http://localhost:3000/api${path}`, { headers }),
    })

  return {
    env,
    payload,
    config,
    request,
    async adminHeaders() {
      const res = await payload.login({ collection: 'users', data: ADMIN })
      return { Authorization: `JWT ${res.token}` }
    },
    async close() {
      await payload.destroy()
      const c = new pg.Client({ connectionString: url })
      await c.connect()
      await c.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
      await c.end()
    },
  }
}
