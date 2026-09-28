// Abfrage des Live-Zustands im Browser (ARCHITEKTUR §2.5, §9.3; PLAN P3.11). Die App reicht sie über `BehaviorHost` als
// `ctx.actions.productStatus` an das Modul `product-status` herein – so enthält die Vorschau-Laufzeit keinen Netzcode.
// Ohne Cookies (`credentials: 'omit'`), ohne Cache. Framework-frei.

export const STATUS_ENDPOINT = '/api/public/product-status'

export async function fetchProductStates(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${STATUS_ENDPOINT}?ids=${ids.join(',')}`, {
    credentials: 'omit',
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal,
  })
  return res.ok ? ((await res.json()) as Record<string, unknown>) : null
}
