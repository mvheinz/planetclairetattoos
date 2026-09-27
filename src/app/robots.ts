import type { MetadataRoute } from 'next'

import { getEnv } from '@/lib/env'
import { robotsRules } from '@/lib/seo/robots'

// `/robots.txt` (KONZEPT §2.5, AK-2-04, AK-A-4-03): Produktion `Allow` + Sperrliste + Sitemap, sonst `Disallow: /`.
// Nie der Verwaltungspfad.
export default function robots(): MetadataRoute.Robots {
  const env = getEnv()
  return robotsRules(env.APP_ENV, env.NEXT_PUBLIC_SITE_URL)
}
