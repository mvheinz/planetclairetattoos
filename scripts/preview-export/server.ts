// Build und Server des Vorschau-Exports (ARCHITEKTUR §14.2 Nr. 3–4): `next build` mit der Export-Umgebung nach
// `.next-preview` (ohne NEXT_PUBLIC_LEASH_DEBUG, also ohne `__leash`), danach `next start -p 3999` auf 127.0.0.1 und
// Warten auf `/api/health` (höchstens 120 s). `stop()` beendet die ganze Prozessgruppe.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'

import { EXPORT_ORIGIN, EXPORT_PORT } from './env'
import { ExportError } from './errors'

export const HEALTH_TIMEOUT_MS = 120_000

export function buildApp(env: Record<string, string>): void {
  const buildEnv = { ...env }
  delete buildEnv.NEXT_PUBLIC_LEASH_DEBUG
  const res = spawnSync('pnpm', ['-s', 'build'], {
    stdio: 'inherit',
    env: buildEnv as NodeJS.ProcessEnv,
  })
  if (res.status !== 0) throw new ExportError(1, `next build fehlgeschlagen (Exit ${res.status}).`)
}

export interface RunningServer {
  origin: string
  stop(): Promise<void>
}

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean }>

/** Pollt `url` bis zur ersten Antwort 2xx; wirft nach `timeoutMs`. */
export async function waitForHealth(
  url: string,
  timeoutMs = HEALTH_TIMEOUT_MS,
  fetchFn: Fetch = fetch,
  intervalMs = 500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(5000) })
      if (res.ok) return
    } catch {
      // Server startet noch.
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new ExportError(1, `Server antwortet nicht innerhalb von ${timeoutMs / 1000} s auf ${url}.`)
}

export async function startServer(env: Record<string, string>): Promise<RunningServer> {
  // Ein alter Server auf Port 3999 würde sonst fälschlich als „bereit“ gelten.
  const stale = await fetch(`${EXPORT_ORIGIN}/api/health`, { signal: AbortSignal.timeout(2000) })
    .then(() => true)
    .catch(() => false)
  if (stale) {
    throw new ExportError(
      1,
      `Port ${EXPORT_PORT} ist schon belegt (läuft noch ein Export mit --keep-server?). Bitte den Prozess beenden.`,
    )
  }
  const child: ChildProcess = spawn(
    'pnpm',
    // Ohne `-H`: mit `-H 127.0.0.1` schreibt next-intl intern auf `localhost` um, Next leitet das als fremde Adresse
    // weiter und liefert 308-Schleifen (z. B. `/de/impressum`).
    ['exec', 'next', 'start', '-p', String(EXPORT_PORT)],
    { env: env as NodeJS.ProcessEnv, stdio: ['ignore', 'inherit', 'inherit'], detached: true },
  )
  let exited = false
  child.on('exit', () => {
    exited = true
  })
  const stop = async () => {
    if (exited || child.pid === undefined) return
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      return
    }
    const done = new Promise<void>((r) => child.once('exit', () => r()))
    const timer = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 10_000))
    if ((await Promise.race([done, timer])) === 'timeout') {
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        // schon beendet
      }
    }
  }
  try {
    await waitForHealth(`${EXPORT_ORIGIN}/api/health`)
  } catch (e) {
    await stop()
    throw e
  }
  if (exited) throw new ExportError(1, 'next start wurde vorzeitig beendet.')
  return { origin: EXPORT_ORIGIN, stop }
}
