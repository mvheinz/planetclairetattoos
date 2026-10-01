// Antwortform der Verwaltungs-Aktionen (PLAN P5.1, ARCHITEKTUR §2.4): Admin-Aktionen sind Payload-Custom-Endpoints in
// `src/endpoints/` und zustandsbasiert idempotent – ist der Zielzustand schon erreicht, antworten sie 200 mit
// `{ unchanged: true }` und lösen keine zweite Wirkung aus (keine zweite Mail, Rechnung oder Buchung). Der Knopf
// (`ActionButton`) zeigt dann „Das war schon erledigt – nichts geändert.“

export const ADMIN_NO_STORE = { 'cache-control': 'private, no-store' } as const

export interface AdminActionResult<T> {
  doc: T
  /** Zielzustand war schon erreicht, nichts geändert. */
  unchanged?: boolean
}

export function adminActionResponse<T>(
  result: AdminActionResult<T>,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json(
    { doc: result.doc, unchanged: result.unchanged === true, ...extra },
    { headers: ADMIN_NO_STORE },
  )
}

/** PDF für die Verwaltung (Packzettel, Etikett; nie im geteilten Cache). */
export function pdfResponse(data: Buffer, filename: string): Response {
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      ...ADMIN_NO_STORE,
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${filename}"`,
      'content-length': String(data.length),
      'x-content-type-options': 'nosniff',
    },
  })
}
