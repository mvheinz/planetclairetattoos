import 'server-only'

// ERZEUGT von scripts/legal/gen-services.ts aus docs/recht/DIENSTE.md §7 – nicht von Hand ändern (pnpm legal:services).
// Quelle für Einstellungen → „Auftragsverarbeitung“ (R-155), die Auftragsverarbeiter-Tabelle unter der
// Datenschutzerklärung (`ProcessorTable`, kein Token) und den CSP-Abgleich (T-16, R-131).

export type ServiceRole = 'processor' | 'controller' | 'processorAndController' | 'none'
export type ServiceAvv = 'required' | 'coveredBy' | 'notRequired' | 'notAvailable'
export type ServiceThirdCountry = 'US' | 'EU' | 'none'
export type ServiceCspContext = 'public' | 'dynamic' | 'checkout' | 'admin' | 'api'

export interface ServiceEntry {
  id: string
  name: string
  seat: { de: string; en: string }
  role: ServiceRole
  avv: ServiceAvv
  avvCoveredBy: string | null
  production: boolean
  personalData: 'yes' | 'minimal' | 'no'
  thirdCountry: ServiceThirdCountry
  activeFrom: string
  driverEnv: string | null
  csp: Partial<Record<ServiceCspContext, Record<string, readonly string[]>>>
  serverHosts: readonly string[]
}

export const SERVICES_YAML_VERSION = 1

export const SERVICES: readonly ServiceEntry[] = [
  {
    id: 'vercel',
    name: 'Vercel (Hosting, CDN, Funktionen, Cron)',
    seat: {
      de: 'Covina (CA), USA',
      en: 'Covina (CA), USA',
    },
    role: 'processor',
    avv: 'required',
    production: true,
    personalData: 'yes',
    thirdCountry: 'US',
    activeFrom: 'P11',
    driverEnv: null,
    csp: {},
    serverHosts: [],
    avvCoveredBy: null,
  },
  {
    id: 'vercelAnalytics',
    name: 'Vercel Web Analytics',
    seat: {
      de: 'Covina (CA), USA',
      en: 'Covina (CA), USA',
    },
    role: 'processor',
    avv: 'coveredBy',
    avvCoveredBy: 'vercel',
    production: false,
    personalData: 'minimal',
    thirdCountry: 'US',
    activeFrom: 'P11',
    driverEnv: 'NEXT_PUBLIC_ANALYTICS_ENABLED',
    csp: {},
    serverHosts: [],
  },
  {
    id: 'neon',
    name: 'Neon Postgres (aws-eu-central-1)',
    seat: {
      de: 'San Francisco, USA; Daten in Frankfurt',
      en: 'San Francisco, USA; data in Frankfurt',
    },
    role: 'processor',
    avv: 'required',
    production: true,
    personalData: 'yes',
    thirdCountry: 'US',
    activeFrom: 'P11',
    driverEnv: 'DATABASE_URL',
    csp: {},
    serverHosts: ['*.eu-central-1.aws.neon.tech'],
    avvCoveredBy: null,
  },
  {
    id: 'cloudflareR2',
    name: 'Cloudflare R2 (EU-Jurisdiktion)',
    seat: {
      de: 'San Francisco, USA; EU-Jurisdiktion',
      en: 'San Francisco, USA; EU jurisdiction',
    },
    role: 'processor',
    avv: 'required',
    production: true,
    personalData: 'yes',
    thirdCountry: 'US',
    activeFrom: 'P11',
    driverEnv: 'STORAGE_DRIVER',
    csp: {},
    serverHosts: ['*.eu.r2.cloudflarestorage.com'],
    avvCoveredBy: null,
  },
  {
    id: 'stripe',
    name: 'Stripe Payments Europe',
    seat: {
      de: 'Dublin, Irland',
      en: 'Dublin, Ireland',
    },
    role: 'processorAndController',
    avv: 'required',
    production: true,
    personalData: 'yes',
    thirdCountry: 'US',
    activeFrom: 'P11',
    driverEnv: 'PAYMENTS_DRIVER',
    csp: {
      checkout: {
        'script-src': ['https://js.stripe.com', 'https://*.js.stripe.com'],
        'frame-src': [
          'https://js.stripe.com',
          'https://*.js.stripe.com',
          'https://hooks.stripe.com',
        ],
        'connect-src': ['https://api.stripe.com'],
      },
    },
    serverHosts: ['api.stripe.com', 'files.stripe.com'],
    avvCoveredBy: null,
  },
  {
    id: 'paypal',
    name: 'PayPal (Europe)',
    seat: {
      de: 'Luxemburg',
      en: 'Luxembourg',
    },
    role: 'controller',
    avv: 'notRequired',
    production: true,
    personalData: 'yes',
    thirdCountry: 'EU',
    activeFrom: 'P11',
    driverEnv: 'PAYMENTS_DRIVER',
    csp: {},
    serverHosts: [],
    avvCoveredBy: null,
  },
  {
    id: 'lettermint',
    name: 'Lettermint B.V.',
    seat: {
      de: 'Zwolle, Niederlande',
      en: 'Zwolle, Netherlands',
    },
    role: 'processor',
    avv: 'required',
    production: true,
    personalData: 'yes',
    thirdCountry: 'none',
    activeFrom: 'P11',
    driverEnv: 'EMAIL_DRIVER',
    csp: {},
    serverHosts: ['smtp.lettermint.co'],
    avvCoveredBy: null,
  },
  {
    id: 'ionos',
    name: 'IONOS SE (Domain, DNS, Postfach)',
    seat: {
      de: 'Montabaur, Deutschland',
      en: 'Montabaur, Germany',
    },
    role: 'processor',
    avv: 'required',
    production: true,
    personalData: 'yes',
    thirdCountry: 'none',
    activeFrom: 'P0',
    driverEnv: null,
    csp: {},
    serverHosts: [],
    avvCoveredBy: null,
  },
  {
    id: 'deepl',
    name: 'DeepL SE (API Free)',
    seat: {
      de: 'Köln, Deutschland',
      en: 'Cologne, Germany',
    },
    role: 'none',
    avv: 'notAvailable',
    production: true,
    personalData: 'no',
    thirdCountry: 'none',
    activeFrom: 'P11',
    driverEnv: 'TRANSLATION_DRIVER',
    csp: {},
    serverHosts: ['api-free.deepl.com'],
    avvCoveredBy: null,
  },
  {
    id: 'sentry',
    name: 'Sentry (EU-Region)',
    seat: {
      de: 'San Francisco, USA; EU-Region',
      en: 'San Francisco, USA; EU region',
    },
    role: 'processor',
    avv: 'required',
    production: true,
    personalData: 'minimal',
    thirdCountry: 'US',
    activeFrom: 'P11',
    driverEnv: 'SENTRY_DSN',
    csp: {},
    serverHosts: ['*.ingest.de.sentry.io'],
    avvCoveredBy: null,
  },
  {
    id: 'github',
    name: 'GitHub (nur Entwicklung)',
    seat: {
      de: 'San Francisco, USA',
      en: 'San Francisco, USA',
    },
    role: 'none',
    avv: 'notRequired',
    production: false,
    personalData: 'no',
    thirdCountry: 'US',
    activeFrom: 'P0',
    driverEnv: null,
    csp: {},
    serverHosts: [],
    avvCoveredBy: null,
  },
  {
    id: 'dhl',
    name: 'DHL Paket GmbH / Deutsche Post AG',
    seat: {
      de: 'Bonn, Deutschland',
      en: 'Bonn, Germany',
    },
    role: 'controller',
    avv: 'notRequired',
    production: true,
    personalData: 'yes',
    thirdCountry: 'none',
    activeFrom: 'P11',
    driverEnv: 'CARRIER_DRIVER',
    csp: {},
    serverHosts: [],
    avvCoveredBy: null,
  },
]
