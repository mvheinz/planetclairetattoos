// Start-Prüfung der Umgebung beim Serverstart (ARCHITEKTUR §4.2/§4.3).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // AK-A-4-02: Nur hier ist die Erkennung über NODE_ENV erlaubt – ein Produktions-Start ohne APP_ENV bricht ab.
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.APP_ENV &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    throw new Error(
      'Start abgebrochen – APP_ENV fehlt (Produktions-Build ohne APP_ENV, ARCHITEKTUR §4.2).',
    )
  }
  const { assertProductionEnv, getEnv } = await import('./lib/env')
  assertProductionEnv(getEnv())
}
