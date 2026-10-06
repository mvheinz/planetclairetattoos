// Wartungsmodus (ARCHITEKTUR §5.2/§10.5, KONZEPT R26, RECHT R-090, Annahme KA-30): reine Entscheidungen und die schlichte
// 503-Seite des Proxys. Ohne Framework-Importe außer `Response`; keine Cookies, keine Drittanbieter, kein JavaScript.
import { localizedPath, matchRoute, splitLocale } from '../routes/paths'
import type { Locale } from '../routes/registry'

/** Seiten, die im Wartungsmodus erreichbar bleiben: Impressum, Datenschutz, AGB, Widerrufsbelehrung, „Vertrag widerrufen“. */
export const MAINTENANCE_OPEN_ROUTES = ['R21', 'R22', 'R23', 'R24', 'R26'] as const

/** Ist die öffentliche Seite `pathname` (mit Sprachpräfix) im Wartungsmodus gesperrt (→ 503)? */
export function isBlockedInMaintenance(pathname: string): boolean {
  const split = splitLocale(pathname)
  if (!split) return true
  const match = matchRoute(split.rest, split.locale)
  return !match || !(MAINTENANCE_OPEN_ROUTES as readonly string[]).includes(match.route.id)
}

/** Antwort für gesperrte Schnittstellen (Webhook, Kasse, Formulare): 503 mit `Retry-After`, ohne Körper-Details. */
export const maintenanceApiResponse = (): Response =>
  new Response('Service Unavailable (maintenance)', {
    status: 503,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '3600',
    },
  })

const TEXT: Record<
  Locale,
  { title: string; lead: string; more: string; links: [string, string][]; withdraw: string }
> = {
  de: {
    title: 'Planet Claire macht gerade kurz Pause',
    lead: 'Hier wird gerade aufgeräumt und umgebaut. In Kürze bin ich wieder da – schau bitte später noch einmal vorbei.',
    more: 'Das hier bleibt offen:',
    links: [
      ['R21', 'Impressum'],
      ['R22', 'Datenschutz'],
      ['R23', 'AGB'],
      ['R24', 'Widerrufsbelehrung'],
    ],
    withdraw: 'Vertrag widerrufen',
  },
  en: {
    title: 'Planet Claire is taking a short break',
    lead: 'I am tidying up and rebuilding a few things. I will be back soon – please check again a little later.',
    more: 'These pages stay open:',
    links: [
      ['R21', 'Legal notice'],
      ['R22', 'Privacy'],
      ['R23', 'Terms'],
      ['R24', 'Right of withdrawal'],
    ],
    withdraw: 'Withdraw from contract here',
  },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** Schlichte 503-Seite in Juttas Ton mit den Pflichtlinks im Fußbereich (R-090, AK-3-11). */
export function maintenancePage(locale: Locale): Response {
  const t = TEXT[locale]
  const links = t.links
    .map(([id, label]) => `<li><a href="${esc(localizedPath(id, locale))}">${esc(label)}</a></li>`)
    .join('')
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(t.title)}</title>
<style>:root{color-scheme:light dark}body{margin:0;font:18px/1.55 Georgia,serif;background:#faf7f2;color:#1c1b1a}
@media (prefers-color-scheme:dark){body{background:#161514;color:#f1ece4}}
main,footer{max-width:34rem;margin:0 auto;padding:2rem 16px}a{color:inherit}
ul{padding-left:1.2rem}footer a.w{display:inline-block;min-height:44px;line-height:44px;padding:0 1rem;border:1px solid currentColor;border-radius:8px;text-decoration:none}</style>
</head><body>
<main data-maintenance=""><h1>${esc(t.title)}</h1><p>${esc(t.lead)}</p><p>${esc(t.more)}</p><ul>${links}</ul></main>
<footer data-site-footer=""><a class="w" data-withdraw-link="" href="${esc(localizedPath('R26', locale))}">${esc(t.withdraw)}</a></footer>
</body></html>`
  return new Response(html, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '3600',
    },
  })
}
