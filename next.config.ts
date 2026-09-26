import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

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

export default withPayload(nextConfig, { devBundleServerPackages: false })
