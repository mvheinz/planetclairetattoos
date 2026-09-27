import { handleEndpoints, type CollectionConfig, type Payload, type SanitizedConfig } from 'payload'

import { isAdmin } from '@/access'
import { parseEnv, type Env } from '@/lib/env'
import { storagePlugins, uploadStorage } from '@/lib/storage'

import { createIsolatedPayload } from './isolatedPayload'

// Eigene Payload-Instanz für Speicher-Kontrakttests und Spike B-02 (ARCHITEKTUR §3.3): gleiche Speicher-Bausteine wie die
// App, aber mit eigener Umgebung (Treiber `local`/`s3`). `private-uploads` ist ein minimaler Stellvertreter, außer der
// Test übergibt die echte Collection (`options.privateUploads`, dann mit dem Speicher dieser Umgebung).

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
  options: { privateUploads?: CollectionConfig } = {},
): Promise<StorageHarness> {
  const env = parseEnv({ ...process.env, ...overrides })
  const iso = await createIsolatedPayload(`storage_${key}`, {
    secret: env.PAYLOAD_SECRET,
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
      options.privateUploads
        ? {
            ...options.privateUploads,
            upload: {
              ...(options.privateUploads.upload as object),
              ...uploadStorage('private', env),
            },
          }
        : {
            slug: 'private-uploads',
            access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
            fields: [{ name: 'note', type: 'text' }],
            upload: { ...uploadStorage('private', env) },
          },
    ],
    plugins: storagePlugins(env),
  })
  const { payload, config, cacheKey } = iso
  await payload.create({ collection: 'users', data: ADMIN as never, overrideAccess: true })

  return {
    env,
    payload,
    config,
    request: (path, headers = {}) =>
      handleEndpoints({
        config,
        payloadInstanceCacheKey: cacheKey,
        request: new Request(`http://localhost:3000/api${path}`, { headers }),
      }),
    async adminHeaders() {
      const res = await payload.login({ collection: 'users', data: ADMIN })
      return { Authorization: `JWT ${res.token}` }
    },
    close: () => iso.close(),
  }
}
