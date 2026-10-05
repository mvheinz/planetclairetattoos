import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

import { localizedPath } from './src/lib/routes/paths'
import { shortLinks } from './src/lib/routes/registry'
import type { AppEnvName } from './src/lib/seo/robots'
import { staticHeaderRules, withoutPublicClientHints } from './src/lib/security/headers'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// `APP_ENV` wie `src/lib/env.ts` (ARCHITEKTUR §4.2); `next.config.ts` darf `process.env` lesen, `.env` ist hier geladen.
const appEnv = (process.env.APP_ENV || 'development') as AppEnvName

const nextConfig: NextConfig = {
  // Docker-Exit-Pfad (docs/ARCHITEKTUR.md): standalone nur, wenn das Dockerfile es anfordert.
  output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,
  // Vorschau-Export baut nach .next-preview, damit der Entwicklungsserver unberührt bleibt (ARCHITEKTUR §5.2).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Bildgrößen erzeugt Payload beim Hochladen (DATENMODELL §6.2); keine Laufzeit-Optimierung (ARCHITEKTUR §9.4).
  images: {
    unoptimized: true,
  },
  // Debug-Schalter der Tuschelinie (DESIGN §9.13) immer als Build-Konstante: Next inlinet `NEXT_PUBLIC_*` nur, wenn die
  // Variable gesetzt ist. Ohne `.env` (CI) bliebe `process.env.NEXT_PUBLIC_LEASH_DEBUG` sonst stehen, der Import von
  // `@/leash/debug` würde nicht entfernt und `__leash`/`__qa` lägen als Chunk in `.next/static` (check:no-debug).
  env: {
    NEXT_PUBLIC_LEASH_DEBUG: process.env.NEXT_PUBLIC_LEASH_DEBUG === '1' ? '1' : '',
  },
  // PDFs (P4.11/P4.12): @react-pdf/renderer serverseitig ungebündelt; die lokalen TTF-Schriften (src/lib/pdf/fonts)
  // gehören in jedes Server-Bundle, das PDFs rendert (Jobs, Rechtstext-Route).
  serverExternalPackages: ['@react-pdf/renderer'],
  // `react-dom/server` lädt `src/lib/react/staticMarkup.ts` zur Laufzeit am Bundler vorbei (Mails, nicht hydriertes
  // Menü/Fuß-HTML in jeder Seite – auch bei ISR-Erneuerung). Die Abhängigkeitsverfolgung sieht diesen Import nicht.
  outputFileTracingIncludes: {
    '/**': [
      './src/lib/pdf/fonts/*.ttf',
      './src/admin/pwa/*.png',
      './docs/recht/VVT.md',
      './node_modules/react-dom/{package.json,*.js,cjs/*.production.js}',
      './node_modules/react/{package.json,*.js,cjs/*.production.js}',
    ],
  },
  // 404 mit Seitenrahmen schon im HTML (src/app/global-not-found.tsx): das Wurzel-Layout liegt unter [locale].
  experimental: {
    globalNotFound: true,
  },
  // Rechtliche Kurz-URLs (R-010, ARCHITEKTUR §2.3 Nr. 1): 308 auf die kanonische DE-Route, ohne Spracherkennung
  // und ohne Cookie; läuft vor dem Proxy.
  async redirects() {
    return shortLinks.map((s) => ({
      source: s.path,
      destination: localizedPath(s.routeId, 'de'),
      permanent: true,
    }))
  },
  // Sicherheits-Header (ARCHITEKTUR §8.1): alle Antworten + CSP `public`, `/api/*` CSP `api`; außerhalb der Produktion
  // `X-Robots-Tag: noindex, nofollow` (AK-A-4-03). Nonce-Kontexte überschreibt `src/proxy.ts`.
  async headers() {
    return staticHeaderRules({ appEnv, nodeEnv: process.env.NODE_ENV })
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// Client-Hints von Payload nur für die Verwaltung (Tempo-Budget R01, P2.20; `withoutPublicClientHints`).
export default withoutPublicClientHints(
  withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false }),
)
