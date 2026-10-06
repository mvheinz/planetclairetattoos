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

// KI-/Text-und-Data-Mining-Vorbehalt (U-22 c, § 44b Abs. 3 UrhG): maschinenlesbar in `robots.txt` (eigene Gruppe für
// bekannte KI-Crawler), `/ai.txt`, `<meta name="robots" content="… noai, noimageai">` (indexierbare Seiten),
// `X-Robots-Tag: noai, noimageai` (Produktion) und TDMRep (`tdm-reservation: 1` als Header und Meta,
// `/.well-known/tdmrep.json`). Suchmaschinen (Googlebot, Bingbot …) bleiben erlaubt.

/** Bekannte Crawler für KI-Training und Datensammlung (Liste erweiterbar; `public/ai.txt` wird dagegen geprüft). */
export const AI_CRAWLERS: readonly string[] = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'GoogleOther',
  'PerplexityBot',
  'Bytespider',
  'Applebot-Extended',
  'FacebookBot',
  'meta-externalagent',
  'cohere-ai',
  'Diffbot',
  'ImagesiftBot',
  'Omgilibot',
  'Amazonbot',
  'AI2Bot',
  'Timpibot',
  'img2dataset',
]

/** Meta-/Header-Wert gegen KI-Nutzung (Konvention „noai“, „noimageai“). */
export const AI_ROBOTS_DIRECTIVES = 'noai, noimageai'

/** `X-Robots-Tag` nur in Produktion (sonst gilt `noindex, nofollow`): schließt KI-Nutzung aus, Indexierung bleibt. */
export function aiRobotsTag(appEnv: AppEnvName): string | null {
  return isIndexableEnv(appEnv) ? AI_ROBOTS_DIRECTIVES : null
}

/** TDMRep: Nutzungsvorbehalt als Header und Meta (W3C TDM Reservation Protocol). */
export const TDM_RESERVATION = { name: 'tdm-reservation', content: '1' } as const

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

export interface RobotsRule {
  userAgent: string | string[]
  allow?: string
  disallow: string | string[]
}

export interface RobotsRules {
  /** Außerhalb der Produktion eine Regel, in Produktion `*` plus die Gruppe der KI-Crawler. */
  rules: RobotsRule | RobotsRule[]
  sitemap?: string
}

/**
 * Inhalt von `/robots.txt`: Produktion `Allow: /` + Sperrliste + Sitemap und eine eigene Gruppe
 * `Disallow: /` für KI-Crawler, sonst `Disallow: /` für alle.
 */
export function robotsRules(appEnv: AppEnvName, siteUrl: string): RobotsRules {
  if (!isIndexableEnv(appEnv)) return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: disallowedPaths() },
      { userAgent: [...AI_CRAWLERS], disallow: '/' },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
