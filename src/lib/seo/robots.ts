// Robots-Regeln (KONZEPT §2.5, ARCHITEKTUR §4.2, P2.11) als reine Daten ohne Framework-Importe und ohne Pfad-Aliasse –
// `next.config.ts` (Header), `src/app/robots.ts` und Tests importieren diese Datei. Der Verwaltungspfad (`ADMIN_ROUTE`)
// taucht hier nie auf (AK-2-04): Verwaltungsantworten tragen stattdessen `X-Robots-Tag: noindex, nofollow`.
import { localizedPath, pageRoutes } from '../routes/paths'
import { LOCALES } from '../routes/registry'

export type AppEnvName = 'development' | 'test' | 'preview' | 'staging' | 'production'

/** Nur `production` ist indexierbar (ARCHITEKTUR §4.2). */
export const isIndexableEnv = (appEnv: AppEnvName) => appEnv === 'production'

/** Header `X-Robots-Tag` für **alle** Antworten außerhalb der Produktion, sonst keiner. */
export function xRobotsTag(appEnv: AppEnvName): string | null {
  return isIndexableEnv(appEnv) ? null : 'noindex, nofollow'
}

/**
 * Gesperrte Pfade in Produktion: `/api/` und alle `noindex`-Seiten ohne `follow` (Korb, Kasse, Danke, Bestellstatus),
 * Muster mit Parametern als Präfix bis zum ersten Parameter (`/de/danke/`). R26 (`noindex, follow`) bleibt erlaubt,
 * damit Crawler die Meta-Angabe sehen.
 */
export function disallowedPaths(): string[] {
  const paths = pageRoutes()
    .filter((r) => r.robots === 'noindex')
    .flatMap((r) =>
      LOCALES.map((l) => {
        const pattern = r.paths![l]
        const cut = pattern.indexOf('[')
        return cut === -1 ? localizedPath(r.id, l) : `/${l}${pattern.slice(0, cut)}`
      }),
    )
  return ['/api/', ...paths]
}

export interface RobotsRules {
  rules: { userAgent: string; allow?: string; disallow: string | string[] }
  sitemap?: string
}

/** Inhalt von `/robots.txt`: Produktion `Allow: /` + Sperrliste + Sitemap, sonst `Disallow: /`. */
export function robotsRules(appEnv: AppEnvName, siteUrl: string): RobotsRules {
  if (!isIndexableEnv(appEnv)) return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: { userAgent: '*', allow: '/', disallow: disallowedPaths() },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
