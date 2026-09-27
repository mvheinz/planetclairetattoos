import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

import { localizedPath } from './src/lib/routes/paths'
import { shortLinks } from './src/lib/routes/registry'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // Docker-Exit-Pfad (docs/ARCHITEKTUR.md): standalone nur, wenn das Dockerfile es anfordert.
  output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,
  // Vorschau-Export baut nach .next-preview, damit der Entwicklungsserver unberührt bleibt (ARCHITEKTUR §5.2).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Bildgrößen erzeugt Payload beim Hochladen (DATENMODELL §6.2); keine Laufzeit-Optimierung (ARCHITEKTUR §9.4).
  images: {
    unoptimized: true,
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

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
