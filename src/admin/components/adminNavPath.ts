// Sichtbarer Pfad → Pfad relativ zur Verwaltung (für die Markierung der aktiven Ansicht). Im Browser steht
// `ADMIN_ROUTE/…`; beim Rendern auf dem Server kann Next den intern umgeschriebenen Pfad `/admin/…` liefern (Proxy,
// ARCHITEKTUR §8.4) – beide Präfixe werden entfernt.

const INTERNAL_MOUNT = '/admin'

export function relativeAdminPath(pathname: string | null | undefined, adminRoute: string): string {
  const path = pathname ?? ''
  for (const prefix of [adminRoute, INTERNAL_MOUNT]) {
    if (path === prefix) return '/'
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length)
  }
  return path || '/'
}
