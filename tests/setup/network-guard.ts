// Netzwerk-Wächter für Unit- und Int-Tests (ARCHITEKTUR §7.2, AK-A-3-01): nur 127.0.0.1, localhost und ::1
// (Ausnahme: Stripe-Testmodus nur auf ausdrücklichen Wunsch, siehe `STRIPE_TEST_API_ENV`).
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

export const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]', '::ffff:127.0.0.1'])

export class BlockedNetworkError extends Error {
  constructor(host: string) {
    super(
      `Netzwerk-Wächter: Verbindung zu „${host}“ blockiert – Tests dürfen nur localhost erreichen (ARCHITEKTUR §7.2).`,
    )
    this.name = 'BlockedNetworkError'
  }
}

/**
 * Einzige Ausnahme (P4.5, ARCHITEKTUR §7.2): der Stripe-Testmodus im Zahlungs-Kontrakttest – nur `api.stripe.com` und
 * nur, wenn `PC_TEST_ALLOW_STRIPE_API=1` ausdrücklich gesetzt ist (dazu ein `sk_test_…`; Live-Schlüssel verbietet die
 * Start-Prüfung außerhalb von Produktion).
 */
export const STRIPE_TEST_API_ENV = 'PC_TEST_ALLOW_STRIPE_API'
export const STRIPE_TEST_API_HOST = 'api.stripe.com'

export function isAllowedHost(host: string | undefined): boolean {
  if (!host) return true // Unix-Sockets / Pfade
  const h = host.toLowerCase()
  if (ALLOWED_HOSTS.has(h)) return true
  return h === STRIPE_TEST_API_HOST && process.env[STRIPE_TEST_API_ENV] === '1'
}

type ConnectArgs = Parameters<net.Socket['connect']>

function hostFromArgs(args: ConnectArgs): string | undefined {
  const [first, second] = args as unknown[]
  if (first && typeof first === 'object') {
    const o = first as { host?: string; path?: string }
    if (o.path) return undefined
    return o.host ?? 'localhost'
  }
  if (typeof first === 'number') return typeof second === 'string' ? second : 'localhost'
  if (typeof first === 'string') return undefined // IPC-Pfad
  return undefined
}

function requestHost(args: unknown[]): string | undefined {
  const [first, second] = args
  const fromUrl = (u: string | URL) => new URL(String(u)).hostname
  if (typeof first === 'string' || first instanceof URL) return fromUrl(first)
  const opts = (first ?? second) as
    { hostname?: string; host?: string; socketPath?: string } | undefined
  if (!opts || opts.socketPath) return undefined
  return (opts.hostname ?? opts.host ?? 'localhost').replace(/:\d+$/, '')
}

const marker = Symbol.for('planetclaire.networkGuard')

export function installNetworkGuard(): void {
  const g = globalThis as unknown as Record<symbol, boolean>
  if (g[marker]) return
  g[marker] = true

  const originalConnect = net.Socket.prototype.connect
  net.Socket.prototype.connect = function guardedConnect(this: net.Socket, ...args: ConnectArgs) {
    const host = hostFromArgs(args)
    if (!isAllowedHost(host)) throw new BlockedNetworkError(host ?? '?')
    return (originalConnect as (...a: ConnectArgs) => net.Socket).apply(this, args)
  } as net.Socket['connect']

  // http(s).request: Ziel-Host prüfen, auch wenn ein Proxy-Agent (z. B. global-agent) auf localhost umleitet.
  for (const mod of [http, https] as const) {
    for (const fn of ['request', 'get'] as const) {
      const original = mod[fn] as (...a: unknown[]) => http.ClientRequest
      ;(mod as unknown as Record<string, unknown>)[fn] = function guardedRequest(
        ...args: unknown[]
      ) {
        const host = requestHost(args)
        if (!isAllowedHost(host)) throw new BlockedNetworkError(host ?? '?')
        return original.apply(mod, args)
      }
    }
  }

  // fetch (undici) prüft den Host vor dem Verbindungsaufbau – klare Meldung statt DNS-Fehler.
  const originalFetch = globalThis.fetch
  if (originalFetch) {
    globalThis.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
      if (!isAllowedHost(url.hostname)) throw new BlockedNetworkError(url.hostname)
      return originalFetch(input, init)
    }) as typeof fetch
  }
}
