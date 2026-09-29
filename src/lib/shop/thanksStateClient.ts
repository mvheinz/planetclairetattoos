// Abfrage des Zustands der Danke-Seite im Browser (ARCHITEKTUR §2.5, KONZEPT §4.12, PLAN P4.17). Die App reicht sie über
// `BehaviorHost` als `ctx.actions.thanksState` an das Modul `thanks-poll` herein – die Vorschau-Laufzeit enthält so
// keinen Netzcode. Nur eigene Pfade (`/api/checkout/<token>/state`), ohne Cache, ohne Referrer; setzt nie ein Cookie.
// Framework-frei.

const STATE_PATH = /^\/api\/checkout\/[A-Za-z0-9_-]{43}\/state$/

export async function fetchThanksState(url: string, signal?: AbortSignal): Promise<string | null> {
  if (!STATE_PATH.test(url)) return null
  const res = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: { accept: 'application/json' },
    signal,
  })
  if (!res.ok) return null
  const body = (await res.json()) as { state?: unknown }
  return typeof body.state === 'string' ? body.state : null
}
