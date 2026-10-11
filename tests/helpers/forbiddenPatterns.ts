// Verbotsmuster für Quelltext/Inhalte (RECHT §5, V-xx), soweit sie sich per Textsuche prüfen lassen. Genutzt für
// `content/seed/**` (AK-SEED-13) und den Scan über `src/**` und `content/**` mit Allowlist
// (`tests/unit/legal/forbidden.unit.spec.ts`, P1.32). `FORBIDDEN_SOURCE_PATTERNS` ergänzt Muster, die nur im
// Quelltext sinnvoll sind (vorbelegte Häkchen, Einbettungen, Tracker, CAPTCHA, Personendaten in URLs).

import {
  FORBIDDEN_CONTENT_PATTERNS,
  type ForbiddenPattern,
} from '../../src/lib/legal/forbiddenContent'

export { FORBIDDEN_CONTENT_PATTERNS, type ForbiddenPattern }

const p = (id: string, source: string): ForbiddenPattern => ({ id, re: new RegExp(source, 'iu') })

/** Zusätzliche Quelltext-Muster (RECHT §5 V-03, V-04 `next/font/google`, V-05, V-06, V-07, V-22). */
export const FORBIDDEN_SOURCE_PATTERNS: readonly ForbiddenPattern[] = [
  p('V-03', String.raw`defaultChecked(?!\s*=\s*\{\s*false\s*\})|checked=\{\s*true\s*\}`),
  p('V-04', String.raw`next/font/google`),
  p(
    'V-05',
    String.raw`instagram\.com/(p|reel)/.*/embed|instgrm|youtube(-nocookie)?\.com/embed|player\.vimeo|google\.[a-z.]+/maps|maps\.googleapis|tile\.openstreetmap|open\.spotify\.com/embed|w\.soundcloud`,
  ),
  p('V-06', String.raw`recaptcha|hcaptcha|challenges\.cloudflare\.com|turnstile|friendlycaptcha`),
  p(
    'V-07',
    String.raw`googletagmanager|google-analytics|gtag\(|fbq\(|connect\.facebook\.net|analytics\.tiktok|hotjar|clarity\.ms|plausible|umami|matomo|mixpanel|posthog|segment\.(com|io)|@vercel/speed-insights`,
  ),
  p('V-22', String.raw`searchParams\.get\(['"](email|name|phone|address)`),
]
