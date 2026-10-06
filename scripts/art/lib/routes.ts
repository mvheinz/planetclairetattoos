import { matchRoute, splitLocale } from '../../../src/lib/routes/paths'

// Route einer aufgenommenen URL (KUNST-QA §5: Szenario-Routen, Ruhezonen). Rein.

export interface ArtRoute {
  id: string
  preset: string | null
}

export function routeOf(url: string): ArtRoute | null {
  const pathname = url.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0] ?? '/'
  const split = splitLocale(pathname)
  if (!split) return null
  const m = matchRoute(split.rest || '/', split.locale)
  return m ? { id: m.route.id, preset: m.route.preset ?? null } : null
}

/** Ruhe-Routen ohne Bewegung (DESIGN §11.6, AK-DS-11): Preset `calm` und `legal`. */
export function isCalmRoute(url: string): boolean {
  const r = routeOf(url)
  return !!r && (r.preset === 'calm' || r.preset === 'legal')
}
