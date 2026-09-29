// Aufruf eines Admin-Endpunkts aus der Verwaltung (PLAN P5.1, ARCHITEKTUR §2.4): `POST` mit JSON, Sitzungs-Cookie und
// einem Idempotenz-Schlüssel je Klick. Endpunkte sind zustandsbasiert idempotent – ist der Zielzustand schon erreicht,
// antworten sie 200 `{ unchanged: true }` ohne zweite Wirkung. Fehler kommen als `{ error }` mit deutscher Meldung.

import { adminText } from '../translations'

export interface AdminActionOutcome {
  /** `true`: Zielzustand war schon erreicht, nichts geändert. */
  unchanged?: boolean
  /** Eigene Erfolgsmeldung statt „Erledigt.“. */
  message?: string
}

export class AdminActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'AdminActionError'
  }
}

export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * `POST <url>` für eine Verwaltungs-Aktion. Wirft `AdminActionError` mit einem Text für Jutta
 * (Handlungsvorschlag steckt in `adminText('actionFailed')`).
 */
export async function postAdminAction<T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  body: Record<string, unknown> = {},
  { idempotencyKey = newIdempotencyKey(), fetchImpl = fetch } = {},
): Promise<T & AdminActionOutcome> {
  let res: Response
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AdminActionError(adminText('actionOffline'), 0)
  }
  const json = (await res.json().catch(() => ({}))) as T & AdminActionOutcome & { error?: string }
  if (!res.ok) {
    throw new AdminActionError(
      adminText('actionFailed', { message: json.error ?? res.statusText ?? String(res.status) }),
      res.status,
    )
  }
  return json
}
