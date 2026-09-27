import { absoluteUrl, SITE_NAME } from './metadata'

// JSON-LD (KONZEPT §3.0.5, E-50): Startseite `Organization` mit Name, URL, Logo und `sameAs` Instagram – **ohne**
// Adresse. Ausgabe als `<script type="application/ld+json">` (Datenblock, wird nicht ausgeführt; `<` maskiert).

export const LOGO_PATH = '/art/wordmark.svg'

/** `instagram` = vollständige Profil-URL (`instagramUrl()` aus `src/lib/data/navigation.ts`). */
export function organizationJsonLd(instagram: string, siteUrl?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl('/', siteUrl),
    logo: absoluteUrl(LOGO_PATH, siteUrl),
    sameAs: [instagram],
  }
}

/** Serialisiert JSON-LD sicher für ein Inline-`<script>` (kein `</script>`-Ausbruch). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
