import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { de } from '@payloadcms/translations/languages/de'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Documents } from './collections/Documents'
import { PrivateUploads } from './collections/PrivateUploads'
import { Categories } from './collections/Categories'
import { ConformityDeclarations } from './collections/ConformityDeclarations'
import { Products } from './collections/Products'
import { Checkouts } from './collections/Checkouts'
import { Reservations } from './collections/Reservations'
import { Orders } from './collections/Orders'
import { Invoices } from './collections/Invoices'
import { InvoiceCounters } from './collections/InvoiceCounters'
import { Withdrawals } from './collections/Withdrawals'
import { LegalTexts } from './collections/LegalTexts'
import { Flash } from './collections/Flash'
import { TattooOffers } from './collections/TattooOffers'
import { TattooGallery } from './collections/TattooGallery'
import { Inquiries } from './collections/Inquiries'
import { Faqs } from './collections/Faqs'
import { Pages } from './collections/Pages'
import { RevenueEntries } from './collections/RevenueEntries'
import { PrivacyRequests } from './collections/PrivacyRequests'
import { AuditLog } from './collections/AuditLog'
import { ConsentLog } from './collections/ConsentLog'
import { DeletionLog } from './collections/DeletionLog'
import { EmailLog } from './collections/EmailLog'
import { WebhookEvents } from './collections/WebhookEvents'
import { Settings } from './globals/Settings'
import { SiteTexts } from './globals/SiteTexts'
import { withJsonPreview } from './admin/jsonPreview'
import { ADMIN_CUSTOM_DE } from './admin/translations'
import { isAdmin, isAdminRequest } from './access'
import { JOB_TASKS } from './jobs'
import { createMailTransport, parseMailFrom } from './lib/email'
import { getEnv } from './lib/env'
import { isCronAuthorized } from './lib/jobs/auth'
import { storagePlugins } from './lib/storage'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const env = getEnv()
const mailFrom = parseMailFrom(env.MAIL_FROM)

export default buildConfig({
  // Verwaltungspfad aus ADMIN_ROUTE (E-93): Links, Weiterleitungen und Passwort-Reset nutzen ihn; src/proxy.ts schreibt
  // ihn intern auf den Ordner app/(payload)/admin um (ARCHITEKTUR §8.4, Spike B-01).
  routes: { admin: env.ADMIN_ROUTE },
  admin: {
    user: Users.slug,
    // Kein Gravatar-Request (keine Drittanbieter-Requests, CLAUDE.md §6).
    avatar: 'default',
    importMap: {
      baseDir: path.resolve(dirname),
      // Ordner bleibt `admin/` (interner Mount-Punkt), auch wenn ADMIN_ROUTE anders heißt.
      importMapFile: path.resolve(dirname, 'app/(payload)/admin/importMap.js'),
    },
  },
  // JSON-/Code-Felder ohne Monaco (CDN) in der Verwaltung (ARCHITEKTUR §8.4).
  collections: [
    Users,
    Media,
    Documents,
    PrivateUploads,
    Categories,
    ConformityDeclarations,
    Products,
    Checkouts,
    Reservations,
    Orders,
    Invoices,
    InvoiceCounters,
    Withdrawals,
    LegalTexts,
    Flash,
    TattooOffers,
    TattooGallery,
    Inquiries,
    Faqs,
    Pages,
    RevenueEntries,
    PrivacyRequests,
    AuditLog,
    EmailLog,
    ConsentLog,
    WebhookEvents,
    DeletionLog,
  ].map((c) => ({ ...c, fields: withJsonPreview(c.fields) })),
  globals: [Settings, SiteTexts].map((g) => ({ ...g, fields: withJsonPreview(g.fields) })),
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
  // E-Mail über dieselbe Transport-Fabrik wie der Mail-Adapter (ARCHITEKTUR §3.4) – auch für Payloads eigene Mails.
  email: nodemailerAdapter({
    transport: createMailTransport(env),
    defaultFromAddress: mailFrom.address,
    defaultFromName: mailFrom.name || 'Planet Claire',
    skipVerify: true,
  }),
  // Jobs-Queue (DATENMODELL §11, ARCHITEKTUR §9.6): Hauptweg ist der Job-Wecker /api/cron/tick.
  jobs: {
    tasks: JOB_TASKS,
    access: {
      run: ({ req }) => isAdminRequest(req) || isCronAuthorized(req.headers, env),
      queue: ({ req }) => isAdminRequest(req),
      cancel: ({ req }) => isAdminRequest(req),
    },
    autoRun: env.JOBS_AUTORUN ? [{ cron: '* * * * *', allQueues: true, limit: 50 }] : [],
    shouldAutoRun: () => env.JOBS_AUTORUN,
    jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
      ...defaultJobsCollection,
      fields: withJsonPreview(defaultJobsCollection.fields),
      access: { ...defaultJobsCollection.access, read: isAdmin },
      admin: { ...defaultJobsCollection.admin, group: 'System', hidden: false },
    }),
  },
  plugins: [...storagePlugins(env)],
})
