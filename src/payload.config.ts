import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { de } from '@payloadcms/translations/languages/de'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { ADMIN_CUSTOM_DE } from './admin/translations'
import { getEnv } from './lib/env'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const env = getEnv()

export default buildConfig({
  admin: {
    user: Users.slug,
    // Kein Gravatar-Request (keine Drittanbieter-Requests, CLAUDE.md §6).
    avatar: 'default',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media],
  editor: lexicalEditor(),
  // DATENMODELL §1.2 (E-60, E-61): fehlendes EN zeigt DE.
  localization: {
    locales: [
      { code: 'de', label: 'Deutsch' },
      { code: 'en', label: 'English' },
    ],
    defaultLocale: 'de',
    fallback: true,
  },
  // Admin-Oberfläche nur Deutsch (DATENMODELL §1.2).
  i18n: {
    supportedLanguages: { de },
    fallbackLanguage: 'de',
    translations: { de: { custom: ADMIN_CUSTOM_DE } },
  },
  // GraphQL ist abgeschaltet (DATENMODELL §1.4 Regel 5, ARCHITEKTUR §2.5).
  graphQL: { disable: true },
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // DATENMODELL §10: Schema nur über Migrationen; Push nur lokal auf einer Wegwerf-Datenbank.
  db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URL,
      max: env.DB_POOL_MAX,
    },
    push: env.PAYLOAD_DB_PUSH && env.APP_ENV === 'development',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  plugins: [],
})
